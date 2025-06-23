"use client";

import { Badge } from "@/components/ui/badge";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEP_STATE_CONFIG } from "@/lib/workflow/step-constants";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import { StepIdValue, StepUIState } from "@/types";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  XCircle
} from "lucide-react";
import { ReactElement } from "react";

const ICONS = { Loader2, CheckCircle, XCircle, Clock };

interface StepCardHeaderProps {
  index: number;
  stepId: StepIdValue;
  state?: StepUIState;
  executing: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function StepCardHeader({
  index,
  stepId,
  state,
  executing,
  isExpanded,
  onToggle
}: StepCardHeaderProps) {
  const detail = STEP_DETAILS[stepId];
  const title =
    detail?.title
    || stepId
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  const descriptor =
    executing ? "Executing..."
    : state?.status === "checking" ? "Checking..."
    : state?.status === "undoing" ? "Undoing..."
    : state?.status === "blocked" ? "Waiting for prerequisites"
    : state?.status === "ready" ? "Ready to execute"
    : state?.summary || "Initializing";
  const currentState = executing ? "executing" : state?.status || "idle";
  const config = STEP_STATE_CONFIG[currentState];

  const Icon =
    config.icon ?
      (
        ICONS as Record<string, (props: { className?: string }) => ReactElement>
      )[config.icon]
    : null;

  return (
    <CardHeader
      className="p-4 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0",
              config.indicatorClass
            )}>
            {Icon ?
              <Icon
                className={cn(
                  "h-4 w-4",
                  config.icon === "Loader2" && "animate-spin"
                )}
              />
            : index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">{descriptor}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant={config.badge.variant}
            className={config.badge.className}>
            {executing ?
              "Executing"
            : state?.status === "blocked" ?
              "Blocked"
            : state?.status === "ready" ?
              "Ready"
            : state?.status ?
              state.status.charAt(0).toUpperCase() + state.status.slice(1)
            : "Idle"}
          </Badge>
          <div className="text-slate-400">
            {isExpanded ?
              <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
      </div>
      {state?.error && isExpanded && (
        <div className="mt-3 p-4 bg-destructive/10 border-l-4 border-destructive rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-destructive mb-1">
                Execution Error
              </h4>
              <p className="text-xs text-destructive">{state.error}</p>
            </div>
          </div>
        </div>
      )}
    </CardHeader>
  );
}
