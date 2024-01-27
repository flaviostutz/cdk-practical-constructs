import type { oas30 } from 'openapi3-ts';

import { Wso2BaseProperties } from '../types';

import { Wso2ApiDefinitionV1 } from './v1/types';

export type Wso2ApiCustomResourceProperties = Wso2ApiProps;

export type Wso2ApiProps = Wso2BaseProperties & {
  /**
   * WSO2 specific document with API definitions
   * Some default values might be applied on top of the input when using in the construct
   */
  apiDefinition: Wso2ApiDefinitionV1;
  /**
   * An Openapi 3.0 document containing the documentation of the API.
   * The paths/operations in this document will be used to configure routes in WSO2
   */
  openapiDocument: oas30.OpenAPIObject;
};
