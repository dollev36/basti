import inquirer from 'inquirer';

import { getDbClusters } from '#src/aws/rds/get-db-clusters.js';
import { getDbInstances } from '#src/aws/rds/get-db-instances.js';
import { getReplicationGroupsByClusterMode } from '#src/aws/elasticache/get-elasticache-replication-groups.js';
import { getCacheClusters } from '#src/aws/elasticache/get-elasticache-node.js';
import type { AwsDbCluster, AwsDbInstance } from '#src/aws/rds/rds-types.js';
import type { AwsElasticacheCluster } from '#src/aws/elasticache/elasticache-types.js';
import {
  parseNodeGroupResponse,
  parseNodeGroup,
} from '#src/aws/elasticache/parse-elasticache-response.js';
import type { Cli } from '#src/common/cli.js';
import { cli } from '#src/common/cli.js';
import { fmt } from '#src/common/fmt.js';
import type {
  DbClusterTargetInput,
  DbInstanceTargetInput,
  ElasticacheClusterTargetInput,
} from '#src/target/target-input.js';

import { getErrorDetail } from '../../error/get-error-detail.js';

import type { DistinctChoice } from 'inquirer';

export type AwsTargetInput =
  | DbInstanceTargetInput
  | DbClusterTargetInput
  | ElasticacheClusterTargetInput;

export async function promptForAwsTarget(
  commandType: string
): Promise<AwsTargetInput | undefined> {
  const { instances, clusters, elasticacheClusters, elasticacheNodes } =
    await getTargets();

  const { target } = await cli.prompt({
    type: 'list',
    name: 'target',
    message: 'Select target to connect to',
    choices: [
      ...toInstanceChoices(instances),
      ...toClusterChoices(clusters),
      ...toElasticacheClusterChoices(
        elasticacheClusters,
        commandType,
        elasticacheNodes
      ),
      ...getCustomChoices(),
    ],
  });

  return target;
}

async function getTargets(): Promise<{
  instances: AwsDbInstance[];
  clusters: AwsDbCluster[];
  elasticacheClusters: AwsElasticacheCluster[][];
  elasticacheNodes: AwsElasticacheCluster[];
}> {
  const subCli = cli.createSubInstance({ indent: 2 });

  cli.out(`${fmt.green('❯')} Retrieving connection targets:`);

  const instances = await getTargetResources(
    async () => await getDbInstances(),
    'DB instances',
    subCli
  );

  const clusters = await getTargetResources(
    async () => await getDbClusters(),
    'DB clusters',
    subCli
  );

  const elasticacheClusters = await getTargetResources(
    async () => await getReplicationGroupsByClusterMode(),
    'Elasticache clusters',
    subCli
  );

  const elasticacheNodes = await getTargetResources(
    async () => await getCacheClusters(),
    'Elasticache Nodes',
    subCli
  );
  return { instances, clusters, elasticacheClusters, elasticacheNodes };
}

function toInstanceChoices(instances: AwsDbInstance[]): DistinctChoice[] {
  if (instances.length === 0) {
    return [];
  }
  return [
    new inquirer.Separator('Database instances:'),
    ...instances.map(instance => toInstanceChoice(instance)),
  ];
}

function toClusterChoices(clusters: AwsDbCluster[]): DistinctChoice[] {
  if (clusters.length === 0) {
    return [];
  }
  return [
    new inquirer.Separator('Database clusters:'),
    ...clusters.map(cluster => toClusterChoice(cluster)),
  ];
}

function toElasticacheClusterChoices(
  clusters: AwsElasticacheCluster[][],
  commandType: string,
  elasticacheNodes: AwsElasticacheCluster[]
): DistinctChoice[] {
  if (clusters.length === 0) {
    return [];
  }
  return commandType === 'init'
    ? toInitElasticacheClusterChoices(clusters)
    : [
      new inquirer.Separator('Elasticache clusters:'),
      ...toConnectElasticacheClusterChoices(clusters, elasticacheNodes),
    ];
}

function toInitElasticacheClusterChoices(
  clusters: AwsElasticacheCluster[][]
): Array<DistinctChoice<ElasticacheClusterTargetInput>> {
  return [
    new inquirer.Separator('Elasticache clusters:'),
    ...clusters[0]!.map(cluster => toElasticacheClusterChoice(cluster)),
    ...clusters[1]!.map(cluster => toElasticacheClusterChoice(cluster)),
  ];
}

