/* eslint-disable camelcase */
import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import { addWso2Api } from '../wso2/cdk';

import { TestConfig } from './configs';

export type StageStackProps = StackProps & {
  stageConfig: TestConfig;
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: StageStackProps) {
    super(scope, id, props);

    // wso2 api resource example
    addWso2Api(this);
  }
}
