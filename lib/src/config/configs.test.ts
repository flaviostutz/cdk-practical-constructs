/* eslint-disable camelcase */
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import { LambdaConfig } from '..';

import { StageConfig, StagesConfig, resolveStageConfig } from './configs';

type TestConfig = StageConfig & {
  lambda: LambdaConfig;
};

const testStageConfigs: StagesConfig<TestConfig> = {
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

describe('configs', () => {
  it('resolve config with dev overrides', async () => {
    const stageConfig = resolveStageConfig<TestConfig>('dev', testStageConfigs);
    expect(stageConfig.lambda.allowAllOutbound).toBeTruthy();
    expect(stageConfig.lambda.logGroupRetention).toBe(RetentionDays.ONE_DAY);
  });

  it('resolve stage "dev-pr-123" with same contents as stage "dev"', async () => {
    const stageConfig = resolveStageConfig<TestConfig>('dev-pr-123', testStageConfigs);
    expect(stageConfig.lambda.allowAllOutbound).toBeTruthy();
    expect(stageConfig.lambda.logGroupRetention).toBe(RetentionDays.ONE_DAY);
  });

  it('resolve prd config with defaults', async () => {
    const stageConfig = resolveStageConfig<TestConfig>('tst', testStageConfigs);
    expect(stageConfig.lambda.allowAllOutbound).toBeTruthy();
    expect(stageConfig.lambda.logGroupRetention).toBe(RetentionDays.ONE_WEEK);
  });

  it('resolve acc config with defaults', async () => {
    const stageConfig = resolveStageConfig<TestConfig>('prd', testStageConfigs);
    expect(stageConfig.lambda.allowAllOutbound).toBeTruthy();
    expect(stageConfig.lambda.logGroupRetention).toBe(RetentionDays.SIX_MONTHS);
  });
});
