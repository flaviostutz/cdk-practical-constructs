import { APIGatewayProxyResult } from 'aws-lambda';

import { LambdaEventType } from './schemas';

export const handler = async (event: LambdaEventType): Promise<APIGatewayProxyResult> => {
  const todoId = event.body.id;
  if (!todoId) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: 'todoId is required' }),
    };
  }

  const { description } = event.body;
  if (!description) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: 'description is required' }),
    };
  }

  return {
    statusCode: 201,
    body: JSON.stringify({ id: todoId, message: `Todo item created successfully` }),
  };
};
