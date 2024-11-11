import { RemovalPolicy } from 'aws-cdk-lib/core';
import { BackoffOptions } from 'exponential-backoff';

import { LambdaConfig } from '../lambda/types';

/**
 * Configurations used on the Lambda that receives events
 * from Cloudformation to invoke WSO2 server. So if your
 * WSO2 is accessible only via an specific network, or needs special rules
 * or internal CA certificates, configure it using this property
 */
export type Wso2LambdaConfig = Pick<
  LambdaConfig,
  | 'securityGroups'
  | 'extraCaPubCert'
  | 'network'
  | 'logGroupSubscriberLambdaArn'
  | 'logGroupRetention'
  | 'logGroupRemovalPolicy'
>;

export type Wso2BaseProperties = {
  /**
   * Configurations related to WSO2 APIM host, credentials tenant etc
   */
  wso2Config: Wso2Config;
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

/**
 * Retry options for API requests to WSO2 server
 */
export type RetryOptions = {
  /**
   * Retry options for check operations such as getting API to compare with desired contents.
   *
   * @default "{ startingDelay: 500, timeMultiple: 1.5, numOfAttempts: 10, maxDelay: 10000 }" which means retries on [500ms, 750ms, 1125ms, 1687ms (elapsed: 4s), 2531, 3796, 5696, 8542 (elapsed: 24s), 10000, 10000, 10000, 10000, 10000 (elapsed: 74s max)]
   */
  checkRetries?: BackoffOptions;
  /**
   * Retry options for operations such as create/update API on WSO2, change api lifecycle, publish Openapi docs etc
   * @default "{ startingDelay: 2000, timeMultiple: 1.5, numOfAttempts: 3, maxDelay: 5000 }"
   */
  mutationRetries?: BackoffOptions;
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
