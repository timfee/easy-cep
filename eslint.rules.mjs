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

// Parse types.ts to get all Var enum values
function getVarEnumValues(projectRoot) {
  const typesPath = path.join(projectRoot, "types.ts");
  if (!fs.existsSync(typesPath)) return new Set();

  const content = fs.readFileSync(typesPath, "utf-8");
  const vars = new Set();

  // Match Var enum values
  const regex = /Var\.\w+\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
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
        "Define Zod schema inline before using in {{method}} call"
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

          // Check if schema is defined inline (should be a const/variable defined nearby)
          if (schemaArg.type === "Identifier") {
            // Look for the schema definition in the same scope
            const scope = context.getScope();
            const variable = scope.variables.find(
              (v) => v.name === schemaArg.name
            );

            if (variable && variable.defs.length > 0) {
              const def = variable.defs[0];

              // Check if it's defined far from usage (more than 10 lines)
              if (def.node.loc && node.loc) {
                const distance = node.loc.start.line - def.node.loc.start.line;
                if (distance > 10) {
                  context.report({
                    node: schemaArg,
                    messageId: "defineSchemaInline",
                    data: { method: node.callee.name }
                  });
                }
              }
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

// Export all rules
export const rules = {
  "no-hardcoded-urls": noHardcodedUrls,
  "must-destructure-context": mustDestructureContext,
  "must-use-try-catch": mustUseTryCatch,
  "must-call-required-callbacks": mustCallRequiredCallbacks,
  "no-direct-fetch-with-auth": noDirectFetchWithAuth,
  "must-define-schema-inline": mustDefineSchemaInline,
  "use-var-enum": useVarEnum
};
