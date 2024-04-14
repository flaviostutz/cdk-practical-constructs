import z from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const requestBodySchema = z
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

export const responseBodySchema = z
  .strictObject({
    id: z.string(),
    message: z.string(),
  })
  .openapi({
    example: {
      id: '1234',
      message: 'Todo item created successfully',
    },
  });

export const lambdaEventSchema = z.object({
  body: requestBodySchema,
});

export type LambdaEventType = z.infer<typeof lambdaEventSchema>;
