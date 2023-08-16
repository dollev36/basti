import { DescribeCacheSubnetGroupsCommand } from '@aws-sdk/client-elasticache';

import { AwsNotFoundError } from '../common/aws-errors.js';

import { parseDbSubnetGroup } from './parse-elasticache-response.js';
import { elasticacheClient } from './elasticache-client.js';

import type { AwsDbSubnetGroup } from './elasticache-types.js';

export interface GetSubnetGroupInput {
  name: string | undefined;
}

export async function getCacheClusterSubnetGroup({
  name,
}: GetSubnetGroupInput): Promise<AwsDbSubnetGroup | undefined> {
  try {
    const { CacheSubnetGroups } = await elasticacheClient.send(
      new DescribeCacheSubnetGroupsCommand({
        CacheSubnetGroupName: name,
      })
    );

    if (!CacheSubnetGroups) {
      throw new Error(`Invalid response from AWS.`);
    }

    return CacheSubnetGroups.map(group => parseDbSubnetGroup(group))[0];
  } catch (error) {
    if (error instanceof AwsNotFoundError) {
      return undefined;
    }
    throw error;
  }
}
