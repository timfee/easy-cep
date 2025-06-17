"use client";
import { StepIdValue, StepUIState, VarName, WorkflowVars } from "@/types";
import StepLogs from "./StepLogs";

export interface StepInfo {
  id: StepIdValue;
  requires: readonly VarName[];
  provides: readonly VarName[];
}

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
    <div className="border p-4 rounded mb-4">
      <h2 className="font-semibold mb-1">{definition.id}</h2>
      <div className="text-sm mb-1">Status: {state?.status ?? "idle"}</div>
      <div className="text-sm mb-2">
        {state?.summary || state?.error || state?.notes || ""}
      </div>

      <div className="mb-2">
        <strong>Requires</strong>
        <ul className="list-disc list-inside">
          {definition.requires.map((v) => (
            <li key={v}>
              {v}: {vars[v] ? "✔" : "✗"}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-2">
        <strong>Provides</strong>
        <ul className="list-disc list-inside">
          {definition.provides.map((v) => (
            <li key={v}>
              {v}: {vars[v] ? "✔" : "✗"}
            </li>
          ))}
        </ul>
      </div>

      {state?.status !== "complete" && (
        <button
          className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          onClick={() => onExecute(definition.id)}
          disabled={executing || missing.length > 0}>
          Execute
        </button>
      )}

      <StepLogs logs={state?.logs} />
    </div>
  );
}
