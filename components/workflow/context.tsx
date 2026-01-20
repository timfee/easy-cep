"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { StepIdValue } from "@/lib/workflow/step-ids";
import type { BasicVarStore } from "@/lib/workflow/var-store";
import type { VarName, WorkflowVars } from "@/lib/workflow/variables";
import type { StepDefinition, StepStreamEvent, StepUIState } from "@/types";

import { computeEffectiveStatus } from "@/lib/workflow/core/status";
import { checkStep, runStep, undoStep } from "@/lib/workflow/engine";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import { StepStatus } from "@/lib/workflow/step-status";
import { createVarStore } from "@/lib/workflow/var-store";
import { WORKFLOW_VARIABLES } from "@/lib/workflow/variables";

interface VarStore extends BasicVarStore {
  set(updates: Partial<WorkflowVars>): void;
  has(key: VarName): boolean;
  subscribe(key: VarName, callback: (value: unknown) => void): () => void;
}

interface WorkflowContextValue {
  vars: VarStore;
  varsRaw: Partial<WorkflowVars>;
  status: Partial<Record<StepIdValue, StepUIState>>;
  executing: StepIdValue | null;
  steps: StepDefinition[];
  updateVars: (updates: Partial<WorkflowVars>) => Promise<void>;
  updateStep: (stepId: StepIdValue, state: StepUIState) => void;
  applyStepEvent: (event: StepStreamEvent) => void;
  executeStep: (stepId: StepIdValue) => Promise<void>;
  undoStep: (stepId: StepIdValue) => Promise<void>;
  checkSteps: () => Promise<void>;
  sessionLoaded: boolean;
  setSessionLoaded: (loaded: boolean) => void;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within WorkflowProvider");
  }
  return context;
}

interface WorkflowProviderProps {
  children: React.ReactNode;
  steps: StepDefinition[];
  initialVars?: Partial<WorkflowVars>;
}

