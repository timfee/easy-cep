"use client";
import {
  AppsInfoButton,
  ClaimsInfoButton,
  DomainInfoButton,
  OuInfoButton,
  ProvisioningInfoButton,
  RolesInfoButton,
  SamlInfoButton,
  SsoInfoButton,
  UsersInfoButton
} from "@/components/info/info-buttons";
import { useStepCardActions } from "@/components/step-card/step-card-context";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import { WORKFLOW_VARIABLES } from "@/lib/workflow/variables";
import {
  StepDefinition,
  StepId,
  StepIdValue,
  StepUIState,
  VarName,
  WorkflowVars
} from "@/types";
import { ChevronRight, Play, RotateCcw, Terminal, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { StepApiCalls } from "./step-api-calls";
import { StepLogs } from "./step-logs";
import { StepVariables } from "./step-variables";

const INFO_BTN: Partial<Record<StepIdValue, React.FC>> = {
  [StepId.VerifyPrimaryDomain]: DomainInfoButton,
  [StepId.CreateAutomationOU]: OuInfoButton,
  [StepId.CreateServiceUser]: UsersInfoButton,
  [StepId.CreateAdminRoleAndAssignUser]: RolesInfoButton,
  [StepId.ConfigureGoogleSamlProfile]: SamlInfoButton,
  [StepId.CreateMicrosoftApps]: AppsInfoButton,
  [StepId.SetupMicrosoftProvisioning]: ProvisioningInfoButton,
  [StepId.ConfigureMicrosoftSso]: AppsInfoButton,
  [StepId.SetupMicrosoftClaimsPolicy]: ClaimsInfoButton,
  [StepId.CompleteGoogleSsoSetup]: SamlInfoButton,
  [StepId.AssignUsersToSso]: SsoInfoButton
};

interface Props {
  definition: StepDefinition;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
}

export function StepCardContent({ definition, state, vars, executing }: Props) {
  const actions = useStepCardActions();
  const [logsOpen, setLogsOpen] = useState(false);
  const detail = STEP_DETAILS[definition.id];
  const InfoBtn = INFO_BTN[definition.id];
  useEffect(() => {
    if (executing || state?.status === "pending") setLogsOpen(true);
  }, [executing, state?.status]);
  const missing = definition.requires.filter(
    (v) => WORKFLOW_VARIABLES[v]?.ephemeral && vars[v] === undefined
  );
  const canExecute =
    Object.entries(WORKFLOW_VARIABLES)
      .filter(([, m]) => m.consumedBy?.includes(definition.id) && !m.producedBy)
      .every(([k]) => vars[k as VarName] !== undefined) && missing.length === 0;
  const canUndo = state?.status === "complete";
  return (
    <CardContent className="px-6">
      {detail?.description && (
        <div
          className="text-sm text-slate-700 px-6"
          onClick={(e) => e.stopPropagation()}>
          {detail.description.split("\n").map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      <div
        className="overflow-x-auto my-6 px-6"
        onClick={(e) => e.stopPropagation()}>
        <StepApiCalls stepId={definition.id} />
      </div>
      <div className="flex items-center justify-between my-6 px-6">
        <div className="flex items-center gap-2">
          {missing.length > 0 ?
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.onExecute(definition.id);
                  }}
                  disabled>
                  <Play className="h-3.5 w-3.5 mr-1.5" /> Execute
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{`Requires transient data from ${missing
                .map((v) => {
                  const p = WORKFLOW_VARIABLES[v]?.producedBy;
                  return p ? STEP_DETAILS[p]?.title || p : v;
                })
                .join(
                  ", "
                )}. Re-run the producing step first.`}</TooltipContent>
            </Tooltip>
          : <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                actions.onExecute(definition.id);
              }}
              disabled={
                !canExecute || executing || state?.status === "complete"
              }>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Execute
            </Button>
          }
          {InfoBtn && <InfoBtn />}
        </div>
        <div className="flex items-center gap-2">
          {canUndo && (
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                actions.onUndo(definition.id);
              }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Undo
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              actions.onForce(definition.id);
            }}
            disabled={executing}>
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Force
          </Button>
        </div>
      </div>
      <div
        className="overflow-x-auto my-6 px-6"
        onClick={(e) => e.stopPropagation()}>
        <StepVariables
          stepId={definition.id}
          vars={vars}
          onChange={actions.onVarChange}
        />
      </div>
      <Collapsible open={logsOpen} onOpenChange={setLogsOpen} className="px-6">
        <CollapsibleTrigger className="w-full flex items-center justify-between mt-4 font-medium text-slate-700 hover:bg-slate-100 p-4 rounded bg-slate-50 border border-slate-200 transition-colors">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-secondary" /> Execution Logs
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              logsOpen && "rotate-90"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 border-slate-100 border border-t-0 rounded-t-none rounded data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          {state?.logs && state.logs.length > 0 ?
            <StepLogs logs={state.logs} />
          : <div className="text-center py-6 text-slate-500 border border-dashed border-slate-300 rounded my-1">
              <Terminal className="h-5 w-5 mx-auto text-slate-400 mb-1.5" />
              <p className="text-xs">No logs for this step yet.</p>
            </div>
          }
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  );
}