function toConnectElasticacheClusterChoices(
  clusters: AwsElasticacheCluster[][],
  elasticacheNodes: AwsElasticacheCluster[]
): Array<DistinctChoice<ElasticacheClusterTargetInput>> {
  const res: DistinctChoice[] = [];
  if (clusters[0]) {
    clusters[0].forEach(clusterModeEnabled => {
      if (clusterModeEnabled.ClusterMode === 'enabled') {
        res.push({
          name: clusterModeEnabled.identifier + '- Configuration Endpoint',
          value: { elasticacheCluster: clusterModeEnabled },
        });
      }
      res.push(
        ...toClusterModeEnabledChoicesFromNodeGroups(
          clusterModeEnabled,
          elasticacheNodes
        )
      );
    });
  }
  if (clusters[1]) {
    clusters[1].forEach(clusterModeDisabled => {
      res.push(
        ...toClusterModeDisabledChoicesFromNodeGroups(
          clusterModeDisabled,
          elasticacheNodes
        )
      );
    });
  }

  return res;
}
function getCustomChoices(): DistinctChoice[] {
  return [
    new inquirer.Separator(),
    {
      name: 'Custom',
      value: undefined,
    },
  ];
}

async function getTargetResources<T>(
  getResources: () => Promise<T[]>,
  resourceName: string,
  cli: Cli
): Promise<T[]> {
  try {
    cli.progressStart(resourceName);
    const resources = await getResources();
    cli.progressSuccess();
    return resources;
  } catch (error) {
    const warnText = getErrorDetail(error);

    cli.progressWarn({ warnText });
    return [];
  }
}

function toInstanceChoice(
  dbInstance: AwsDbInstance
): DistinctChoice<DbInstanceTargetInput> {
  return {
    name: dbInstance.identifier,
    value: {
      dbInstance,
    },
  };
}

function toClusterChoice(dbCluster: AwsDbCluster): DistinctChoice {
  return {
    name: dbCluster.identifier,
    value: {
      dbCluster,
    },
  };
}
function toElasticacheClusterChoice(
  elasticacheCluster: AwsElasticacheCluster
): DistinctChoice<ElasticacheClusterTargetInput> {
  return {
    name: elasticacheCluster.identifier,
    value: {
      elasticacheCluster,
    },
  };
}

function toClusterModeEnabledChoicesFromNodeGroups(
  elasticacheCluster: AwsElasticacheCluster,
  elasticacheNodes: AwsElasticacheCluster[]
): Array<DistinctChoice<ElasticacheClusterTargetInput>> {
  const choises: Array<{
    name: string;
    value: { elasticacheCluster: AwsElasticacheCluster };
  }> = [];
  elasticacheCluster.NodeGroups.forEach(NodeGroup => {
    if (NodeGroup.NodeGroupMembers && NodeGroup.NodeGroupMembers.length > 0)
      NodeGroup.NodeGroupMembers.forEach(NodeGroupMember => {
        // clusterMode Enabled
        const Node = elasticacheNodes.find(cache => {
          return cache.identifier === NodeGroupMember.CacheClusterId;
        })!;
        Node.replicationGroupId = elasticacheCluster.replicationGroupId;
        choises.push({
          name: '   '.concat(NodeGroupMember.CacheClusterId!),
          value: { elasticacheCluster: Node },
        });
      });
  });
  return [...choises];
}

function toClusterModeDisabledChoicesFromNodeGroups(
  elasticacheCluster: AwsElasticacheCluster,
  elasticacheNodes: AwsElasticacheCluster[]
): Array<DistinctChoice<ElasticacheClusterTargetInput>> {
  const choises: Array<{
    name: string;
    value: { elasticacheCluster: AwsElasticacheCluster };
  }> = [];

  const NodeGroup = elasticacheCluster.NodeGroups[0]!;
  const Parsed: AwsElasticacheCluster = parseNodeGroup(NodeGroup);
  Parsed.replicationGroupId = elasticacheCluster.replicationGroupId;

  const name =
    elasticacheCluster.replicationGroupId.concat('- Primary Endpoint');

  choises.push({
    name,

    value: { elasticacheCluster: Parsed },
  });

  if (NodeGroup.NodeGroupMembers && NodeGroup.NodeGroupMembers.length > 0)
    NodeGroup.NodeGroupMembers.forEach(member => {
      const Parsed: AwsElasticacheCluster = parseNodeGroupResponse(member);
      Parsed.replicationGroupId = elasticacheCluster.replicationGroupId;
      choises.push({
        name: '   '.concat(member.CacheClusterId!, ' - ', member.CurrentRole!),
        value: { elasticacheCluster: Parsed },
      });
    });
  return [...choises];
}
