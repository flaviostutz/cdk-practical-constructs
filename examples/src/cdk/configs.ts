import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StagesConfig } from 'cdk-practical-constructs';

import { TestConfig } from './types/TestConfig';

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
