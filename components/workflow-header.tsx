"use client";

import { ProviderLogin } from "@/components/provider-login";
import { StepProgress } from "@/components/step-progress";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { useWorkflow } from "./workflow-context";

export function WorkflowHeader() {
  const { steps, status, updateVars, executing } = useWorkflow();

  const completedSteps = steps.filter(
    (s) => status[s.id]?.status === "complete"
  ).length;
  const isRunning = executing !== null;

  return (
    <div className="border-b px-6 py-3 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center py-2">
            <Image
              src="../icon.svg"
              alt="Easy CEP Logo"
              width="40"
              height="40"
              className="mb-1 mr-2"
            />
            <h1 className="text-xl font-semibold text-blue-700">Easy CEP</h1>
          </div>
          <div className="flex items-center gap-3 text-sm -mx-1">
            {isRunning && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Running
              </Badge>
            )}
            <span className="text-slate-600">
              {completedSteps}/{steps.length} steps completed
            </span>
          </div>
          <StepProgress />
        </div>
        <ProviderLogin onUpdate={updateVars} />
      </div>
    </div>
  );
}
