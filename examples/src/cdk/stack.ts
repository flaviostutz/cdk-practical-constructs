/* eslint-disable camelcase */
import { Stack } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import { addWso2Api } from '../wso2/cdk';
import { addLambdaGetTest } from '../lambda/cdk';
import { addTodoApi } from '../apigateway/cdk';

import { StageStackProps } from './types/StageStackProps';

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: StageStackProps) {
    super(scope, id, props);

    // todo api example
    addTodoApi(this, props);

    // base lambda node js example
    addLambdaGetTest(this);

    // wso2 api resource example
    addWso2Api(this);
  }
}
