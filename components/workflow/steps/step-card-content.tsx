"use client";

import { ChevronRight, Play, RotateCcw, Terminal, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AppsInfoButton,
  ClaimsInfoButton,
  DomainInfoButton,
  OuInfoButton,
  ProvisioningInfoButton,
  RolesInfoButton,
  SamlInfoButton,
  SsoInfoButton,
  UsersInfoButton,
} from "@/components/workflow/info/info-buttons";
import { useStepCardActions } from "@/components/workflow/steps/step-card-context";
import { cn } from "@/lib/utils";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import { StepId, type StepIdValue } from "@/lib/workflow/step-ids";
import  { type WorkflowVars } from "@/lib/workflow/variables";
import  { type StepDefinition, type StepUIState } from "@/types";

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
  [StepId.AssignUsersToSso]: SsoInfoButton,
};

interface Props {
  definition: StepDefinition;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
}

/**
 * Main body of a step card with actions and logs.
 */
export function StepCardContent({ definition, state, vars, executing }: Props) {
  const actions = useStepCardActions();
  const [logsOpen, setLogsOpen] = useState(false);
  const detail = STEP_DETAILS[definition.id];
  const InfoBtn = INFO_BTN[definition.id];
  useEffect(() => {
    if (executing) {
      setLogsOpen(true);
    }
  }, [executing]);

  const missingAll = definition.requires.filter((v) => vars[v] === undefined);
  const canExecute = missingAll.length === 0;
  const canUndo = state?.status === "complete";

  return (
    <CardContent className="px-6 pb-8">
      {detail?.description && (
        <div className="w-full px-6 text-left text-muted-foreground text-sm">
          {detail.description.split("\n").map((l, i) => (
            <p key={`${definition.id}-desc-${i}`}>{l}</p>
          ))}
        </div>
      )}
      <div className="my-6 w-full overflow-x-auto px-6 text-left">
        <StepApiCalls stepId={definition.id} />
      </div>
      <div className="my-6 flex items-start justify-between px-6">
        <div>
          <div className="flex items-center gap-2">
            <Button
              disabled={
                !canExecute || executing || state?.status === "complete"
              }
              onClick={(e) => {
                e.stopPropagation();
                actions.onExecute(definition.id);
              }}
              size="sm"
            >
              <Play className="h-3.5 w-3.5" /> Execute
            </Button>
            {InfoBtn && <InfoBtn />}
          </div>
          {!canExecute && state?.blockReason && (
            <p className="mt-2 text-destructive text-xs">{state.blockReason}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canUndo && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                actions.onUndo(definition.id);
              }}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Undo
            </Button>
          )}
          <Button
            disabled={executing}
            onClick={(e) => {
              e.stopPropagation();
              actions.onForce(definition.id);
            }}
            size="sm"
            variant="outline"
          >
            <Zap className="h-3.5 w-3.5" /> Force
          </Button>
        </div>
      </div>
      <div className="my-6 w-full overflow-x-auto px-6 text-left">
        <StepVariables
          missing={missingAll}
          onChange={actions.onVarChange}
          stepId={definition.id}
          vars={vars}
        />
      </div>
      <Collapsible className="px-6" onOpenChange={setLogsOpen} open={logsOpen}>
        <CollapsibleTrigger className="mt-4 flex w-full items-center justify-between rounded border border-border bg-muted/60 p-4 font-medium text-muted-foreground transition-colors hover:bg-muted">
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
        <CollapsibleContent className="rounded rounded-t-none border border-border/60 border-t-0 p-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          {state?.logs && state.logs.length > 0 && (
            <StepLogs logs={state.logs} />
          )}
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  );
}
