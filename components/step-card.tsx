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
} from "@/components/info-buttons";
import { StepApiCalls } from "@/components/step-api-calls";
import { StepLogs } from "@/components/step-logs";
import { StepVariables } from "@/components/step-variables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { StepId } from "@/types";

import {
  StepDefinition,
  StepIdValue,
  StepUIState,
  VarName,
  WorkflowVars
} from "@/types";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  XCircle,
  Zap
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface StepCardProps {
  index: number;
  definition: StepDefinition;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  onExecute(id: StepIdValue): void;
  onUndo(id: StepIdValue): void;
  onForce(id: StepIdValue): void;
  onVarChange(key: VarName, value: unknown): void;
}

const INFO_BUTTONS: Partial<Record<StepIdValue, React.FC>> = {
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

export function StepCard({
  index,
  definition,
  state,
  vars,
  executing,
  onExecute,
  onUndo,
  onForce,
  onVarChange
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const InfoButtonComponent = INFO_BUTTONS[definition.id];
  const detail = STEP_DETAILS[definition.id];

  const title =
    detail?.title
    || definition.name
    || definition.id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  useEffect(() => {
    if (!isExpanded) {
      setLogsOpen(false);
    }
  }, [isExpanded]);

  const getDescriptorText = () => {
    if (executing) return "Executing...";
    switch (state?.status) {
      case "checking":
        return "Checking...";
      case "undoing":
        return "Undoing...";
      default:
        return state?.summary || "Ready to execute";
    }
  };
  useEffect(() => {
    if (executing || state?.status === "pending") {
      setIsExpanded(true);
      setLogsOpen(true);
    }
  }, [executing, state?.status]);

  const getStepIndexDisplay = () => {
    const baseClasses =
      "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0 transition-colors duration-200";
    const iconClasses = "h-4 w-4";

    if (executing) {
      return (
        <div
          className={cn(
            baseClasses,
            "bg-blue-500 text-white animate-breathing"
          )}>
          <Loader2 className={cn(iconClasses, "animate-spin")} />
        </div>
      );
    }
    switch (state?.status) {
      case "checking":
        return (
          <div
            className={cn(
              baseClasses,
              "bg-blue-500 text-white animate-breathing"
            )}>
            <Loader2 className={cn(iconClasses, "animate-spin")} />
          </div>
        );
      case "complete":
        return (
          <div className={cn(baseClasses, "bg-green-500 text-white")}>
            <CheckCircle className={iconClasses} />
          </div>
        );
      case "failed":
        return (
          <div className={cn(baseClasses, "bg-red-500 text-white")}>
            <XCircle className={iconClasses} />
          </div>
        );
      case "pending":
        return (
          <div className={cn(baseClasses, "bg-amber-500 text-white")}>
            <Clock className={iconClasses} />
          </div>
        );
      case "undoing":
        return (
          <div
            className={cn(
              baseClasses,
              "bg-amber-500 text-white animate-breathing"
            )}>
            <Loader2 className={cn(iconClasses, "animate-spin")} />
          </div>
        );
      case "reverted":
        return (
          <div className={cn(baseClasses, "bg-slate-600 text-white")}>
            {index + 1}
          </div>
        );
      default: // idle
        return (
          <div className={cn(baseClasses, "bg-slate-600 text-white")}>
            {index + 1}
          </div>
        );
    }
  };

  const getStatusBadge = () => {
    if (executing)
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
          Executing
        </Badge>
      );
    switch (state?.status) {
      case "checking":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
            Checking
          </Badge>
        );
      case "complete":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            Complete
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
            Pending
          </Badge>
        );
      case "undoing":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
            Undoing
          </Badge>
        );
      case "reverted":
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-200">
            Reverted
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-600 border-slate-200">
            Idle
          </Badge>
        );
    }
  };

  const getCardClassName = () => {
    const baseClass =
      "transition-all duration-300 ease-out bg-white border py-4 shadow-none";
    const cursorClass = isExpanded ? "" : "cursor-pointer";
    const shadowClass = "hover:shadow-md";
    let borderColorClass = "border-slate-200 hover:border-slate-300";
    const animationClass = "";

    if (executing) {
      borderColorClass = "border-blue-400 ring-1 ring-blue-300"; // Softer ring
    } else {
      switch (state?.status) {
        case "complete":
          borderColorClass = "border-green-400";
          break;
        case "failed":
          borderColorClass = "border-red-400";
          break;
        case "pending":
          borderColorClass = "border-amber-400";
          break;
        case "checking":
          borderColorClass = "border-blue-300";
          break;
        case "undoing":
          borderColorClass = "border-amber-400 ring-1 ring-amber-300"; // Softer ring
          break;
        case "reverted":
          borderColorClass = "border-slate-300";
          break;
      }
    }
    return `${baseClass} ${cursorClass} ${shadowClass} ${borderColorClass} ${animationClass}`;
  };

  const missingEphemeralVars = definition.requires.filter(
    (v) => WORKFLOW_VARIABLES[v]?.ephemeral && vars[v] === undefined
  );
  const canExecute =
    Object.entries(WORKFLOW_VARIABLES)
      .filter(
        ([, meta]) =>
          meta.consumedBy?.includes(definition.id) && !meta.producedBy
      )
      .every(([key]) => vars[key as VarName] !== undefined)
    && missingEphemeralVars.length === 0;
  const canUndo = state?.status === "complete";

  const handleHeaderClick = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card
      className={getCardClassName()}
      onClick={() => {
        if (!isExpanded) handleHeaderClick();
      }}
      role="button"
      aria-expanded={isExpanded}>
      <CardHeader
        className="p-3 cursor-pointer transition-colors duration-200"
        onClick={(e) => {
          e.stopPropagation();
          handleHeaderClick();
        }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {getStepIndexDisplay()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm md:text-base leading-tight">
                {title}
              </h3>
              <p className="text-xs md:text-sm text-slate-600 mt-0.5 leading-tight">
                {getDescriptorText()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {getStatusBadge()}
            <div className="text-slate-400 transition-transform duration-200 ease-out">
              {isExpanded ?
                <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </div>
        {state?.error && isExpanded && (
          <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-400 rounded-r-md animate-slideDown">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-red-800 mb-0.5">
                  Execution Error
                </h4>
                <p className="text-xs text-red-700">{state.error}</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      {(executing || state?.status === "pending") && (
        <div className="my-3 px-6">
          <div className="relative h-1 bg-slate-200 overflow-hidden rounded">
            <div className="absolute inset-0 bg-blue-500 animate-indeterminate" />
          </div>
        </div>
      )}

      <Collapsible open={isExpanded}>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <CardContent className="px-6">
            {detail?.description && (
              <div
                className=" text-slate-700 px-7"
                onClick={(e) => e.stopPropagation()}>
                {detail.description.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            <div
              className="overflow-x-auto px-7 my-2"
              onClick={(e) => e.stopPropagation()}>
              <StepApiCalls stepId={definition.id} />
            </div>

            <div className="flex items-center justify-between my-6">
              <div className="flex items-center gap-2">
                {missingEphemeralVars.length > 0 ?
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecute(definition.id);
                        }}
                        disabled
                        variant="default">
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Execute
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {`Requires transient data from ${missingEphemeralVars
                        .map((v) => {
                          const producer = WORKFLOW_VARIABLES[v]?.producedBy;
                          const name =
                            producer ?
                              STEP_DETAILS[producer]?.title || producer
                            : v;
                          return name;
                        })
                        .join(", ")}. Re-run the producing step first.`}
                    </TooltipContent>
                  </Tooltip>
                : <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecute(definition.id);
                    }}
                    disabled={
                      !canExecute || executing || state?.status === "complete"
                    }
                    variant="default">
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Execute
                  </Button>
                }

                {InfoButtonComponent && <InfoButtonComponent />}
              </div>
              <div className="space-x-2">
                {canUndo && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndo(definition.id);
                    }}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Undo
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onForce(definition.id);
                  }}
                  disabled={executing}>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Force
                </Button>
              </div>
            </div>
            <div
              className="overflow-x-auto"
              onClick={(e) => e.stopPropagation()}>
              <StepVariables
                stepId={definition.id}
                vars={vars}
                onChange={onVarChange}
              />
            </div>

            <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between mt-4 font-medium text-slate-700 hover:bg-slate-100 p-3 rounded-lg bg-slate-50 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-green-600" />
                  Execution Logs
                </div>
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    logsOpen ? "rotate-90" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-2 border-slate-100 border border-t-0 rounded-t-none rounded-md data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                {state?.logs && state.logs.length > 0 ?
                  <StepLogs logs={state.logs} />
                : <div className="text-center py-6 text-slate-500 border border-dashed border-slate-300 rounded-lg mt-1">
                    <Terminal className="h-5 w-5 mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs">No logs for this step yet.</p>
                  </div>
                }
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
