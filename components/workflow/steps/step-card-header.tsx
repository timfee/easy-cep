import type { ElementType, KeyboardEvent, MouseEvent } from "react";

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useCallback } from "react";

import type { StepIdValue } from "@/lib/workflow/step-ids";
import type { StepUIState } from "@/types";

import { Badge } from "@/components/ui/badge";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEP_STATE_CONFIG } from "@/lib/workflow/step-constants";
import { STEP_DETAILS } from "@/lib/workflow/step-details";
import { StepStatus } from "@/lib/workflow/step-status";

/**
 * Summarize the current execution status for display.
 */
function getStatusDescriptor(executing: boolean, state?: StepUIState) {
  if (executing) {
    return "Executing...";
  }
  if (state?.isChecking) {
    return "Checking...";
  }
  if (state?.isUndoing) {
    return "Undoing...";
  }
  if (state?.status === StepStatus.Blocked) {
    return state.blockReason || "Waiting for prerequisites";
  }
  if (state?.status === StepStatus.Ready) {
    return "Ready to execute";
  }
  if (state?.status === StepStatus.Stale) {
    return state.summary || "Attention needed";
  }
  return state?.summary || "Initializing";
}

/**
 * Convert a status value into badge text.
 */
function getBadgeText(executing: boolean, status?: string) {
  if (executing) {
    return "Executing";
  }
  if (status === "blocked") {
    return "Blocked";
  }
  if (status === "ready") {
    return "Ready";
  }
  if (status === "stale") {
    return "Attention";
  }
  if (status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
  return "Idle";
}

interface StepCardHeaderProps {
  index: number;
  stepId: StepIdValue;
  state?: StepUIState;
  executing: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Header row for a step card with status visuals.
 */
export function StepCardHeader({
  index,
  stepId,
  state,
  executing,
  isExpanded,
  onToggle,
}: StepCardHeaderProps) {
  const detail = STEP_DETAILS[stepId];
  const title =
    detail?.title ||
    stepId
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");

  const descriptor = getStatusDescriptor(executing, state);
  const currentState = state?.status || StepStatus.Ready;
  const config = STEP_STATE_CONFIG[currentState];

  const showSpinner = executing || state?.isChecking || state?.isUndoing;
  let Icon: ElementType<{ className?: string }> | null = null;
  if (showSpinner) {
    Icon = Loader2;
  } else if (config.icon === "AlertTriangle") {
    Icon = AlertTriangle;
  } else if (config.icon === "CheckCircle") {
    Icon = CheckCircle;
  }

  const handleCardClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onToggle();
    },
    [onToggle]
  );

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    },
    [onToggle]
  );

  return (
    <CardHeader className="rounded-t-xl px-6 py-4 transition-colors">
      <button
        type="button"
        className="relative flex w-full cursor-pointer items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-expanded={isExpanded}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-semibold text-xs",
              config.indicatorClass
            )}
          >
            {Icon ? (
              <Icon className={cn("h-4 w-4", showSpinner && "animate-spin")} />
            ) : (
              index + 1
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base text-foreground">{title}</h3>
            <p className="mt-1 text-foreground/80 text-sm">{descriptor}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Badge
            className={config.badge.className}
            variant={config.badge.variant}
          >
            {getBadgeText(executing, state?.status)}
          </Badge>
          <div className="text-foreground/60">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>
      {state?.error && isExpanded && (
        <div className="mt-3 max-h-32 overflow-y-auto rounded border-destructive border-l-4 bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <div>
              <h4 className="mb-1 font-semibold text-destructive text-xs">
                Execution Error
              </h4>
              <p className="text-destructive text-xs">{state.error}</p>
            </div>
          </div>
        </div>
      )}
    </CardHeader>
  );
}
