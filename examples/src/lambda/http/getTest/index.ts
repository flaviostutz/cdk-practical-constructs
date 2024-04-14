import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing id in path parameters' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ id, content: `This is item ${id}` }),
  };
};
