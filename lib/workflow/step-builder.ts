import {
  StepCheckContext,
  StepDefinition,
  StepExecuteContext,
  StepIdValue,
  StepUndoContext,
  VarName,
  WorkflowVars
} from "@/types";
import { z } from "zod";
import { createStep } from "./create-step";

interface StepBuilder<
  TData extends Partial<WorkflowVars> = Partial<WorkflowVars>
> {
  requires(...vars: VarName[]): StepBuilder<TData>;
  provides(...vars: VarName[]): StepBuilder<TData>;
  check(
    fn: (ctx: BuilderCheckContext<TData>) => Promise<void>
  ): StepBuilder<TData>;
  execute(
    fn: (ctx: BuilderExecuteContext<TData>) => Promise<void>
  ): StepBuilder<TData>;
  undo(fn: (ctx: BuilderUndoContext) => Promise<void>): StepBuilder<TData>;
  build(): StepDefinition & {
    check(ctx: StepCheckContext<TData>): Promise<void>;
    execute(ctx: StepExecuteContext<TData>): Promise<void>;
    undo?(ctx: StepUndoContext): Promise<void>;
  };
}

interface HttpClient {
  get<R>(
    url: string,
    schema: z.ZodSchema<R>,
    options?: { flatten?: boolean }
  ): Promise<R>;
  post<R>(
    url: string,
    schema: z.ZodSchema<R>,
    body?: unknown,
    options?: { flatten?: boolean }
  ): Promise<R>;
  put<R>(
    url: string,
    schema: z.ZodSchema<R>,
    body?: unknown,
    options?: { flatten?: boolean }
  ): Promise<R>;
  patch<R>(
    url: string,
    schema: z.ZodSchema<R>,
    body?: unknown,
    options?: { flatten?: boolean }
  ): Promise<R>;
  delete<R>(
    url: string,
    schema: z.ZodSchema<R>,
    options?: { flatten?: boolean }
  ): Promise<R>;
}

interface VarStore {
  get<K extends VarName>(key: K): WorkflowVars[K] | undefined;
  require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]>;
  build(template: string): string;
}

interface BuilderCheckContext<T> {
  vars: VarStore;
  google: HttpClient;
  microsoft: HttpClient;
  log: StepCheckContext<T>["log"];
  markComplete: StepCheckContext<T>["markComplete"];
  markIncomplete: StepCheckContext<T>["markIncomplete"];
  markCheckFailed: StepCheckContext<T>["markCheckFailed"];
}

interface BuilderExecuteContext<T> {
  vars: VarStore;
  google: HttpClient;
  microsoft: HttpClient;
  checkData: T;
  log: StepExecuteContext<T>["log"];
  output(vars: Partial<WorkflowVars>): void;
  markFailed: StepExecuteContext<T>["markFailed"];
  markPending: StepExecuteContext<T>["markPending"];
}

interface BuilderUndoContext {
  vars: VarStore;
  google: HttpClient;
  microsoft: HttpClient;
  log: StepUndoContext["log"];
  markReverted: StepUndoContext["markReverted"];
  markFailed: StepUndoContext["markFailed"];
}

export function defineStep<
  TData extends Partial<WorkflowVars> = Partial<WorkflowVars>
>(id: StepIdValue): StepBuilder<TData> {
  let requires: VarName[] = [];
  let provides: VarName[] = [];
  let checkFn: ((ctx: BuilderCheckContext<TData>) => Promise<void>) | null =
    null;
  let executeFn: ((ctx: BuilderExecuteContext<TData>) => Promise<void>) | null =
    null;
  let undoFn: ((ctx: BuilderUndoContext) => Promise<void>) | null = null;

  const builder: StepBuilder<TData> = {
    requires(...vars: VarName[]) {
      requires = vars;
      return builder;
    },

    provides(...vars: VarName[]) {
      provides = vars;
      return builder;
    },

    check(fn) {
      checkFn = fn;
      return builder;
    },

    execute(fn) {
      executeFn = fn;
      return builder;
    },

    undo(fn) {
      undoFn = fn;
      return builder;
    },

    build() {
      if (!checkFn || !executeFn) {
        throw new Error(
          `Step ${id} must have both check and execute functions`
        );
      }

      return createStep<TData>({
        id,
        requires,
        provides,

        async check(originalCtx) {
          const ctx = wrapContext(originalCtx);
          await checkFn!(ctx);
        },

        async execute(originalCtx) {
          const ctx = {
            ...wrapContext(originalCtx),
            checkData: originalCtx.checkData,
            output: (vars: Partial<WorkflowVars>) =>
              originalCtx.markSucceeded(vars)
          };
          await executeFn!(ctx);
        },

        async undo(originalCtx) {
          if (undoFn) {
            const ctx = wrapContext(originalCtx);
            await undoFn(ctx);
          }
        }
      });
    }
  };

  return builder;
}

function createHttpClient(
  fetchFn: <R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ) => Promise<R>
): HttpClient {
  return {
    get: (url, schema, options) =>
      fetchFn(url, schema, { method: "GET", ...options }),

    post: (url, schema, body, options) =>
      fetchFn(url, schema, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
        ...options
      }),

    put: (url, schema, body, options) =>
      fetchFn(url, schema, {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
        ...options
      }),

    patch: (url, schema, body, options) =>
      fetchFn(url, schema, {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
        ...options
      }),

    delete: (url, schema, options) =>
      fetchFn(url, schema, { method: "DELETE", ...options })
  };
}

function createVarStore(vars: Partial<WorkflowVars>): VarStore {
  return {
    get: <K extends VarName>(key: K) => vars[key],
    require: <K extends VarName>(key: K) => {
      const value = vars[key];
      if (value === undefined)
        throw new Error(`Required variable ${key} is missing`);
      return value;
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

function wrapContext<
  C extends {
    fetchGoogle: StepCheckContext<unknown>["fetchGoogle"];
    fetchMicrosoft: StepCheckContext<unknown>["fetchMicrosoft"];
    vars: Partial<WorkflowVars>;
  }
>(
  ctx: C
): Omit<C, "fetchGoogle" | "fetchMicrosoft" | "vars"> & {
  vars: VarStore;
  google: HttpClient;
  microsoft: HttpClient;
} {
  const { fetchGoogle, fetchMicrosoft, vars, ...rest } = ctx;

  return {
    ...rest,
    vars: createVarStore(vars),
    google: createHttpClient(fetchGoogle),
    microsoft: createHttpClient(fetchMicrosoft)
  };
}

// Keep getVar for migration purposes only
export function getVar<K extends VarName>(
  vars: Partial<WorkflowVars>,
  key: K
): WorkflowVars[K] {
  const value = vars[key];
  if (value === undefined) {
    throw new Error(`Required variable ${key} is not available`);
  }
  return value;
}
