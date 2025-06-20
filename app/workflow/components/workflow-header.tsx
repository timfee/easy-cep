"use client";

import { ProviderLogin } from "@/components/provider-login";
import { Badge } from "@/components/ui/badge";
import { useWorkflow } from "../context/workflow-context";

export function WorkflowHeader() {
  const { steps, status, updateVars, executing, executeStep } = useWorkflow();

  const completedSteps = steps.filter(
    (s) => status[s.id]?.status === "complete"
  ).length;
  const isRunning = executing !== null;

  const runAllSteps = async () => {
    for (const step of steps) {
      if (status[step.id]?.status !== "complete") {
        await executeStep(step.id);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <div className="border-b px-6 py-3 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">
            Easy CEP
          </h1>
          <div className="flex items-center gap-3 text-sm -mx-1">
            <Badge
              variant={isRunning ? "default" : "secondary"}
              className={
                isRunning ? "bg-green-100 text-green-800 border-green-200" : ""
              }>
              {isRunning ? "Running" : "Idle"}
            </Badge>
            <span className="text-slate-600">
              {completedSteps}/{steps.length} steps completed
            </span>
          </div>
        </div>
        <ProviderLogin onUpdate={updateVars} />
      </div>
    </div>
  );
}
