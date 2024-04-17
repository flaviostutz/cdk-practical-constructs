/* eslint-disable camelcase */
import { Construct } from 'constructs';
import { LambdaOperation, OpenApiGatewayLambda } from 'cdk-practical-constructs';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { RemovalPolicy } from 'aws-cdk-lib';

import { StageStackProps } from '../cdk/types/StageStackProps';

import { buildGetTodoOperation } from './handlers/http/getTodo/cdk';
import { buildPostTodoOperation } from './handlers/http/postTodo/cdk';

// prepare zod with openapi extensions
extendZodWithOpenApi(z);

export const addTodoApi = (scope: Construct, props: StageStackProps): void => {
  const operations: LambdaOperation[] = [];

  // build Lambda + openapi defs for GetTodo operation
  const getLoanOp = buildGetTodoOperation(scope, props);
  operations.push(getLoanOp);

  // build Lambda + openapi defs for PostTodo operation
  const postLoanOp = buildPostTodoOperation(scope, props);
  operations.push(postLoanOp);

  // aws api gateway from openapi definitions
  const apigw = new OpenApiGatewayLambda(scope, 'todo-api', {
    stage: 'test',
    openapiBasic: {
      openapi: '3.0.3',
      info: {
        title: 'Todo API',
        description: 'Todo management API',
        version: 'v1',
      },
    },
    openapiOperations: operations,
  });

  // remove API GW when CFN stack is removed
  apigw.specRestApi.applyRemovalPolicy(RemovalPolicy.DESTROY);
  // console.log(JSON.stringify(apigw.openapiDocument, null, 2));
};
