import  { type VarName, type WorkflowVars } from "./variables";

/**
 * Basic variable accessor used in workflow contexts.
 */
export interface BasicVarStore {
  get<K extends VarName>(key: K): WorkflowVars[K] | undefined;
  require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]>;
  build(template: string): string;
}

function isVarName(
  value: string,
  vars: Partial<WorkflowVars>
): value is VarName {
  return value in vars;
}

/**
 * Require a variable to be present or throw.
 */
function requireVar<K extends VarName>(
  vars: Partial<WorkflowVars>,
  key: K
): NonNullable<WorkflowVars[K]> {
  const value = vars[key];
  if (value === undefined) {
    throw new Error(`Required variable ${key} is missing`);
  }
  return value;
}

/**
 * Create a variable store wrapper for workflow vars.
 */
export function createVarStore(vars: Partial<WorkflowVars>): BasicVarStore {
  return {
    build: (template: string) => template.replaceAll(/\{(\w+)\}/g, (match, rawKey: string) => {
        if (!isVarName(rawKey, vars)) {
          throw new Error(`Template variable ${rawKey} is missing`);
        }
        const value = requireVar(vars, rawKey);
        return String(value ?? match);
      }),
    get: <K extends VarName>(key: K) => vars[key],
    require: <K extends VarName>(key: K) => requireVar(vars, key),
  };
}
