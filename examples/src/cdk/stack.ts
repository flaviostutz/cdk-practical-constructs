/* eslint-disable camelcase */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseNodeJsFunction, EventType } from 'cdk-practical-constructs';

import { TestConfig } from './configs';

export type StageStackProps = StackProps & {
  stageConfig: TestConfig;
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: StageStackProps) {
    super(scope, id, props);

    // eslint-disable-next-line no-new
    new BaseNodeJsFunction(this, 'test lambda', {
      ...props.stageConfig.lambda,
      stage: props.stageConfig.stage ?? 'dev',
      eventType: EventType.Http,
      description: 'Test http lambda',
    });
  }
}
