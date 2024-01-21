/* eslint-disable no-new */
import { App } from 'aws-cdk-lib/core';
import { resolveStageConfig } from 'cdk-practical-constructs';

import { TestConfig, testStageConfigs } from './configs';
import { AppStack } from './stack';

const app = new App();

// this file is the entry point file and can have access to process env
// eslint-disable-next-line no-process-env
const stage = process.env.STAGE;
if (!stage) throw new Error('Process env STAGE is required');

const stageConfig = resolveStageConfig<TestConfig>(stage, testStageConfigs);

new AppStack(app, 'example-stack', { stageConfig });

app.synth();
