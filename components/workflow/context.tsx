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
import { computeEffectiveStatus } from "@/lib/workflow/core/status";
import { checkStep, runStep, undoStep } from "@/lib/workflow/engine";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import type { StepIdValue } from "@/lib/workflow/step-ids";
import { StepStatus } from "@/lib/workflow/step-status";
import { type BasicVarStore, createVarStore } from "@/lib/workflow/var-store";
import type { VarName, WorkflowVars } from "@/lib/workflow/variables";
import { WORKFLOW_VARIABLES } from "@/lib/workflow/variables";
import type { StepDefinition, StepUIState } from "@/types";

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
  updateVars: (updates: Partial<WorkflowVars>) => void;
  updateStep: (stepId: StepIdValue, state: StepUIState) => void;
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
  const listeners = useRef<Map<VarName, Set<(value: unknown) => void>>>(
    new Map()
  );

  useEffect(() => {
    setSessionLoaded(true);
  }, []);

  const updateVars = useCallback(
    (newVars: Partial<WorkflowVars>) => {
      const keys = Object.keys(newVars).filter(
        (key): key is VarName => key in newVars
      );
      if (keys.length === 0) {
        return;
      }

      setVarsState((prev) => {
        const updated = { ...prev, ...newVars };

        // Notify listeners
        for (const key of keys) {
          const keyListeners = listeners.current.get(key);
          if (keyListeners) {
            for (const cb of keyListeners) {
              cb(updated[key]);
            }
          }
        }

        // Reset checked status for affected steps
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
    },
    [steps]
  );

  // Create VarStore implementation
  const varStore = useMemo<VarStore>(
    () => ({
      get<K extends VarName>(key: K): WorkflowVars[K] | undefined {
        return createVarStore(vars).get(key);
      },

      require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]> {
        return createVarStore(vars).require(key);
      },

      set(updates: Partial<WorkflowVars>) {
        updateVars(updates);
      },

      has(key: VarName): boolean {
        return vars[key] !== undefined;
      },

      build(template: string): string {
        return createVarStore(vars).build(template);
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
          status: StepStatus.Blocked,
          error: `Missing required vars: ${messages.join(", ")}`,
        });
        return;
      }

      setExecuting(id);
      updateStep(id, {
        status: statusRef.current[id]?.status ?? StepStatus.Ready,
        isExecuting: true,
      });

      try {
        const result = await runStep(id, vars);
        updateStep(id, result.state);
        updateVars(result.newVars);
      } catch (error) {
        console.error("Failed to run step:", error);
        updateStep(id, {
          status: StepStatus.Blocked,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        setExecuting(null);
      }
    },
    [steps, vars, updateStep, updateVars]
  );

  const undoStepAction = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((workflowStep) => workflowStep.id === id);
      if (!step) {
        return;
      }

      updateStep(id, {
        status: statusRef.current[id]?.status ?? StepStatus.Ready,
        isUndoing: true,
      });

      try {
        const result = await undoStep(id, vars);
        updateStep(id, result.state);

        if (result.state.status === StepStatus.Complete) {
          // Clear provided vars
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
          status: StepStatus.Blocked,
          error: error instanceof Error ? error.message : "Failed to undo step",
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
        (current?.status === StepStatus.Complete && current.logs?.length)
      ) {
        continue;
      }
      if (step.requires.some((varName) => !vars[varName])) {
        continue;
      }

      checkedSteps.current.add(step.id);
      updateStep(step.id, {
        status: statusRef.current[step.id]?.status ?? StepStatus.Ready,
        isChecking: true,
      });

      const result = await checkStep(step.id, vars);
      updateStep(step.id, result.state);

      if (Object.keys(result.newVars).length > 0) {
        updateVars(result.newVars);
      }
    }
  }, [vars, steps, status, updateStep, updateVars]);

  // Auto-check steps when vars change

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkSteps();
    }, 100);

    return () => clearTimeout(timeoutId);
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
        ...(currentState || { status: StepStatus.Ready, logs: [] }),
        status: info.status,
        blockReason: info.blockReason,
      };
    }
    return computed;
  }, [steps, vars]);

  const value: WorkflowContextValue = {
    vars: varStore,
    varsRaw: vars,
    status: effectiveStatus,
    executing,
    steps,
    updateVars,
    updateStep,
    executeStep,
    undoStep: undoStepAction,
    checkSteps,
    sessionLoaded,
    setSessionLoaded,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
