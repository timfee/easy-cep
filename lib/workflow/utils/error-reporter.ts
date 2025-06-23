import { WorkflowVars } from "@/types";
import { inspect } from "node:util";

export function logUncaughtError(
  error: unknown,
  context: { stepId?: string; operation?: string; vars: Partial<WorkflowVars> }
) {
  console.error("\n**** UNCAUGHT ERROR *****");
  console.error(`Step: ${context.stepId || "unknown"}`);
  console.error(`Operation: ${context.operation || "unknown"}`);

  const sanitizedVars = Object.entries(context.vars).reduce(
    (acc, [key, value]) => {
      if (
        key.toLowerCase().includes("token")
        || key.toLowerCase().includes("password")
      ) {
        acc[key] = "[REDACTED]";
      } else {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, unknown>
  );

  console.error(
    "Variables:",
    inspect(sanitizedVars, { depth: 3, colors: true })
  );
  console.error("Error:", inspect(error, { depth: null, colors: true }));
  console.error("******** /UNCAUGHT ERROR ********\n");
}
