import { OpenAPIObject } from 'openapi3-ts/oas30';

/**
 * Wso2 openapi doc returned by WSO2 when we submit the "petstore" version
 */
export const petstoreOpenapiReturnedWso2v1: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'Swagger Petstore',
    license: {
      name: 'MIT',
    },
    version: 'v1',
  },
  servers: [
    {
      url: 'http://petstore.swagger.io/v1',
    },
  ],
  security: [
    {
      default: [],
    },
  ],
  paths: {
    '/pets': {
      get: {
        tags: ['pets'],
        summary: 'List all pets',
        operationId: 'listPets',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'How many items to return at one time (max 100)',
            required: false,
            style: 'form',
            explode: true,
            schema: {
              type: 'integer',
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
                style: 'simple',
                explode: false,
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
        security: [
          {
            default: [],
          },
        ],
        'x-throttling-tier': 'Unlimited',
        'x-wso2-application-security': {
          'security-types': ['oauth2'],
          optional: false,
        },
      },
      post: {
        tags: ['pets'],
        summary: 'Create a pet',
        operationId: 'createPets',
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
        security: [
          {
            default: [],
          },
        ],
        'x-throttling-tier': 'Unlimited',
        'x-wso2-application-security': {
          'security-types': ['oauth2'],
          optional: false,
        },
      },
    },
    '/pets/{petId}': {
      get: {
        tags: ['pets'],
        summary: 'Info for a specific pet',
        operationId: 'showPetById',
        parameters: [
          {
            name: 'petId',
            in: 'path',
            description: 'The id of the pet to retrieve',
            required: true,
            style: 'simple',
            explode: false,
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
        security: [
          {
            default: [],
          },
        ],
        'x-throttling-tier': 'Unlimited',
        'x-wso2-application-security': {
          'security-types': ['oauth2'],
          optional: false,
        },
      },
    },
  },
  components: {
    schemas: {
      Pets: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Pet',
        },
      },
      Error: {
        required: ['code', 'message'],
        type: 'object',
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
      Pet: {
        required: ['id', 'name'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          id: {
            type: 'integer',
            format: 'int64',
          },
          tag: {
            type: 'string',
          },
        },
      },
    },
    securitySchemes: {
      default: {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: 'https://test.com',
            scopes: {},
          },
        },
      },
    },
  },
  'x-throttling-tier': 'Unlimited',
  'x-wso2-cors': {
    corsConfigurationEnabled: true,
    accessControlAllowOrigins: ['testwebsite.com'],
    accessControlAllowCredentials: false,
    accessControlAllowHeaders: [
      'Authorization',
      'Access-Control-Allow-Origin',
      'Content-Type',
      'SOAPAction',
    ],
    accessControlAllowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  },
  'x-wso2-production-endpoints': {
    urls: ['http://serverabc.com'],
    type: 'http',
  },
  'x-wso2-basePath': '/t/nn.nl/petstore/v1',
  'x-wso2-transports': ['https'],
  'x-wso2-response-cache': {
    enabled: false,
    cacheTimeoutInSeconds: 300,
  },
};
