import { FlatCompat } from "@eslint/eslintrc";
import sonar from "eslint-plugin-sonarjs";
import tsdoc from "eslint-plugin-tsdoc";
import { dirname } from "path";
import { fileURLToPath } from "url";
import customRules from "./eslint.rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      ".next",
      "out",
      "public",
      "cypress",
      "e2e",
      "playwright",
      ".turbo"
    ]
  },
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "plugin:promise/recommended"
  ),
  sonar.configs.recommended,
  {
    plugins: { tsdoc, workflow: customRules },
    rules: {
      "tsdoc/syntax": "warn",
      // eslint-disable-next-line no-magic-numbers
      "sonarjs/cognitive-complexity": ["warn", 20],
      "no-magic-numbers": ["warn", { ignore: [-1, 0, 1] }]
    }
  },
  {
    files: ["app/workflow/steps/*.ts"],
    rules: {
      // 1. Step structure enforcement
      "workflow/must-export-create-step": "error",
      "workflow/must-destructure-context": "error",
      "workflow/must-use-try-catch": "error",
      "workflow/must-call-required-callbacks": "error",

      // 2. No direct API calls
      "workflow/no-direct-fetch-with-auth": "error",
      "workflow/must-use-context-fetch": "error",

      // 3. Schema requirements
      "workflow/must-define-schema-inline": "error",
      "workflow/no-any-in-schemas": "error",

      // 4. Step-specific patterns
      "workflow/check-data-type-required": "error",
      "workflow/no-state-mutations": "error",
      "workflow/no-console-log": "error" // Use ctx.log instead
    }
  },
  {
    files: ["**/__tests__/**", "test/**"],
    rules: {
      "custom/no-console-log": "off",
      "no-magic-numbers": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "sonarjs/no-nested-conditional": "off"
    }
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" }
      ],
      // 1. Constant usage
      "workflow/no-hardcoded-urls": "error",
      "workflow/use-api-endpoint": "error",

      // 2. Type safety
      "workflow/use-var-enum": "error",
      "workflow/use-step-id-enum": "error",
      "workflow/no-string-step-ids": "error",

      // 3. Import rules
      "workflow/import-types-from-types": "error",
      "workflow/import-constants-from-constants": "error"
    }
  },
  { files: ["jest.config.ts"], rules: { "sonarjs/slow-regex": "off" } }
];

export default eslintConfig;
