"use client";

import { StepId, StepUIState, WorkflowVars } from "@/types";

import { useState } from "react";
import ProviderLogin from "./components/ProviderLogin";
import StepCard from "./components/StepCard";
import { runStep } from "./workflow/engine";
import { getAllSteps } from "./workflow/step-registry";

const STEPS = getAllSteps();

export default function WorkflowPage() {
  const [vars, setVars] = useState<Partial<WorkflowVars>>({});
  const [status, setStatus] = useState<Partial<Record<StepId, StepUIState>>>(
    {}
  );
  const [executing, setExecuting] = useState<StepId | null>(null);

  const updateVars = (newVars: Partial<WorkflowVars>) =>
    setVars((prev) => ({ ...prev, ...newVars }));

  const updateStep = (stepId: StepId, stepState: StepUIState) =>
    setStatus((prev) => ({ ...prev, [stepId]: stepState }));

  async function handleExecute(id: StepId) {
    const def = STEPS.find((s) => s.id === id);
    if (!def) return;
    const missing = def.requires.filter((v) => !vars[v]);
    if (missing.length > 0) {
      updateStep(id, {
        status: "failed",
        error: `Missing required vars: ${missing.join(", ")}`
      });
      return;
    }

    setExecuting(id);
    try {
      await runStep(id, vars, updateVars, updateStep);
    } catch (error) {
      console.error("Failed to run step:", error);
    } finally {
      setExecuting(null);
    }
  }

  return (
    <main>
      <AuthSection />
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
