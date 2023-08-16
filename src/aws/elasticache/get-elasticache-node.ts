import { DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache';

import { parseCacheNodeResponse } from './parse-elasticache-response.js';
import { elasticacheClient } from './elasticache-client.js';

import type {
  AwsElasticacheCluster,
  AwsElasticacheNode,
} from './elasticache-types.js';

export async function getCacheClusters(): Promise<AwsElasticacheCluster[]> {
  const { CacheClusters } = await elasticacheClient.send(
    new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true })
  );

  if (!CacheClusters) {
    throw new Error(`Invalid response from AWS.`);
  }
  const res: AwsElasticacheNode[] = [];
  CacheClusters.forEach(nodeGroup => {
    nodeGroup.CacheNodes!.forEach(node => {
      node.CacheNodeId = nodeGroup.CacheClusterId;
    });
    res.push(
      ...nodeGroup.CacheNodes!.map(node => parseCacheNodeResponse(node))
    );
  });
  return res;
}
