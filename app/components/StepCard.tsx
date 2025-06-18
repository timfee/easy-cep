"use client";
import { StepIdValue, StepUIState, VarName, WorkflowVars } from "@/types";
import StepLogs from "./StepLogs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm
} from "./ui/description-list";
import { Heading } from "./ui/heading";

export interface StepInfo {
  id: StepIdValue;
  requires: readonly VarName[];
  provides: readonly VarName[];
}

const statusColor: Record<
  StepUIState["status"],
  "zinc" | "sky" | "blue" | "green" | "red" | "amber"
> = {
  idle: "zinc",
  checking: "sky",
  executing: "blue",
  complete: "green",
  failed: "red",
  pending: "amber"
};

interface StepCardProps {
  definition: StepInfo;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  onExecute(id: StepIdValue): void;
}

export default function StepCard({
  definition,
  state,
  vars,
  executing,
  onExecute
}: StepCardProps) {
  const missing = definition.requires.filter((v) => !vars[v]);

  return (
    <div className="border p-4 rounded mb-4 space-y-3">
      <Heading level={2}>{definition.id}</Heading>
      <div className="text-sm flex items-center gap-2">
        <span>Status:</span>
        <Badge color={statusColor[state?.status ?? "idle"]}>
          {state?.status ?? "idle"}
        </Badge>
      </div>
      {(state?.summary || state?.error || state?.notes) && (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          {state?.summary || state?.error || state?.notes}
        </div>
      )}

      <div>
        <Heading level={3} className="mb-1 text-sm font-semibold">
          Requires
        </Heading>
        <DescriptionList>
          {definition.requires.map((v) => (
            <>
              <DescriptionTerm key={`${v}-term`}>{v}</DescriptionTerm>
              <DescriptionDetails key={`${v}-details`}>
                {vars[v] ? "✔" : "✗"}
              </DescriptionDetails>
            </>
          ))}
        </DescriptionList>
      </div>

      <div>
        <Heading level={3} className="mb-1 text-sm font-semibold">
          Provides
        </Heading>
        <DescriptionList>
          {definition.provides.map((v) => (
            <>
              <DescriptionTerm key={`${v}-term`}>{v}</DescriptionTerm>
              <DescriptionDetails key={`${v}-details`}>
                {vars[v] ? "✔" : "✗"}
              </DescriptionDetails>
            </>
          ))}
        </DescriptionList>
      </div>

      {state?.status !== "complete" && (
        <Button
          color="blue"
          onClick={() => onExecute(definition.id)}
          disabled={executing || missing.length > 0}>
          Execute
        </Button>
      )}

      <StepLogs logs={state?.logs} />
    </div>
  );
}
