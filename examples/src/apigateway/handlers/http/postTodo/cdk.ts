import { BaseNodeJsFunction, EventType, LambdaOperation } from 'cdk-practical-constructs';
import { Construct } from 'constructs';

import { StageStackProps } from '../../../../cdk/types/StageStackProps';

import { requestBodySchema, responseBodySchema } from './schemas';

export const buildPostTodoOperation = (
  scope: Construct,
  props: StageStackProps,
): LambdaOperation => {
  if (!props.stageConfig.stage) throw new Error('props.stageConfig.stage is required');

  const func = new BaseNodeJsFunction(scope, 'postTodo', {
    ...props.stageConfig.lambda,
    baseCodePath: 'src/apigateway/handlers',
    stage: props.stageConfig.stage,
    network: props.stageConfig.lambda.network,
    eventType: EventType.Http,
    description: 'Get Todo by id',
  });

  if (!func.liveAlias) throw new Error('func.liveAlias is required');

  return {
    lambdaAlias: func.liveAlias,
    routeConfig: {
      method: 'post',
      path: '/todos',
      request: {
        body: {
          content: {
            'application/json': {
              schema: requestBodySchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Create a new todo item',
          content: {
            'application/json': {
              schema: responseBodySchema,
            },
          },
        },
      },
    },
  };
};
