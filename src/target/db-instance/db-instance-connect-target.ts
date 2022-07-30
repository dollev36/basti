import { AwsDbInstance } from "../../aws/rds/rds-types.js";
import { ConnectTargetBase } from "../connect-target.js";

export class DbInstanceConnectTarget extends ConnectTargetBase {
  private readonly dbInstance: AwsDbInstance;

  constructor({ dbInstance }: { dbInstance: AwsDbInstance }) {
    super();
    this.dbInstance = dbInstance;
  }

  protected async getSecurityGroupIds(): Promise<string[]> {
    return this.dbInstance.securityGroupIds;
  }
}