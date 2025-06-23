import type { JestConfigWithTsJest } from "ts-jest";
import { pathsToModuleNameMapper } from "ts-jest";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsconfigFile = fs.readFileSync(
  path.resolve(__dirname, "./tsconfig.json"),
  "utf-8"
);
const tsconfig = JSON.parse(tsconfigFile);

const { compilerOptions } = tsconfig;

const config: JestConfigWithTsJest = {
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
