/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-mutating-methods */
import {
  OpenAPIRegistry,
  RouteConfig,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import type { oas30, oas31 } from 'openapi3-ts';
import { Converter } from '@apiture/openapi-down-convert';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { Construct } from 'constructs';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';

import { BaseNodeJsFunction } from '../lambda/lambda-base';
import { BaseNodeJsProps, EventType } from '../lambda/types';
import { lintOpenapiDocument } from '../utils/openapi-lint';

import { LambdaOperation, OpenApiGatewayLambdaProps } from './types';
import {
  OpenApiGatewayLambda,
  addVPCEndpointConfig,
  generateOpenapiDocWithExtensions,
  generateOperationId,
  getPropsWithDefaults,
} from './openapi-gateway-lambda';

extendZodWithOpenApi(z);

const defaultLambdaConfig: BaseNodeJsProps = {
  stage: 'dev',
  network: {
    vpcId: 'aaa',
    availabilityZones: ['a'],
    privateSubnetIds: ['a'],
    privateSubnetRouteTableIds: ['a'],
  },
  eventType: EventType.Http,
  entry: 'src/apigateway/__tests__/http/test-lambda/index.ts',
};

describe('openapi-gateway-lambda', () => {
  it('minimal OpenApiGatewayLambda should work', async () => {
    const app = new App();
    const stack = new Stack(app);

    const openapiOperations: LambdaOperation[] = [];

    // user get test operation
    const userGetOperation = testUserGetOperation(stack, defaultLambdaConfig);
    openapiOperations.push(userGetOperation);

    // create rest api
    const apigw = new OpenApiGatewayLambda(stack, 'myapi', {
      stage: 'tst',
      openapiBasic: {
        openapi: '3.0.3',
        info: {
          title: 'test api',
          version: 'v1',
        },
      },
      openapiOperations,
    });

    // execute synth and test results
    const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));

    expect(apigw.node.id).toBe('myapi');
    expect(apigw.specRestApi.node.id).toBe('myapi-tst');
    expect(apigw.logGroupAccessLog).toBeUndefined();

    // apigw allowed to call lambda
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      FunctionName: {
        Ref: stack.getLogicalId(userGetOperation.lambdaAlias.node.defaultChild as CfnFunction),
      },
      Principal: 'apigateway.amazonaws.com',
    });

    // routes and schemas defined in rest api
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Body: {
        info: {
          title: 'test api',
        },
        paths: {
          '/users/{id}': {
            get: {
              parameters: [
                {
                  schema: {
                    type: 'string',
                    example: '1212121',
                  },
                  in: 'path',
                },
                {
                  schema: {
                    type: 'string',
                  },
                  name: 'x-special-header',
                  in: 'header',
                },
              ],
            },
          },
        },
      },
    });

    // cloudwatch metrics enabled by default
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      MethodSettings: [
        {
          MetricsEnabled: true,
        },
      ],
    });
  });

  it('complex OpenApiGatewayLambda should work', async () => {
    const app = new App();
    const stack = new Stack(app);

    // add lambda operations
    const openapiOperations: LambdaOperation[] = [];
    openapiOperations.push(testUserGetOperation(stack, defaultLambdaConfig));
    openapiOperations.push(testUserPostOperation(stack, defaultLambdaConfig));

    // create rest api
    const apigw = new OpenApiGatewayLambda(stack, 'myapi', {
      stage: 'tst',
      openapiBasic: {
        openapi: '3.0.3',
        info: {
          title: 'test api',
          version: 'v1',
        },
        servers: [{ url: 'https://test.com/api' }],
        tags: [{ name: 'tag1' }],
      },
      accessLogEnable: true,
      accessLogRetention: RetentionDays.ONE_MONTH,
      endpointExportName: 'myapi-endpoint',
      endpointTypes: [EndpointType.PRIVATE],
      vpcEndpointIds: ['vpce-123123'],
      openapiOperations,
    });

    expect(apigw.specRestApi).toBeDefined();
    expect(apigw.logGroupAccessLog).toBeDefined();

    // execute synth and test results
    const template = Template.fromStack(stack);
    const templateStr = JSON.stringify(template.toJSON());

    // console.log(JSON.stringify(template.toJSON(), null, 2));

    expect(templateStr.indexOf('myapi-endpoint')).not.toBe(-1);

    // check aws extension for vpces in api gateway
    expectContain(
      templateStr,
      `"x-amazon-apigateway-endpoint-configuration": {
      "vpcEndpointIds": [
        "vpce-123123"
      ]
    },`,
    );

    expectContain(
      templateStr,
      `"x-amazon-apigateway-policy": {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "execute-api:Invoke",
            "Resource": [
              "execute-api:/*"
            ],
            "Condition": {
              "StringEquals": {
                "aws:sourceVpce": [
                  "vpce-123123"
                ]
              }
            }
          }
        ]
      }`,
    );

    // Make sure that the workaround adds the endpoint configuration to the rest api construct
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      EndpointConfiguration: {
        Types: ['PRIVATE'],
        VpcEndpointIds: ['vpce-123123'],
      },
    });

    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: 'apigateway-accesslogs-myapi',
      RetentionInDays: 30,
    });
  });

  it('generateOperationId', async () => {
    const rc = testRouteConfig();
    const rs = generateOperationId({
      ...rc,
      path: '/abc123&yza {748rt}/aaab',
      method: 'get',
    });
    expect(rs).toMatch(/^abc123yza748rt-aaab-get.*/);
  });

  it('getPropsWithDefaults', async () => {
    const props = getPropsWithDefaults('test-api', {
      stage: 'tst',
      openapiBasic: {
        openapi: 'aaaa',
        info: {
          title: 'aaaa',
          version: 'aaaa',
        },
      },
      openapiOperations: [],
    });
    expect(props.restApiName).toBeUndefined();
    expect(props.deploy).toBeTruthy();
  });

  it('addVPCEndpointConfig private endpoint', async () => {
    const originProps = testGatewayProps();
    const originDoc31 = testOpenpidoc31();
    const { openapiDoc31WithVPCE } = addVPCEndpointConfig(originProps, originDoc31);
    expect(openapiDoc31WithVPCE['x-amazon-apigateway-endpoint-configuration']).toStrictEqual({
      vpcEndpointIds: ['vpce-1111'],
    });
    expect(
      openapiDoc31WithVPCE['x-amazon-apigateway-policy'].Statement[0].Condition.StringEquals[
        'aws:sourceVpce'
      ],
    ).toStrictEqual(originProps.vpcEndpointIds);
    // output includes fields from input
    expect(originDoc31.info).toStrictEqual(openapiDoc31WithVPCE.info);
  });

  it('addVPCEndpointConfig private endpoint should fail if invalid', async () => {
    const originProps = testGatewayProps();
    const originDoc31 = testOpenpidoc31();
    const f = (): void => {
      addVPCEndpointConfig(
        {
          ...originProps,
          vpcEndpointIds: [],
        },
        originDoc31,
      );
    };
    expect(f).toThrow();
  });

  it('addVPCEndpointConfig default endpoint', async () => {
    const originProps: OpenApiGatewayLambdaProps = {
      ...testGatewayProps(),
      endpointTypes: [EndpointType.REGIONAL],
    };
    const originDoc31 = testOpenpidoc31();
    const { openapiDoc31WithVPCE } = addVPCEndpointConfig(originProps, originDoc31);
    expect(openapiDoc31WithVPCE['x-amazon-apigateway-endpoint-configuration']).toBeUndefined();
    expect(openapiDoc31WithVPCE['x-amazon-apigateway-policy']).toBeUndefined();
  });

  it('generateOpenapiDocWithExtensions', async () => {
    const awsRegion = 'eu-west-1';
    const lambdaArn = 'arn:aws:lambda:eu-west-1:123123123:function:my-function:live';
    const openapidoc = generateOpenapiDocWithExtensions(testGatewayProps(), awsRegion);

    expect(
      // @ts-ignore
      openapidoc['x-amazon-apigateway-request-validators'].requestparams.validateRequestBody,
    ).toBeTruthy();
    // @ts-ignore
    expect(openapidoc.paths['/users/{id}'].get['x-amazon-apigateway-request-validator']).toBe(
      'request',
    );
    // @ts-ignore
    expect(openapidoc.paths['/users/{id}'].get['x-amazon-apigateway-integration']).toStrictEqual({
      uri: `arn:aws:apigateway:${awsRegion}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,
      httpMethod: 'POST',
      type: 'AWS_PROXY',
    });
  });

  it('openapi lint should work', async () => {
    const f = (): void => {
      lintOpenapiDocument(testOpenpidoc30(), true);
    };
    expect(f).not.toThrow();
  });

  it('openapi lint should fail', async () => {
    const odoc = testOpenpidoc30();

    // fail if parameter ids in path and declaration doesn't match
    // @ts-ignore
    odoc.paths['/users/{id}'].get.parameters[0].name = 'SOMETHING';
    const f = (): void => {
      lintOpenapiDocument(odoc, true);
    };
    expect(f).toThrow();
  });

  it('should throw error if no openapi operation is provided', async () => {
    const app = new App();
    const stack = new Stack(app);

    const createRestApi = (): void => {
      // eslint-disable-next-line no-new
      new OpenApiGatewayLambda(stack, 'myapi', {
        stage: 'tst',
        openapiBasic: {
          openapi: '3.0.3',
          info: {
            title: 'test api',
            version: 'v1',
          },
        },
        openapiOperations: [],
      });
    };

    const expectedErrorMessage = `props.openapiOperations validation errors: ${JSON.stringify(
      {
        _errors: ['At least one operation is required'],
      },
      null,
      2,
    )}`;

    expect(createRestApi).toThrow(new Error(expectedErrorMessage));
  });

  it('should throw error with invalid operations', async () => {
    const app = new App();
    const stack = new Stack(app);

    const lambdaFunction = new BaseNodeJsFunction(stack, 'user-get-lambda', {
      ...defaultLambdaConfig,

      // ? The lambda must have the alias
      createLiveAlias: false,
    });

    const openapiOperations = [
      {
        lambdaAlias: lambdaFunction.liveAlias,
        routeConfig: {
          method: 'GET',
          responses: testUserGetRouteConfig.responses,
          deprecated: 1,
        },
      },
    ];

    const createRestApi = (): void => {
      // eslint-disable-next-line no-new
      new OpenApiGatewayLambda(stack, 'myapi', {
        stage: 'tst',
        openapiBasic: {
          openapi: '3.0.3',
          info: {
            title: 'test api',
            version: 'v1',
          },
        },
        // @ts-expect-error invalid operations
        openapiOperations,
      });
    };

    const expectedErrorMessage = `props.openapiOperations validation errors: ${JSON.stringify(
      {
        '0': {
          _errors: [],
          lambdaAlias: {
            _errors: ['Required'],
          },
          routeConfig: {
            _errors: [],
            path: {
              _errors: ['Required'],
            },
            method: {
              _errors: [
                "Invalid enum value. Expected 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace', received 'GET'",
              ],
            },
            deprecated: {
              _errors: ['Expected boolean, received number'],
            },
          },
        },
        _errors: [],
      },
      null,
      2,
    )}`;

    expect(createRestApi).toThrow(new Error(expectedErrorMessage));
  });

  it('should be able to have 2 endpoints calling the same lambda', async () => {
    const app = new App();
    const stack = new Stack(app);

    // user get test operation
    const lambdaFunction = new BaseNodeJsFunction(stack, 'user-get-lambda-fn', defaultLambdaConfig);

    const userGetOperation: LambdaOperation = {
      lambdaAlias: lambdaFunction.liveAlias!,
      routeConfig: {
        ...testUserGetRouteConfig,
        path: '/users1/{id}',
      },
    };

    const userGetOperation2: LambdaOperation = {
      lambdaAlias: lambdaFunction.liveAlias!,
      routeConfig: {
        ...testUserGetRouteConfig,
        path: '/users2/{id}',
      },
    };

    const openapiOperations: LambdaOperation[] = [userGetOperation, userGetOperation2];

    // create rest api
    // eslint-disable-next-line no-new
    new OpenApiGatewayLambda(stack, 'myapi', {
      stage: 'tst',
      openapiBasic: {
        openapi: '3.0.3',
        info: {
          title: 'test api',
          version: 'v1',
        },
      },
      openapiOperations,
    });

    // execute synth and test results
    const template = Template.fromStack(stack);

    expect(template).toBeDefined();

    template.resourceCountIs('AWS::Lambda::Permission', 1);

    // apigw allowed to call lambda
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      FunctionName: {
        Ref: stack.getLogicalId(userGetOperation.lambdaAlias.node.defaultChild as CfnFunction),
      },
      Principal: 'apigateway.amazonaws.com',
    });
  });
});

const testUserGetOperation = (scope: Construct, lambdaConfig: BaseNodeJsProps): LambdaOperation => {
  const lambdaFunction = new BaseNodeJsFunction(scope, 'user-get-lambda', lambdaConfig);
  if (!lambdaFunction.liveAlias) {
    throw new Error('alias should be created');
  }
  return {
    lambdaAlias: lambdaFunction.liveAlias,
    routeConfig: testUserGetRouteConfig,
  };
};

const testUserPostOperation = (
  scope: Construct,
  lambdaConfig: BaseNodeJsProps,
): LambdaOperation => {
  const lambdaFunction = new BaseNodeJsFunction(scope, 'user-post-lambda', lambdaConfig);
  if (!lambdaFunction.liveAlias) {
    throw new Error('alias should be created');
  }
  return {
    lambdaAlias: lambdaFunction.liveAlias,
    routeConfig: testUserPostRouteConfig,
  };
};

const testUserGetRouteConfig: RouteConfig = {
  method: 'get',
  path: '/users/{id}',
  summary: 'Get a single user',
  description: 'Get a single user',
  request: {
    params: z.object({
      id: z.string().openapi({ example: '1212121' }),
    }),
    headers: z.object({
      'x-special-header': z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Object with user data',
      content: {
        'application/json': {
          schema: z
            .object({
              id: z.string().openapi({ example: '1212121' }),
              name: z.string().openapi({ example: 'John Doe' }),
              age: z.number().openapi({ example: 42 }),
            })
            .openapi('User'),
        },
      },
    },
  },
};

const testUserPostRouteConfig: RouteConfig = {
  method: 'post',
  path: '/users',
  summary: 'Create a user',
  description: 'Create a user',
  request: {
    headers: z.object({
      'x-special-header': z.string().optional(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              id: z.string().openapi({ example: '1212121' }),
              name: z.string().openapi({ example: 'John Doe' }),
              age: z.number().openapi({ example: 42 }),
            })
            .openapi('User'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z
            .object({
              message: z.string().openapi({ example: 'User created successfully' }),
            })
            .openapi('Response'),
        },
      },
    },
    400: {
      description: 'Error',
      content: {
        'application/json': {
          schema: z
            .object({
              message: z.string().openapi({ example: 'User created successfully' }),
              details: z
                .array(z.string())
                .openapi({ example: ['User name is required', 'age should be positive'] }),
            })
            .openapi('ResponseDetails'),
        },
      },
    },
  },
};

const testGatewayProps = (): OpenApiGatewayLambdaProps => {
  return {
    endpointTypes: [EndpointType.PRIVATE],
    vpcEndpointIds: ['vpce-1111'],
    accessLogEnable: true,
    accessLogRetention: RetentionDays.ONE_DAY,
    openapiBasic: {
      openapi: '3.0.3',
      info: {
        title: 'test api',
        version: 'v1',
      },
    },
    openapiOperations: [
      {
        // @ts-ignore
        lambdaAlias: {
          aliasName: 'live',
          functionName: 'my-function',
          functionArn: 'arn:aws:lambda:eu-west-1:123123123:function:my-function:live',
        },
        routeConfig: testRouteConfig(),
        awsExtensions: {
          enableRequestValidator: true,
        },
      },
    ],
  };
};

const testOpenpidoc30 = (): oas30.OpenAPIObject => {
  const odoc = testOpenpidoc31();
  const converter = new Converter(odoc, {
    verbose: false,
    deleteExampleWithId: true,
    allOfTransform: false,
  });

  return converter.convert() as oas30.OpenAPIObject;
};

const testOpenpidoc31 = (): oas31.OpenAPIObject => {
  const registry = new OpenAPIRegistry();

  registry.registerPath(testRouteConfig());

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const openapiDoc31 = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'My API',
      description: 'This is the API',
      contact: {
        name: 'Test1',
      },
    },
    servers: [{ url: 'http://test.com/api' }],
  });

  if (openapiDoc31.webhooks && Object.keys(openapiDoc31.webhooks).length === 0) {
    // eslint-disable-next-line fp/no-delete
    delete openapiDoc31.webhooks;
  }

  return openapiDoc31;
};

const testRouteConfig = (): RouteConfig => {
  return {
    operationId: 'get-user',
    method: 'get',
    path: '/users/{id}', // should show error on aws lint
    summary: 'Get a single user',
    description: 'Get a single user',
    request: {
      params: z.object({
        id: z.string().openapi({ example: '1212121' }),
      }),
    },
    responses: {
      200: {
        description: 'Object with user data.',
        content: {
          'application/json': {
            schema: UserSchema,
          },
        },
      },
    },
  };
};

const UserSchema = z
  .object({
    id: z.string().openapi({ example: '1212121' }),
    name: z.string().openapi({ example: 'John Doe' }),
    age: z.number().openapi({ example: 42 }),
  })
  .openapi('User');

const expectContain = (source: string, expectStr: string): void => {
  const s = source.replaceAll(/\s/g, '');
  const e = expectStr.replaceAll(/\s/g, '');
  if (s.indexOf(e) === -1) {
    throw new Error("source doesn't contain required string");
  }
};
