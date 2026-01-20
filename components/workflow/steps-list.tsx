"use client";

import { Loader2 } from "lucide-react";
import { useMemo } from "react";

import type { VarName, WorkflowVars } from "@/lib/workflow/variables";

import { useWorkflow } from "@/components/workflow/context";
import { CompletionCard } from "@/components/workflow/steps/completion-card";
import { StepCard } from "@/components/workflow/steps/step-card";
import { Var } from "@/lib/workflow/variables";

/**
 * Render the workflow steps with login gating.
 */
export function StepsList() {
  const {
    steps,
    status,
    varsRaw,
    executing,
    executeStep,
    undoStep,
    updateVars,
    sessionLoaded,
  } = useWorkflow();

  const stepActions = useMemo(
    () => ({
      onExecute: executeStep,
      onForce: executeStep,
      onUndo: undoStep,
      onVarChange: (key: VarName, value: unknown) => {
        const updates: Partial<WorkflowVars> = {};
        if (typeof value === "string") {
          updates[key] = value;
        }
        updateVars(updates);
      },
    }),
    [executeStep, undoStep, updateVars]
  );

  const loggedIn = Boolean(
    varsRaw[Var.GoogleAccessToken] || varsRaw[Var.MsGraphToken]
  );

  if (!sessionLoaded) {
    return (
      <div className="py-24 text-center text-foreground/70">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="my-24 text-center text-foreground/70">
        <div className="h-40 rounded-lg border border-border/60 bg-muted/30 p-12">
          <h2 className="font-semibold text-foreground text-lg">
            Sign in to begin
          </h2>
          <p className="mt-1 text-sm">
            Use the buttons at the top to connect your accounts.
          </p>
        </div>
      </div>
    );
  }

  const allComplete =
    steps.length > 0 &&
    steps.every((step) => {
      const stepState = status[step.id];
      return stepState?.status === "complete";
    });

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const stepState = status[step.id];

        return (
          <StepCard
            actions={stepActions}
            definition={step}
            executing={executing === step.id}
            index={index}
            key={step.id}
            state={stepState}
            vars={varsRaw}
          />
        );
      })}
      {allComplete && <CompletionCard />}
    </div>
  );
}
