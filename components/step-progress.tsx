"use client";

import { cn } from "@/lib/utils";
import { useWorkflow } from "./workflow-context";
import { type StepIdValue } from "@/types";

export function StepProgress() {
  const { steps, status, executing } = useWorkflow();

  const getColor = (stepId: StepIdValue) => {
    const state = status[stepId];
    if (executing === stepId) return "bg-blue-500";
    switch (state?.status) {
      case "checking":
      case "executing":
        return "bg-blue-500";
      case "complete":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "pending":
      case "undoing":
        return "bg-amber-500";
      case "reverted":
        return "bg-slate-600";
      default:
        return "bg-slate-200";
    }
  };

  return (
    <div className="flex gap-0.5 mt-1 h-2">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "flex-1 rounded-sm",
            index === 0 && "rounded-l",
            index === steps.length - 1 && "rounded-r",
            getColor(step.id)
          )}
        />
      ))}
    </div>
  );
}
