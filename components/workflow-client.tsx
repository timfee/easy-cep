/* eslint-disable workflow/no-duplicate-code-blocks */
/* eslint-disable workflow/no-hardcoded-config */
"use client";

import { ProviderLogin } from "@/components/provider-login";
import { StepCard } from "@/components/step-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VarsInspector } from "@/components/vars-inspector";
import { checkStep, runStep, undoStep } from "@/lib/workflow/engine";
import {
  StepDefinition,
  StepIdValue,
  StepUIState,
  Var,
  VarName,
  WorkflowVars
} from "@/types";
import { Activity, Play, Settings, Variable } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface WorkflowClientProps {
  steps: ReadonlyArray<StepDefinition>;
}

const DEFAULT_CONFIG: Partial<WorkflowVars> = {
  [Var.AutomationOuName]: "Automation",
  [Var.AutomationOuPath]: "/Automation",
  [Var.ProvisioningUserPrefix]: "azuread-provisioning",
  [Var.AdminRoleName]: "Microsoft Entra Provisioning",
  [Var.SamlProfileDisplayName]: "Azure AD",
  [Var.ProvisioningAppDisplayName]: "Google Workspace Provisioning",
  [Var.SsoAppDisplayName]: "Google Workspace SSO",
  [Var.ClaimsPolicyDisplayName]: "Google Workspace Basic Claims"
};

export function WorkflowClient({ steps }: WorkflowClientProps) {
  const initialized = useRef(false);
  const checkedSteps = useRef(new Set<StepIdValue>());

  const [vars, setVars] = useState<Partial<WorkflowVars>>({});
  const [status, setStatus] = useState<
    Partial<Record<StepIdValue, StepUIState>>
  >({});
  const [executing, setExecuting] = useState<StepIdValue | null>(null);

  // Initialize once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setVars({
      [Var.GeneratedPassword]: Math.random().toString(36).slice(-12),
      ...DEFAULT_CONFIG
    });
  }, []);

  const updateStep = useCallback(
    (stepId: StepIdValue, stepState: StepUIState) =>
      setStatus((prev) => ({ ...prev, [stepId]: stepState })),
    []
  );

  const updateVars = useCallback(
    (newVars: Partial<WorkflowVars>) => {
      const keys = Object.keys(newVars) as VarName[];
      if (keys.length === 0) return;

      setVars((prev) => {
        const hasChanges = keys.some((k) => newVars[k] !== prev[k]);
        if (!hasChanges) return prev;

        for (const step of steps) {
          const dependsOnChangedVar = step.requires.some((reqVar) =>
            keys.includes(reqVar)
          );
          const isCompleted = status[step.id]?.status === "complete";

          if (dependsOnChangedVar && !isCompleted) {
            checkedSteps.current.delete(step.id);
          }
        }

        return { ...prev, ...newVars };
      });
    },
    [steps, status]
  );

  const checkSteps = useCallback(async () => {
    for (const step of steps) {
      if (
        checkedSteps.current.has(step.id)
        || status[step.id]?.status === "complete"
      )
        continue;
      if (step.requires.some((v) => !vars[v])) continue;

      checkedSteps.current.add(step.id);
      updateStep(step.id, { status: "checking" });

      const result = await checkStep(step.id, vars);
      updateStep(step.id, result.state);

      if (Object.keys(result.newVars).length > 0) {
        updateVars(result.newVars);
      }
    }
  }, [vars, steps, status, updateStep, updateVars]);

  useEffect(() => {
    checkSteps();
  }, [checkSteps]);

  // Step operations
  const executeStep = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((s) => s.id === id);
      if (!step) return;

      const missingVars = step.requires.filter((v) => !vars[v]);
      if (missingVars.length > 0) {
        return updateStep(id, {
          status: "failed",
          error: `Missing required vars: ${missingVars.join(", ")}`
        });
      }

      setExecuting(id);
      updateStep(id, { status: "executing" });

      try {
        const result = await runStep(id, vars);
        updateVars(result.newVars);
        updateStep(id, result.state);
      } catch (error) {
        console.error("Failed to run step:", error);
        updateStep(id, {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Unknown error occurred"
        });
      } finally {
        setExecuting(null);
      }
    },
    [steps, vars, updateStep, updateVars]
  );
  const undoStepAction = useCallback(
    async (id: StepIdValue) => {
      const step = steps.find((s) => s.id === id);
      if (!step) return;

      updateStep(id, { status: "undoing" });

      try {
        const result = await undoStep(id, vars);
        updateStep(id, result.state);

        if (result.state.status === "reverted") {
          // Clear provided vars and reset step
          setVars(
            (prev) =>
              Object.fromEntries(
                Object.entries(prev).filter(
                  ([k]) => !step.provides.includes(k as VarName)
                )
              ) as Partial<WorkflowVars>
          );
          checkedSteps.current.delete(id);
          updateStep(id, { status: "idle" });
        }
      } catch (error) {
        console.error("Failed to undo step:", error);
        updateStep(id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Failed to undo step"
        });
      }
    },
    [steps, vars, updateStep]
  );

  const runAllSteps = useCallback(async () => {
    for (const step of steps) {
      if (status[step.id]?.status !== "complete") {
        await executeStep(step.id);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }, [steps, status, executeStep]);

  // Computed values
  const completedSteps = steps.filter(
    (s) => status[s.id]?.status === "complete"
  ).length;
  const isWorkflowRunning = executing !== null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isRunning={isWorkflowRunning}
        completedSteps={completedSteps}
        totalSteps={steps.length}
        vars={vars}
        onVarsUpdate={updateVars}
      />

      <MainContent
        steps={steps}
        status={status}
        vars={vars}
        executing={executing}
        isRunning={isWorkflowRunning}
        onExecute={executeStep}
        onUndo={undoStepAction}
        onRunAll={runAllSteps}
        onVarChange={(key, value) =>
          updateVars({ [key]: value } as Partial<WorkflowVars>)
        }
      />
    </div>
  );
}

