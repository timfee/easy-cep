"use client";
import { StepIdValue, StepUIState, VarName, WorkflowVars } from "@/types";
import clsx from "clsx";
import { Boxes, Check, FileStack, Play, RotateCcw, X, Zap } from "lucide-react";
import { StepApiCalls } from "./step-card/step-api-calls";
import { stepDescriptions } from "./step-card/step-descriptions";
import { StepVariables } from "./step-card/StepVariables";
import StepLogs from "./StepLogs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

export interface StepInfo {
  id: StepIdValue;
  requires: readonly VarName[];
  provides: readonly VarName[];
}

const accent: Record<StepUIState["status"], string> = {
  idle: "border-gray-300",
  checking: "border-blue-500",
  executing: "border-blue-500",
  complete: "border-green-500",
  failed: "border-red-500",
  pending: "border-amber-500",
  undoing: "border-purple-500",
  reverted: "border-gray-300"
};

const badgeColor: Record<
  StepUIState["status"],
  "zinc" | "blue" | "green" | "red" | "amber" | "purple"
> = {
  idle: "zinc",
  checking: "blue",
  executing: "blue",
  complete: "green",
  failed: "red",
  pending: "amber",
  undoing: "purple",
  reverted: "zinc"
};

const textColor: Record<StepUIState["status"], string> = {
  idle: "text-zinc-700",
  checking: "text-blue-700",
  executing: "text-blue-700",
  complete: "text-green-700",
  failed: "text-red-700",
  pending: "text-amber-700",
  undoing: "text-purple-700",
  reverted: "text-zinc-700"
};

interface StepCardProps {
  index: number;
  definition: StepInfo;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  onExecute(id: StepIdValue): void;
  onUndo(id: StepIdValue): void;
  onForce(id: StepIdValue): void;
  onVarChange(key: VarName, value: unknown): void;
}

export default function StepCard({
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
  const missing = definition.requires.filter((v) => !vars[v]);
  const status = state?.status ?? "idle";
  const inProgress =
    status === "checking"
    || status === "executing"
    || status === "pending"
    || status === "undoing";
  const executed = status === "complete" || status === "failed";

  return (
    <Card
      className={clsx(
        "relative mb-6 overflow-hidden",
        accent[status],
        inProgress && "animate-pulse"
      )}>
      {inProgress && (
        <div className="absolute left-0 right-0 top-0 h-1 overflow-hidden">
          <div className="animate-indeterminate h-full w-1/2 bg-blue-500" />
        </div>
      )}
      <CardHeader className="p-6 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
              {index + 1}
            </span>
            <h3 className="text-lg font-semibold text-gray-900">
              {definition.id}
            </h3>
          </div>
          <Badge
            color={badgeColor[status]}
            className="px-3 py-1 text-xs font-medium capitalize">
            {status}
          </Badge>
        </div>

        <div className="mt-2 flex items-start justify-between gap-4 text-sm">
          <p className="text-gray-700 flex-1">
            {stepDescriptions[definition.id]}
          </p>
          {(state?.summary || state?.error || state?.notes) && (
            <span className={`${textColor[status]} shrink-0 whitespace-nowrap`}>
              {state.error
                || (state.summary === "Already complete" ? "" : state.summary)
                || state.notes}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-gray-50 p-4">
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-gray-800">
              <FileStack className="h-4 w-4" /> Requires
            </h4>
            <ul className="space-y-1 text-sm">
              {definition.requires.map((v) => (
                <li key={v} className="flex items-center gap-2">
                  <span className="font-mono text-gray-800">{v}</span>
                  {vars[v] ?
                    <Check className="h-4 w-4 text-green-600" />
                  : <X className="h-4 w-4 text-gray-400" />}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 p-4">
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-gray-800">
              <Boxes className="h-4 w-4" /> Provides
            </h4>
            <ul className="space-y-1 text-sm">
              {definition.provides.map((v) => (
                <li key={v} className="flex items-center gap-2">
                  <span className="font-mono text-gray-800">{v}</span>
                  {vars[v] ?
                    <Check className="h-4 w-4 text-green-600" />
                  : <X className="h-4 w-4 text-gray-400" />}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <StepVariables
          stepId={definition.id}
          vars={vars}
          onChange={onVarChange}
        />

        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            onClick={() => onExecute(definition.id)}
            disabled={executing || missing.length > 0}
            data-complete={executed}
            style={{ opacity: executed ? 0.5 : 1 }}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Execute
          </Button>
          {executed && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUndo(definition.id)}
                disabled={executing}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Undo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onForce(definition.id)}
                disabled={executing}
                className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 disabled:opacity-50">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Force
              </Button>
            </div>
          )}
        </div>
        <StepApiCalls stepId={definition.id} />

        <StepLogs logs={state?.logs} />
      </CardContent>
    </Card>
  );
}
