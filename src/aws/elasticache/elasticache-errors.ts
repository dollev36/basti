import { ElastiCacheServiceException } from '@aws-sdk/client-elasticache';

import {
  AwsAccessDeniedError,
  AwsNotFoundError,
  AwsError,
} from '../common/aws-errors.js';

export async function elasticacheErrorHandler<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof ElastiCacheServiceException &&
      error.name === 'AccessDenied'
    ) {
      throw new AwsAccessDeniedError();
    }
    if (
      error instanceof ElastiCacheServiceException &&
      (error.name === 'CacheClusterNotFoundFault' ||
        error.name === 'ReplicationGroupNotFoundFault' ||
        error.name === 'CacheSubnetGroupNotFoundFault')
    ) {
      throw new AwsNotFoundError();
    }
    if (
      error instanceof ElastiCacheServiceException &&
      error.name === 'InvalidParameterCombination' &&
      error.message.toLowerCase().includes('securitygroup')
    ) {
      throw new AwsTooManySecurityGroupsAttachedError();
    }
    throw error;
  }
}

export class AwsTooManySecurityGroupsAttachedError extends AwsError {
  constructor() {
    super(`Too many security groups attached`);
  }
}
