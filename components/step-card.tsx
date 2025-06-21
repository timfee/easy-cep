"use client";

import { StepCardContent } from "@/components/step-card/step-card-content";
import { StepCardProvider } from "@/components/step-card/step-card-context";
import { StepCardHeader } from "@/components/step-card/step-card-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEP_STATE_CONFIG } from "@/lib/workflow/step-constants";
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
  const currentState = executing ? "executing" : state?.status || "idle";
  const config = STEP_STATE_CONFIG[currentState];

  const shouldExpand = executing || state?.status === "pending";
  if (shouldExpand && !isExpanded) setIsExpanded(true);

  return (
    <StepCardProvider value={actions}>
      <Card
        className={cn(
          "transition-all duration-300 ease-out bg-white shadow-none hover:shadow-md",
          config.borderClass,
          !isExpanded && "cursor-pointer"
        )}
        onClick={() => !isExpanded && setIsExpanded(true)}>
        <StepCardHeader
          index={index}
          stepId={definition.id}
          state={state}
          executing={executing}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        {(executing || state?.status === "pending") && (
          <div className="my-6 px-6">
            <div className="relative h-1 bg-slate-200 overflow-hidden rounded">
              <div className="absolute inset-0 bg-blue-500 animate-indeterminate" />
            </div>
          </div>
        )}
        {isExpanded && (
          <StepCardContent
            definition={definition}
            state={state}
            vars={vars}
            executing={executing}
          />
        )}
      </Card>
    </StepCardProvider>
  );
});
