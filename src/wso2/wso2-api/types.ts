import { publisher } from 'wso2apim-sdk';
import type { oas30 } from 'openapi3-ts';
import { RemovalPolicy } from 'aws-cdk-lib/core';

import { LambdaConfig } from '../..';

export type Wso2ApiProps = {
  /**
   * Entry path in Secret Manager with credentials for accessing WSO2 API with
   * roles for listing APIs, creating client credentials, publishing APIs etc
   * Example: 'wso2/customers/credentials' - with contents "{ user: 'myuser', pwd: 'mypass' }"
   */
  wso2CredentialsSecretManagerPath: string;
  wso2BaseUrl: string;
  wso2ApiDefinition: Wso2ApiDefinition;
  openapiDocument: oas30.OpenAPIObject;
  customResourceConfig: LambdaConfig;
  /**
   * Removes or retains API in WSO2 APIM server when this application is removed from CFN
   * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html
   * Defaults to DESTROY, which means that the API will be removed from WSO2 when this resource is deleted in CFN
   */
  removalPolicy: RemovalPolicy;
};

export type API = publisher.definitions['API'];

export type Wso2ApiDefinition = API & {
  subscriberVisibility?: 'RESTRICTED' | 'PRIVATE' | 'PUBLIC';
  subscriberVisibilityRoles?: string[];
  publisherVisibility?: 'RESTRICTED' | 'PRIVATE';
  publisherVisibilityRoles?: string[];
};
