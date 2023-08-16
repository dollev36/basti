import { DescribeReplicationGroupsCommand } from '@aws-sdk/client-elasticache';

import { AwsNotFoundError } from '../common/aws-errors.js';

import { parseElasticacheResponse } from './parse-elasticache-response.js';
import { elasticacheClient } from './elasticache-client.js';

import type { AwsElasticacheCluster } from './elasticache-types.js';

export interface getReplicationGroupsInput {
  identifier: string;
}

export async function getReplicationGroups(): Promise<AwsElasticacheCluster[]> {
  const { ReplicationGroups } = await elasticacheClient.send(
    new DescribeReplicationGroupsCommand({})
  );

  if (!ReplicationGroups) {
    throw new Error(`Invalid response from AWS.`);
  }

  return ReplicationGroups.map(cluster => parseElasticacheResponse(cluster));
}

export async function getReplicationGroupsByClusterMode(): Promise<
  AwsElasticacheCluster[][]
> {
  const { ReplicationGroups } = await elasticacheClient.send(
    new DescribeReplicationGroupsCommand({})
  );

  if (!ReplicationGroups) {
    throw new Error(`Invalid response from AWS.`);
  }
  const ClusterModeDisabled = ReplicationGroups.map(cluster =>
    parseElasticacheResponse(cluster)
  ).filter(cluster => cluster.ClusterMode === 'disabled');
  const ClusterModeEnabled = ReplicationGroups.map(cluster =>
    parseElasticacheResponse(cluster)
  ).filter(cluster => cluster.ClusterMode === 'enabled');
  return [ClusterModeEnabled, ClusterModeDisabled];
}

export async function getReplicationGroup({
  identifier,
}: getReplicationGroupsInput): Promise<AwsElasticacheCluster | undefined> {
  try {
    const { ReplicationGroups } = await elasticacheClient.send(
      new DescribeReplicationGroupsCommand({ ReplicationGroupId: identifier })
    );

    if (!ReplicationGroups) {
      throw new Error(`Invalid response from AWS.`);
    }

    return ReplicationGroups.map(cluster =>
      parseElasticacheResponse(cluster)
    )[0];
  } catch (error) {
    if (error instanceof AwsNotFoundError) {
      return undefined;
    }
    throw error;
  }
}
