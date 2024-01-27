/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-mutating-methods */

import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';

import { Wso2ApplicationProps } from './types';
import { Wso2Application } from './wso2-application';

describe('wso2-application-construct', () => {
  it('minimal wso2 api', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    const wso2Application = new Wso2Application(stack, 'wso2', testProps1);

    expect(wso2Application.customResourceFunction).toBeDefined();

    const template = Template.fromStack(stack);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(template.toJSON(), null, 2));

    template.hasResourceProperties('Custom::Wso2Application', {
      wso2Config: testProps1.wso2Config,
      applicationDefinition: testProps1.applicationDefinition,
    });
  });
});

const testProps = (): Wso2ApplicationProps => {
  return {
    wso2Config: {
      baseApiUrl: 'http://localhost:8080/wso2',
      credentialsSecretId: 'arn::creds',
    },
    applicationDefinition: {
      name: 'test-application',
      throttlingPolicy: 'Unlimited',
    },
  };
};
