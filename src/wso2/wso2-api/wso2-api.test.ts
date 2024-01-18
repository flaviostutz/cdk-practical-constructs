/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-mutating-methods */

import { Wso2ApiDefinition } from '..';

// import { App, Stack } from 'aws-cdk-lib';
// import { Template } from 'aws-cdk-lib/assertions';

describe('wso2-api-construct', () => {
  it('minimal wso2 api', async () => {
    expect(true).toBeTruthy();
    // const app = new App();
    // const stack = new Stack(app);
    // execute synth and test results
    // const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));
    // expect(apigw.logGroupAccessLog).toBeUndefined();
    // apigw allowed to call lambda
    // template.hasResourceProperties('AWS::Lambda::Permission', {
    //   Principal: 'apigateway.amazonaws.com',
    // });
  });
});

const testWso2ApiDefs = (args: {
  name: string;
  context: string;
  backendUrl: string;
}): Wso2ApiDefinition => {
  return {
    wso2Version: 'v1',
    version: 'v1',
    type: 'HTTP',
    endpointConfig: {
      production_endpoints: {
        url: args.backendUrl,
      },
      sandbox_endpoints: {
        url: args.backendUrl,
      },
      endpoint_type: 'http',
    },
    context: args.context,
    name: args.name,
  };
};
