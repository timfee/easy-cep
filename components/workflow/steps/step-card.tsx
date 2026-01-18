"use client";

import { memo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { StepCardContent } from "@/components/workflow/steps/step-card-content";
import { StepCardProvider } from "@/components/workflow/steps/step-card-context";
import { StepCardHeader } from "@/components/workflow/steps/step-card-header";
import { StepLROIndicator } from "@/components/workflow/steps/step-lro-indicator";
import { cn } from "@/lib/utils";
import { STEP_STATE_CONFIG } from "@/lib/workflow/step-constants";
import type { StepIdValue } from "@/lib/workflow/step-ids";
import { StepStatus } from "@/lib/workflow/step-status";
import type { VarName, WorkflowVars } from "@/lib/workflow/variables";
import type { StepDefinition, StepUIState } from "@/types";

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
  actions,
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentState = state?.status || StepStatus.Ready;
  const config = STEP_STATE_CONFIG[currentState];

  const shouldExpand = executing;
  if (shouldExpand && !isExpanded) {
    setIsExpanded(true);
  }

  return (
    <StepCardProvider value={actions}>
      <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
        <Card
          className={cn(
            "bg-white shadow-none transition-all duration-300 ease-out",
            state?.status !== StepStatus.Blocked && "hover:shadow-md",
            config.borderClass
          )}
        >
          <StepCardHeader
            executing={executing}
            index={index}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            state={state}
            stepId={definition.id}
          />
          {executing &&
            (state?.lro?.detected ? (
              <StepLROIndicator
                estimatedDuration={state.lro.estimatedDuration}
                operationType={state.lro.operationType}
                startTime={state.lro.startTime}
              />
            ) : (
              <div className="my-6 px-6">
                <div className="relative h-1 overflow-hidden rounded bg-muted">
                  <div className="absolute inset-0 animate-indeterminate bg-primary" />
                </div>
              </div>
            ))}
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <StepCardContent
              definition={definition}
              executing={executing}
              state={state}
              vars={vars}
            />
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </StepCardProvider>
  );
});
