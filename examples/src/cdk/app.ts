/* eslint-disable no-new */
import { App } from 'aws-cdk-lib/core';
import { resolveStageConfig } from 'cdk-practical-constructs';

import { testStageConfigs } from './configs';
import { AppStack } from './stack';
import { TestConfig } from './types/TestConfig';

const app = new App();

// this file is the entry point file and can have access to process env
// eslint-disable-next-line no-process-env
const stage = process.env.STAGE;
if (!stage) throw new Error('Process env STAGE is required');

const stageConfig = resolveStageConfig<TestConfig>(stage, testStageConfigs);

new AppStack(app, 'example-stack', { stageConfig });

app.synth();
