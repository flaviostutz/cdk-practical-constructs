import { EndpointType, SpecRestApiProps } from 'aws-cdk-lib/aws-apigateway';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { IAlias } from 'aws-cdk-lib/aws-lambda';
import { OpenAPIObjectConfigV31 } from '@asteasolutions/zod-to-openapi/dist/v3.1/openapi-generator';

/**
 * Props for OpenApiGatewayLambda construct
 */
export type OpenApiGatewayLambdaProps = Omit<
  // the omitted attributes are defined by the openapi spec itself
  SpecRestApiProps,
  'apiDefinition' | 'restApiName' | 'description' | 'endpointConfiguration'
> & {
  /**
   * Endpoint type for the API. Will be used to configure API Gateway via AWS extensions.
   * defaults to EDGE
   */
  endpointTypes?: EndpointType[];
  /**
   * VPC Endpoint ids allowed to access the API. Will be used to configure API Gateway via AWS extensions.
   * Only allowed if endpointType is PRIVATE
   */
  vpcEndpointIds?: string[];
  /**
   * Log API access to a Cloudwatch Log Group
   * defaults to false
   */
  accessLogEnable?: boolean;
  accessLogRetention?: RetentionDays;
  openapiBasic: OpenAPIBasic;
  openapiOperations: LambdaOperation[];
};

export type OpenAPIBasic = OpenAPIObjectConfigV31;

export type AwsExtensions = {
  enableParametersValidator?: boolean;
  enableRequestValidator?: boolean;
};

type LambdaAlias = IAlias;

export type LambdaOperation = {
  routeConfig: RouteConfig;
  lambdaAlias: LambdaAlias;
  awsExtensions?: AwsExtensions;
};
