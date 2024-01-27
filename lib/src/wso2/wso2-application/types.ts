import { Wso2BaseProperties } from '../types';

import { Wso2ApplicationDefinition } from './v1/types';

export type Wso2ApplicationCustomResourceProperties = Wso2ApplicationProps;

/**
 * WSO2 Application construct parameters
 */
export type Wso2ApplicationProps = Wso2BaseProperties & {
  applicationDefinition: Wso2ApplicationDefinition;
};
