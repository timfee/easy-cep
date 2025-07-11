"use client";

import { StepCardContent } from "@/components/step-card/step-card-content";
import { StepCardProvider } from "@/components/step-card/step-card-context";
import { StepCardHeader } from "@/components/step-card/step-card-header";
import { StepLROIndicator } from "@/components/step-card/step-lro-indicator";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { STEP_STATE_CONFIG } from "@/lib/workflow/step-constants";
import { StepStatus } from "@/lib/workflow/step-status";
import {
  StepDefinition,
  StepIdValue,
  StepUIState,
  VarName,
  WorkflowVars
} from "@/types";
import { memo, useState } from "react";

interface StepCardProps {
  index: number;
  definition: StepDefinition;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  actions: {
    onExecute: (id: StepIdValue) => void;
    onUndo: (id: StepIdValue) => void;
    onForce: (id: StepIdValue) => void;
    onVarChange: (key: VarName, value: unknown) => void;
  };
}

export const StepCard = memo(function StepCard({
  index,
  definition,
  state,
  vars,
  executing,
  actions
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentState = state?.status || StepStatus.Ready;
  const config = STEP_STATE_CONFIG[currentState];

  const shouldExpand = executing;
  if (shouldExpand && !isExpanded) setIsExpanded(true);

  return (
    <StepCardProvider value={actions}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card
          className={cn(
            "transition-all duration-300 ease-out bg-white shadow-none",
            state?.status !== StepStatus.Blocked && "hover:shadow-md",
            config.borderClass,
            !isExpanded
              && state?.status !== StepStatus.Blocked
              && "cursor-pointer"
          )}
          onClick={() =>
            !isExpanded
            && state?.status !== StepStatus.Blocked
            && setIsExpanded(true)
          }>
          <StepCardHeader
            index={index}
            stepId={definition.id}
            state={state}
            executing={executing}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />
          {executing
            && (state?.lro?.detected ?
              <StepLROIndicator
                startTime={state.lro.startTime}
                estimatedDuration={state.lro.estimatedDuration}
                operationType={state.lro.operationType}
              />
            : <div className="my-6 px-6">
                <div className="relative h-1 bg-slate-200 overflow-hidden rounded">
                  <div className="absolute inset-0 bg-primary animate-indeterminate" />
                </div>
              </div>)}
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <StepCardContent
              definition={definition}
              state={state}
              vars={vars}
              executing={executing}
            />
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </StepCardProvider>
  );
});
