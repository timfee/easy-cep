"use client";

import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useWorkflow } from "../context/workflow-context";

export function WorkflowHeader() {
  const { steps, status, executing, executeStep } = useWorkflow();

  const runAllSteps = async () => {
    for (const step of steps) {
      if (status[step.id]?.status !== "complete") {
        await executeStep(step.id);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <div className="border-b p-6 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">
            Workflow Steps
          </h2>
          <p className="text-sm text-slate-600">
            Execute steps in sequence or manage them individually
          </p>
        </div>
        <Button
          size="sm"
          disabled={executing !== null}
          onClick={runAllSteps}
          className="bg-blue-600 hover:bg-blue-700">
          <Play className="h-4 w-4 mr-2" />
          Run All
        </Button>
      </div>
    </div>
  );
}
