// /* eslint-disable camelcase */

// import { NetworkConfig } from '../../src/lambda/types';

// // https://stackoverflow.com/questions/43159887/make-a-single-property-optional-in-typescript
// export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// /**
//  * Configurations resolved for a specific stage
//  */
// export type StageConfig = {
//   services: ServiceConfig;
//   lambda: GlobalLambdaConfig;
//   env: {
//     account?: string;
//     region: string;
//   };
//   network?: NetworkConfig;
// };

// /**
//  * Global configurations
//  * This will be used to resolve configurations for specific stages
//  */
// export type GlobalConfig = {
//   default: StageConfig;
//   dev?: StageConfig;
//   tst: StageConfig;
//   acc: StageConfig;
//   prd: StageConfig;
// };
