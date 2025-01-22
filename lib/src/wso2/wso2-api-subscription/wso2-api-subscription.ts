import { Construct } from 'constructs';
import { CustomResource, RemovalPolicy } from 'aws-cdk-lib/core';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import z from 'zod';

import { addLambdaAndProviderForWso2Operations } from '../utils-cdk';

import { Wso2ApiSubscriptionProps } from './types';

/**
 * WSO2 API CDK construct for subscribing a WSO2 Application into a WSO2 API
 *
 * @example
 *
 * const wso2Api = new Wso2Api(...);
 * const wso2Application = new Wso2Application(...);
 *
 * const wso2ApiSubscription = new Wso2ApiSubscription(this, 'Wso2ApiSubscription', {
 *  apiId: wso2Api.wso2ApiId,
 *  applicationId: wso2Application.wso2ApplicationId,
 * });
 *
 * ---
 *
 * const wso2ApiSubscription = new Wso2ApiSubscription(this, 'Wso2ApiSubscription', {
 *  apiSearchParameters: {
 *    name: 'MyApi',
 *    version: 'v1',
 *    context: 'my-api',
 *  },
 *  applicationSearchParameters: {
 *    applicationName: 'MyApplication',
 *  },
 * });
 */
export class Wso2ApiSubscription extends Construct {
  readonly customResourceFunction: IFunction;

  readonly wso2SubscriptionId: string;

  constructor(scope: Construct, id: string, props: Wso2ApiSubscriptionProps) {
    super(scope, id);

    validateProps(props);

    const { customResourceProvider, customResourceFunction } =
      addLambdaAndProviderForWso2Operations({
        scope: this,
        id: 'Wso2ApiSubscription',
        props,
        baseDir: __dirname,
      });

    // eslint-disable-next-line no-new
    const resource = new CustomResource(this, 'Wso2ApiSubscription-custom-resource', {
      serviceToken: customResourceProvider.serviceToken,
      properties: props,
      resourceType: 'Custom::Wso2ApiSubscription',
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    this.customResourceFunction = customResourceFunction.nodeJsFunction;

    // TODO: check for a better way to retrieve the subscription id
    // https://github.com/aws-samples/aws-cdk-examples/discussions/641
    this.wso2SubscriptionId = resource.getAtt('SubscriptionId').toString();
  }
}

export const validateProps = (props: Wso2ApiSubscriptionProps): void => {
  const apiSchema = z.union([
    z.object({
      apiId: z.string(),
    }),
    z.object({
      apiSearchParameters: z.object({
        name: z.string(),
        version: z.string(),
        context: z.string(),
      }),
    }),
  ]);

  const applicationSchema = z.union([
    z.object({
      applicationId: z.string(),
    }),
    z.object({
      applicationSearchParameters: z.object({
        name: z.string(),
      }),
    }),
  ]);

  const schema = z
    .object({
      wso2Config: z.object({
        baseApiUrl: z.string(),
        credentialsSecretId: z.string(),
      }),
    })
    .and(apiSchema)
    .and(applicationSchema);

  schema.parse(props);
};
