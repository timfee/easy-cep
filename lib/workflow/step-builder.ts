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
import type { HttpClient } from "./types/http-client";
import { createVarStore, type BasicVarStore } from "./var-store";

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

interface BuilderCheckContext<T> {
  vars: BasicVarStore;
  google: HttpClient;
  microsoft: HttpClient;
  log: StepCheckContext<T>["log"];
  markComplete: StepCheckContext<T>["markComplete"];
  markIncomplete: StepCheckContext<T>["markIncomplete"];
  markCheckFailed: StepCheckContext<T>["markCheckFailed"];
}

interface BuilderExecuteContext<T> {
  vars: BasicVarStore;
  google: HttpClient;
  microsoft: HttpClient;
  checkData: T;
  log: StepExecuteContext<T>["log"];
  output(vars: Partial<WorkflowVars>): void;
  markFailed: StepExecuteContext<T>["markFailed"];
  markPending: StepExecuteContext<T>["markPending"];
}

interface BuilderUndoContext {
  vars: BasicVarStore;
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
    init?: RequestInit & { flatten?: boolean | string }
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

function wrapContext<
  C extends {
    fetchGoogle: StepCheckContext<unknown>["fetchGoogle"];
    fetchMicrosoft: StepCheckContext<unknown>["fetchMicrosoft"];
    vars: Partial<WorkflowVars>;
  }
>(
  ctx: C
): Omit<C, "fetchGoogle" | "fetchMicrosoft" | "vars"> & {
  vars: BasicVarStore;
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
