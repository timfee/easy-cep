"use server";
import "server-only";

import {
  LogLevel,
  StepCheckContext,
  StepId,
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

  const createFetch =
    (token: string | undefined) =>
    async <T>(
      url: string,
      schema: z.ZodSchema<T>,
      init?: Omit<RequestInit, "headers">
    ): Promise<T> => {
      if (!token) throw new Error("No auth token available");

      const headers = (init as RequestInit | undefined)?.headers;
      const res = await fetch(url, {
        ...(init as RequestInit),
        headers: {
          ...(headers ?? {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
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
      console.log(`[${stepId}] [${level}] ${message}`, data);
    }
  };

  // CHECK PHASE
  updateStepState(stepId, { status: "checking" });

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
        updateStepState(stepId, {
          status: "complete",
          summary: "Already complete"
        });
      },
      markIncomplete: (summary, data) => {
        checkData = data;
        isComplete = false;
        updateStepState(stepId, { status: "idle", summary });
      },
      markCheckFailed: (error) => {
        checkFailed = true;
        updateStepState(stepId, {
          status: "failed",
          error: `Check failed: ${error}`
        });
      }
    });
  } catch (error) {
    updateStepState(stepId, {
      status: "failed",
      error:
        "Check error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
    return;
  }

  if (checkFailed || isComplete) return;

  // EXECUTE PHASE
  updateStepState(stepId, { status: "executing" });

  try {
    await step.execute({
      ...baseContext,
      checkData,
      markSucceeded: (newVars) => {
        updateVars(newVars);
        updateStepState(stepId, { status: "complete", summary: "Succeeded" });
      },
      markFailed: (error) => {
        updateStepState(stepId, { status: "failed", error });
      },
      markPending: (notes) => {
        updateStepState(stepId, { status: "pending", notes });
      }
    });
  } catch (error) {
    updateStepState(stepId, {
      status: "failed",
      error:
        "Execute error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
  }
}
