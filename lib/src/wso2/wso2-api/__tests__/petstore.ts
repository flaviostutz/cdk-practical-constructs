/* eslint-disable camelcase */
import { OpenAPIObject } from 'openapi3-ts/oas30';

import type { Wso2ApiDefinitionV1 } from '../v1/types';

export const petstoreOpenapi: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    version: 'v1',
    title: 'Swagger Petstore',
    license: {
      name: 'MIT',
    },
  },
  tags: [{ name: 'tag1' }],
  servers: [
    {
      url: 'http://petstore.swagger.io/v1',
    },
  ],
  paths: {
    '/pets': {
      get: {
        summary: 'List all pets',
        operationId: 'listPets',
        tags: ['pets'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'How many items to return at one time (max 100)',
            required: false,
            schema: {
              type: 'integer',
              maximum: 100,
              format: 'int32',
            },
          },
        ],
        responses: {
          '200': {
            description: 'A paged array of pets',
            headers: {
              'x-next': {
                description: 'A link to the next page of responses',
                schema: {
                  type: 'string',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pets',
                },
              },
            },
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a pet',
        operationId: 'createPets',
        tags: ['pets'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Pet',
              },
            },
          },
          required: true,
        },
        responses: {
          '201': {
            description: 'Null response',
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/pets/{petId}': {
      get: {
        summary: 'Info for a specific pet',
        operationId: 'showPetById',
        tags: ['pets'],
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            description: 'The id of the pet to retrieve',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Expected response to a valid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            type: 'integer',
            format: 'int64',
          },
          name: {
            type: 'string',
          },
          tag: {
            type: 'string',
          },
        },
      },
      Pets: {
        type: 'array',
        maxItems: 100,
        items: {
          $ref: '#/components/schemas/Pet',
        },
      },
      Error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'integer',
            format: 'int32',
          },
          message: {
            type: 'string',
          },
        },
      },
    },
  },
};

/**
 * Wso2 construct api definition
 */
export const wso2ConstructApiDefinition: Wso2ApiDefinitionV1 = {
  id: 'petstore-api-id',
  name: 'petstore-sample',
  context: '/petstore',
  version: 'v1',
  type: 'HTTP',
  endpointConfig: {
    production_endpoints: {
      url: 'http://serverabc.com',
    },
    endpoint_type: 'http',
  },
  gatewayEnvironments: ['public'],
  corsConfiguration: {
    accessControlAllowOrigins: ['testwebsite.com'],
    accessControlAllowHeaders: ['Authorization', 'Access-Control-Allow-Origin', 'Content-Type'],
    accessControlAllowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    // @ts-expect-error this property is stringified at some point
    corsConfigurationEnabled: 'true',
    // @ts-expect-error this property is stringified at some point
    accessControlAllowCredentials: 'false',
  },
  businessInformation: {
    businessOwner: 'petstore',
    businessOwnerEmail: 'contact@petstore.com',
    technicalOwner: 'petstore dev team',
    technicalOwnerEmail: 'devteam@petstore.com',
  },
  additionalProperties: {
    extraProperty: 'my extra property',
  },
};
