"use server";
import "server-only";

/**
 * @file engine.ts
 * @description Server-side execution engine for individual workflow steps.
 *
 * The engine abstracts the *lifecycle* of a step:
 *  1. **Check** – interrogate external systems to see if the step is already
 *     complete.
 *  2. **Execute** – if needed, perform the mutation.
 *  3. Stream log / status updates back to the UI.
 *
 * The public API is the `runStep` server action.  It is intentionally
 * side-effect free *until* it calls the chosen step’s own implementation.
 */

import {
  LogLevel,
  StepCheckContext,
  StepIdValue,
  StepLogEntry,
  StepUIState,
  Var,
  WorkflowVars
} from "@/types";
import { z } from "zod";
import { getStep } from "./step-registry";

async function processStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>,
  execute: boolean
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = { status: "idle", logs };
  let finalVars: Partial<WorkflowVars> = {};

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
  };

  const addLog = (entry: StepLogEntry) => {
    logs = [...logs, entry];
    pushState({});
  };

  const createFetch = (token: string | undefined) => {
    type FetchOpts = RequestInit & { flatten?: boolean };
    return async <T>(
      url: string,
      schema: z.ZodSchema<T>,
      init?: FetchOpts
    ): Promise<T> => {
      if (!token) throw new Error("No auth token available");

      // Extract flatten flag from init, and prepare request options
      const { flatten, ...reqInit } = (init as FetchOpts) ?? {};

      // Single-page fetch helper
      const fetchPage = async (pageUrl: string): Promise<T> => {
        const method = reqInit.method ?? "GET";
        const body = reqInit.body;
        addLog({
          timestamp: Date.now(),
          message: `Request ${method} ${pageUrl}`,
          data: body,
          level: LogLevel.Debug
        });

        const res = await fetch(pageUrl, {
          ...reqInit,
          headers: {
            ...(reqInit.headers ?? {}),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        const clone = res.clone();
        let logData: unknown;
        try {
          logData = await clone.json();
        } catch {
          logData = await clone.text();
        }
        addLog({
          timestamp: Date.now(),
          message: `Response ${res.status} ${pageUrl}`,
          data: logData,
          level: LogLevel.Debug
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();
        return schema.parse(json);
      };

      // If flatten is requested, accumulate paginated 'items'
      if (flatten) {
        let aggregated: T | undefined;
        let nextToken: string | undefined;
        const allItems: unknown[] = [];
        const baseUrl = url;
        do {
          let pageUrl = baseUrl;
          if (nextToken) {
            const sep = baseUrl.includes("?") ? "&" : "?";
            pageUrl = `${baseUrl}${sep}pageToken=${encodeURIComponent(nextToken)}`;
          }
          const page = await fetchPage(pageUrl);
          if (aggregated === undefined) aggregated = page;
          const p = page as unknown as {
            items?: unknown[];
            nextPageToken?: string;
          };
          if (Array.isArray(p.items)) allItems.push(...p.items);
          nextToken = p.nextPageToken;
        } while (nextToken);
        const result = aggregated as unknown as { items: unknown[] };
        result.items = allItems;
        delete (result as unknown as { nextPageToken?: string }).nextPageToken;
        return aggregated!;
      }

      // Default single fetch
      return fetchPage(url);
    };
  };

  const baseContext = {
    fetchGoogle: createFetch(vars[Var.GoogleAccessToken] as string | undefined),
    fetchMicrosoft: createFetch(vars[Var.MsGraphToken] as string | undefined),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    }
  };

  // CHECK PHASE
  pushState({ status: "checking" });

  // Data carried from check() into execute() or propagated as newVars
  type CheckType =
    Parameters<typeof step.check>[0] extends StepCheckContext<infer D> ? D
    : never;
  let checkData!: CheckType;
  let checkFailed = false;
  let isComplete = false;

  try {
    await step.check({
      ...baseContext,
      vars,
      markComplete: (data) => {
        checkData = data;
        isComplete = true;
        pushState({ status: "complete", summary: "Already complete" });
      },
      markIncomplete: (summary, data) => {
        checkData = data;
        isComplete = false;
        pushState({ status: "idle", summary });
      },
      markCheckFailed: (error) => {
        checkFailed = true;
        pushState({ status: "failed", error: `Check failed: ${error}` });
      }
    });
  } catch (error) {
    pushState({
      status: "failed",
      error:
        "Check error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
    return { state: currentState, newVars: finalVars };
  }

  if (checkFailed) {
    return { state: currentState, newVars: finalVars };
  }

  if (isComplete) {
    // Propagate any variables gathered during check for completed steps
    return { state: currentState, newVars: checkData };
  }

  if (execute) {
    // EXECUTE PHASE
    pushState({ status: "executing" });

    try {
      await step.execute({
        ...baseContext,
        vars,
        checkData,
        markSucceeded: (newVars) => {
          finalVars = newVars;
          pushState({ status: "complete", summary: "Succeeded" });
        },
        markFailed: (error) => {
          pushState({ status: "failed", error });
        },
        markPending: (notes) => {
          pushState({ status: "pending", notes });
        }
      });
    } catch (error) {
      pushState({
        status: "failed",
        error:
          "Execute error: "
          + (error instanceof Error ? error.message : "Unknown error")
      });
    }
  }

  return { state: currentState, newVars: finalVars };
}

export async function runStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  return processStep(stepId, vars, true);
}

export async function checkStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  return processStep(stepId, vars, false);
}
