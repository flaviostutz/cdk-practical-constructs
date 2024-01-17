import { Wso2ApiDefinition, Wso2ApiProps } from './types';

export const validateProps = (props: Wso2ApiProps): Wso2ApiProps => {
  if (!props.wso2BaseUrl) throw new Error('wso2ApiBaseUrl is required');
  if (!props.wso2CredentialsSecretManagerPath) {
    throw new Error('wso2CredentialsSecretManagerPath is required');
  }

  // TODO check impl

  const apiDef = props.wso2ApiDefinition;
  if (!apiDef.context) {
    throw new Error('context is required (it is used in api url prefix)');
  }
  if (!apiDef.name) {
    throw new Error('name is required');
  }
  if (!apiDef.gatewayEnvironments || apiDef.gatewayEnvironments.length === 0) {
    throw new Error('gatewayEnvironments must have at least one element');
  }

  validateVisibility(apiDef);

  return props;
};

const validateVisibility = (apiDef: Wso2ApiDefinition): void => {
  if (apiDef.subscriberVisibility) {
    if (!['RESTRICTED', 'PRIVATE', 'PUBLIC'].includes(apiDef.subscriberVisibility)) {
      throw new Error('subscriberVisibility must be RESTRICTED, PRIVATE or PUBLIC');
    }
    if (apiDef.subscriberVisibility === 'RESTRICTED') {
      if (
        !Array.isArray(apiDef.subscriberVisibilityRoles) ||
        apiDef.subscriberVisibilityRoles.length === 0
      ) {
        throw new Error(
          'subscriberVisibilityRoles must be defined when subscriberVisibility is RESTRICTED',
        );
      }
    }
  }

  if (apiDef.publisherVisibility) {
    if (!['RESTRICTED', 'PRIVATE'].includes(apiDef.publisherVisibility)) {
      throw new Error('publisherVisibility must be RESTRICTED or PRIVATE');
    }
    if (apiDef.publisherVisibility === 'RESTRICTED') {
      if (
        !Array.isArray(apiDef.publisherVisibilityRoles) ||
        apiDef.publisherVisibilityRoles.length === 0
      ) {
        throw new Error(
          'publisherVisibilityRoles must be defined when publisherVisibility is RESTRICTED',
        );
      }
    }
  }
};
