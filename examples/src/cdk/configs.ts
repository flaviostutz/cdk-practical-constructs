import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { LambdaConfig, StageConfig, StagesConfig } from 'cdk-practical-constructs';

export type TestConfig = StageConfig & {
  lambda: LambdaConfig;
};

export const testStageConfigs: StagesConfig<TestConfig> = {
  default: {
    lambda: {
      allowAllOutbound: true,
      logRetention: RetentionDays.ONE_WEEK,
    },
  },
  dev: {
    lambda: {
      logRetention: RetentionDays.ONE_DAY,
      bundling: {
        sourceMap: true,
      },
    },
  },
  prd: {
    lambda: {
      logRetention: RetentionDays.SIX_MONTHS,
    },
  },
};
