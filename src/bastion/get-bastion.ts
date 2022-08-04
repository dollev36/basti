import { getEc2Instances } from "../aws/ec2/get-ec2-instances.js";
import {
  Bastion,
  BASTION_INSTANCE_ID_TAG_NAME,
  BASTION_INSTANCE_SECURITY_GROUP_NAME_PREFIX,
} from "./bastion.js";

export type GetBastionInput = {
  bastionId?: string;
  vpcId?: string;
};

export async function getBastion({
  bastionId,
  vpcId,
}: GetBastionInput): Promise<Bastion | undefined> {
  const [instance] = await getEc2Instances({
    tags: [
      {
        key: BASTION_INSTANCE_ID_TAG_NAME,
        value: bastionId || "*",
      },
    ],
    vpcId,
  });

  if (!instance) {
    return;
  }

  const id = instance.tags[BASTION_INSTANCE_ID_TAG_NAME];
  if (!id) {
    throw new Error(
      `Bastion instance doesn't have the required tag "${BASTION_INSTANCE_ID_TAG_NAME}".`
    );
  }

  const securityGroup = instance.securityGroups.find((group) =>
    group.name.startsWith(BASTION_INSTANCE_SECURITY_GROUP_NAME_PREFIX)
  );
  if (!securityGroup) {
    throw new Error(
      `Bastion instance doesn't have the required security group.`
    );
  }

  return {
    id,
    instance,
    securityGroupId: securityGroup.id,
    securityGroupName: securityGroup.name,
  };
}
