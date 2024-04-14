import { StackProps } from 'aws-cdk-lib/core';

import { TestConfig } from './TestConfig';

export type StageStackProps = StackProps & {
  stageConfig: TestConfig;
};
