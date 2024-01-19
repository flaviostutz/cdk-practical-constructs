/* eslint-disable @typescript-eslint/no-explicit-any */

import { petstoreOpenapi } from '../__tests__/petstore';
import { Wso2ApiBaseProperties, Wso2ApiDefinition } from '../types';

import { Wso2ApiCustomResourceEvent, handler } from './index';

describe('wso2 custom resource lambda', () => {
  it('basic secret fetch and wso2 version check', async () => {
    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.PhysicalResourceId).toBe('test123Swagger Petstore');
  });
});

const testBasicWso2ApiDefs = (): Wso2ApiDefinition => {
  return {
    wso2Version: 'v1',
    context: '/testcontext1',
    name: 'myapitest',
    version: '1.0.0',
  };
};

const commonEvt = {
  StackId: 'test-stack',
  RequestId: '123-123123',
  LogicalResourceId: 'abc abc',
  ServiceToken: 'arn:somelambdatest',
  ResponseURL: 's3bucketxxx',
  ResourceType: 'wso2api',
};

const testCFNEventCreate = (baseProperties: Wso2ApiBaseProperties): Wso2ApiCustomResourceEvent => {
  return {
    ...commonEvt,
    RequestType: 'Create',
    ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
  };
};
// const testCFNEventDelete = (
//   resourceProperties: { [key: string]: any },
//   physicalResourceId: string,
// ): Wso2ApiCustomResourceEvent => {
//   return {
//     ...commonEvt,
//     RequestType: 'Delete',
//     ResourceProperties: { ...resourceProperties, ServiceToken: 'arn:somelambdatest' },
//     PhysicalResourceId: physicalResourceId,
//   };
// };
// const testCFNEventUpdate = (
//   resourceProperties: { [key: string]: any },
//   oldResourceProperties: { [key: string]: any },
//   physicalResourceId: string,
// ): Wso2ApiCustomResourceEvent => {
//   return {
//     ...commonEvt,
//     RequestType: 'Update',
//     ResourceProperties: { ...resourceProperties, ServiceToken: 'arn:somelambdatest' },
//     PhysicalResourceId: physicalResourceId,
//     OldResourceProperties: oldResourceProperties,
//   };
// };

const testEvent: Wso2ApiBaseProperties = {
  wso2Config: {
    baseApiUrl: 'http://testwso2.com',
    credentialsSecretManagerPath: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
  },
  openapiDocument: petstoreOpenapi,
  apiDefinition: testBasicWso2ApiDefs(),
};
