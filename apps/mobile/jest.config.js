/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          strict: true,
          module: 'commonjs',
          moduleResolution: 'node',
          types: ['jest'],
        },
      },
    ],
  },
};
