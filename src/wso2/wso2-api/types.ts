import type { oas30 } from 'openapi3-ts';
import { RemovalPolicy } from 'aws-cdk-lib/core';

import { LambdaConfig } from '../..';

import { Wso2ApiDefinitionV1 } from './v1/types';

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
  customResourceConfig?: Wso2LambdaConfig;
  /**
   * Removes or retains API in WSO2 APIM server when this application is removed from CFN
   * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html
   * Defaults to DESTROY, which means that the API will be removed from WSO2 when this resource is deleted in CFN
   */
  removalPolicy?: RemovalPolicy;
};

/**
 * Wso2ApiDefinition for WSO2 API.
 * Fields may vary depending on the WSO2 server version (wso2Version)
 */

export type Wso2ApiDefinition =
  | ({
      /**
       * Server API version. Use 'v1' for WSO2 server 3.x and 'v2' for WSO2 server 4.x
       */
      wso2Version: 'v1';
    } & Wso2ApiDefinitionV1)
  | ({
      /**
       * Server API version. Use 'v1' for WSO2 server 3.x and 'v2' for WSO2 server 4.x
       */
      // TODO remove later (just for testing)
      wso2Version: 'v2';
    } & Wso2ApiDefinitionV1);

export type Wso2LambdaConfig = Pick<
  LambdaConfig,
  | 'allowTLSOutboundTo'
  | 'securityGroups'
  | 'extraCaPubCert'
  | 'network'
  | 'logGroupSubscriberLambdaArn'
  | 'logRetention'
>;
