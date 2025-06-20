import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  setupFiles: ["<rootDir>/test/setupEnv.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "server-only": "<rootDir>/test/__mocks__/server-only.ts"
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  globals: { "ts-jest": { useESM: true, tsconfig: "tsconfig.jest.json" } }
};

export default config;
