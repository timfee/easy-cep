"use client";
import { StepIdValue, StepUIState, VarName, WorkflowVars } from "@/types";
import {
  ArrowRightIcon as ArrowRight,
  Square3Stack3DIcon as Boxes,
  CheckIcon as Check,
  DocumentPlusIcon as FileStack,
  XMarkIcon as X
} from "@heroicons/react/24/solid";
import StepLogs from "./StepLogs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

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

interface StepCardProps {
  index: number;
  definition: StepInfo;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  onExecute(id: StepIdValue): void;
  onUndo(id: StepIdValue): void;
  onForce(id: StepIdValue): void;
}

export default function StepCard({
  index,
  definition,
  state,
  vars,
  executing,
  onExecute,
  onUndo,
  onForce
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
    <div
      className={`relative mb-6 rounded-xl border ${accent[status]} border-l-4 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200${
        inProgress ? " animate-pulse" : ""
      }`}>
      {inProgress && (
        <div className="absolute left-0 right-0 top-0 h-1 overflow-hidden rounded-t">
          <div className="animate-indeterminate h-full w-1/2 bg-blue-500" />
        </div>
      )}
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

      {(state?.summary || state?.error || state?.notes) && (
        <p className="mt-2 text-sm text-gray-700">
          {state.summary || state.error || state.notes}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-4">
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
        <div className="rounded-lg bg-gray-50 p-4">
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

      <div className="mt-4 flex items-center gap-2">
        <Button
          color="blue"
          className="inline-flex items-center gap-2"
          onClick={() => onExecute(definition.id)}
          disabled={executing || missing.length > 0}
          data-complete={executed}
          style={{ opacity: executed ? 0.5 : 1 }}>
          Execute <ArrowRight className="h-4 w-4" />
        </Button>
        {executed && (
          <div className="ml-auto flex items-center gap-2">
            <button
              className="text-sm text-blue-700 hover:underline disabled:text-gray-300"
              onClick={() => onUndo(definition.id)}
              disabled={executing}>
              Undo
            </button>
            <button
              className="text-sm text-blue-700 hover:underline disabled:text-gray-300"
              onClick={() => onForce(definition.id)}
              disabled={executing}>
              Force
            </button>
          </div>
        )}
      </div>

      <StepLogs logs={state?.logs} />
    </div>
  );
}
