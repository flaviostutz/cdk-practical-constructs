// eslint-disable-next-line import/no-commonjs
module.exports = {
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(tsx?|json?)$': [
      'esbuild-jest',
      {
        sourcemap: true, // correct line numbers in code coverage
      },
    ],
  },
  coverageReporters: ['text'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**', '!**/__tests__/**'],
  coverageThreshold: {
    global: {
      lines: 95,
      functions: 90,
      branches: 70,
    },
  },
};