import { z } from 'zod';

import type {
  ReplicationGroup,
  CacheNode,
  NodeGroupMember,
  NodeGroup,
  CacheSubnetGroup,
} from '@aws-sdk/client-elasticache';
import type {
  AwsElasticacheCluster,
  AwsDbSubnetGroup,
  AwsElasticacheNode,
} from './elasticache-types.js';

export function parseElasticacheResponse(
  response: ReplicationGroup
): AwsElasticacheCluster {
  return response.ClusterEnabled !== undefined && response.ClusterEnabled
    ? parseElasticacheReplicationGroupResponse(response)
    : parseElasticacheNodeResponse(response);
}

export const parseCacheNodeResponse: (
  response?: CacheNode
) => AwsElasticacheCluster = z
  .object({
    CacheNodeId: z.string(),
    Endpoint: z.object({
      Address: z.string(),
      Port: z.number(),
    }),
  })
  .transform(response => ({
    identifier: response.CacheNodeId,
    host: response.Endpoint.Address,
    port: response.Endpoint.Port,
    ClusterMode: 'enabled',
    NodeGroups: [],
    replicationGroupId: '',
  })).parse;

export const parseElasticacheNodeResponse: (
  response?: ReplicationGroup
) => AwsElasticacheNode = z
  .object({
    NodeGroups: z.any(),
    ReplicationGroupId: z.string(),
  })
  .transform(response => ({
    identifier: response.ReplicationGroupId,
    host: response.NodeGroups[0].PrimaryEndpoint.Address,
    port: response.NodeGroups[0].PrimaryEndpoint.Port,
    ClusterMode: 'disabled',
    NodeGroups: response.NodeGroups,
    replicationGroupId: response.ReplicationGroupId,
  })).parse;

export const parseElasticacheReplicationGroupResponse: (
  response?: ReplicationGroup
) => AwsElasticacheCluster = z
  .object({
    ReplicationGroupId: z.string(),
    ConfigurationEndpoint: z.object({
      Address: z.string(),
      Port: z.number(),
    }),
    ClusterMode: z.string(),
    NodeGroups: z.any(),
  })
  .transform(response => ({
    identifier: response.ReplicationGroupId,
    host: response.ConfigurationEndpoint.Address,
    port: response.ConfigurationEndpoint.Port,
    ClusterMode: response.ClusterMode,
    NodeGroups: response.NodeGroups,
    replicationGroupId: response.ReplicationGroupId,
  })).parse;

export const parseDbSubnetGroup: (
  response?: CacheSubnetGroup
) => AwsDbSubnetGroup = z
  .object({
    CacheSubnetGroupName: z.string(),
    VpcId: z.string(),
  })
  .transform(response => ({
    name: response.CacheSubnetGroupName,
    vpcId: response.VpcId,
  })).parse;

export const parseNodeGroupResponse: (
  response?: NodeGroupMember
) => AwsElasticacheNode = z
  .object({
    CacheClusterId: z.string(),
    ReadEndpoint: z.object({
      Address: z.string(),
      Port: z.number(),
    }),
    NodeGroups: z.any(),
  })
  .transform(response => ({
    identifier: response.CacheClusterId,
    host: response.ReadEndpoint.Address,
    port: response.ReadEndpoint.Port,
    ClusterMode: 'disabled',
    NodeGroups: [],
    replicationGroupId: '',
  })).parse;

export const parseNodeGroup: (response?: NodeGroup) => AwsElasticacheNode = z
  .object({
    NodeGroupId: z.string(),
    PrimaryEndpoint: z.object({
      Address: z.string(),
      Port: z.number(),
    }),
  })
  .transform(response => ({
    identifier: response.NodeGroupId,
    host: response.PrimaryEndpoint.Address,
    port: response.PrimaryEndpoint.Port,
    ClusterMode: 'disabled',
    NodeGroups: [],
    replicationGroupId: '',
  })).parse;
