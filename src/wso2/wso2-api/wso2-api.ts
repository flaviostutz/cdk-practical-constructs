import { Construct } from 'constructs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { CustomResource, Duration, RemovalPolicy, ScopedAws } from 'aws-cdk-lib/core';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Peer, Port } from 'aws-cdk-lib/aws-ec2';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import { EventType } from '../../lambda/types';
import { lintOpenapiDocument } from '../../utils/openapi-lint';
import { BaseNodeJsFunction } from '../../lambda/lambda-base';

import { Wso2ApiDefinition, Wso2ApiProps } from './types';
import { applyDefaultsWso2ApiDefinition, validateWso2ApiDefs } from './wso2-api-defs';

/**
 * WSO2 API CDK construct for creating WSO2 APIs based on Openapi and WSO2-specific configurations
 * This construct is related to one "physical" api in WSO2.
 */
export class Wso2Api extends Construct {
  readonly customResourceFunction: IFunction;

  readonly apiDefinition: Wso2ApiDefinition;

  readonly openapiDocument: OpenAPIObject;

  constructor(scope: Construct, id: string, props: Wso2ApiProps) {
    super(scope, id);

    // Do as much of the logic in the construct as possible and leave only
    // the minimal complexity to the Lambda Custom Resource as it's harder
    // to debug and eventual errors will rollback the entire stack and will
    // make the feedback cycle much longer.

    // Keep this construct stateless (don't access WSO2 apis) and
    // leave the stateful part to the Lambda Custom Resource (accessing WSO2 apis etc)

    validateProps(props);

    const wso2ApiDefs = applyDefaultsWso2ApiDefinition(props.apiDefinition, props.openapiDocument);

    const { accountId, region } = new ScopedAws(scope);

    const logRetention = props.customResourceConfig?.logRetention ?? RetentionDays.ONE_MONTH;

    // lambda function used for invoking WSO2 APIs during CFN operations
    const customResourceFunction = new BaseNodeJsFunction(this, 'Wso2ApiCustomResourceFunction', {
      stage: 'dev',
      timeout: Duration.seconds(120),
      runtime: Runtime.NODEJS_18_X,
      eventType: EventType.CustomResource,
      entry: 'dist/wso2/wso2-api/handler/index.js',
      initialPolicy: [
        PolicyStatement.fromJson({
          Effect: 'Allow',
          Action: 'secretsmanager:GetSecretValue',
          Resource: `arn:aws:secretsmanager:${region}:${accountId}:secret:${props.wso2Config.credentialsSecretManagerPath}*`,
        }),
      ],
      logRetention,
      ...props.customResourceConfig,
    });

    // add default outbound rule for connecting to any host
    if (!props.customResourceConfig?.allowTLSOutboundTo) {
      customResourceFunction.defaultSecurityGroup?.addEgressRule(Peer.anyIpv4(), Port.allTraffic());
    }

    const customResourceProvider = new Provider(this, 'Wso2ApiCustomResourceProvider', {
      onEventHandler: customResourceFunction.nodeJsFunction,
      logRetention,
    });

    // TODO test if large open api documents can be passed by Custom Resource properties

    // eslint-disable-next-line no-new
    new CustomResource(this, 'Wso2ApiCustomResource', {
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        wso2Config: props.wso2Config,
        apiDefinition: wso2ApiDefs,
        openapiDocument: props.openapiDocument,
      },
      resourceType: 'Custom::Wso2ApiCustomResource',
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });

    this.apiDefinition = wso2ApiDefs;
    this.openapiDocument = props.openapiDocument;
    this.customResourceFunction = customResourceFunction.nodeJsFunction;
  }
}

export const validateProps = (props: Wso2ApiProps): void => {
  if (!props.wso2Config) throw new Error('wso2Config is required');
  if (!props.wso2Config.baseApiUrl) throw new Error('wso2Config.baseApiUrl is required');
  if (!props.wso2Config.credentialsSecretManagerPath) {
    throw new Error('wso2Config.credentialsSecretManagerPath is required');
  }
  validateWso2ApiDefs(props.apiDefinition);
  lintOpenapiDocument(props.openapiDocument, false);
};
