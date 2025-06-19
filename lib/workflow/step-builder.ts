/**
 * Fluent builder utility for creating workflow steps with simplified context
 * helpers. The builder abstracts variable handling and HTTP helpers so that
 * individual step files can focus on their business logic.
 */
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

/**
 * Describes the chainable builder returned by {@link defineStep}. Each method
 * mutates internal state and returns the builder for further configuration.
 */
interface StepBuilder<
  TData extends Partial<WorkflowVars> = Partial<WorkflowVars>
> {
  requires(...vars: VarName[]): StepBuilder<TData>;
  provides(...vars: VarName[]): StepBuilder<TData>;
  check(
    fn: (ctx: SimplifiedCheckContext<TData>) => Promise<void>
  ): StepBuilder<TData>;
  execute(
    fn: (ctx: SimplifiedExecuteContext<TData>) => Promise<void>
  ): StepBuilder<TData>;
  undo(fn: (ctx: SimplifiedUndoContext) => Promise<void>): StepBuilder<TData>;
  build(): StepDefinition;
}

interface SimplifiedCheckContext<T> extends Omit<StepCheckContext<T>, "vars"> {
  vars: {
    get<K extends VarName>(key: K): WorkflowVars[K] | undefined;
    require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]>;
    build(template: string): string;
  };
  google: {
    get<R>(path: string, schema: z.ZodSchema<R>): Promise<R>;
    post<R>(path: string, schema: z.ZodSchema<R>, body: unknown): Promise<R>;
  };
  microsoft: {
    get<R>(path: string, schema: z.ZodSchema<R>): Promise<R>;
    post<R>(path: string, schema: z.ZodSchema<R>, body: unknown): Promise<R>;
  };
}

interface SimplifiedExecuteContext<T>
  extends Omit<StepExecuteContext<T>, "vars" | "markSucceeded"> {
  vars: SimplifiedCheckContext<T>["vars"];
  google: SimplifiedCheckContext<T>["google"];
  microsoft: SimplifiedCheckContext<T>["microsoft"];
  output(vars: Partial<WorkflowVars>): void;
}

interface SimplifiedUndoContext extends Omit<StepUndoContext, "vars"> {
  vars: SimplifiedCheckContext<unknown>["vars"];
  google: SimplifiedCheckContext<unknown>["google"];
  microsoft: SimplifiedCheckContext<unknown>["microsoft"];
}

/**
 * Entry point for creating a new workflow step. Callers chain together
 * requirements, output variables and handler functions before finally invoking
 * {@link StepBuilder.build} to produce a `StepDefinition` compatible with the
 * engine.
 */
export function defineStep<
  TData extends Partial<WorkflowVars> = Partial<WorkflowVars>
>(id: StepIdValue): StepBuilder<TData> {
  let requires: VarName[] = [];
  let provides: VarName[] = [];
  let checkFn: ((ctx: SimplifiedCheckContext<TData>) => Promise<void>) | null =
    null;
  let executeFn:
    | ((ctx: SimplifiedExecuteContext<TData>) => Promise<void>)
    | null = null;
  let undoFn: ((ctx: SimplifiedUndoContext) => Promise<void>) | null = null;

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

      return createStep<TData, typeof requires, typeof provides>({
        id,
        requires,
        provides,

        async check(ctx) {
          const simplified = createSimplifiedContext(ctx);
          await checkFn!(
            simplified as unknown as SimplifiedCheckContext<TData>
          );
        },

        async execute(ctx) {
          const simplified = {
            ...createSimplifiedContext(ctx),
            checkData: ctx.checkData,
            output: (vars: Partial<WorkflowVars>) => ctx.markSucceeded(vars)
          } as SimplifiedExecuteContext<TData>;
          await executeFn!(simplified);
        },

        async undo(ctx) {
          if (undoFn) {
            const simplified = createSimplifiedContext(ctx);
            await undoFn(simplified as SimplifiedUndoContext);
          }
        }
      });
    }
  };

  return builder;
}

/**
 * Convert the verbose engine context into a smaller set of helpers used by
 * steps defined via {@link defineStep}. This keeps step implementations tidy
 * while still allowing access to the underlying fetch utilities.
 */
interface BaseContext {
  vars: Partial<WorkflowVars>;
  fetchGoogle: StepCheckContext<unknown>["fetchGoogle"];
  fetchMicrosoft: StepCheckContext<unknown>["fetchMicrosoft"];
}

function createSimplifiedContext(ctx: BaseContext) {
  return {
    ...ctx,
    vars: {
      get: <K extends VarName>(key: K) => ctx.vars[key],
      require: <K extends VarName>(key: K) => {
        const value = ctx.vars[key];
        if (value === undefined)
          throw new Error(`Required variable ${key} is missing`);
        return value;
      },
      build: (template: string) => {
        return template.replace(/\{(\w+)\}/g, (_, key) => {
          const value = ctx.vars[key as VarName];
          if (value === undefined)
            throw new Error(`Template variable ${key} is missing`);
          return String(value);
        });
      }
    },
    google: {
      get: (path: string, schema: z.ZodSchema<unknown>) =>
        ctx.fetchGoogle(path, schema),
      post: (path: string, schema: z.ZodSchema<unknown>, body: unknown) =>
        ctx.fetchGoogle(path, schema, {
          method: "POST",
          body: JSON.stringify(body)
        })
    },
    microsoft: {
      get: (path: string, schema: z.ZodSchema<unknown>) =>
        ctx.fetchMicrosoft(path, schema),
      post: (path: string, schema: z.ZodSchema<unknown>, body: unknown) =>
        ctx.fetchMicrosoft(path, schema, {
          method: "POST",
          body: JSON.stringify(body)
        })
    }
  };
}
