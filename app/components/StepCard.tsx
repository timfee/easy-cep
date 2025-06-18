"use client";
import { StepIdValue, StepUIState, VarName, WorkflowVars } from "@/types";
import { ArrowRight, Boxes, Check, FileStack, X } from "lucide-react";
import StepLogs from "./StepLogs";

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
  pending: "border-amber-500"
};

const badge: Record<StepUIState["status"], string> = {
  idle: "bg-gray-100 text-gray-700",
  checking: "bg-blue-50 text-blue-700 animate-pulse",
  executing: "bg-blue-50 text-blue-700 animate-pulse",
  complete: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700"
};

interface StepCardProps {
  index: number;
  definition: StepInfo;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  onExecute(id: StepIdValue): void;
}

export default function StepCard({
  index,
  definition,
  state,
  vars,
  executing,
  onExecute
}: StepCardProps) {
  const missing = definition.requires.filter((v) => !vars[v]);
  const status = state?.status ?? "idle";

  return (
    <div
      className={`relative mb-6 rounded-xl border ${accent[status]} border-l-4 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
            {index + 1}
          </span>
          <h3 className="text-lg font-semibold text-gray-900">
            {definition.id}
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${badge[status]}`}>
          {status}
        </span>
      </div>

      {(state?.summary || state?.error || state?.notes) && (
        <p className="mt-2 text-sm text-gray-700">
          {state.summary || state.error || state.notes}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
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

      {status !== "complete" && (
        <button
          onClick={() => onExecute(definition.id)}
          disabled={executing || missing.length > 0}
          className={`mt-4 inline-flex items-center gap-2 rounded-md px-6 py-2.5 font-medium transition-all ${
            executing || missing.length > 0 ?
              "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm hover:shadow-md active:scale-95"
          }`}>
          Execute <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <StepLogs logs={state?.logs} />
    </div>
  );
}
