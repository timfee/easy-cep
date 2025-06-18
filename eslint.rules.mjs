// eslint-rules/workflow-rules.ts
import { ESLintUtils } from "@typescript-eslint/utils";
import * as fs from "fs";
import * as path from "path";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rules/${name}`
);

// Parse constants.ts to get all ApiEndpoint paths
function getApiEndpoints(projectRoot) {
  const constantsPath = path.join(projectRoot, "constants.ts");
  if (!fs.existsSync(constantsPath)) return new Set();

  const content = fs.readFileSync(constantsPath, "utf-8");
  const endpoints = new Set();

  // Match string literals in ApiEndpoint object
  const regex = /["'](https?:\/\/[^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    endpoints.add(match[1]);
  }

  return endpoints;
}

// Parse workflow variable names from variables.ts
function getVarEnumValues(projectRoot) {
  const varsPath = path.join(projectRoot, "lib/workflow/variables.ts");
  if (!fs.existsSync(varsPath)) return new Set();

  const content = fs.readFileSync(varsPath, "utf-8");
  const vars = new Set();

  const obj = content.match(/WORKFLOW_VARIABLES\s*=\s*{([\s\S]*?)}/);
  if (!obj) return vars;

  const regex = /(\w+)\s*:/g;
  let match;
  while ((match = regex.exec(obj[1])) !== null) {
    vars.add(match[1]);
  }

  return vars;
}

export const noHardcodedUrls = createRule({
  name: "no-hardcoded-urls",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce using ApiEndpoint constants instead of hardcoded URLs"
    },
    messages: {
      useApiEndpoint:
        "Use ApiEndpoint constants instead of hardcoded URL: {{url}}"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    const projectRoot = context.getCwd();
    const knownEndpoints = getApiEndpoints(projectRoot);

    return {
      Literal(node) {
        if (
          typeof node.value === "string"
          && node.value.startsWith("https://")
          && (node.value.includes("googleapis.com")
            || node.value.includes("graph.microsoft.com"))
        ) {
          // Check if this URL matches any known endpoint
          const baseUrl = node.value.split("?")[0].replace(/\/[^/]+$/, "");

          for (const endpoint of knownEndpoints) {
            if (endpoint.startsWith(baseUrl)) {
              context.report({
                node,
                messageId: "useApiEndpoint",
                data: { url: node.value }
              });
              return;
            }
          }
        }
      }
    };
  }
});

export const mustDestructureContext = createRule({
  name: "must-destructure-context",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce destructuring context in check and execute functions"
    },
    messages: {
      destructureContext:
        "Must destructure context parameter in {{method}} method"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      PropertyDefinition(node) {
        if (
          node.key.type === "Identifier"
          && (node.key.name === "check" || node.key.name === "execute")
          && node.value
          && node.value.type === "ArrowFunctionExpression"
        ) {
          const firstParam = node.value.params[0];
          if (!firstParam || firstParam.type !== "ObjectPattern") {
            context.report({
              node: firstParam || node,
              messageId: "destructureContext",
              data: { method: node.key.name }
            });
          }
        }
      }
    };
  }
});

export const mustUseTryCatch = createRule({
  name: "must-use-try-catch",
  meta: {
    type: "problem",
    docs: { description: "Enforce try-catch in check and execute methods" },
    messages: {
      missingTryCatch: "{{method}} method must wrap all logic in try-catch"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      PropertyDefinition(node) {
        if (
          node.key.type === "Identifier"
          && (node.key.name === "check" || node.key.name === "execute")
          && node.value
          && node.value.type === "ArrowFunctionExpression"
        ) {
          const body = node.value.body;

          // Check if body is a block with try-catch as first statement
          if (
            body.type !== "BlockStatement"
            || body.body.length === 0
            || body.body[0].type !== "TryStatement"
          ) {
            context.report({
              node: body,
              messageId: "missingTryCatch",
              data: { method: node.key.name }
            });
          }
        }
      }
    };
  }
});

export const mustCallRequiredCallbacks = createRule({
  name: "must-call-required-callbacks",
  meta: {
    type: "problem",
    docs: {
      description: "Enforce calling required callbacks in check and execute"
    },
    messages: { missingCallback: "{{method}} must call one of: {{callbacks}}" },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    const checkCallbacks = [
      "markComplete",
      "markIncomplete",
      "markCheckFailed"
    ];
    const executeCallbacks = ["markSucceeded", "markFailed", "markPending"];

    function checkForCallbacks(node, method, requiredCallbacks) {
      const calledFunctions = new Set();

      // Walk the AST to find function calls
      function walk(n) {
        if (n.type === "CallExpression" && n.callee.type === "Identifier") {
          calledFunctions.add(n.callee.name);
        }

        // Recursively walk child nodes
        Object.values(n).forEach((child) => {
          if (child && typeof child === "object") {
            if (Array.isArray(child)) {
              child.forEach(walk);
            } else if ("type" in child) {
              walk(child);
            }
          }
        });
      }

      walk(node);

      // Check if at least one required callback was called
      const hasRequiredCallback = requiredCallbacks.some((cb) =>
        calledFunctions.has(cb)
      );

      if (!hasRequiredCallback) {
        context.report({
          node,
          messageId: "missingCallback",
          data: { method, callbacks: requiredCallbacks.join(", ") }
        });
      }
    }

    return {
      PropertyDefinition(node) {
        if (
          node.key.type === "Identifier"
          && (node.key.name === "check" || node.key.name === "execute")
          && node.value
          && node.value.type === "ArrowFunctionExpression"
          && node.value.body.type === "BlockStatement"
        ) {
          const callbacks =
            node.key.name === "check" ? checkCallbacks : executeCallbacks;
          checkForCallbacks(node.value.body, node.key.name, callbacks);
        }
      }
    };
  }
});

export const noDirectFetchWithAuth = createRule({
  name: "no-direct-fetch-with-auth",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce using fetchGoogle/fetchMicrosoft instead of fetch with auth headers"
    },
    messages: {
      useFetchHelper:
        "Use {{helper}} instead of fetch with Authorization header"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier"
          && node.callee.name === "fetch"
          && node.arguments.length >= 2
        ) {
          const options = node.arguments[1];

          // Check if options contains headers with Authorization
          if (options.type === "ObjectExpression") {
            const headersProperty = options.properties.find(
              (prop) =>
                prop.type === "Property"
                && prop.key.type === "Identifier"
                && prop.key.name === "headers"
            );

            if (headersProperty && headersProperty.type === "Property") {
              const url = node.arguments[0];
              let helper = "fetchGoogle or fetchMicrosoft";

              if (url.type === "Literal" && typeof url.value === "string") {
                if (url.value.includes("googleapis.com")) {
                  helper = "fetchGoogle";
                } else if (url.value.includes("graph.microsoft.com")) {
                  helper = "fetchMicrosoft";
                }
              }

              context.report({
                node,
                messageId: "useFetchHelper",
                data: { helper }
              });
            }
          }
        }
      }
    };
  }
});

export const mustDefineSchemaInline = createRule({
  name: "must-define-schema-inline",
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce defining Zod schemas inline before API calls"
    },
    messages: {
      defineSchemaInline:
        "Define Zod schema as a const immediately before using in {{method}} call"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier"
          && (node.callee.name === "fetchGoogle"
            || node.callee.name === "fetchMicrosoft")
          && node.arguments.length >= 2
        ) {
          const schemaArg = node.arguments[1];

          // We want schemas to be defined as variables (not inline z.object())
          // but close to where they're used
          if (schemaArg.type === "Identifier") {
            // Simple check: warn if it looks like a generic name
            const schemaName = schemaArg.name;
            if (schemaName === "schema" || schemaName === "Schema") {
              context.report({
                node: schemaArg,
                messageId: "defineSchemaInline",
                data: { method: node.callee.name }
              });
            }
          }
        }
      }
    };
  }
});

export const useVarEnum = createRule({
  name: "use-var-enum",
  meta: {
    type: "problem",
    docs: { description: "Enforce using Var enum instead of string literals" },
    messages: {
      useVarEnum: 'Use Var.{{suggestion}} instead of string literal "{{value}}"'
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    const projectRoot = context.getCwd();
    const varValues = getVarEnumValues(projectRoot);

    // Map of var values to their enum names
    const valueToEnum = new Map();
    varValues.forEach((value) => {
      // Convert camelCase to PascalCase for enum name
      const enumName = value.charAt(0).toUpperCase() + value.slice(1);
      valueToEnum.set(value, enumName);
    });

    return {
      Property(node) {
        if (
          node.computed
          && node.key.type === "Literal"
          && typeof node.key.value === "string"
          && valueToEnum.has(node.key.value)
        ) {
          context.report({
            node: node.key,
            messageId: "useVarEnum",
            data: {
              value: node.key.value,
              suggestion: valueToEnum.get(node.key.value)
            }
          });
        }
      }
    };
  }
});
// Additional rules for eslint-rules/workflow-rules.ts

export const mustExportCreateStep = createRule({
  name: "must-export-create-step",
  meta: {
    type: "problem",
    docs: {
      description: "Step files must export result of createStep as default"
    },
    messages: { missingCreateStep: "Must export default createStep<...>(...)" }
  },
  defaultOptions: [],
  create(context) {
    let hasDefaultExport = false;
    let usesCreateStep = false;

    return {
      ExportDefaultDeclaration(node) {
        hasDefaultExport = true;
        if (
          node.declaration.type === "CallExpression"
          && node.declaration.callee.type === "Identifier"
          && node.declaration.callee.name === "createStep"
        ) {
          usesCreateStep = true;
        }
      },
      "Program:exit"() {
        if (!hasDefaultExport || !usesCreateStep) {
          context.report({
            node: context.getSourceCode().ast,
            messageId: "missingCreateStep"
          });
        }
      }
    };
  }
});

export const checkDataTypeRequired = createRule({
  name: "check-data-type-required",
  meta: {
    type: "problem",
    docs: { description: "createStep must have explicit CheckData type" },
    messages: {
      missingCheckDataType:
        "Define CheckData interface and pass to createStep<CheckData>"
    }
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier"
          && node.callee.name === "createStep"
        ) {
          // Check if it has type arguments
          if (!node.typeArguments || node.typeArguments.params.length === 0) {
            context.report({ node, messageId: "missingCheckDataType" });
          }
        }
      }
    };
  }
});

export const noStateMutations = createRule({
  name: "no-state-mutations",
  meta: {
    type: "problem",
    docs: {
      description: "Steps cannot mutate vars directly, must use callbacks"
    },
    messages: {
      noDirectMutation: "Use markSucceeded() to set vars, not direct mutation"
    }
  },
  defaultOptions: [],
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type === "MemberExpression"
          && node.left.object.type === "Identifier"
          && (node.left.object.name === "vars"
            || node.left.object.name === "state")
        ) {
          context.report({ node, messageId: "noDirectMutation" });
        }
      }
    };
  }
});

export const mustUseContextFetch = createRule({
  name: "must-use-context-fetch",
  meta: {
    type: "problem",
    docs: { description: "Must use fetchGoogle/fetchMicrosoft from context" },
    messages: { useContextFetch: "Use {{method}} from destructured context" }
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        // Check for ctx.fetchGoogle pattern (should be destructured)
        if (
          node.callee.type === "MemberExpression"
          && node.callee.object.type === "Identifier"
          && (node.callee.object.name === "ctx"
            || node.callee.object.name === "context")
          && node.callee.property.type === "Identifier"
          && (node.callee.property.name === "fetchGoogle"
            || node.callee.property.name === "fetchMicrosoft")
        ) {
          context.report({
            node,
            messageId: "useContextFetch",
            data: { method: node.callee.property.name }
          });
        }
      }
    };
  }
});

// Add these to eslint-rules/workflow-rules.ts

// Parse StepId values from step-ids.ts
function getStepIdEnumValues(projectRoot) {
  const idsPath = path.join(projectRoot, "lib/workflow/step-ids.ts");
  if (!fs.existsSync(idsPath)) return new Map();

  const content = fs.readFileSync(idsPath, "utf-8");
  const stepIds = new Map();

  // Match StepId object values

  const regex = /([A-Za-z]+):\s*['"]([^'"\n]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const [, enumName, stringValue] = match;
    stepIds.set(stringValue, enumName);
  }

  return stepIds;
}

export const useStepIdEnum = createRule({
  name: "use-step-id-enum",
  meta: {
    type: "problem",
    docs: { description: "Use StepId enum values instead of string literals" },
    messages: {
      useStepIdEnum: 'Use StepId.{{suggestion}} instead of "{{value}}"'
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    const projectRoot = context.getCwd();
    const stepIdMap = getStepIdEnumValues(projectRoot);

    return {
      Property(node) {
        if (
          node.key.type === "Identifier"
          && node.key.name === "id"
          && node.value.type === "Literal"
          && typeof node.value.value === "string"
          && stepIdMap.has(node.value.value)
        ) {
          context.report({
            node: node.value,
            messageId: "useStepIdEnum",
            data: {
              value: node.value.value,
              suggestion: stepIdMap.get(node.value.value)
            }
          });
        }
      }
    };
  }
});

export const noStringStepIds = createRule({
  name: "no-string-step-ids",
  meta: {
    type: "problem",
    docs: { description: "Do not use string literals for step IDs" },
    messages: {
      noStringStepId: "Use StepId enum instead of string literal for step IDs"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        // Check getStep() calls
        if (
          node.callee.type === "Identifier"
          && node.callee.name === "getStep"
          && node.arguments.length > 0
          && node.arguments[0].type === "Literal"
          && typeof node.arguments[0].value === "string"
        ) {
          context.report({
            node: node.arguments[0],
            messageId: "noStringStepId"
          });
        }

        // Check runStep() calls
        if (
          node.callee.type === "Identifier"
          && node.callee.name === "runStep"
          && node.arguments.length > 0
          && node.arguments[0].type === "Literal"
          && typeof node.arguments[0].value === "string"
        ) {
          context.report({
            node: node.arguments[0],
            messageId: "noStringStepId"
          });
        }
      }
    };
  }
});

export const importTypesFromTypes = createRule({
  name: "import-types-from-types",
  meta: {
    type: "problem",
    docs: {
      description: "Import types from @/types instead of defining locally"
    },
    messages: {
      importFromTypes: 'Import {{type}} from "@/types" instead of defining it'
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    const coreTypes = new Set([
      "Var",
      "StepId",
      "StepOutcome",
      "LogLevel",
      "WorkflowVars",
      "StepCheckContext",
      "StepExecuteContext",
      "StepUIState"
    ]);

    return {
      // Check for local type definitions that should be imported
      TSEnumDeclaration(node) {
        if (coreTypes.has(node.id.name)) {
          context.report({
            node,
            messageId: "importFromTypes",
            data: { type: node.id.name }
          });
        }
      },
      TSInterfaceDeclaration(node) {
        if (coreTypes.has(node.id.name)) {
          context.report({
            node,
            messageId: "importFromTypes",
            data: { type: node.id.name }
          });
        }
      },
      // Check imports are from correct location
      ImportDeclaration(node) {
        if (
          node.source.value === "./types"
          || node.source.value === "../types"
        ) {
          // Should be @/types
          const importedTypes = node.specifiers
            .filter((spec) => spec.type === "ImportSpecifier")
            .map((spec) => spec.imported.name)
            .filter((name) => coreTypes.has(name));

          if (importedTypes.length > 0) {
            context.report({
              node: node.source,
              messageId: "importFromTypes",
              data: { type: importedTypes.join(", ") }
            });
          }
        }
      }
    };
  }
});

export const importConstantsFromConstants = createRule({
  name: "import-constants-from-constants",
  meta: {
    type: "problem",
    docs: { description: "Import constants from constants.ts" },
    messages: {
      importFromConstants:
        "Import {{constant}} from constants.ts instead of hardcoding"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      VariableDeclaration(node) {
        // Check for local ApiEndpoint definitions
        if (
          node.declarations.some(
            (decl) =>
              decl.id.type === "Identifier" && decl.id.name === "ApiEndpoint"
          )
        ) {
          context.report({
            node,
            messageId: "importFromConstants",
            data: { constant: "ApiEndpoint" }
          });
        }

        // Check for local TemplateId definitions
        if (
          node.declarations.some(
            (decl) =>
              decl.id.type === "Identifier" && decl.id.name === "TemplateId"
          )
        ) {
          context.report({
            node,
            messageId: "importFromConstants",
            data: { constant: "TemplateId" }
          });
        }
      }
    };
  }
});

export const noAnyInSchemas = createRule({
  name: "no-any-in-schemas",
  meta: {
    type: "problem",
    docs: { description: "Do not use any type in Zod schemas" },
    messages: {
      noAnyInSchema: "Use specific types instead of z.any() in schemas"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        // Check for z.any() calls
        if (
          node.callee.type === "MemberExpression"
          && node.callee.object.type === "Identifier"
          && node.callee.object.name === "z"
          && node.callee.property.type === "Identifier"
          && node.callee.property.name === "any"
        ) {
          context.report({ node, messageId: "noAnyInSchema" });
        }
      }
    };
  }
});

export const noProcessEnv = createRule({
  name: "no-process-env",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct process.env usage in workflow steps"
    },
    messages: {
      noProcessEnv:
        "Direct use of process.env is forbidden; use env.ts or workflow vars"
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier"
          && node.object.name === "process"
          && node.property.type === "Identifier"
          && node.property.name === "env"
        ) {
          context.report({ node, messageId: "noProcessEnv" });
        }
      }
    };
  }
});

export const rules = {
  "check-data-type-required": checkDataTypeRequired,
  "import-constants-from-constants": importConstantsFromConstants,
  "import-types-from-types": importTypesFromTypes,
  "must-call-required-callbacks": mustCallRequiredCallbacks,
  "must-define-schema-inline": mustDefineSchemaInline,
  "must-destructure-context": mustDestructureContext,
  "must-export-create-step": mustExportCreateStep,
  "must-use-context-fetch": mustUseContextFetch,
  "must-use-try-catch": mustUseTryCatch,
  "no-any-in-schemas": noAnyInSchemas,
  "no-direct-fetch-with-auth": noDirectFetchWithAuth,
  "no-hardcoded-urls": noHardcodedUrls,
  "no-state-mutations": noStateMutations,
  "no-string-step-ids": noStringStepIds,
  "use-step-id-enum": useStepIdEnum,
  "use-var-enum": useVarEnum,
  "no-process-env": noProcessEnv
};

// eslint-disable-next-line import/no-anonymous-default-export
export default { rules };
