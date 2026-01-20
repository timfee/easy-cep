import type { z } from "zod";
import type { StepIdValue } from "@/lib/workflow/step-ids";
import type { VarName, WorkflowVars } from "@/lib/workflow/variables";
import type {
  StepCheckContext,
  StepDefinition,
  StepExecuteContext,
  StepUndoContext,
} from "@/types";
import { GoogleClient } from "./http/google-client";
import { MicrosoftClient } from "./http/microsoft-client";
import type { HttpClient } from "./types/http-client";
import { type BasicVarStore, createVarStore } from "./var-store";

interface StepBuilder<
  TData extends Partial<WorkflowVars> = Partial<WorkflowVars>,
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
  google: GoogleClient;
  microsoft: MicrosoftClient;
  log: StepCheckContext<T>["log"];
  markComplete: StepCheckContext<T>["markComplete"];
  markIncomplete: StepCheckContext<T>["markIncomplete"];
  markStale: StepCheckContext<T>["markStale"];
  markCheckFailed: StepCheckContext<T>["markCheckFailed"];
}

interface BuilderExecuteContext<T> {
  vars: BasicVarStore;
  google: GoogleClient;
  microsoft: MicrosoftClient;
  checkData: T;
  log: StepExecuteContext<T>["log"];
  output(vars: Partial<WorkflowVars>): void;
  markFailed: StepExecuteContext<T>["markFailed"];
  markPending: StepExecuteContext<T>["markPending"];
}

interface BuilderUndoContext {
  vars: BasicVarStore;
  google: GoogleClient;
  microsoft: MicrosoftClient;
  log: StepUndoContext["log"];
  markReverted: StepUndoContext["markReverted"];
  markFailed: StepUndoContext["markFailed"];
}

/**
 * Create a new workflow step.
 *
 * The returned builder exposes `.requires()`, `.provides()`, `.check()`, `.execute()` and `.undo()`
 * chainable methods. Call `.build()` to produce the final `StepDefinition` used by the engine.
 */
export function defineStep<
  TData extends Partial<WorkflowVars> = Partial<WorkflowVars>,
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
      if (!(checkFn && executeFn)) {
        throw new Error(
          `Step ${id} must have both check and execute functions`
        );
      }

      const check = async (originalCtx: StepCheckContext<TData>) => {
        for (const key of requires) {
          if (originalCtx.vars[key] === undefined) {
            return originalCtx.markCheckFailed(
              `Missing required variable ${key}`
            );
          }
        }
        const ctx = wrapContext(originalCtx);
        await checkFn?.(ctx);
      };

      const execute = async (originalCtx: StepExecuteContext<TData>) => {
        for (const key of requires) {
          if (originalCtx.vars[key] === undefined) {
            throw new Error(`Missing required variable ${key}`);
          }
        }
        const ctx = {
          ...wrapContext(originalCtx),
          checkData: originalCtx.checkData,
          output: (vars: Partial<WorkflowVars>) => originalCtx.output(vars),
        };
        await executeFn?.(ctx);
      };

      const undo = async (originalCtx: StepUndoContext) => {
        if (undoFn) {
          const ctx = wrapContext(originalCtx);
          await undoFn(ctx);
        }
      };

      return {
        id,
        requires,
        provides,
        check,
        execute,
        undo: undoFn ? undo : undefined,
      };
    },
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
  return { request: (url, schema, init) => fetchFn(url, schema, init) };
}

function wrapContext<
  C extends {
    fetchGoogle: StepCheckContext<unknown>["fetchGoogle"];
    fetchMicrosoft: StepCheckContext<unknown>["fetchMicrosoft"];
    vars: Partial<WorkflowVars>;
  },
>(
  ctx: C
): Omit<C, "fetchGoogle" | "fetchMicrosoft" | "vars"> & {
  vars: BasicVarStore;
  google: GoogleClient;
  microsoft: MicrosoftClient;
} {
  const { fetchGoogle, fetchMicrosoft, vars, ...rest } = ctx;

  return {
    ...rest,
    vars: createVarStore(vars),
    google: new GoogleClient(createHttpClient(fetchGoogle)),
    microsoft: new MicrosoftClient(createHttpClient(fetchMicrosoft)),
  };
}
