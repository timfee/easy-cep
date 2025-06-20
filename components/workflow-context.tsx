"use client";
/* eslint-disable workflow/no-duplicate-code-blocks */

import { checkStep, runStep, undoStep } from "@/lib/workflow/engine";
import {
  parsePersistedState,
  prepareStateForPersistence
} from "@/lib/workflow/schemas/persisted-state";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import { createVarStore, type BasicVarStore } from "@/lib/workflow/var-store";
import { WORKFLOW_VARIABLES } from "@/lib/workflow/variables";
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
  useMemo,
  useRef,
  useState
} from "react";

export function filterEphemeralVars(
  vars: Partial<WorkflowVars>
): Partial<WorkflowVars> {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    if (!WORKFLOW_VARIABLES[key as VarName]?.ephemeral) {
      acc[key as VarName] = value;
    }
    return acc;
  }, {} as Partial<WorkflowVars>);
}

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
  const loadStoredState = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("workflowState");
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const validated = parsePersistedState(parsed);

      if (!validated) {
        localStorage.removeItem("workflowState");
        console.warn("Cleared corrupted workflow state from localStorage");
        return null;
      }

      return validated;
    } catch (error) {
      console.error("Failed to load workflow state:", error);
      localStorage.removeItem("workflowState");
      return null;
    }
  }, []);

  const [vars, setVarsState] = useState<Partial<WorkflowVars>>(() => ({
    ...initialVars
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

  // Load stored workflow state on mount
  useEffect(() => {
    const stored = loadStoredState();
    if (stored) {
      if (stored.vars) {
        setVarsState((prev) => ({ ...prev, ...stored.vars }));
      }
      if (stored.status) {
        setStatus(stored.status);
        statusRef.current = stored.status;
      }
    }
    setSessionLoaded(true);
  }, [loadStoredState]);

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
          const isCompleted = statusRef.current[step.id]?.status === "complete";
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
        listeners.current.get(key)!.add(callback);

        return () => {
          listeners.current.get(key)?.delete(callback);
        };
      }
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
      if (!step) return;

      const missingVars = step.requires.filter((varName) => !vars[varName]);
      if (missingVars.length > 0) {
        const messages = missingVars.map((key) => {
          const meta = WORKFLOW_VARIABLES[key];
          const producer = meta?.producedBy;
          const producerName =
            producer ? STEP_DETAILS[producer]?.title || producer : null;
          if (meta?.ephemeral && producerName) {
            return `${key} (from \"${producerName}\" – rerun this step)`;
          }
          return producerName ? `${key} (from \"${producerName}\")` : key;
        });
        updateStep(id, {
          status: "failed",
          error: `Missing required vars: ${messages.join(", ")}`
        });
        return;
      }

      setExecuting(id);
      updateStep(id, { status: "executing" });

      try {
        const result = await runStep(id, vars);
        updateStep(id, result.state);
        updateVars(result.newVars);
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
      const step = steps.find((workflowStep) => workflowStep.id === id);
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
      if (step.requires.some((varName) => !vars[varName])) continue;

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stateJson = prepareStateForPersistence(vars, statusRef.current);
        localStorage.setItem("workflowState", stateJson);
      } catch (error) {
        console.error("Failed to save workflow state:", error);
      }
    }
  }, [vars, status]);

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
    checkSteps,
    sessionLoaded,
    setSessionLoaded
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
