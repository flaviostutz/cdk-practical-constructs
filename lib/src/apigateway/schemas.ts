import z from 'zod';

const openapiOpearationSchema = z.object({
  lambdaAlias: z.object({
    aliasName: z.string(),
    version: z.object({
      version: z.string(),
      functionArn: z.string(),
      functionName: z.string(),
    }),
  }),
  routeConfig: z.object({
    path: z.string(),
    method: z.enum(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']),
    deprecated: z.boolean().optional(),
  }),
});

export const openapiOperationsSchema = z.array(openapiOpearationSchema);
