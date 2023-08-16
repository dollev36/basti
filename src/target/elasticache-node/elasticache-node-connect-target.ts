import type { AwsElasticacheNode } from '#src/aws/elasticache/elasticache-types.js';

import { ConnectTargetBase } from '../connect-target.js';

import type { ConnectTargetBaseConstructorInput } from '../connect-target.js';

export class ElasticacheNodeClusterConnectTarget extends ConnectTargetBase {
  private readonly elasticacheNode: AwsElasticacheNode;

  constructor(
    input: ConnectTargetBaseConstructorInput & {
      elasticacheNode: AwsElasticacheNode;
    }
  ) {
    super(input);
    this.elasticacheNode = input.elasticacheNode;
  }

  async getHost(): Promise<string> {
    return this.elasticacheNode.host;
  }

  async getPort(): Promise<number> {
    return this.elasticacheNode.port;
  }

  protected async getSecurityGroupIds(): Promise<string[]> {
    return [];
  }
}
