"use client";

import { StepCard } from "@/components/step-card";
import { WorkflowVars } from "@/types";
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
