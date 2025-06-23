import type { JestConfigWithTsJest } from "ts-jest";
import { pathsToModuleNameMapper } from "ts-jest";
// Import the entire tsconfig.json as the default export
import tsconfig from "./tsconfig.json" with { type: "json" };

// Destructure compilerOptions from the imported tsconfig object
const { compilerOptions } = tsconfig;

const config: JestConfigWithTsJest = {
  // Use the recommended ESM preset string
  preset: "ts-jest/presets/default-esm",

  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  setupFiles: ["<rootDir>/test/setupEnv.ts"],
  roots: ["<rootDir>"],
  modulePaths: [compilerOptions.baseUrl],
  // Automatically generate module name mappers from tsconfig.json
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/" }),
    "server-only": "<rootDir>/test/__mocks__/server-only.ts"
  },

  // Your transform configuration is correct, but it's part of the preset.
  // We include it here to ensure it uses the correct tsconfig.
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { useESM: true, tsconfig: "./tsconfig.jest.json" }
    ]
  }
};

export default config;
