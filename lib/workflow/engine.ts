"use server";

import { inspect } from "node:util";
import { PROVIDERS } from "@/constants";
import { env } from "@/env";
import { refreshTokenIfNeeded } from "@/lib/auth";
import type { StepIdValue } from "@/lib/workflow/step-ids";
import { Var, type WorkflowVars } from "@/lib/workflow/variables";
import {
  LogLevel,
  type StepCheckContext,
  type StepLogEntry,
  type StepStreamEvent,
  type StepUIState,
} from "@/types";
import { createAuthenticatedFetch } from "./fetch-utils";
import type { LROMetadata } from "./lro-detector";
import { getStep } from "./step-registry";
import { StepStatus } from "./step-status";

/**
 * Redact sensitive values before logging workflow vars.
 */
function sanitizeVars(vars: Partial<WorkflowVars>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("certificate")
      ) {
        return [key, "[REDACTED]"];
      }
      return [key, value];
    })
  );
}

/**
 * Append a log entry while sanitizing sensitive payloads.
 */
function appendLog(
  entry: StepLogEntry,
  vars: Partial<WorkflowVars>,
  logs: StepLogEntry[]
): StepLogEntry[] {
  let data = entry.data;
  if (entry.level === LogLevel.Error) {
    data = {
      error: data instanceof Error ? inspect(data, { depth: null }) : data,
      vars: sanitizeVars(vars),
    };
  } else if (data instanceof Error) {
    data = inspect(data, { depth: null });
  }

  return [...logs, { ...entry, data }];
}

/**
 * Emit verbose logs in development mode.
 */
function logDev(entry: StepLogEntry, vars: Partial<WorkflowVars>) {
  if (env.NODE_ENV !== "development") {
    return;
  }
  const payload = {
    ...entry,
    data:
      entry.level === LogLevel.Error
        ? { error: entry.data, vars: sanitizeVars(vars) }
        : entry.data,
  };
  console.debug("[workflow]", payload);
}

type StepEventContext =
  | {
      stepId: StepIdValue;
      traceId: string;
      onEvent: (event: StepStreamEvent) => void;
    }
  | undefined;

function emitPhaseEvent(
  context: StepEventContext,
  phase: "check" | "execute",
  status: "start" | "end"
) {
  if (!context) {
    return;
  }
  context.onEvent({
    type: "phase",
    stepId: context.stepId,
    traceId: context.traceId,
    phase,
    status,
  });
}

function emitVarsEvent(context: StepEventContext, data: Partial<WorkflowVars>) {
  if (!context || Object.keys(data).length === 0) {
    return;
  }
  context.onEvent({
    type: "vars",
    stepId: context.stepId,
    traceId: context.traceId,
    vars: data,
  });
}

function emitStateEvent(context: StepEventContext, data: Partial<StepUIState>) {
  if (!context) {
    return;
  }
  context.onEvent({
    type: "state",
    stepId: context.stepId,
    traceId: context.traceId,
    state: data,
  });
}

function emitLogEvent(context: StepEventContext, entry: StepLogEntry) {
  if (!context) {
    return;
  }
  context.onEvent({
    type: "log",
    stepId: context.stepId,
    traceId: context.traceId,
    entry,
  });
}

function emitLroEvent(context: StepEventContext, lro: StepUIState["lro"]) {
  if (!(context && lro)) {
    return;
  }
  context.onEvent({
    type: "lro",
    stepId: context.stepId,
    traceId: context.traceId,
    lro,
  });
}

/**
 * Run a step through check and optional execute phases.
 */
