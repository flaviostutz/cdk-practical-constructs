import { IVpc, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { RouteConfig } from '@asteasolutions/zod-to-openapi';
import z, { ZodSchema } from 'zod';

import { NetworkConfig } from './lambda/types';

let c = 0;

export const vpcFromConfig = (scope: Construct, config: NetworkConfig): IVpc => {
  if (!config) throw new Error("'config' is required");
  c += 1;
  // define VPC and Subnets
  return Vpc.fromVpcAttributes(scope, `vpc-${config.vpcId}-${c}`, {
    vpcId: config.vpcId,
    availabilityZones: config.availabilityZones,
    privateSubnetIds: config.privateSubnetIds,
    privateSubnetRouteTableIds: config.privateSubnetRouteTableIds,
  });
};

/**
 * Get Lambda Zod schema for validation of request event
 */
export const getLambdaEventSchema = (routeConfig: RouteConfig): ZodSchema => {
  return z.object({
    pathParameters: routeConfig.request?.params ?? z.undefined(),
    // FIXME finish implementation
    // headers: routeConfig.request?.headers,
    // body: routeConfig.request?.body?.content['application/json'].schema ?? null
  });
};
