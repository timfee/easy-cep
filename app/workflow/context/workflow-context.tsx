"use client";
/* eslint-disable workflow/no-duplicate-code-blocks */

import { checkStep, runStep, undoStep } from "@/lib/workflow/engine";
import {
  StepDefinition,
  StepIdValue,
  StepUIState,
  VarName,
  WorkflowVars
} from "@/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

interface VarStore {
  get<K extends VarName>(key: K): WorkflowVars[K] | undefined;
  require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]>;
  set(updates: Partial<WorkflowVars>): void;
  has(key: VarName): boolean;
  build(template: string): string;
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
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context)
    throw new Error("useWorkflow must be used within WorkflowProvider");
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
  initialVars = {}
}: WorkflowProviderProps) {
  const [vars, setVarsState] = useState<Partial<WorkflowVars>>(initialVars);
  const [status, setStatus] = useState<
    Partial<Record<StepIdValue, StepUIState>>
  >({});
  const [executing, setExecuting] = useState<StepIdValue | null>(null);
  const checkedSteps = useRef(new Set<StepIdValue>());
  const listeners = useRef<Map<VarName, Set<(value: unknown) => void>>>(
    new Map()
  );

  // Create VarStore implementation
  const varStore: VarStore = {
    get<K extends VarName>(key: K): WorkflowVars[K] | undefined {
      return vars[key];
    },

    require<K extends VarName>(key: K): NonNullable<WorkflowVars[K]> {
      const value = vars[key];
      if (value === undefined) {
        throw new Error(`Required variable ${key} is not available`);
      }
      return value as NonNullable<WorkflowVars[K]>;
    },

    set(updates: Partial<WorkflowVars>) {
      updateVars(updates);
    },

    has(key: VarName): boolean {
      return vars[key] !== undefined;
    },

    build(template: string): string {
      return template.replace(/\{(\w+)\}/g, (_, key) => {
        const value = vars[key as VarName];
        if (value === undefined) {
          throw new Error(`Template variable ${key} is not available`);
        }
        return String(value);
      });
    },

    subscribe(key: VarName, callback: (value: unknown) => void): () => void {
      if (!listeners.current.has(key)) {
        listeners.current.set(key, new Set());
      }
      listeners.current.get(key)!.add(callback);

      return () => {
        listeners.current.get(key)?.delete(callback);
      };
    }
  };

  const updateVars = useCallback(
    (newVars: Partial<WorkflowVars>) => {
      const keys = Object.keys(newVars) as VarName[];
      if (keys.length === 0) return;

      setVarsState((prev) => {
        const updated = { ...prev, ...newVars };

        // Notify listeners
        keys.forEach((key) => {
          listeners.current.get(key)?.forEach((cb) => cb(updated[key]));
        });

        // Reset checked status for affected steps
        for (const step of steps) {
          const dependsOnChangedVar = step.requires.some((reqVar) =>
            keys.includes(reqVar)
          );
          const isCompleted = status[step.id]?.status === "complete";
          if (dependsOnChangedVar && !isCompleted) {
            checkedSteps.current.delete(step.id);
          }
        }

        return updated;
      });
    },
    [steps, status]
  );

  const updateStep = useCallback(
    (stepId: StepIdValue, stepState: StepUIState) => {
      setStatus((prev) => ({ ...prev, [stepId]: stepState }));
    },
    []
  );

  const executeStep = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((s) => s.id === id);
      if (!step) return;

      const missingVars = step.requires.filter((v) => !vars[v]);
      if (missingVars.length > 0) {
        updateStep(id, {
          status: "failed",
          error: `Missing required vars: ${missingVars.join(", ")}`
        });
        return;
      }

      setExecuting(id);
      updateStep(id, { status: "executing" });

      try {
        const result = await runStep(id, vars);
        updateVars(result.newVars);
        updateStep(id, result.state);
      } catch (error) {
        console.error("Failed to run step:", error);
        updateStep(id, {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Unknown error occurred"
        });
      } finally {
        setExecuting(null);
      }
    },
    [steps, vars, updateStep, updateVars]
  );

  const undoStepAction = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((s) => s.id === id);
      if (!step) return;

      updateStep(id, { status: "undoing" });

      try {
        const result = await undoStep(id, vars);
        updateStep(id, result.state);

        if (result.state.status === "reverted") {
          // Clear provided vars
          const clearedVars = Object.fromEntries(
            Object.entries(vars).filter(
              ([k]) => !step.provides.includes(k as VarName)
            )
          ) as Partial<WorkflowVars>;
          setVarsState(clearedVars);
          checkedSteps.current.delete(id);
          updateStep(id, { status: "idle" });
        }
      } catch (error) {
        console.error("Failed to undo step:", error);
        updateStep(id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Failed to undo step"
        });
      }
    },
    [steps, vars, updateStep]
  );

  const checkSteps = useCallback(async () => {
    for (const step of steps) {
      if (
        checkedSteps.current.has(step.id)
        || status[step.id]?.status === "complete"
      ) {
        continue;
      }
      if (step.requires.some((v) => !vars[v])) continue;

      checkedSteps.current.add(step.id);
      updateStep(step.id, { status: "checking" });

      const result = await checkStep(step.id, vars);
      updateStep(step.id, result.state);

      if (Object.keys(result.newVars).length > 0) {
        updateVars(result.newVars);
      }
    }
  }, [vars, steps, status, updateStep, updateVars]);

  // Auto-check steps when vars change
  useEffect(() => {
    checkSteps();
  }, [checkSteps]);

  const value: WorkflowContextValue = {
    vars: varStore,
    varsRaw: vars,
    status,
    executing,
    steps,
    updateVars,
    updateStep,
    executeStep,
    undoStep: undoStepAction,
    checkSteps
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
