"use client";

import { Input } from "@/components/ui/input";
import {
  camelToTitle,
  WORKFLOW_VARIABLES,
  type StepIdValue,
  type VarName,
  type WorkflowVars
} from "@/lib/workflow/variables";
import { Database } from "lucide-react";

interface StepVariablesProps {
  stepId: StepIdValue;
  vars: Partial<WorkflowVars>;
  onVarChange: (key: VarName, value: unknown) => void;
}

export function StepVariables({
  stepId,
  vars,
  onVarChange
}: StepVariablesProps) {
  const allStepVars = Object.entries(WORKFLOW_VARIABLES)
    .filter(
      ([, meta]) =>
        meta.consumedBy?.includes(stepId) || meta.producedBy === stepId
    )
    .map(([key, meta]) => ({ key: key as VarName, ...meta }));

  const requiredVars = allStepVars.filter(
    (v) => v.consumedBy?.includes(stepId) && v.producedBy !== stepId
  );
  const providedVars = allStepVars.filter((v) => v.producedBy === stepId);

  const VariableItem = ({
    varKey,
    meta,
    isEditable
  }: {
    varKey: VarName;
    meta: (typeof allStepVars)[0];
    isEditable: boolean;
  }) => (
    <div className="space-y-1.5">
      <label
        htmlFor={`var-${varKey}-${stepId}`}
        className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
        <Database className="h-3 w-3 text-purple-500" />
        <span>{camelToTitle(varKey)}</span>
      </label>
      {isEditable ?
        <Input
          id={`var-${varKey}-${stepId}`}
          value={vars[varKey] ?? meta.defaultValue ?? ""}
          onChange={(e) => onVarChange(varKey, e.target.value)}
          placeholder={meta.description || "Enter value"}
          className="text-xs border-slate-300 bg-white h-8 px-2 py-1 w-full rounded-md" // Changed from rounded-lg to rounded-md to match screenshot
          type={meta.type === "number" ? "number" : "text"}
        />
      : <div className="text-xs text-slate-600 bg-slate-100 border border-slate-300 rounded-md px-2 py-1.5 min-h-[32px] flex items-center w-full">
          {/* Matched screenshot style for value display */}
          {vars[varKey] !== undefined ?
            <code className="font-mono text-xs block truncate w-full">
              {meta.sensitive ? "••••••••" : String(vars[varKey])}
            </code>
          : <span className="italic text-slate-400 text-2xs">Not set</span>}
        </div>
      }
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Requires Column */}
      <div className="flex-1 space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-lg p-4">
        {/* Lighter background, slightly softer border, more padding */}
        <h4 className="text-sm font-semibold text-slate-800 mb-3">
          {/* Added mb-3 for spacing */}
          Requires
        </h4>
        {requiredVars.length > 0 ?
          requiredVars.map(({ key, ...meta }) => (
            <VariableItem
              key={key}
              varKey={key}
              meta={meta}
              isEditable={meta.configurable}
            />
          ))
        : <p className="text-xs text-slate-500 text-center py-4">
            No required inputs for this step.
          </p>
        }
      </div>

      {/* Provides Column */}
      <div className="flex-1 space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-lg p-4">
        {/* Lighter background, slightly softer border, more padding */}
        <h4 className="text-sm font-semibold text-slate-800 mb-3">
          {/* Added mb-3 for spacing */}
          Provides
        </h4>
        {providedVars.length > 0 ?
          providedVars.map(({ key, ...meta }) => (
            <VariableItem
              key={key}
              varKey={key}
              meta={meta}
              isEditable={false}
            />
          ))
        : <p className="text-xs text-slate-500 text-center py-4">
            No provided outputs for this step.
          </p>
        }
      </div>
    </div>
  );
}
