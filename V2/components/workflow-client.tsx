"use client";

import { ProviderLogin } from "@/components/provider-login";
import { StepCard } from "@/components/step-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VarsInspector } from "@/components/vars-inspector";
import type { StepIdValue, VarName } from "@/lib/workflow-variables"; // Import types
import { WORKFLOW_VARIABLES } from "@/lib/workflow-variables";
import { Activity, Play, Settings, Variable } from "lucide-react";
import { useCallback, useState } from "react";

// Define StepInfo based on your actual step definitions
interface StepInfo {
  id: StepIdValue;
  // Conceptual requires/provides, actual data flow is via WORKFLOW_VARIABLES
  requires: readonly VarName[];
  provides: readonly VarName[];
  // Add other step-specific properties if needed
  name?: string; // e.g., "Authenticate Google"
  description?: string;
}

// Define StepLogEntry and StepUIState here as they are central to workflow state
export interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: "info" | "warn" | "error" | "debug";
  apiCall?: {
    method: string;
    url: string;
    request?: { headers?: Record<string, string>; body?: any };
    response?: { status: number; headers?: Record<string, string>; body?: any };
    duration?: number;
  };
}

export interface StepUIState {
  status:
    | "idle"
    | "checking"
    | "executing"
    | "complete"
    | "failed"
    | "pending"
    | "undoing"
    | "reverted";
  summary?: string;
  error?: string;
  notes?: string;
  logs?: StepLogEntry[];
}

interface WorkflowClientProps {
  steps: ReadonlyArray<StepInfo>;
}

type WorkflowVars = Partial<Record<VarName, any>>;

export function WorkflowClient({ steps }: WorkflowClientProps) {
  const initialVars = Object.entries(WORKFLOW_VARIABLES).reduce(
    (acc, [key, meta]) => {
      if (meta.defaultValue !== undefined) {
        acc[key as VarName] = meta.defaultValue;
      }
      return acc;
    },
    {} as WorkflowVars
  );

  const [vars, setVars] = useState<WorkflowVars>(initialVars);
  const [stepStates, setStepStates] = useState<Record<string, StepUIState>>({});
  const [executingSteps, setExecutingSteps] = useState<Set<string>>(new Set());

  const handleVarsUpdate = useCallback((newVars: Partial<WorkflowVars>) => {
    setVars((prev) => ({ ...prev, ...newVars }));
  }, []);

  const handleSingleVarChange = useCallback((key: VarName, value: unknown) => {
    setVars((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExecuteStep = useCallback(
    (stepId: StepIdValue) => {
      setExecutingSteps((prev) => new Set([...prev, stepId]));
      setStepStates((prev) => ({
        ...prev,
        [stepId]: { status: "executing", summary: "Step is running..." }
      }));

      // Simulate step execution with mixed log types
      setTimeout(() => {
        setExecutingSteps((prev) => {
          const next = new Set(prev);
          next.delete(stepId);
          return next;
        });

        const shouldFail = Math.random() < 0.3;

        // Simulate variable production
        const producedVarsUpdate: WorkflowVars = {};
        Object.entries(WORKFLOW_VARIABLES).forEach(([varKey, meta]) => {
          if (meta.producedBy === stepId) {
            if (meta.type === "string")
              producedVarsUpdate[varKey as VarName] =
                `${varKey}-value-${Date.now()}`;
            if (meta.type === "boolean")
              producedVarsUpdate[varKey as VarName] = Math.random() > 0.5;
            // Add other types as needed
          }
        });
        if (Object.keys(producedVarsUpdate).length > 0) {
          handleVarsUpdate(producedVarsUpdate);
        }

        setStepStates((prev) => ({
          ...prev,
          [stepId]:
            shouldFail ?
              {
                status: "failed",
                summary: "Step execution failed",
                error: "Connection timeout after 30 seconds",
                logs: [
                  {
                    timestamp: Date.now(),
                    message: `Step ${stepId} started`,
                    level: "info"
                  },
                  {
                    timestamp: Date.now() + 1000,
                    message: "API call failed",
                    level: "error",
                    apiCall: {
                      method: "GET",
                      url: "https://api.example.com/data",
                      request: { headers: { Authorization: "Bearer ***" } },
                      response: {
                        status: 500,
                        body: { error: "Internal Server Error" }
                      },
                      duration: 2500
                    }
                  }
                ]
              }
            : {
                status: "complete",
                summary: "Step completed successfully",
                logs: [
                  {
                    timestamp: Date.now(),
                    message: `Step ${stepId} started`,
                    level: "info"
                  },
                  {
                    timestamp: Date.now() + 1000,
                    message: "API call successful",
                    level: "info",
                    apiCall: {
                      method: "GET",
                      url: "https://api.example.com/data",
                      request: { headers: { Authorization: "Bearer ***" } },
                      response: {
                        status: 200,
                        body: { data: [{ id: 1, name: "Example" }] },
                        headers: { "Content-Type": "application/json" }
                      },
                      duration: 245
                    }
                  },
                  {
                    timestamp: Date.now() + 2000,
                    message: `Step ${stepId} completed`,
                    level: "info"
                  }
                ]
              }
        }));
      }, 3000);
    },
    [handleVarsUpdate]
  );

  const handleUndoStep = useCallback((stepId: StepIdValue) => {
    setStepStates((prev) => ({
      ...prev,
      [stepId]: { status: "undoing", summary: "Reverting step..." }
    }));

    setTimeout(() => {
      setStepStates((prev) => ({
        ...prev,
        [stepId]: { status: "reverted", summary: "Step reverted" }
      }));
    }, 1500);
  }, []);

  const handleForceStep = useCallback(
    (stepId: StepIdValue) => {
      handleExecuteStep(stepId);
    },
    [handleExecuteStep]
  );

  const completedSteps = Object.values(stepStates).filter(
    (state) => state.status === "complete"
  ).length;
  const totalSteps = steps.length;
  const isWorkflowRunning = executingSteps.size > 0;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-slate-50/50 flex flex-col">
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
              variant={isWorkflowRunning ? "default" : "secondary"}
              className={
                isWorkflowRunning ?
                  "bg-green-100 text-green-800 border-green-200"
                : ""
              }>
              {isWorkflowRunning ? "Running" : "Idle"}
            </Badge>
            <span className="text-slate-600">
              {completedSteps}/{totalSteps} steps completed
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-50/50">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2 text-slate-900">
                  <div className="p-1 bg-orange-100 rounded">
                    <Settings className="h-4 w-4 text-orange-600" />
                  </div>
                  Provider Authentication
                </h3>
                <ProviderLogin onUpdate={handleVarsUpdate} />
              </div>

              <Separator className="bg-slate-200" />

              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2 text-slate-900">
                  <div className="p-1 bg-purple-100 rounded">
                    <Variable className="h-4 w-4 text-purple-600" />
                  </div>
                  Global Variables
                </h3>
                <VarsInspector vars={vars} onChange={handleVarsUpdate} />
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white">
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
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={isWorkflowRunning}
                className="bg-blue-600 hover:bg-blue-700">
                <Play className="h-4 w-4 mr-2" />
                Run All
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-50/30">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  index={index}
                  definition={step}
                  state={stepStates[step.id]}
                  vars={vars}
                  executing={executingSteps.has(step.id)}
                  onExecute={handleExecuteStep}
                  onUndo={handleUndoStep}
                  onForce={handleForceStep}
                  onVarChange={handleSingleVarChange} // Pass down the handler
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
