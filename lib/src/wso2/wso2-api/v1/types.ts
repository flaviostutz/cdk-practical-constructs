import { API as APIv1 } from './types-swagger';

export type Wso2ApiDefinitionV1 = Omit<APIv1, 'createdTime' | 'lastUpdatedTime'>;
