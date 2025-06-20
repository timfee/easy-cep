"use client";

import { StepCard } from "@/components/step-card";
import { Var, WorkflowVars } from "@/types";
import { useWorkflow } from "../context/workflow-context";

export default function StepsPage() {
  const {
    steps,
    status,
    varsRaw,
    executing,
    executeStep,
    undoStep,
    updateVars
  } = useWorkflow();

  const loggedIn = Boolean(
    varsRaw[Var.GoogleAccessToken] || varsRaw[Var.MsGraphToken]
  );

  if (!loggedIn) {
    return (
      <div className="py-24 text-center text-slate-600">
        <div className="border-2 border-dashed border-slate-300 rounded-lg h-40 mb-6 flex items-center justify-center bg-slate-50" />
        <h2 className="text-lg font-semibold text-slate-700">
          Sign in to begin
        </h2>
        <p className="text-sm mt-1">
          Use the buttons above to connect your accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <StepCard
          key={step.id}
          index={index}
          definition={step}
          state={status[step.id]}
          vars={varsRaw}
          executing={executing === step.id}
          onExecute={executeStep}
          onUndo={undoStep}
          onForce={executeStep}
          onVarChange={(key, value) =>
            updateVars({ [key]: value } as Partial<WorkflowVars>)
          }
        />
      ))}
    </div>
  );
}
