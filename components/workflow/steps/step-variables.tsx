import { Database } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import  { type StepIdValue } from "@/lib/workflow/step-ids";
import {
  type VariableMetadata,
  type VarName,
  WORKFLOW_VARIABLES,
  type WorkflowVars,
} from "@/lib/workflow/variables";

interface StepVariablesProps {
  stepId: StepIdValue;
  vars: Partial<WorkflowVars>;
  onChange: (key: VarName, value: unknown) => void;
  /**
   * Variable names that are missing required values.
   */
  missing?: VarName[];
}

interface VariableItemProps {
  varKey: VarName;
  meta: VariableMetadata;
  isEditable: boolean;
  missing: VarName[];
  stepId: string;
  vars: Partial<WorkflowVars>;
  onChange: (key: VarName, value: unknown) => void;
}

function VariableItem({
  varKey,
  meta,
  isEditable,
  missing,
  stepId,
  vars,
  onChange,
}: VariableItemProps) {
  return (
    <div className="space-y-1.5">
      <label
        className={cn(
          "flex items-center gap-1.5 font-medium text-foreground/70 text-xs",
          missing.includes(varKey) && "text-destructive"
        )}
        htmlFor={`var-${varKey}-${stepId}`}
      >
        <Database className="h-3 w-3 text-foreground/60" />
        <span>{varKey}</span>
        {isEditable && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary/80">
            Editable
          </span>
        )}
      </label>
      {isEditable ? (
        <Input
          aria-invalid={missing.includes(varKey)}
          className="h-8 w-full rounded-md border-input bg-background px-2 py-1 text-xs text-foreground/90 placeholder:text-foreground/50"
          id={`var-${varKey}-${stepId}`}
          onChange={(e) => onChange(varKey, e.target.value)}
          placeholder={meta.description || "Enter value"}
          type="text"
          value={vars[varKey] ?? ""}
        />
      ) : (
        <div
          aria-invalid={missing.includes(varKey)}
          className={cn(
            "flex min-h-[32px] w-full items-center rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-foreground/70 text-xs",
            missing.includes(varKey) && "border-destructive text-destructive"
          )}
        >
          {vars[varKey] !== undefined ? (
            <code className="block w-full truncate font-mono text-xs">
              {meta.sensitive ? "••••••••" : String(vars[varKey])}
            </code>
          ) : (
            <span className="text-[11px] text-foreground/50 italic">
              Not set
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Show required and provided variables for a step.
 */
export function StepVariables({
  stepId,
  vars,
  onChange,
  missing = [],
}: StepVariablesProps) {
  const isVarName = useCallback(
    (value: string): value is VarName => value in WORKFLOW_VARIABLES,
    []
  );

  const allStepVars = useMemo(
    () =>
      Object.entries(WORKFLOW_VARIABLES)
        .filter(
          ([, meta]) =>
            meta.consumedBy?.includes(stepId) || meta.producedBy === stepId
        )
        .flatMap(([key, meta]) => {
          if (isVarName(key)) {
            return [{ key, ...meta }];
          }
          return [];
        }),
    [isVarName, stepId]
  );

  const requiredVars = useMemo(
    () =>
      allStepVars.filter(
        (variable) =>
          variable.consumedBy?.includes(stepId) &&
          variable.producedBy !== stepId
      ),
    [allStepVars, stepId]
  );
  const providedVars = useMemo(
    () => allStepVars.filter((variable) => variable.producedBy === stepId),
    [allStepVars, stepId]
  );

  return (
    <div className="grid w-full gap-3 text-left md:grid-cols-2">
      <div className="flex-1 space-y-3 rounded-lg border border-border/60 border-l-2 border-l-primary/60 bg-muted/30 p-4">
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/80">
          Requires
        </h4>
        {requiredVars.length > 0 ? (
          requiredVars.map((meta) => (
            <VariableItem
              isEditable={meta.configurable ?? false}
              key={meta.key}
              meta={meta}
              missing={missing}
              onChange={onChange}
              stepId={stepId}
              varKey={meta.key}
              vars={vars}
            />
          ))
        ) : (
          <p className="py-4 text-center text-[11px] text-foreground/60">
            No required inputs for this step.
          </p>
        )}
      </div>

      <div className="flex-1 space-y-3 rounded-lg border border-border/60 border-l-2 border-l-ring/60 bg-muted/30 p-4">
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/80">
          Provides
        </h4>
        {providedVars.length > 0 ? (
          providedVars.map((meta) => (
            <VariableItem
              isEditable={false}
              key={meta.key}
              meta={meta}
              missing={missing}
              onChange={onChange}
              stepId={stepId}
              varKey={meta.key}
              vars={vars}
            />
          ))
        ) : (
          <p className="py-4 text-center text-[11px] text-foreground/60">
            No provided outputs for this step.
          </p>
        )}
      </div>
    </div>
  );
}
