import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';

import { Wso2ApiSubscriptionProps } from './types';
import { Wso2ApiSubscription } from './wso2-api-subscription';

describe('wso2-subscription-construct', () => {
  it('minimal wso2 api', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    const wso2Subscription = new Wso2ApiSubscription(stack, 'wso2', testProps1);

    expect(wso2Subscription.customResourceFunction).toBeDefined();

    const template = Template.fromStack(stack);

    template.hasResourceProperties('Custom::Wso2ApiSubscription', {
      // Should forward the props to the custom resource
      ...testProps1,
    });
  });
});

const testProps = (): Wso2ApiSubscriptionProps => {
  return {
    wso2Config: {
      baseApiUrl: 'http://localhost:8080/wso2',
      credentialsSecretId: 'arn::creds',
    },
    apiId: '1111-2222',
    applicationId: '3333-4444',
    throttlingPolicy: 'Unlimited',
  };
};
