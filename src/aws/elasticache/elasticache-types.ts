import type { NodeGroup } from '@aws-sdk/client-elasticache';

export interface AwsElasticacheCluster {
  identifier: string;
  ClusterMode: string;
  replicationGroupId: string;
  NodeGroups: NodeGroup[];
  host: string;
  port: number;
}

export interface AwsElasticacheNode {
  identifier: string;
  ClusterMode: string;
  NodeGroups: NodeGroup[];
  replicationGroupId: string;
  host: string;
  port: number;
}

export interface AwsDbSubnetGroup {
  name: string;
  vpcId: string;
}