async function processStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>,
  execute: boolean,
  eventContext?: {
    traceId: string;
    onEvent: (event: StepStreamEvent) => void;
  }
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = { status: StepStatus.Ready, logs };
  let finalVars: Partial<WorkflowVars> = {};

  const eventMeta = eventContext
    ? { stepId, traceId: eventContext.traceId, onEvent: eventContext.onEvent }
    : undefined;

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
    emitStateEvent(eventMeta, data);
  };

  const recordLro = (lro: LROMetadata) => {
    if (!currentState.lro) {
      const nextLro = {
        detected: true,
        startTime: Date.now(),
        estimatedDuration: lro.estimatedSeconds,
        operationType: lro.type,
      };
      currentState = {
        ...currentState,
        lro: nextLro,
      };
      emitLroEvent(eventMeta, nextLro);
    }
  };

  const addLog = (entry: StepLogEntry) => {
    const nextLogs = appendLog(entry, vars, logs);
    const sanitizedEntry = nextLogs.at(-1);
    if (!sanitizedEntry) {
      return;
    }
    logs = nextLogs;
    logDev(sanitizedEntry, vars);
    emitLogEvent(eventMeta, sanitizedEntry);
    pushState({});
  };

  const shouldUseCookieTokens = env.NODE_ENV !== "test";
  const googleTokenObj = shouldUseCookieTokens
    ? await refreshTokenIfNeeded(PROVIDERS.GOOGLE)
    : null;
  const microsoftTokenObj = shouldUseCookieTokens
    ? await refreshTokenIfNeeded(PROVIDERS.MICROSOFT)
    : null;

  const baseContext = {
    fetchGoogle: createAuthenticatedFetch(
      googleTokenObj?.accessToken ?? vars[Var.GoogleAccessToken],
      { addLog, onLroDetected: recordLro }
    ),
    fetchMicrosoft: createAuthenticatedFetch(
      microsoftTokenObj?.accessToken ?? vars[Var.MsGraphToken],
      { addLog, onLroDetected: recordLro }
    ),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    },
  };

  emitPhaseEvent(eventMeta, "check", "start");
  pushState({ isChecking: true });

  type CheckType =
    Parameters<typeof step.check>[0] extends StepCheckContext<infer D>
      ? D
      : never;
  let checkData: CheckType | undefined;
  let checkFailed = false;
  let isComplete = false;

  try {
    await step.check({
      ...baseContext,
      vars,
      markComplete: (data: CheckType) => {
        checkData = data;
        isComplete = true;
        emitVarsEvent(eventMeta, data);
        pushState({
          status: StepStatus.Complete,
          summary: "Step already complete",
        });
      },
      markIncomplete: (summary: string, data: CheckType) => {
        checkData = data;
        isComplete = false;
        pushState({ status: StepStatus.Ready, summary });
      },
      markStale: (message: string) => {
        checkData = undefined;
        isComplete = false;
        pushState({ status: StepStatus.Stale, summary: message });
      },
      markCheckFailed: (error: string) => {
        checkFailed = true;
        pushState({
          status: StepStatus.Blocked,
          error: `Check failed: ${error}`,
        });
      },
    });
  } catch (error) {
    pushState({
      status: StepStatus.Blocked,
      error:
        "Check error: " +
        (error instanceof Error ? error.message : "Unknown error"),
    });
    pushState({ isChecking: false, isExecuting: false });
    return { state: currentState, newVars: finalVars };
  }

  const completeCheckPhase = () => {
    emitPhaseEvent(eventMeta, "check", "end");
  };

  if (checkFailed) {
    pushState({ isChecking: false });
    completeCheckPhase();
    return { state: currentState, newVars: finalVars };
  }

  if (isComplete) {
    const newVars = checkData ?? {};
    pushState({ isChecking: false });
    completeCheckPhase();
    return { state: currentState, newVars };
  }

  if (!checkData) {
    pushState({ status: StepStatus.Blocked, error: "Check data missing" });
    pushState({ isChecking: false });
    completeCheckPhase();
    return { state: currentState, newVars: finalVars };
  }

  emitVarsEvent(eventMeta, checkData);
  completeCheckPhase();

  if (execute) {
    emitPhaseEvent(eventMeta, "execute", "start");
    pushState({ isExecuting: true });

    try {
      await step.execute({
        ...baseContext,
        vars,
        checkData,
        output: (newVars: Partial<WorkflowVars>) => {
          finalVars = newVars;
          emitVarsEvent(eventMeta, newVars);
          pushState({ status: StepStatus.Complete, summary: "Succeeded" });
        },
        markFailed: (error: string) => {
          pushState({ status: StepStatus.Blocked, error });
        },
        markPending: (notes: string) => {
          pushState({ status: StepStatus.Pending, notes });
        },
      });
    } catch (error) {
      pushState({
        status: StepStatus.Blocked,
        error:
          "Execute error: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
    }
    emitPhaseEvent(eventMeta, "execute", "end");
  }

  emitVarsEvent(eventMeta, finalVars);
  pushState({ isChecking: false, isExecuting: false });
  return { state: currentState, newVars: finalVars };
}

/**
 * Execute a workflow step end-to-end.
 */
export async function runStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  return await processStep(stepId, vars, true);
}

export async function runStepWithEvents<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>,
  onEvent: (event: StepStreamEvent) => void
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  const traceId = crypto.randomUUID();
  const result = await processStep(stepId, vars, true, { traceId, onEvent });
  onEvent({
    type: "complete",
    stepId,
    traceId,
    state: result.state,
    newVars: result.newVars,
  });
  return result;
}

/**
 * Run a step check without executing mutations.
 */
export async function checkStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  return await processStep(stepId, vars, false);
}

/**
 * Execute a step's undo handler with logging.
 */
async function processUndoStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState }> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = {
    status: StepStatus.Ready,
    isUndoing: true,
    logs,
  };

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
  };

  const recordLro = (lro: LROMetadata) => {
    if (!currentState.lro) {
      currentState = {
        ...currentState,
        lro: {
          detected: true,
          startTime: Date.now(),
          estimatedDuration: lro.estimatedSeconds,
          operationType: lro.type,
        },
      };
    }
  };

  const addLog = (entry: StepLogEntry) => {
    logs = appendLog(entry, vars, logs);
    logDev(entry, vars);
    pushState({});
  };

  const googleTokenObj = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const microsoftTokenObj = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);

  const baseContext = {
    fetchGoogle: createAuthenticatedFetch(
      googleTokenObj?.accessToken ?? vars[Var.GoogleAccessToken],
      { addLog, onLroDetected: recordLro }
    ),
    fetchMicrosoft: createAuthenticatedFetch(
      microsoftTokenObj?.accessToken ?? vars[Var.MsGraphToken],
      { addLog, onLroDetected: recordLro }
    ),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    },
  };

  if (!step.undo) {
    pushState({ status: StepStatus.Blocked, error: "Undo not implemented" });
    pushState({ isUndoing: false });
    return { state: currentState };
  }

  try {
    await step.undo({
      ...baseContext,
      vars,
      markReverted: () => {
        pushState({ status: StepStatus.Complete, summary: "Reverted" });
      },
      markFailed: (error: string) => {
        pushState({ status: StepStatus.Blocked, error });
      },
    });
  } catch (error) {
    pushState({
      status: StepStatus.Blocked,
      error:
        "Undo error: " +
        (error instanceof Error ? error.message : "Unknown error"),
    });
  }
  pushState({ isUndoing: false });
  return { state: currentState };
}

/**
 * Undo the effects of a workflow step when supported.
 */
export async function undoStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState }> {
  return await processUndoStep(stepId, vars);
}
