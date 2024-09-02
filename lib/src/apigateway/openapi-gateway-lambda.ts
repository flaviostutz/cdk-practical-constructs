/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-param-reassign */

import {
  AccessLogFormat,
  ApiDefinition,
  EndpointType,
  LogGroupLogDestination,
  MethodLoggingLevel,
  SpecRestApi,
  SpecRestApiProps,
  StageOptions,
  CfnRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import type { oas30, oas31 } from 'openapi3-ts';
import { Construct } from 'constructs';
import { ArnFormat, ScopedAws, Size, Stack } from 'aws-cdk-lib/core';
import { ILogGroup, LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { OpenAPIRegistry, OpenApiGeneratorV31, RouteConfig } from '@asteasolutions/zod-to-openapi';
import { Converter } from '@apiture/openapi-down-convert';

import { lintOpenapiDocument } from '../utils/openapi-lint';
import { randomId } from '../utils/misc';

import { openapiOperationsSchema } from './schemas';
import { LambdaOperation, OpenApiGatewayLambdaProps } from './types';

/**
 * Rest API built from Openapi specs and aws extensions for running on Lambda functions with the following characteristics:
 *   - Uses API Gateway extensions for OpenAPI for connecting api routes to Lambdas (https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html)
 *   - Creates an AWS API Gateway along with multiple Lambdas for each route defined in OpenAPI spec
 *   - Uses api operations that supports Zod schemas in definitions (prop.openapiOperations)
 *   - An opiniated set of defaults that can be overwritten in props
 */
export class OpenApiGatewayLambda extends Construct {
  public readonly specRestApi: SpecRestApi;

  public readonly logGroupAccessLog?: ILogGroup;

  public readonly openapiDocument: oas30.OpenAPIObject;

  constructor(scope: Construct, id: string, props: OpenApiGatewayLambdaProps) {
    super(scope, id);

    validateOpenapiOperations(props.openapiOperations);

    const { region: awsRegion } = new ScopedAws(scope);

    const propsWithDefaults = getPropsWithDefaults(id, props);
    const { deployOptions, logGroupAccessLog } = addLogGroupForTracing(this, propsWithDefaults);

    // zod-to-openapi only supports openapi 3.1
    let openapiDoc31 = generateOpenapiDocWithExtensions(propsWithDefaults, awsRegion);

    const { openapiDoc31WithVPCE } = addVPCEndpointConfig(propsWithDefaults, openapiDoc31);
    openapiDoc31 = openapiDoc31WithVPCE;

    // cleanups
    if (openapiDoc31.webhooks && Object.keys(openapiDoc31.webhooks).length === 0) {
      // eslint-disable-next-line fp/no-delete
      delete openapiDoc31.webhooks;
    }

    // AWS Gateway only supports openapi 3.0, so downconvert doc from 3.1 to 3.0
    const converter = new Converter(openapiDoc31, {
      verbose: false,
      deleteExampleWithId: true,
      allOfTransform: false,
    });
    const openapiDoc30 = converter.convert() as oas30.OpenAPIObject;

    lintOpenapiDocument(openapiDoc30, true);

    // The api gateway does not appends the stackname/stage into it by default
    const apiGatewayId = `${id}-${props.stage}`;

    // SpecRestApi builds all of our lambda integrations based on openapi doc and extensions
    const specRestApi = new SpecRestApi(this, apiGatewayId, {
      ...propsWithDefaults,
      description: openapiDoc30.info.title,
      apiDefinition: ApiDefinition.fromInline(openapiDoc30),
      deployOptions,
    });

    addGatewayToLambdaPermissions(this, propsWithDefaults.openapiOperations, specRestApi);

    // Workaround to link the vpc endpoint ids top the api gateway > api settings
    // This should be removed when this issue is fixed
    // https://github.com/aws/aws-cdk/issues/9684
    const hasPrivate = props.endpointTypes?.some((value) => value === EndpointType.PRIVATE);
    if (hasPrivate) {
      (specRestApi.node.defaultChild as CfnRestApi).endpointConfiguration = {
        types: propsWithDefaults.endpointTypes ?? [EndpointType.PRIVATE],
        vpcEndpointIds: propsWithDefaults.vpcEndpointIds,
      };
    }

    this.specRestApi = specRestApi;
    this.openapiDocument = openapiDoc30;
    this.logGroupAccessLog = logGroupAccessLog;
  }
}

const validateOpenapiOperations = (operations: LambdaOperation[]): void => {
  const result = openapiOperationsSchema.safeParse(operations);

  if (!result.success) {
    const errorMessage = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`props.openapiOperations validation errors: ${errorMessage}`);
  }
};

const addGatewayToLambdaPermissions = (
  scope: Construct,
  lambdaOperations: LambdaOperation[],
  specRestApi: SpecRestApi,
): void => {
  const addedPermissionLambdaSet = new Set();
  const restApiArn = getRestApiExecutionArn(scope, specRestApi);

  lambdaOperations.forEach((lambdaOperation: LambdaOperation) => {
    // ? The `functionArn` refers to the ARN of the Lambda function's alias, not the ARN of the Lambda function itself.
    // ? The alias arn structure is `arn:aws:lambda:region:account-id:function:function-name:alias-name`
    const aliasArn = lambdaOperation.lambdaAlias.functionArn;

    if (addedPermissionLambdaSet.has(aliasArn)) {
      return;
    }

    addedPermissionLambdaSet.add(aliasArn);

    lambdaOperation.lambdaAlias.addPermission(`allow-apigw-${specRestApi.restApiName}`, {
      principal: new ServicePrincipal('apigateway.amazonaws.com', {
        conditions: {
          ArnLike: {
            'aws:SourceArn': restApiArn,
          },
        },
      }),
      action: 'lambda:InvokeFunction',
    });
  });
};

/**
 * This permission logic was extracted from `specRestApi.arnForExecuteApi()`
 * The arn structure is `arn:aws:execute-api:region:account-id:api-id/stage-name/http-method/resource-path`
 * But the integration with api gateway is failing with this arn, so we need to use the arn with the resource name with only 2 levels of path (i.e., stage-name/http-method)
 * This is the same strategy used in the `serverless` framework
 *
 * TODO: We need to further investigate it, and update the code to use `specRestApi.arnForExecuteApi()` directly
 */
const getRestApiExecutionArn = (scope: Construct, specRestApi: SpecRestApi): string => {
  const restApiArn = Stack.of(scope).formatArn({
    service: 'execute-api',
    resource: specRestApi.restApiId,
    arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    resourceName: `*/*`,
  });

  return restApiArn;
};

/**
 * Setup log groups for access log
 */
const addLogGroupForTracing = (
  scope: Construct,
  props: OpenApiGatewayLambdaProps,
): { deployOptions: StageOptions; logGroupAccessLog?: LogGroup } => {
  if (props.accessLogEnable && props.deployOptions) {
    throw new Error("When 'accessLogEnable' is defined, 'deployOptions' cannot be defined");
  }

  if (props.accessLogEnable) {
    const logGroupAccessLog = new LogGroup(scope, 'AccessLogGroup', {
      logGroupName: `apigateway-accesslogs-${scope.node.id}`,
      retention: props.accessLogRetention,
    });

    const deployOptionsAccessLog: StageOptions = {
      ...props.deployOptions,
      accessLogDestination: new LogGroupLogDestination(logGroupAccessLog),
      accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      loggingLevel: MethodLoggingLevel.INFO,
      dataTraceEnabled: false,
      tracingEnabled: true,
      metricsEnabled: props.deployOptions?.metricsEnabled ?? true,
    };

    return { deployOptions: deployOptionsAccessLog, logGroupAccessLog };
  }

  return {
    deployOptions: props.deployOptions ?? {
      metricsEnabled: true,
    },
  };
};

export const addVPCEndpointConfig = (
  props: OpenApiGatewayLambdaProps,
  openapiDoc31: oas31.OpenAPIObject,
): { openapiDoc31WithVPCE: oas31.OpenAPIObject } => {
  const hasPrivate = props.endpointTypes?.some((value) => value === EndpointType.PRIVATE);
  if (!hasPrivate) {
    return { openapiDoc31WithVPCE: openapiDoc31 };
  }

  if (!props.vpcEndpointIds || props.vpcEndpointIds.length === 0) {
    throw new Error("At least one 'vpcEndpoint' is required when any endpointType is PRIVATE");
  }

  const openapiDoc31WithVPCE = {
    ...openapiDoc31,
  };

  // add x-amazon-apigateway-endpoint-configuration connecting to VPCE
  openapiDoc31WithVPCE['x-amazon-apigateway-endpoint-configuration'] = {
    vpcEndpointIds: props.vpcEndpointIds,
  };

  // add x-amazon-apigateway-policy for VPCEndpoint permission
  const accessPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: 'execute-api:Invoke',
        Resource: ['execute-api:/*'],
        Condition: {
          StringEquals: {
            'aws:sourceVpce': props.vpcEndpointIds,
          },
        },
      },
    ],
  };
  openapiDoc31WithVPCE['x-amazon-apigateway-policy'] = accessPolicy;

  return { openapiDoc31WithVPCE };
};

