import type { oas30 } from 'openapi3-ts';
import { RemovalPolicy } from 'aws-cdk-lib/core';
import { BackoffOptions } from 'exponential-backoff';

import { LambdaConfig } from '../../lambda/types';

import { Wso2ApiDefinitionV1 } from './v1/types';

export type Wso2ApiProps = Wso2ApiBaseProperties & {
  /**
   * Removes or retains API in WSO2 APIM server when this application is removed from CFN
   * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html
   * Defaults to RETAIN, which means that the API will be kept in WSO2 when this resource is deleted in CFN
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
  /**
   * Version of the WSO2 server API
   * @default v1
   */
  apiVersion?: 'v1';
};

/**
 * Wso2ApiDefinition for WSO2 API.
 * Fields may vary depending on the WSO2 server version (wso2Version)
 */

// export type Wso2ApiDefinition = Wso2ApiDefinitionV1;

export type Wso2LambdaConfig = Pick<
  LambdaConfig,
  | 'allowOutboundTo'
  | 'securityGroups'
  | 'extraCaPubCert'
  | 'network'
  | 'logGroupSubscriberLambdaArn'
  | 'logGroupRetention'
  | 'logGroupRemovalPolicy'
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
  apiDefinition: Wso2ApiDefinitionV1;
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
  /**
   * Automatic retry for checks and mutations
   * This is a best effort to make the deployment successful even when WSO2 cluster is unstable,
   * but if you use long retries your CFN stack might take too long to fail when the WSO2 server
   * is unavailable, as it will continue retrying for minutes.
   */
  retryOptions?: RetryOptions;
};

export type RetryOptions = {
  /**
   * Retry options for check operations such as getting API to compare with desired contents.
   *
   * @default "{ startingDelay: 500, timeMultiple: 1.5, numOfAttempts: 10, maxDelay: 10000 }" which means retries on [500ms, 750ms, 1125ms, 1687ms (elapsed: 4s), 2531, 3796, 5696, 8542 (elapsed: 24s), 10000, 10000, 10000, 10000, 10000 (elapsed: 74s max)]
   */
  checkRetries?: BackoffOptions;
  /**
   * Retry options for operations such as create/update API on WSO2, change api lifecycle, publish Openapi docs etc
   * @default "{ startingDelay: 2000, timeMultiple: 1.5, numOfAttempts: 2, maxDelay: 5000 }" which means retries on [500ms, 750ms, 1125ms, 1687ms (elapsed: 4s), 2531, 3796, 5696, 8542 (elapsed: 24s), 10000, 10000, 10000, 10000, 10000 (elapsed: 74s max)]
   */
  mutationRetries?: BackoffOptions;
};
