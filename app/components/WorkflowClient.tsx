"use client";

import { StepId, StepUIState, Var, WorkflowVars } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkStep, runStep } from "../workflow/engine";
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

  const updateVars = useCallback((newVars: Partial<WorkflowVars>) => {
    const keys = Object.keys(newVars) as (keyof typeof newVars)[];
    if (keys.length === 0) return;
    setVars((prev) => {
      let changed = false;
      for (const k of keys) {
        if (newVars[k] !== prev[k]) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        return prev;
      }
      return { ...prev, ...newVars };
    });
  }, []);

  const updateStep = useCallback(
    (stepId: StepId, stepState: StepUIState) =>
      setStatus((prev) => ({ ...prev, [stepId]: stepState })),
    []
  );

  // Run checks once when auth tokens become available
  const hasChecked = useRef(false);
  useEffect(() => {
    if (hasChecked.current) return;
    if (!vars[Var.GoogleAccessToken] && !vars[Var.MsGraphToken]) return;
    hasChecked.current = true;
    (async () => {
      for (const step of steps) {
        const missing = step.requires.filter((v) => !vars[v]);
        if (missing.length === 0) {
          const result = await checkStep(step.id, vars);
          updateStep(step.id, result.state);
          if (Object.keys(result.newVars).length > 0) {
            updateVars(result.newVars);
          }
        }
      }
    })();
  }, [
    vars[Var.GoogleAccessToken],
    vars[Var.MsGraphToken],
    steps,
    updateStep,
    updateVars
  ]);

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
      const result = await runStep(id, vars);
      updateVars(result.newVars);
      updateStep(id, result.state);
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
