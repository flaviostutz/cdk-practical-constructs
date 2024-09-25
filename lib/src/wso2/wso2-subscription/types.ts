import { Wso2BaseProperties } from '../types';

import { Wso2SubscriptionDefinition } from './v1/types';

export type Wso2SubscriptionCustomResourceProperties = Wso2SubscriptionProps;

/**
 * WSO2 Subscription construct parameters
 */
export type Wso2SubscriptionProps = Wso2BaseProperties & {
  subscriptionDefinition: Wso2SubscriptionDefinition;
};
