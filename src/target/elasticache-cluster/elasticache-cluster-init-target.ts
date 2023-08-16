import {
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
} from '@aws-sdk/client-elasticache';

import { getCacheClusterSubnetGroup } from '#src/aws/elasticache/get-cache-clusters-subnet-group.js';
import { modifyElasticacheReplicationGroup } from '#src/aws/elasticache/modify-elasticache-replication-group.js';
import type { AwsElasticacheCluster } from '#src/aws/elasticache/elasticache-types.js';
import { elasticacheClient } from '#src/aws/elasticache/elasticache-client.js';
import { AwsNotFoundError, AwsError } from '#src/aws/common/aws-errors.js';

import { InitTargetBase } from '../init-target.js';

import type { DescribeCacheClustersCommandOutput } from '@aws-sdk/client-elasticache';

export class elasticacheClusterInitTarget extends InitTargetBase {
  private readonly elasticacheCluster: AwsElasticacheCluster;
  private readonly securityGroups: Promise<string[]>;
  private readonly elasticacheSubnetGroupName: Promise<string | undefined>;
  private readonly detaliedInformationCluster: Promise<DescribeCacheClustersCommandOutput>;
  constructor({
    elasticacheCluster,
  }: {
    elasticacheCluster: AwsElasticacheCluster;
  }) {
    super();
    this.elasticacheCluster = elasticacheCluster;
    this.detaliedInformationCluster = this.getDescribedCacheCluster();
    this.elasticacheSubnetGroupName = this.getSubnetGroupName();
    this.securityGroups = this.getSecurityGroupIds();
  }

  getId(): string {
    return this.elasticacheCluster.identifier;
  }

  async getVpcId(): Promise<string> {
    const subnetGroupName = await this.elasticacheSubnetGroupName;
    if (subnetGroupName === undefined) {
      throw AwsError;
    }

    const dbSubnetGroup = await getCacheClusterSubnetGroup({
      name: subnetGroupName,
    });

    if (!dbSubnetGroup) {
      throw new Error(`Cluster subnet group "${subnetGroupName}" not found`);
    }

    return dbSubnetGroup.vpcId;
  }

  protected getTargetPort(): number {
    return this.elasticacheCluster.port;
  }

  protected async getSecurityGroupIds(): Promise<string[]> {
    const detailedCache = await this.detaliedInformationCluster;
    if (detailedCache.CacheClusters === undefined) {
      throw AwsNotFoundError;
    }
    const array: string[] = [];
    if (detailedCache.CacheClusters[0]?.SecurityGroups !== undefined)
      detailedCache.CacheClusters[0]?.SecurityGroups?.forEach(element => {
        if (element.SecurityGroupId !== undefined)
          array.push(element.SecurityGroupId);
      });
    return array;
  }

  protected async getDescribedCacheCluster(): Promise<DescribeCacheClustersCommandOutput> {
    const cluster = await elasticacheClient.send(
      new DescribeReplicationGroupsCommand({
        ReplicationGroupId: this.elasticacheCluster.identifier,
      })
    );
    const cacheId =
      cluster.ReplicationGroups![0]?.NodeGroups![0]?.NodeGroupMembers![0]
        ?.CacheClusterId;
    const node = await elasticacheClient.send(
      new DescribeCacheClustersCommand({ CacheClusterId: cacheId })
    );
    if (node.CacheClusters?.length === 0) {
      throw AwsNotFoundError;
    }
    return node;
  }

  protected async getSubnetGroupName(): Promise<string | undefined> {
    const detailedCache = await this.detaliedInformationCluster;
    return detailedCache.CacheClusters![0]?.CacheSubnetGroupName;
  }

  protected async attachSecurityGroup(securityGroupId: string): Promise<void> {
    const securityGroups = await this.securityGroups;
    const detailedCache = await this.detaliedInformationCluster;
    await (this.elasticacheCluster.ClusterMode === 'enabled'
      ? modifyElasticacheReplicationGroup({
          identifier: this.elasticacheCluster.identifier,
          securityGroupIds: [...securityGroups, securityGroupId],
          cachePreviousSecurityGroups: [],
        })
      : modifyElasticacheReplicationGroup({
          identifier: detailedCache.CacheClusters![0]?.ReplicationGroupId,
          securityGroupIds: [...securityGroups, securityGroupId],
          cachePreviousSecurityGroups: [],
        }));
  }
}
