import { Construct } from 'constructs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { CustomResource, Duration, RemovalPolicy, ScopedAws } from 'aws-cdk-lib/core';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Peer, Port } from 'aws-cdk-lib/aws-ec2';

import { EventType } from '../../lambda/types';
import { lintOpenapiDocument } from '../../utils/openapi-lint';
import { BaseNodeJsFunction } from '../../lambda/lambda-base';

import { Wso2ApiProps } from './types';
import { applyDefaultsWso2ApiDefinition, validateWso2ApiDefs } from './wso2-api-defs';

/**
 * WSO2 API CDK construct for creating WSO2 APIs based on Openapi and WSO2-specific configurations
 * This construct is related to one "physical" api in WSO2.
 */
export class Wso2Api extends Construct {
  readonly wso2ApiCustomResource: CustomResource;

  constructor(scope: Construct, id: string, props: Wso2ApiProps) {
    super(scope, id);

    // Do as much of the logic in the construct as possible and leave only
    // the minimal complexity to the Lambda Custom Resource as it's harder
    // to debug and eventual errors will rollback the entire stack and will
    // make the feedback cycle much longer.

    // Keep this construct stateless (don't access WSO2 apis) and
    // leave the stateful part to the Lambda Custom Resource (accessing WSO2 apis etc)

    validateProps(props);

    const wso2ApiDefs = applyDefaultsWso2ApiDefinition(
      props.wso2ApiDefinition,
      props.openapiDocument,
    );

    const { accountId, region } = new ScopedAws(scope);

    // lambda function used for invoking WSO2 APIs during CFN operations
    const customResourceFunction = new BaseNodeJsFunction(this, 'Wso2ApiCustomResourceFunction', {
      stage: 'dev',
      timeout: Duration.seconds(120),
      runtime: Runtime.NODEJS_18_X,
      eventType: EventType.CustomResource,
      entry: 'src/wso2/wso2-api/handler.ts',
      initialPolicy: [
        PolicyStatement.fromJson({
          Effect: 'Allow',
          Action: 'secretsmanager:GetSecretValue',
          Resource: `arn:aws:secretsmanager:${region}:${accountId}:secret:${props.wso2CredentialsSecretManagerPath}*`,
        }),
      ],
      logRetention: props.customResourceConfig.logRetention,
      ...props.customResourceConfig,
    });
    customResourceFunction.defaultSecurityGroup?.addEgressRule(Peer.anyIpv4(), Port.allTraffic());

    const customResourceProvider = new Provider(this, 'Wso2ApiCustomResourceProvider', {
      onEventHandler: customResourceFunction.nodeJsFunction,
      logRetention: props.customResourceConfig.logRetention,
    });

    // TODO test if large open api documents can be passed by Custom Resource properties

    this.wso2ApiCustomResource = new CustomResource(this, 'Wso2ApiCustomResource', {
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        wso2BaseUrl: props.wso2BaseUrl,
        wso2CredentialsSecretManagerPath: props.wso2CredentialsSecretManagerPath,
        openapiDocument: props.openapiDocument,
        wso2ApiDefinition: wso2ApiDefs,
      },
      resourceType: 'Custom::Wso2ApiCustomResource',
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });
  }
}

export const validateProps = (props: Wso2ApiProps): void => {
  if (!props.wso2BaseUrl) throw new Error('wso2ApiBaseUrl is required');
  if (!props.wso2CredentialsSecretManagerPath) {
    throw new Error('wso2CredentialsSecretManagerPath is required');
  }
  validateWso2ApiDefs(props.wso2ApiDefinition);
  lintOpenapiDocument(props.openapiDocument, false);
};
