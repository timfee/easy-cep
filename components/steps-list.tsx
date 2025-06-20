"use client";

import { StepCard } from "@/components/step-card";
import { useWorkflow } from "@/components/workflow-context";
import { Var, WorkflowVars } from "@/types";
import { Loader2 } from "lucide-react";

export function StepsList() {
  const {
    steps,
    status,
    varsRaw,
    executing,
    executeStep,
    undoStep,
    updateVars,
    sessionLoaded
  } = useWorkflow();

  const loggedIn = Boolean(
    varsRaw[Var.GoogleAccessToken] || varsRaw[Var.MsGraphToken]
  );

  if (!sessionLoaded) {
    return (
      <div className="py-24 text-center text-slate-600">
        <Loader2 className="h-6 w-6 mx-auto animate-spin" />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="my-24 text-center text-slate-600">
        <div className="border-slate-300 rounded-lg h-40 p-12 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-700">
            Sign in to begin
          </h2>
          <p className="text-sm mt-1">
            Use the buttons at the top to connect your accounts.
          </p>
        </div>
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

export default StepsList;
