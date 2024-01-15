import { Construct } from 'constructs';

import { Wso2ApiProps } from './types';
import { validateAndPrepareProps } from './props';

/**
 * WSO2 API CDK construct for creating WSO2 APIs based on Openapi and WSO2 specific configurations
 */
export class Wso2Api extends Construct {
  constructor(scope: Construct, id: string, props: Wso2ApiProps) {
    super(scope, id);

    if (props) {
      // eslint-disable-next-line no-console
      console.log('test');
    }

    const propsp = validateAndPrepareProps(props);

    lintOpenapiDocument(openapiDoc30);
  }
}
