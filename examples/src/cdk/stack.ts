/* eslint-disable camelcase */
import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import { TestConfig } from './configs';
import { addWso2Api as addWso2PetstoreApi } from './petstore-wso2-api';

export type StageStackProps = StackProps & {
  stageConfig: TestConfig;
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: StageStackProps) {
    super(scope, id, props);

    addWso2PetstoreApi(this);
  }
}
