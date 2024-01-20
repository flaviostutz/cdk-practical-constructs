// /* eslint-disable camelcase */

// import { RetentionDays } from 'aws-cdk-lib/aws-logs';

// // Global configs
// export const globalConfig = {
//   default: {
//     env: {
//       region: 'us-east-1',
//     },
//     lambda: {
//       allowTLSOutboundTo: '10.0.0.0/8',
//       logRetention: RetentionDays.ONE_WEEK,
//     },
//     services: defaultServicesConfig,
//   },
//   dev: {
//     lambda: {},
//   },
//   tst: {
//     lambda: {
//       logRetention: RetentionDays.ONE_WEEK,
//     },
//   },
//   acc: {
//     lambda: {
//       logRetention: RetentionDays.ONE_MONTH,
//     },
//   },
//   prd: {
//     lambda: {
//       logRetention: RetentionDays.SIX_MONTHS,
//     },
//   },
// };
