"use client";

import { StepId, StepOutcome, WorkflowVars } from "@/types";
import { useEffect, useState } from "react";
import { checkStep } from "./actions/check-step";
import { executeStep } from "./actions/execute-step";

type StepStatus = { isComplete: boolean; summary: string };

type WorkflowState = {
  vars: Partial<WorkflowVars>;
  status: Partial<Record<StepId, StepStatus>>;
  executing: StepId | null;
};

const STEP_SEQUENCE: StepId[] = [
  StepId.VerifyPrimaryDomain,
  StepId.CreateAutomationOu,
  StepId.CreateServiceUser
];

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState>({
    vars: {},
    status: {},
    executing: null
  });

  // On mount, check all steps in sequence
  useEffect(() => {
    (async () => {
      let vars = { ...state.vars };
      const status: WorkflowState["status"] = {};

      for (const id of STEP_SEQUENCE) {
        const result = await checkStep(id); // assumes no vars needed
        status[id] = { isComplete: result.isComplete, summary: result.summary };
        if (result.data) vars = { ...vars, ...result.data };
      }

      setState((prev) => ({ ...prev, status, vars }));
    })();
  }, []);

  async function handleExecute(id: StepId) {
    setState((prev) => ({ ...prev, executing: id }));
    const checkResult = await checkStep(id);
    const execResult = await executeStep(id, checkResult);

    const updatedVars =
      execResult.output ? { ...state.vars, ...execResult.output } : state.vars;

    setState((prev) => ({
      ...prev,
      executing: null,
      vars: updatedVars,
      status: {
        ...prev.status,
        [id]: {
          isComplete: execResult.status === StepOutcome.Succeeded,
          summary: execResult.notes ?? execResult.error ?? checkResult.summary
        }
      }
    }));
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
              <div>{step?.summary ?? "Checking…"}</div>
              {!step?.isComplete && (
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
