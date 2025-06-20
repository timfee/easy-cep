"use client";

import { AppsInfoButton } from "@/components/apps-info-button";
import { ClaimsInfoButton } from "@/components/claims-info-button";
import { OuInfoButton } from "@/components/ou-info-button";
import { ProvisioningInfoButton } from "@/components/provisioning-info-button";
import { SamlInfoButton } from "@/components/saml-info-button";
import { SsoInfoButton } from "@/components/sso-info-button";
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
import { cn } from "@/lib/utils";
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
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  XCircle,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!isExpanded) {
      setLogsOpen(false);
    }
  }, [isExpanded]);

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
    const baseClass = "transition-all duration-300 ease-out bg-white border"; // Use single border for simplicity
    const shadowClass = isExpanded ? "shadow-xl" : "hover:shadow-lg";
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
        case "undoing":
          borderColorClass = "border-amber-400 ring-1 ring-amber-300"; // Softer ring
          break;
        case "reverted":
          borderColorClass = "border-slate-300";
          break;
      }
    }
    return `${baseClass} ${shadowClass} ${borderColorClass} ${animationClass}`;
  };

  const canExecute = Object.entries(WORKFLOW_VARIABLES)
    .filter(
      ([, meta]) => meta.consumedBy?.includes(definition.id) && !meta.producedBy
    )
    .every(([key]) => vars[key as VarName] !== undefined);
  const canUndo = state?.status === "complete";

  const handleHeaderClick = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card className={getCardClassName()}>
      <CardHeader
        className="p-4 md:p-5 cursor-pointer transition-colors duration-200"
        onClick={handleHeaderClick}
        role="button"
        aria-expanded={isExpanded}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {getStepIndexDisplay()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm md:text-base leading-tight">
                {definition.name || definition.id}
              </h3>
              <p className="text-xs md:text-sm text-slate-600 mt-0.5 leading-tight">
                {state?.summary || "Ready to execute"}
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

      <Collapsible open={isExpanded}>
        <CollapsibleContent className="overflow-hidden transition-all duration-300 ease-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <CardContent className="pt-0 pb-4 px-4 md:pb-5 md:px-5 space-y-5 md:space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExecute(definition.id);
                  }}
                  disabled={!canExecute || executing}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Execute
                </Button>
                {canUndo && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndo(definition.id);
                    }}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800">
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Undo
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onForce(definition.id);
                  }}
                  disabled={executing}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 disabled:opacity-50">
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Force
                </Button>
                {definition.id === StepId.CreateAutomationOU && (
                  <OuInfoButton />
                )}
                {definition.id === StepId.ConfigureGoogleSamlProfile && (
                  <SamlInfoButton />
                )}
                {definition.id === StepId.AssignUsersToSso && <SsoInfoButton />}
                {definition.id === StepId.CreateMicrosoftApps && (
                  <AppsInfoButton />
                )}
                {definition.id === StepId.ConfigureMicrosoftSyncAndSso && (
                  <ProvisioningInfoButton />
                )}
                {definition.id === StepId.SetupMicrosoftClaimsPolicy && (
                  <ClaimsInfoButton />
                )}
              </div>
              {state?.logs && state.logs.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-slate-600 border-slate-300 text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {state.logs.length} logs
                </Badge>
              )}
            </div>

            {definition.description && (
              <p className="text-sm text-slate-700 leading-relaxed">
                {definition.description}
              </p>
            )}

            <div className="overflow-x-auto">
              <StepApiCalls stepId={definition.id} />
            </div>
            <div className="overflow-x-auto">
              <StepVariables
                stepId={definition.id}
                vars={vars}
                onChange={onVarChange}
              />
            </div>

            <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 p-3 rounded-lg bg-slate-50 border border-slate-200 transition-colors">
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
              <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
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
