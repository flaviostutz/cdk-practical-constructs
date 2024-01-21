import type { oas30 } from 'openapi3-ts';
import { RemovalPolicy } from 'aws-cdk-lib/core';

import { LambdaConfig } from '../../lambda/types';

import { Wso2ApiDefinitionV1 } from './v1/types';

export type Wso2ApiProps = Wso2ApiBaseProperties & {
  /**
   * Removes or retains API in WSO2 APIM server when this application is removed from CFN
   * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html
   * Defaults to DESTROY, which means that the API will be removed from WSO2 when this resource is deleted in CFN
   */
  removalPolicy?: RemovalPolicy;
  /**
   * Lambda config for the CustomResource that will be used for running the WSO2 API calls
   * By default this Lambda will have access to all networks so it's able to invoke the WSO2 APIs.
   * You can add custom CA pub certs (extraCaPubCert) or configure a specific VPC to run it (network) for example.
   */
  customResourceConfig?: Wso2LambdaConfig;
};

export type Wso2Config = {
  /**
   * WSO2 server API base URL. This is the base URL from which the API calls to WSO2 will be sent.
   * @example https://mywso2.com/
   */
  baseApiUrl: string;
  /**
   * Tenant identification (when using multi tenant setups)
   * @example mypublic.com
   */
  tenant?: string;
  /**
   * Secret id in Secret Manager with credentials for accessing WSO2 API. It will be used for
   * listing APIs, creating client credentials, publishing APIs etc
   * @example 'wso2/customers/credentials' - with json contents "{ user: 'myuser', pwd: 'mypass' }"
   */
  credentialsSecretId: string;
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

export type Wso2ApiBaseProperties = {
  /**
   * Configurations related to WSO2 APIM host, credentials tenant etc
   */
  wso2Config: Wso2Config;
  /**
   * WSO2 specific document with API definitions
   * Some default values might be applied on top of the input when using in the construct
   */
  apiDefinition: Wso2ApiDefinition;
  /**
   * An Openapi 3.0 document containing the documentation of the API.
   * The paths/operations in this document will be used to configure routes in WSO2
   */
  openapiDocument: oas30.OpenAPIObject;
  /**
   * If true, during the creation of this CFN Resource, if an API in WSO2 already exists with the same tenant/name/version, it will fail.
   * If false, an existing API in WSO2 can be used. This means that an API that wasn't created by this construct can
   * be updated or even deleted by this Custom Resource (if 'Retain' is 'DESTROY' for this resource).
   * @default true
   */
  failIfExists?: boolean;
};
