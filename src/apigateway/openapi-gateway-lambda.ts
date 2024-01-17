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
} from 'aws-cdk-lib/aws-apigateway';
import type { oas30, oas31 } from 'openapi3-ts';
import { Construct } from 'constructs';
import { Size } from 'aws-cdk-lib';
import { ILogGroup, LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { OpenAPIRegistry, OpenApiGeneratorV31, RouteConfig } from '@asteasolutions/zod-to-openapi';
import { Converter } from '@apiture/openapi-down-convert';

import { lintOpenapiDocument } from '../utils/openapi-lint';
import { randomId } from '../utils/misc';

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

    const propsWithDefaults = getPropsWithDefaults(id, props);
    const { deployOptions, logGroupAccessLog } = addLogGroupForTracing(this, propsWithDefaults);

    addGatewayToLambdaPermissions(this, propsWithDefaults.openapiOperations);

    // zod-to-openapi only supports openapi 3.1
    let openapiDoc31 = generateOpenapiDocWithExtensions(propsWithDefaults);

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

    // SpecRestApi builds all of our lambda integrations based on openapi doc and extensions
    const specRestApi = new SpecRestApi(this, 'SpecRestApi', {
      ...propsWithDefaults,
      description: openapiDoc30.info.title,
      apiDefinition: ApiDefinition.fromInline(openapiDoc30),
      deployOptions,
    });

    this.specRestApi = specRestApi;
    this.openapiDocument = openapiDoc30;
    this.logGroupAccessLog = logGroupAccessLog;
  }
}

const addGatewayToLambdaPermissions = (
  scope: Construct,
  lambdaOperations: LambdaOperation[],
): void => {
  if (!lambdaOperations || lambdaOperations.length === 0) {
    throw new Error('lambdaOperations prop is required and should be non-empty');
  }
  lambdaOperations.forEach((lambdaOperation: LambdaOperation) => {
    lambdaOperation.lambdaAlias.addPermission('allow-apigw-to-lambda', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
    });
  });
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
  const hasPrivate = props.endpointTypes?.reduce(
    (cur, value) => cur || value === EndpointType.PRIVATE,
    false,
  );
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
            'aws:SourceVpce': props.vpcEndpointIds,
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
): oas31.OpenAPIObject => {
  // generate basic openapi document
  const registry = new OpenAPIRegistry();

  const lambdaOperationsMap: Record<string, LambdaOperation> = {};

  for (let i = 0; i < props.openapiOperations.length; i += 1) {
    const lambdaOperation = props.openapiOperations[i];

    registry.registerPath(lambdaOperation.routeConfig);
    let { operationId } = lambdaOperation.routeConfig;
    if (!operationId) {
      operationId = generateOperationId(lambdaOperation.routeConfig);
      lambdaOperation.routeConfig.operationId = operationId;
    }
    if (operationId) {
      lambdaOperationsMap[operationId] = lambdaOperation;
    } else {
      throw new Error("'operationId' should be defined");
    }
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
            // `arn:aws:lambda:\${AWS::Region}:\${AWS::AccountId}:function:my-function:${lambdaOp.lambdaAlias.aliasName}`
            uri: lambdaOp.lambdaAlias.functionArn,
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
    restApiName: id,

    // opiniated default props
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