export const generateOpenapiDocWithExtensions = (
  props: OpenApiGatewayLambdaProps,
  awsRegion: string,
): oas31.OpenAPIObject => {
  // generate basic openapi document
  const registry = new OpenAPIRegistry();

  const lambdaOperationsMap: Record<string, LambdaOperation> = {};

  for (let i = 0; i < props.openapiOperations.length; i += 1) {
    const lambdaOperation = props.openapiOperations[i];

    const operationId =
      lambdaOperation.routeConfig.operationId ?? generateOperationId(lambdaOperation.routeConfig);

    registry.registerPath({
      ...lambdaOperation.routeConfig,
      operationId,
    });

    lambdaOperationsMap[operationId] = lambdaOperation;
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const openapiDoc31 = generator.generateDocument(props.openapiBasic);

  // add aws extensions with default validators
  openapiDoc31['x-amazon-apigateway-request-validators'] = {
    requestparams: {
      validateRequestBody: true,
      validateRequestParameters: true,
    },
    request: {
      validateRequestBody: true,
      validateRequestParameters: false,
    },
    params: {
      validateRequestBody: false,
      validateRequestParameters: true,
    },
  };

  // add aws extension to each operation
  const traverse = (jsonObj: unknown): void => {
    if (jsonObj !== null && typeof jsonObj === 'object') {
      Object.entries(jsonObj).forEach(([key, value]) => {
        if (key === 'operationId') {
          const lambdaOp = lambdaOperationsMap[value as string];

          // add aws validator extension to operation
          // https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions-request-validator.html
          const validatorName = `${
            lambdaOp.awsExtensions?.enableRequestValidator ? 'request' : ''
          }${lambdaOp.awsExtensions?.enableParametersValidator ? 'params' : ''}`;
          if (validatorName) {
            // @ts-ignore
            jsonObj['x-amazon-apigateway-request-validator'] = validatorName;
          }

          // add aws lambda integration extension to operation
          // https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions-integration.html
          // @ts-ignore
          jsonObj['x-amazon-apigateway-integration'] = {
            // We need to use a api gw lambda invocation function to invocate the lambda we are integrating
            // https://stackoverflow.com/a/50696321
            uri: `arn:aws:apigateway:${awsRegion}:lambda:path/2015-03-31/functions/${lambdaOp.lambdaAlias.functionArn}/invocations`,
            // "passthroughBehavior": "when_no_match",
            httpMethod: 'POST',
            type: 'AWS_PROXY',
          };
        }

        // key is either an array index or object key
        traverse(value);
      });
    } else {
      // jsonObj is a number or string
    }
  };
  traverse(openapiDoc31);

  return openapiDoc31;
};

export const getPropsWithDefaults = (
  id: string,
  props: OpenApiGatewayLambdaProps,
): OpenApiGatewayLambdaProps & Pick<SpecRestApiProps, 'restApiName'> => {
  return {
    ...props,

    // opinionated default props
    minCompressionSize: props.minCompressionSize ?? Size.bytes(200000),
    accessLogRetention: props.accessLogRetention ?? RetentionDays.SIX_MONTHS,
    deploy: props.deploy ?? true,
  };
};

export const generateOperationId = (routeConfig: RouteConfig): string => {
  let str = `${routeConfig.path}-${routeConfig.method}`;
  str = str.replace(/^\//g, '');
  str = str.replaceAll(/\//g, '-');
  return `${str.replaceAll(/[^A-Za-z0-9-_]/g, '')}-${randomId(5)}`;
};

// function configureCloudwatchRoleForApi() {
//   const restApiCloudwatchRole = new iam.Role(scope, 'LambdaRestApiCloudWatchRole', {
//     assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
//     inlinePolicies: {
//       LambdaRestApiCloudWatchRolePolicy: new iam.PolicyDocument({
//         statements: [new iam.PolicyStatement({
//           actions: [
//             'logs:CreateLogGroup',
//             'logs:CreateLogStream',
//             'logs:DescribeLogGroups',
//             'logs:DescribeLogStreams',
//             'logs:PutLogEvents',
//             'logs:GetLogEvents',
//             'logs:FilterLogEvents'
//           ],
//           resources: [`arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*`]
//         })]
//       })
//     }
//   });
//   // Create and configure AWS::ApiGateway::Account with CloudWatch Role for ApiGateway
//   const CfnApi = api.node.findChild('Resource') as apigateway.CfnRestApi;
//   const cfnAccount: apigateway.CfnAccount = new apigateway.CfnAccount(scope, 'LambdaRestApiAccount', {
//     cloudWatchRoleArn: restApiCloudwatchRole.roleArn
//   });
//   cfnAccount.addDependency(CfnApi);
// }
// }
