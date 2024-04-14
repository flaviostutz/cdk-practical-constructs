import { BaseNodeJsFunction, EventType, LambdaOperation } from 'cdk-practical-constructs';
import { Construct } from 'constructs';

import { StageStackProps } from '../../../../cdk/types/StageStackProps';

import { pathParamsSchema, responseBodySchema } from './schemas';

export const buildGetTodoOperation = (
  scope: Construct,
  props: StageStackProps,
): LambdaOperation => {
  if (!props.stageConfig.stage) throw new Error('props.stageConfig.stage is required');

  const func = new BaseNodeJsFunction(scope, 'getTodo', {
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
      method: 'get',
      path: '/todos/{todoId}',
      request: {
        params: pathParamsSchema,
      },
      responses: {
        200: {
          description: 'Info about a todo item',
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
