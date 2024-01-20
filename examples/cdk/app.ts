// /* eslint-disable no-new */
// import { App } from 'aws-cdk-lib/core';

// import { resolveStackNameAndPropsForStage } from '../cdk-shared2-nn/stack';
// import { globalConfig } from '../cdk-shared3-monorepo/globals';

// import { AppStack } from './stack';

// const { STAGE } = requireEnvVars(['STAGE']);

// const app = new App();

// const { stackName, stackProps } = resolveStackNameAndPropsForStage({
//   stage: STAGE,
//   globalConfig,
//   serviceName: 'splunk-forward-service',
//   snowApplicationServiceNamePrefix: 'Splunk Forward Service',
// });

// new AppStack(app, stackName, stackProps);

// app.synth();
