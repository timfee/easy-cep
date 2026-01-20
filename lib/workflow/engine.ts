"use server";

import { inspect } from "node:util";

import { PROVIDERS } from "@/constants";
import { env } from "@/env";
import { refreshTokenIfNeeded } from "@/lib/auth";
import type  { StepIdValue } from "@/lib/workflow/step-ids";
import { Var } from '@/lib/workflow/variables';
import type { WorkflowVars } from '@/lib/workflow/variables';
import { LogLevel } from '@/types';
import type { StepCheckContext, StepLogEntry, StepStreamEvent, StepUIState } from '@/types';

import { createAuthenticatedFetch } from "./fetch-utils";
import type  { LROMetadata } from "./lro-detector";
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
  let { data } = entry;
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
    phase,
    status,
    stepId: context.stepId,
    traceId: context.traceId,
    type: "phase",
  });
}

function emitVarsEvent(context: StepEventContext, data: Partial<WorkflowVars>) {
  if (!context || Object.keys(data).length === 0) {
    return;
  }
  context.onEvent({
    stepId: context.stepId,
    traceId: context.traceId,
    type: "vars",
    vars: data,
  });
}

function emitStateEvent(context: StepEventContext, data: Partial<StepUIState>) {
  if (!context) {
    return;
  }
  context.onEvent({
    state: data,
    stepId: context.stepId,
    traceId: context.traceId,
    type: "state",
  });
}

function emitLogEvent(context: StepEventContext, entry: StepLogEntry) {
  if (!context) {
    return;
  }
  context.onEvent({
    entry,
    stepId: context.stepId,
    traceId: context.traceId,
    type: "log",
  });
}

function emitLroEvent(context: StepEventContext, lro: StepUIState["lro"]) {
  if (!(context && lro)) {
    return;
  }
  context.onEvent({
    lro,
    stepId: context.stepId,
    traceId: context.traceId,
    type: "lro",
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
  let currentState: StepUIState = { logs, status: StepStatus.Ready };
  let finalVars: Partial<WorkflowVars> = {};

  const eventMeta = eventContext
    ? { onEvent: eventContext.onEvent, stepId, traceId: eventContext.traceId }
    : undefined;

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
    emitStateEvent(eventMeta, data);
  };

  const recordLro = (lro: LROMetadata) => {
    if (!currentState.lro) {
      const nextLro = {
        detected: true,
        estimatedDuration: lro.estimatedSeconds,
        operationType: lro.type,
        startTime: Date.now(),
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

    const logPhase = (phase: "check" | "execute", status: "start" | "end") => {
      addLog({
        data: { phase, status, stepId },
        level: LogLevel.Debug,
        message: `Phase ${phase} ${status}`,
        timestamp: Date.now(),
      });
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
      addLog({ data, level, message, timestamp: Date.now() });
    },
  };

  logPhase("check", "start");
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
        emitVarsEvent(eventMeta, data);
        pushState({ status: StepStatus.Ready, summary });
      },
      markStale: (message: string, data: CheckType) => {
        checkData = data;
        isComplete = false;
        emitVarsEvent(eventMeta, data);
        pushState({ status: StepStatus.Stale, summary: message });
      },
      markCheckFailed: (error: string) => {
        checkFailed = true;
        pushState({
          error: `Check failed: ${error}`,
          status: StepStatus.Blocked,
        });
      },
    });
  } catch (error) {
    pushState({
      error:
        "Check error: " +
        (error instanceof Error ? error.message : "Unknown error"),
      status: StepStatus.Blocked,
    });
    pushState({ isChecking: false, isExecuting: false });
    return { newVars: finalVars, state: currentState };
  }

  const completeCheckPhase = () => {
    emitPhaseEvent(eventMeta, "check", "end");
  };

  if (checkFailed) {
    pushState({ isChecking: false });
    logPhase("check", "end");
    completeCheckPhase();
    return { newVars: finalVars, state: currentState };
  }

  if (isComplete) {
    const newVars = checkData ?? {};
    pushState({ isChecking: false });
    logPhase("check", "end");
    completeCheckPhase();
    return { newVars, state: currentState };
  }

  if (!checkData) {
    pushState({ error: "Check data missing", status: StepStatus.Blocked });
    pushState({ isChecking: false });
    logPhase("check", "end");
    completeCheckPhase();
    return { newVars: finalVars, state: currentState };
  }

  pushState({ isChecking: false });

  finalVars = checkData;
  emitVarsEvent(eventMeta, checkData);

  if (execute) {
    logPhase("check", "end");
    emitPhaseEvent(eventMeta, "check", "end");
    logPhase("execute", "start");
    emitPhaseEvent(eventMeta, "execute", "start");
    pushState({ isExecuting: true, isChecking: false });

    try {
      await step.execute({
        ...baseContext,
        vars: { ...vars, ...checkData },
        checkData,
        output: (newVars: Partial<WorkflowVars>) => {
          finalVars = { ...checkData, ...newVars };
          emitVarsEvent(eventMeta, finalVars);
          pushState({ status: StepStatus.Complete, summary: "Succeeded" });
        },
        markFailed: (error: string) => {
          pushState({ error, status: StepStatus.Blocked });
        },
        markPending: (notes: string) => {
          pushState({ notes, status: StepStatus.Pending });
        },
      });
    } catch (error) {
      pushState({
        error:
          "Execute error: " +
          (error instanceof Error ? error.message : "Unknown error"),
        status: StepStatus.Blocked,
      });
    }
    logPhase("execute", "end");
    emitPhaseEvent(eventMeta, "execute", "end");
  } else {
    logPhase("check", "end");
    emitPhaseEvent(eventMeta, "check", "end");
  }

  emitVarsEvent(eventMeta, finalVars);
  pushState({ isChecking: false, isExecuting: false });
  return { newVars: finalVars, state: currentState };
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
  const result = await processStep(stepId, vars, true, { onEvent, traceId });
  onEvent({
    newVars: result.newVars,
    state: result.state,
    stepId,
    traceId,
    type: "complete",
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
    isUndoing: true,
    logs,
    status: StepStatus.Ready,
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
          estimatedDuration: lro.estimatedSeconds,
          operationType: lro.type,
          startTime: Date.now(),
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
      addLog({ data, level, message, timestamp: Date.now() });
    },
  };

  if (!step.undo) {
    pushState({ error: "Undo not implemented", status: StepStatus.Blocked });
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
        pushState({ error, status: StepStatus.Blocked });
      },
    });
  } catch (error) {
    pushState({
      error:
        "Undo error: " +
        (error instanceof Error ? error.message : "Unknown error"),
      status: StepStatus.Blocked,
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
