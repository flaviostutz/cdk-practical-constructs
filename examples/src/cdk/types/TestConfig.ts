import { LambdaConfig, StageConfig } from 'cdk-practical-constructs';

export type TestConfig = StageConfig & {
  lambda: LambdaConfig;
};
