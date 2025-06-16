"use client";

import { StepId, StepUIState, WorkflowVars } from "@/types";
import { useState } from "react";
import { runStep } from "../workflow/engine";
import ProviderLogin from "./ProviderLogin";
import StepCard, { StepInfo } from "./StepCard";

interface Props {
  steps: ReadonlyArray<StepInfo>;
}

export default function WorkflowClient({ steps }: Props) {
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
    const def = steps.find((s) => s.id === id);
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
    <main className="p-4">
      <ProviderLogin onUpdate={updateVars} />
      {steps.map((step) => (
        <StepCard
          key={step.id}
          definition={step}
          state={status[step.id]}
          vars={vars}
          executing={executing !== null}
          onExecute={handleExecute}
        />
      ))}
    </main>
  );
}