// Extracted components
function Sidebar({
  isRunning,
  completedSteps,
  totalSteps,
  vars,
  onVarsUpdate
}: {
  isRunning: boolean;
  completedSteps: number;
  totalSteps: number;
  vars: Partial<WorkflowVars>;
  onVarsUpdate: (vars: Partial<WorkflowVars>) => void;
}) {
  return (
    <div className="border-r bg-slate-50/50 flex flex-col">
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
            {completedSteps}/{totalSteps} steps completed
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-slate-50/50">
        <div className="p-6 space-y-6">
          <SidebarSection
            icon={<Settings className="h-4 w-4 text-orange-600" />}
            title="Provider Authentication"
            bgColor="bg-orange-100">
            <ProviderLogin onUpdate={onVarsUpdate} />
          </SidebarSection>

          <Separator className="bg-slate-200" />

          <SidebarSection
            icon={<Variable className="h-4 w-4 text-purple-600" />}
            title="Global Variables"
            bgColor="bg-purple-100">
            <VarsInspector vars={vars} onChange={onVarsUpdate} />
          </SidebarSection>
        </div>
      </ScrollArea>
    </div>
  );
}

function MainContent({
  steps,
  status,
  vars,
  executing,
  isRunning,
  onExecute,
  onUndo,
  onRunAll,
  onVarChange
}: {
  steps: ReadonlyArray<StepDefinition>;
  status: Partial<Record<StepIdValue, StepUIState>>;
  vars: Partial<WorkflowVars>;
  executing: StepIdValue | null;
  isRunning: boolean;
  onExecute: (id: StepIdValue) => void;
  onUndo: (id: StepIdValue) => void;
  onRunAll: () => void;
  onVarChange: (key: VarName, value: unknown) => void;
}) {
  return (
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
          <Button
            size="sm"
            disabled={isRunning}
            onClick={onRunAll}
            className="bg-blue-600 hover:bg-blue-700">
            <Play className="h-4 w-4 mr-2" />
            Run All
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-slate-50/30">
        <div className="p-6 space-y-4">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              index={index}
              definition={step}
              state={status[step.id]}
              vars={vars}
              executing={executing === step.id}
              onExecute={onExecute}
              onUndo={onUndo}
              onForce={onExecute}
              onVarChange={onVarChange}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function SidebarSection({
  icon,
  title,
  bgColor,
  children
}: {
  icon: React.ReactNode;
  title: string;
  bgColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-80">
      <h3 className="font-medium mb-4 flex items-center gap-2 text-slate-900">
        <div className={`p-1 ${bgColor} rounded`}>{icon}</div>
        {title}
      </h3>
      {children}
    </div>
  );
}
