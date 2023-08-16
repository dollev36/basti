import {
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
} from '@aws-sdk/client-elasticache';

import { AwsDependencyViolationError } from '../aws/common/aws-errors.js';
import { deleteSecurityGroup } from '../aws/ec2/delete-security-group.js';
import { getDbClusters } from '../aws/rds/get-db-clusters.js';
import { getDbInstances } from '../aws/rds/get-db-instances.js';
import { modifyDBCluster } from '../aws/rds/modify-db-cluster.js';
import { modifyDbInstance } from '../aws/rds/modify-db-instance.js';
import { retry } from '../common/retry.js';
import { elasticacheClient } from '../aws/elasticache/elasticache-client.js';
import { modifyElasticacheReplicationGroup } from '../aws/elasticache/modify-elasticache-replication-group.js';

import type {
  CacheCluster,
  ReplicationGroup,
} from '@aws-sdk/client-elasticache';
import type {
  ResourcesCleanupPreparer,
  ResourceCleaner,
} from './resource-cleaner.js';

export const accessSecurityGroupReferencesCleaner: ResourcesCleanupPreparer =
  async groupIds => {
    const groupIdSet = new Set(groupIds);
    await cleanupDbInstanceReferences(groupIdSet);
    await cleanupDbClusterReferences(groupIdSet);
    await CleanupElasticacheSecurityGroups(groupIdSet);
  };

export const securityGroupCleaner: ResourceCleaner = async groupId => {
  await retry(async () => await deleteSecurityGroup({ groupId }), {
    delay: 3000,
    maxRetries: 15,
    shouldRetry: error => error instanceof AwsDependencyViolationError,
  });
};

async function cleanupDbInstanceReferences(
  securityGroupIds: Set<string>
): Promise<void> {
  const dbInstances = await getDbInstances();

  const dbInstancesWithReferences = dbInstances.filter(instance =>
    arrayContains(instance.securityGroupIds, securityGroupIds)
  );
  if (dbInstancesWithReferences.length === 0) {
    return;
  }

  for (const dbInstance of dbInstancesWithReferences) {
    await modifyDbInstance({
      identifier: dbInstance.identifier,
      securityGroupIds: filterOut(
        dbInstance.securityGroupIds,
        securityGroupIds
      ),
    });
  }
}

async function cleanupDbClusterReferences(
  securityGroupsIds: Set<string>
): Promise<void> {
  const dbClusters = await getDbClusters();

  const dbClustersWithReferences = dbClusters.filter(cluster =>
    arrayContains(cluster.securityGroupIds, securityGroupsIds)
  );
  if (dbClustersWithReferences.length === 0) {
    return;
  }

  for (const dbCluster of dbClustersWithReferences) {
    await modifyDBCluster({
      identifier: dbCluster.identifier,
      securityGroupIds: filterOut(
        dbCluster.securityGroupIds,
        securityGroupsIds
      ),
    });
  }
}

function arrayContains(arr: string[], set: Set<string>): boolean {
  return arr.some(el => set.has(el));
}

function filterOut(arr: string[], set: Set<string>): string[] {
  return arr.filter(el => !set.has(el));
}

export async function CleanupElasticacheSecurityGroups(
  groupIds: Set<string>
): Promise<void> {
  const { CacheClusters } = await elasticacheClient.send(
    new DescribeCacheClustersCommand({})
  );
  const { ReplicationGroups } = await elasticacheClient.send(
    new DescribeReplicationGroupsCommand({})
  );
  if (!CacheClusters || !ReplicationGroups) {
    throw new Error(`Invalid response from AWS.`);
  }
  for (const ReplicationGroup of ReplicationGroups) {
    await cleanReplicationGroup(ReplicationGroup, CacheClusters, groupIds);
  }
}
async function cleanReplicationGroup(
  replicationGroup: ReplicationGroup,
  CacheClusters: CacheCluster[],
  groupIds: Set<string>
): Promise<void> {
  const exampleCacheCluster =
    replicationGroup.NodeGroups![0]!.NodeGroupMembers![0]!.CacheClusterId;
  const cacheSecurityGroups = CacheClusters.find(
    cache => cache.CacheClusterId === exampleCacheCluster
  )!.SecurityGroups!;
  const cacheSecurityGroupsId: Set<string> = new Set<string>();
  cacheSecurityGroups.map(group => {
    if (group.SecurityGroupId !== undefined)
      cacheSecurityGroupsId.add(group.SecurityGroupId);
    return true;
  });
  groupIds.forEach(Id => cacheSecurityGroupsId.delete(Id));
  if (cacheSecurityGroupsId.size !== cacheSecurityGroups.length) {
    await modifyElasticacheReplicationGroup({
      identifier: replicationGroup.ReplicationGroupId,
      securityGroupIds: [...cacheSecurityGroupsId],
      cachePreviousSecurityGroups: cacheSecurityGroups,
    });
  }
}
