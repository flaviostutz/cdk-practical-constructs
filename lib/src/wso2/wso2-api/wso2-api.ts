import { Construct } from 'constructs';
import { CustomResource, RemovalPolicy } from 'aws-cdk-lib/core';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { OpenAPIObject } from 'openapi3-ts/oas30';

import { lintOpenapiDocument } from '../../utils/openapi-lint';
import { addLambdaAndProviderForWso2Operations } from '../utils-cdk';

import { Wso2ApiCustomResourceProperties, Wso2ApiProps } from './types';
import { applyDefaultsWso2ApiDefinition, validateWso2ApiDefs } from './api-defs';
import { Wso2ApiDefinitionV1 } from './v1/types';

/**
 * WSO2 API CDK construct for creating WSO2 APIs based on Openapi and WSO2-specific configurations
 * This construct is related to one "physical" api in WSO2.
 *
 * The internal implementation tries to protect itself from various scenarios where larger or more complex
 * WSO2 clusters might lead to out-of-order or delays in operations that happen assynchronously after the API
 * accepts the requests, so for every mutation, there is a check to verify sanity.
 */
export class Wso2Api extends Construct {
  readonly customResourceFunction: IFunction;

  readonly apiDefinition: Wso2ApiDefinitionV1;

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

    const { customResourceProvider, customResourceFunction } =
      addLambdaAndProviderForWso2Operations({
        scope: this,
        id: `${id}-wso2api`,
        props,
        baseDir: __dirname,
      });

    // TODO check if large open api documents can be passed by Custom Resource properties

    // eslint-disable-next-line no-new
    new CustomResource(this, `${id}-wso2api-custom-resource`, {
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        wso2Config: props.wso2Config,
        apiDefinition: wso2ApiDefs,
        openapiDocument: props.openapiDocument,
        retryOptions: props.retryOptions,
      } satisfies Wso2ApiCustomResourceProperties,
      resourceType: 'Custom::Wso2Api',
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    this.apiDefinition = wso2ApiDefs;
    this.openapiDocument = props.openapiDocument;
    this.customResourceFunction = customResourceFunction.nodeJsFunction;
  }
}

export const validateProps = (props: Wso2ApiProps): void => {
  if (!props.wso2Config) throw new Error('wso2Config is required');
  if (!props.wso2Config.baseApiUrl) throw new Error('wso2Config.baseApiUrl is required');
  if (!props.wso2Config.credentialsSecretId) {
    throw new Error('wso2Config.credentialsSecretManagerPath is required');
  }
  validateWso2ApiDefs(props.apiDefinition);
  if (!props.openapiDocument.openapi.startsWith('3.0')) {
    throw new Error('openapiDocument should be in openapi version 3.0');
  }
  lintOpenapiDocument(props.openapiDocument, false);
};
