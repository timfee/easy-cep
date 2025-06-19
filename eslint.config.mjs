import { FlatCompat } from "@eslint/eslintrc";
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
  { plugins: { workflow: customRules } },
  {
    files: ["lib/workflow/steps/*.ts"],
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
      "workflow/no-process-env": "error",

      // 5. Configuration enforcement
      "workflow/no-hardcoded-config": "error",
      "workflow/require-var-enum-in-steps": "error",

      // 6. Error handling consistency
      "workflow/use-error-utils": "error"
    }
  },
  {
    files: ["lib/workflow/engine.ts", "lib/workflow/fetch-utils.ts"],
    rules: {
      // Engine-specific rules
      "workflow/no-duplicate-code-blocks": [
        "error",
        { minLines: 20, threshold: 0.8 }
      ],
      "workflow/require-token-refresh": "error"
    }
  },
  {
    files: ["**/__tests__/**", "test/**"],
    rules: {
      "no-magic-numbers": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "workflow/no-hardcoded-config": "off"
    }
  },
  {
    ignores: [
      "**/__tests__/**",
      "test/**",
      "constants.ts",
      "**/api-prefixes.ts",
      "types.ts",
      "app/components/WorkflowClient.tsx" // Allow default values here
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" }
      ],
      // 1. Constant usage
      "workflow/no-hardcoded-urls": "error",
      "workflow/no-hardcoded-config": "error",

      // 2. Type safety
      "workflow/use-var-enum": "error",
      "workflow/use-step-id-enum": "error",
      "workflow/no-string-step-ids": "error",

      // 3. Import rules
      "workflow/import-types-from-types": "error",
      "workflow/import-constants-from-constants": "error",

      // 4. Error handling
      "workflow/use-error-utils": "error",

      // 5. Code quality
      "workflow/no-duplicate-code-blocks": [
        "warn",
        { minLines: 15, threshold: 0.7 }
      ]
    }
  },
  {
    files: ["scripts/**/*.ts", "scripts/**/*.js"],
    rules: {
      // Scripts can have more lenient rules
      "workflow/no-hardcoded-config": "off",
      "workflow/no-process-env": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];

export default eslintConfig;
