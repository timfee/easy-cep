import type { VarName, WorkflowVars } from "./variables";

export interface BasicVarStore {
  get<K extends VarName>(key: K): WorkflowVars[K] | undefined;
  require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]>;
  build(template: string): string;
}

export function createVarStore(vars: Partial<WorkflowVars>): BasicVarStore {
  return {
    get: <K extends VarName>(key: K) => vars[key],
    require: <K extends VarName>(key: K) => {
      const value = vars[key];
      if (value === undefined)
        throw new Error(`Required variable ${key} is missing`);
      return value as NonNullable<WorkflowVars[K]>;
    },
    build: (template: string) => {
      return template.replace(/\{(\w+)\}/g, (_, key) => {
        const value = vars[key as VarName];
        if (value === undefined)
          throw new Error(`Template variable ${key} is missing`);
        return String(value);
      });
    }
  };
}
