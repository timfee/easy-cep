"use server";
import "server-only";

import {
  LogLevel,
  StepCheckContext,
  StepId,
  StepLogEntry,
  StepUIState,
  Var,
  WorkflowVars
} from "@/types";
import { z } from "zod";
import { getStep } from "./step-registry";

export async function runStep(
  stepId: StepId,
  vars: Partial<WorkflowVars>,
  updateVars: (newVars: Partial<WorkflowVars>) => void,
  updateStepState: (stepId: StepId, state: StepUIState) => void
): Promise<void> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = { status: "idle", logs };

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
    updateStepState(stepId, currentState);
  };

  const addLog = (entry: StepLogEntry) => {
    logs = [...logs, entry];
    pushState({});
  };

  const createFetch =
    (token: string | undefined) =>
    async <T>(
      url: string,
      schema: z.ZodSchema<T>,
      init?: Omit<RequestInit, "headers">
    ): Promise<T> => {
      if (!token) throw new Error("No auth token available");

      const method = (init as RequestInit | undefined)?.method ?? "GET";
      const body = (init as RequestInit | undefined)?.body;
      addLog({
        timestamp: Date.now(),
        message: `Request ${method} ${url}`,
        data: body,
        level: LogLevel.Debug
      });

      const headers = (init as RequestInit | undefined)?.headers;
      const res = await fetch(url, {
        ...(init as RequestInit),
        headers: {
          ...(headers ?? {}),
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
        message: `Response ${res.status} ${url}`,
        data: logData,
        level: LogLevel.Debug
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      return schema.parse(json);
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

  type CheckType =
    Parameters<typeof step.check>[0] extends StepCheckContext<infer U> ? U
    : never;
  let checkData!: CheckType;
  let checkFailed = false;
  let isComplete = false;

  try {
    await step.check({
      ...baseContext,
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
    return;
  }

  if (checkFailed || isComplete) return;

  // EXECUTE PHASE
  pushState({ status: "executing" });

  try {
    await step.execute({
      ...baseContext,
      checkData,
      markSucceeded: (newVars) => {
        updateVars(newVars);
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
