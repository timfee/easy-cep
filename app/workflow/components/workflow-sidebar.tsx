"use client";

import { ProviderLogin } from "@/components/provider-login";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Settings } from "lucide-react";
import { useWorkflow } from "../context/workflow-context";

export function WorkflowSidebar() {
  const { steps, status, executing, updateVars } = useWorkflow();

  const completedSteps = steps.filter(
    (s) => status[s.id]?.status === "complete"
  ).length;
  const isRunning = executing !== null;

  return (
    <aside className="border-r bg-slate-50/50 flex flex-col w-80 min-w-80 max-w-sm flex-shrink-0">
      <div className="p-6 border-b bg-white">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Workflow Orchestrator
          </h1>
        </div>

        <div className="flex items-center gap-3 text-sm">
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

      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2 text-slate-900">
                <div className="p-1 bg-orange-100 rounded">
                  <Settings className="h-4 w-4 text-orange-600" />
                </div>
                Provider Authentication
              </h3>
              <ProviderLogin onUpdate={updateVars} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
