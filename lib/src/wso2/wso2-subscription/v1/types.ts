export type Wso2SubscriptionInfo = Wso2SubscriptionDefinition & {
  /**
   * Subscription Id
   * @example 123-456-789
   */
  subscriptionId: string;
};

export type Wso2SubscriptionDefinition = {
  /**
   * Api Id that will be subscribed by an application
   * @example 123-456-789
   */
  apiId: string;
  /**
   * Application Id that will subscribe to the API
   * @example 123-456-789
   */
  applicationId: string;
  // /**
  //  * Subscription Id of the subscription. If not defined a new Subscription might be created during createOrUpdate operations.
  //  * @example 123-456-789
  //  */
  // subscriptionId?: string;
  /**
   * Throttling policy applied to the calls from this Application
   * @example Unlimited
   * */
  throttlingPolicy: 'Unlimited' | 'Bronze' | 'Silver' | 'Gold' | string;
  /**
   * Status of the subscription
   * @example Unlimited
   * */
  status?:
    | 'BLOCKED'
    | 'PROD_ONLY_BLOCKED'
    | 'UNBLOCKED'
    | 'ON_HOLD'
    | 'REJECTED'
    | 'TIER_UPDATE_PENDING';
};
