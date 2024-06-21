// eslint-disable-next-line import/no-commonjs
module.exports = {
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  extends: '@stutzlab/eslint-config',
  rules: {
    'import/group-exports': 'off',
    'fp/no-class': 'off',
    'no-restricted-imports': [
      'error',
      {
        name: 'aws-cdk-lib',
        message:
          'Import from specialized package like `aws-cdk-lib/core` or `aws-cdk-lib/aws-iam` instead of aws-cdk-lib.',
      },
    ],
  },
};
