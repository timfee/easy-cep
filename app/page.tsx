"use client";

import { StepId, StepUIState, WorkflowVars } from "@/types";
import { useEffect, useState } from "react";
import { runStep } from "./workflow/engine";

type StepStatus = StepUIState;

type WorkflowState = {
  vars: Partial<WorkflowVars>;
  status: Partial<Record<StepId, StepStatus>>;
  executing: StepId | null;
};

const STEP_SEQUENCE: StepId[] = [StepId.DummyStep];

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState>({
    vars: {},
    status: {},
    executing: null
  });

  useEffect(() => {
    // Initial state could be loaded here in the future
  }, []);

  async function handleExecute(id: StepId) {
    try {
      await runStep(
        id,
        state.vars,
        (newVars) =>
          setState((prev) => ({ ...prev, vars: { ...prev.vars, ...newVars } })),
        (stepId, stepState) =>
          setState((prev) => ({
            ...prev,
            status: { ...prev.status, [stepId]: stepState }
          }))
      );
    } catch (error) {
      console.error("Failed to run step:", error);
    }
  }

  return (
    <main>
      <h1>Federation Workflow</h1>
      <ul>
        {STEP_SEQUENCE.map((id) => {
          const step = state.status[id];
          return (
            <li key={id}>
              <strong>{id}</strong>
              <div>{step?.summary ?? step?.error ?? step?.notes ?? ""}</div>
              {step?.status !== "complete" && (
                <button
                  onClick={() => handleExecute(id)}
                  disabled={!!state.executing}>
                  Execute
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
