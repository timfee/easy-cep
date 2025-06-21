"use client";

import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { WORKFLOW_VARIABLES, WorkflowVars } from "@/lib/workflow/variables";
import { StepIdValue, VarName } from "@/types";

import { Database } from "lucide-react";
import { useMemo } from "react";

interface StepVariablesProps {
  stepId: StepIdValue;
  vars: Partial<WorkflowVars>;
  onChange: (key: VarName, value: unknown) => void;
}
export function StepVariables({ stepId, vars, onChange }: StepVariablesProps) {
  const allStepVars = useMemo(
    () =>
      Object.entries(WORKFLOW_VARIABLES)
        .filter(
          ([, meta]) =>
            meta.consumedBy?.includes(stepId) || meta.producedBy === stepId
        )
        .map(([key, meta]) => ({ key: key as VarName, ...meta })),
    [stepId]
  );

  const requiredVars = useMemo(
    () =>
      allStepVars.filter(
        (variable) =>
          variable.consumedBy?.includes(stepId)
          && variable.producedBy !== stepId
      ),
    [allStepVars, stepId]
  );
  const providedVars = useMemo(
    () => allStepVars.filter((variable) => variable.producedBy === stepId),
    [allStepVars, stepId]
  );

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
        <Database className="h-3 w-3 text-accent" />
        <span>{varKey}</span>
        {meta.ephemeral && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-chart-1 cursor-help">
                (transient)
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Temporary value; rerun the producing step if missing
            </TooltipContent>
          </Tooltip>
        )}
      </label>
      {isEditable ?
        <Input
          id={`var-${varKey}-${stepId}`}
          value={vars[varKey] ?? ""}
          onChange={(e) => onChange(varKey, e.target.value)}
          placeholder={meta.description || "Enter value"}
          className="text-xs border-slate-300 bg-white h-8 px-2 py-1 w-full rounded-md" // Changed from rounded-lg to rounded-md to match screenshot
          type="text"
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
      {meta.ephemeral && (
        <div className="text-xs text-chart-1 mt-1">
          ⚠️ This value will be lost if you refresh the page
        </div>
      )}
    </div>
  );

  return (
    <div
      className="grid md:grid-cols-2 gap-3"
      onClick={(e) => e.stopPropagation()}>
      {/* Requires Column */}
      <div className="flex-1 space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-lg p-4">
        {/* Lighter background, slightly softer border, more padding */}
        <h4 className="text-sm font-semibold text-slate-800 mb-3">
          {/* Added mb-3 for spacing */}
          Requires
        </h4>
        {requiredVars.length > 0 ?
          requiredVars.map((meta) => (
            <VariableItem
              key={meta.key}
              varKey={meta.key}
              meta={meta}
              isEditable={meta.configurable ?? false}
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
          providedVars.map((meta) => (
            <VariableItem
              key={meta.key}
              varKey={meta.key}
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
