import { Scoper } from 'scoperjs';

// https://stackoverflow.com/questions/43159887/make-a-single-property-optional-in-typescript
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type StagesConfig<T extends StageConfig> = {
  default: T;
  [stage: string]: T;
};

export type StageConfig = {
  stage?: string;
};

/**
 * Returns the prefix for a stage name identified by a '-'. e.g: for 'dev-pr-123', it returns 'dev'
 * @param stageName Full stage name. e.g: dev-pr-123, dev-testing-deploy, acc-frozen
 * @returns Prefix of stage name. e.g: 'dev'
 */
export const getStagePrefix = (stage: string): string => {
  return stage.replaceAll(/-.*/g, '');
};

/**
 * Resolves a stage configuration by merging global configs with specific stage configs
 * @param {string} stage such as 'dev', 'tst', 'acc', 'prd', 'dev-pr-123'. The actual stage name for getting the config will be the stage name prefixed by "-" if exists. For example, for 'dev-pr-123', it will be used 'dev'
 * @param {StagesConfig<T>} stagesConfig Configuration for all stages along with default values if the stage doesn't define a specific value
 * @returns {StageConfig}
 */
export function resolveStageConfig<T extends StageConfig>(
  stage: string,
  stagesConfig: StagesConfig<T>,
): T {
  const contexter = Scoper.create<T>(stagesConfig.default);
  // eslint-disable-next-line no-restricted-syntax
  for (const [stagek, config] of Object.entries(stagesConfig)) {
    contexter.setScopeValue(stagek, config);
  }

  // get stage context by stage prefix name. e.g: context 'dev' when stage is 'dev-pr-123'
  const stagePrefix = getStagePrefix(stage);

  const stageValue = contexter.getValue(stagePrefix);
  stageValue.stage = stage;
  return stageValue;
}
