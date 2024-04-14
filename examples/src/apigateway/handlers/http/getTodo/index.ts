import { APIGatewayProxyResult } from 'aws-lambda';

import { LambdaEventType } from './schemas';

export const handler = async (event: LambdaEventType): Promise<APIGatewayProxyResult> => {
  const todoId = event.pathParameters?.todoId;
  if (!todoId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing todoId in path parameters' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ id: todoId, content: `This is item ${todoId}` }),
  };
};