export function WorkflowProvider({
  children,
  steps,
  initialVars = {},
}: WorkflowProviderProps) {
  const [vars, setVarsState] = useState<Partial<WorkflowVars>>(() => ({
    ...initialVars,
  }));

  const [status, setStatus] = useState<
    Partial<Record<StepIdValue, StepUIState>>
  >({});
  const statusRef = useRef<Partial<Record<StepIdValue, StepUIState>>>(status);
  const [executing, setExecuting] = useState<StepIdValue | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const checkedSteps = useRef(new Set<StepIdValue>());
  const inflightChecks = useRef(new Set<StepIdValue>());
  const listeners = useRef<Map<VarName, Set<(value: unknown) => void>>>(
    new Map()
  );
  const debouncedCheckTimeout = useRef<number | null>(null);

  useEffect(() => {
    setSessionLoaded(true);
  }, []);

  const filterSensitiveVars = useCallback(
    (updates: Partial<WorkflowVars>): Partial<WorkflowVars> => {
      const sanitized: Partial<WorkflowVars> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (WORKFLOW_VARIABLES[key]?.sensitive) {
          continue;
        }
        if (key in updates) {
          sanitized[key as VarName] = value as WorkflowVars[VarName];
        }
      }
      return sanitized;
    },
    []
  );

  const updateVars = useCallback(
    async (newVars: Partial<WorkflowVars>) => {
      const keys = Object.keys(newVars).filter(
        (key): key is VarName => key in newVars
      );
      if (keys.length === 0) {
        return;
      }

      const listenerInvocations: {
        cb: (value: unknown) => unknown;
        value: unknown;
      }[] = [];

      setVarsState((prev) => {
        const updated = { ...prev, ...newVars };

        for (const key of keys) {
          const keyListeners = listeners.current.get(key);
          if (keyListeners) {
            for (const cb of keyListeners) {
              listenerInvocations.push({ cb, value: updated[key] });
            }
          }
        }

        for (const step of steps) {
          const dependsOnChangedVar = step.requires.some((reqVar) =>
            keys.includes(reqVar)
          );

          const isCompleted =
            statusRef.current[step.id]?.status === StepStatus.Complete;
          if (dependsOnChangedVar && !isCompleted) {
            checkedSteps.current.delete(step.id);
          }
        }

        return updated;
      });

      if (listenerInvocations.length > 0) {
        await Promise.all(
          listenerInvocations.map(({ cb, value }) => cb(value))
        );
      }
    },
    [steps]
  );

  const varStore = useMemo<VarStore>(
    () => ({
      build(template: string): string {
        return createVarStore(vars).build(template);
      },

      get<K extends VarName>(key: K): WorkflowVars[K] | undefined {
        return createVarStore(vars).get(key);
      },

      has(key: VarName): boolean {
        return vars[key] !== undefined;
      },

      require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]> {
        return createVarStore(vars).require(key);
      },

      set(updates: Partial<WorkflowVars>) {
        updateVars(updates).catch(() => {});
      },

      subscribe(key: VarName, callback: (value: unknown) => void): () => void {
        if (!listeners.current.has(key)) {
          listeners.current.set(key, new Set());
        }
        listeners.current.get(key)?.add(callback);

        return () => {
          listeners.current.get(key)?.delete(callback);
        };
      },
    }),
    [vars, updateVars]
  );

  const updateStep = useCallback(
    (stepId: StepIdValue, stepState: StepUIState) => {
      setStatus((prev) => ({ ...prev, [stepId]: stepState }));
      statusRef.current = { ...statusRef.current, [stepId]: stepState };
    },
    []
  );

  const applyStepEvent = useCallback(
    (event: StepStreamEvent) => {
      const { stepId } = event;
      if (event.type === "vars") {
        const updates = filterSensitiveVars(event.vars);
        updateVars(updates).catch(() => {});
        return;
      }

      if (event.type === "complete") {
        updateStep(stepId, event.state);
        updateVars(filterSensitiveVars(event.newVars)).catch(() => {});
        setExecuting(null);
        checkedSteps.current.delete(stepId);
        return;
      }

      if (event.type === "phase") {
        setStatus((prev) => {
          const current = prev[stepId] ?? { status: StepStatus.Ready };
          const phaseUpdates =
            event.phase === "check"
              ? { isChecking: event.status === "start" }
              : { isExecuting: event.status === "start" };
          const next = { ...current, ...phaseUpdates };
          statusRef.current = { ...statusRef.current, [stepId]: next };
          return { ...prev, [stepId]: next };
        });
        return;
      }

      if (event.type === "log") {
        setStatus((prev) => {
          const current = prev[stepId] ?? { status: StepStatus.Ready };
          const logs = current.logs
            ? [...current.logs, event.entry]
            : [event.entry];
          const next = { ...current, logs };
          statusRef.current = { ...statusRef.current, [stepId]: next };
          return { ...prev, [stepId]: next };
        });
        return;
      }

      if (event.type === "lro") {
        setStatus((prev) => {
          const current = prev[stepId] ?? { status: StepStatus.Ready };
          const next = { ...current, lro: event.lro };
          statusRef.current = { ...statusRef.current, [stepId]: next };
          return { ...prev, [stepId]: next };
        });
        return;
      }

      if (event.type === "state") {
        setStatus((prev) => {
          const current = prev[stepId] ?? { status: StepStatus.Ready };
          const next = { ...current, ...event.state };
          statusRef.current = { ...statusRef.current, [stepId]: next };
          return { ...prev, [stepId]: next };
        });
      }
    },
    [filterSensitiveVars, updateStep, updateVars]
  );

  const executeStep = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((workflowStep) => workflowStep.id === id);
      if (!step) {
        return;
      }

      const missingVars = step.requires.filter((varName) => !vars[varName]);
      if (missingVars.length > 0) {
        const messages = missingVars.map((key) => {
          const meta = WORKFLOW_VARIABLES[key];
          const producer = meta?.producedBy;
          const producerName = producer
            ? STEP_DETAILS[producer]?.title || producer
            : null;
          return producerName ? `${key} (from "${producerName}")` : key;
        });
        updateStep(id, {
          error: `Missing required vars: ${messages.join(", ")}`,
          status: StepStatus.Blocked,
        });
        return;
      }

      setExecuting(id);
      updateStep(id, {
        isExecuting: true,
        status: statusRef.current[id]?.status ?? StepStatus.Ready,
      });

      try {
        const stream = new EventSource(
          `/api/workflow/steps/${id}/stream?vars=${encodeURIComponent(
            JSON.stringify(filterSensitiveVars(vars))
          )}`
        );

        try {
          await new Promise<void>((resolve, reject) => {
            stream.onmessage = (message) => {
              if (!message.data) {
                return;
              }
              try {
                const event: StepStreamEvent = JSON.parse(message.data);
                applyStepEvent(event);
                if (event.type === "complete") {
                  resolve();
                }
              } catch (error) {
                reject(error);
              }
            };

            stream.onerror = (err) => {
              reject(err);
            };
          });
        } finally {
          stream.close();
        }
      } catch {
        try {
          const fallback = await runStep(id, vars);
          updateStep(id, fallback.state);
          updateVars(fallback.newVars).catch(() => {});
        } catch (error) {
          console.error("Failed to run step:", error);
          updateStep(id, {
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
            status: StepStatus.Blocked,
          });
        } finally {
          setExecuting(null);
        }
        return;
      }

      setExecuting(null);
    },
    [steps, vars, updateStep, updateVars, applyStepEvent, filterSensitiveVars]
  );

  const undoStepAction = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((workflowStep) => workflowStep.id === id);
      if (!step) {
        return;
      }

      updateStep(id, {
        isUndoing: true,
        status: statusRef.current[id]?.status ?? StepStatus.Ready,
      });

      try {
        const result = await undoStep(id, vars);
        updateStep(id, result.state);

        if (result.state.status === StepStatus.Complete) {
          const clearedVarsEntries = Object.entries(vars).filter(([key]) =>
            step.provides.every((providedVar) => providedVar !== key)
          );
          setVarsState(Object.fromEntries(clearedVarsEntries));
          checkedSteps.current.delete(id);
          updateStep(id, { status: StepStatus.Ready });
        }
      } catch (error) {
        console.error("Failed to undo step:", error);
        updateStep(id, {
          error: error instanceof Error ? error.message : "Failed to undo step",
          status: StepStatus.Blocked,
        });
      }
    },
    [steps, vars, updateStep]
  );

  const checkSteps = useCallback(async () => {
    for (const step of steps) {
      const current = status[step.id];
      if (
        checkedSteps.current.has(step.id) ||
        inflightChecks.current.has(step.id) ||
        (current?.status === StepStatus.Complete && current.logs?.length)
      ) {
        continue;
      }
      if (step.requires.some((varName) => !vars[varName])) {
        continue;
      }

      checkedSteps.current.add(step.id);
      inflightChecks.current.add(step.id);
      updateStep(step.id, {
        isChecking: true,
        status: statusRef.current[step.id]?.status ?? StepStatus.Ready,
      });

      let result: Awaited<ReturnType<typeof checkStep>> | undefined;
      try {
        result = await checkStep(step.id, vars);
        updateStep(step.id, result.state);

        if (Object.keys(result.newVars).length > 0) {
          updateVars(result.newVars).catch(() => {});
        }
      } catch (error) {
        updateStep(step.id, {
          error: error instanceof Error ? error.message : "Check failed",
          status: StepStatus.Blocked,
        });
        checkedSteps.current.delete(step.id);
      } finally {
        inflightChecks.current.delete(step.id);
        updateStep(step.id, {
          isChecking: false,
          status:
            result?.state.status ??
            statusRef.current[step.id]?.status ??
            StepStatus.Ready,
          summary: result?.state.summary,
          error: result?.state.error,
          notes: result?.state.notes,
          blockReason: result?.state.blockReason,
          lro: result?.state.lro,
        });
      }
    }
  }, [vars, steps, status, updateStep, updateVars]);

  useEffect(() => {
    if (debouncedCheckTimeout.current) {
      clearTimeout(debouncedCheckTimeout.current);
    }

    debouncedCheckTimeout.current = window.setTimeout(() => {
      checkSteps();
    }, 200);

    return () => {
      if (debouncedCheckTimeout.current) {
        clearTimeout(debouncedCheckTimeout.current);
      }
    };
  }, [checkSteps]);

  const effectiveStatus = useMemo(() => {
    const computed: Partial<Record<StepIdValue, StepUIState>> = {};
    for (const step of steps) {
      const currentState = statusRef.current[step.id];
      const info = computeEffectiveStatus(
        step,
        currentState,
        vars,
        statusRef.current
      );
      computed[step.id] = {
        ...(currentState || { logs: [], status: StepStatus.Ready }),
        status: info.status,
        blockReason: info.blockReason,
      };
    }
    return computed;
  }, [steps, vars]);

  const value: WorkflowContextValue = {
    applyStepEvent,
    checkSteps,
    executeStep,
    executing,
    sessionLoaded,
    setSessionLoaded,
    status: effectiveStatus,
    steps,
    undoStep: undoStepAction,
    updateStep,
    updateVars,
    vars: varStore,
    varsRaw: vars,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
