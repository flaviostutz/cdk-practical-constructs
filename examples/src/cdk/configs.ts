import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { LambdaConfig, StageConfig, StagesConfig } from 'cdk-practical-constructs';

export type TestConfig = StageConfig & {
  lambda: LambdaConfig;
};

export const testStageConfigs: StagesConfig<TestConfig> = {
  default: {
    lambda: {
      allowAllOutbound: true,
      logGroupRetention: RetentionDays.ONE_WEEK,
    },
  },
  dev: {
    lambda: {
      logGroupRetention: RetentionDays.ONE_DAY,
      bundling: {
        sourceMap: true,
      },
    },
  },
  prd: {
    lambda: {
      logGroupRetention: RetentionDays.SIX_MONTHS,
    },
  },
};
