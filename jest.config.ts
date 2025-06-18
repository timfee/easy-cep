import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setupEnv.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    'server-only': '<rootDir>/test/__mocks__/server-only.ts'
  }
};

export default config;
