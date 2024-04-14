import z from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const pathParamsSchema = z.strictObject({
  todoId: z.string().openapi({ example: '1234' }),
});

export const responseBodySchema = z
  .strictObject({
    id: z.string(),
    description: z.string(),
    priority: z.number().optional(),
  })
  .openapi({
    example: {
      id: '1234',
      description: 'Create a test for the todo examples',
    },
  });

export const lambdaEventSchema = z.object({
  pathParameters: pathParamsSchema,
});

export type LambdaEventType = z.infer<typeof lambdaEventSchema>;
