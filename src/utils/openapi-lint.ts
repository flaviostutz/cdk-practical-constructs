/* eslint-disable no-console */
import fs from 'fs';
import { execSync } from 'child_process';

import { oas30 } from 'openapi3-ts';
import tmp from 'tmp';

import { awsRulesetYml } from './spectral-openapi-aws-ruleset';
import { findExecutableInNodeModuleBin } from './misc';

/**
 * This is a linter only on openapi 3.0 json schema
 * It doesn't check for best practices or aws related advisory
 * (check AWS known issues here: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-known-issues.html)
 */
export const lintOpenapiDocument = (
  openapiDoc30: oas30.OpenAPIObject,
  useAwsRuleset: boolean,
): void => {
  // create tmp dir for running lint commands
  const lintDir = tmp.dirSync({ postfix: 'lint-spectral' });

  // prepare aws ruleset file
  // tmp.setGracefulCleanup();
  fs.writeFileSync(`${lintDir.name}/aws-ruleset.yml`, awsRulesetYml);

  // create openapi spec file
  fs.writeFileSync(`${lintDir.name}/openapi-spec.json`, JSON.stringify(openapiDoc30));

  let awsRs = '';
  if (useAwsRuleset) {
    awsRs = '- ./aws-ruleset.yml';
  }

  // create spectral config file
  fs.writeFileSync(
    `${lintDir.name}/.spectral.yaml`,
    `extends:
    - spectral:oas
    ${awsRs}
  rules:
    operation-tags: off
  `,
  );

  // We can't do async operations in CDK, so the following can't be used now (https://github.com/aws/aws-cdk/issues/8273)
  // const rs = await bundleAndLoadRuleset(spectralConfFile.name, { fs, fetch}); const results = await spectral.run(apiDocument)

  // Instead we are directly invoking the process using execSync
  const spectralBinPath = findExecutableInNodeModuleBin('spectral');
  try {
    // this will fail if errors are found in linting
    execSync(`${spectralBinPath} lint -F error -D openapi-spec.json`, {
      cwd: lintDir.name,
      timeout: 10000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const output = err.stdout.toString();
    console.log('');
    console.log('Linting failed for openapi document');
    console.log(JSON.stringify(openapiDoc30, null, 2));
    console.log('');
    console.log('Linting errors:');
    console.log(output);
    console.log('');
    throw new Error('Openapi spec lint error');
  }
};
