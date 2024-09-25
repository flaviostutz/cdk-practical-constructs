// FIXME fill in type
export type Wso2SubscriptionInfo = Wso2SubscriptionDefinition & {
  // /** @example 01234567-0123-0123-0123-012345678901 */
  // applicationId?: string;
  // /**
  //  * @default
  //  * @example APPROVED
  //  */
  // status?: string;
  // /** @example [] */
  // groups?: string[];
  // subscriptionCount?: number;
  // /**
  //  * Scopes allowed by this application
  //  * @example []
  //  * */
  // subscriptionScopes?: ScopeInfo[];
  // /**
  //  * @description Application created user
  //  *
  //  * @example admin
  //  */
  // owner?: string;
  // /** @example false */
  // hashEnabled?: boolean;
};

export type Wso2SubscriptionDefinition = {
  // /** @example CalculatorApp */
  // name: string;
  // /** @example Unlimited */
  // throttlingPolicy: 'Unlimited' | 'Bronze' | 'Silver' | 'Gold' | string;
  // /** @example Sample calculator application */
  // description?: string;
  // /**
  //  * @description Type of the access token generated for this application.
  //  *
  //  * **JWT:** A self-contained, signed JWT based access token which is issued by default.
  //  *
  //  * @default JWT
  //  * @example JWT
  //  * @enum {string}
  //  */
  // tokenType?: 'JWT';
  // /** @example {} */
  // attributes?: { [key: string]: string };
};
