"use client";
import { validateVariableRelationships } from "@/lib/workflow/variable-validators";
import {
  VariableMetadata,
  VarName,
  WORKFLOW_VARIABLES,
  WorkflowVars
} from "@/lib/workflow/variables";
import { PencilSquareIcon as EditIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle
} from "./ui/dialog";
import { Field, Label } from "./ui/fieldset";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

const categoryTitles = {
  auth: "Auth",
  domain: "Domain",
  config: "Config",
  state: "State"
} as const;

interface Props {
  vars: Partial<WorkflowVars>;
  onChange(vars: Partial<WorkflowVars>): void;
}

export default function VarsInspector({ vars, onChange }: Props) {
  const [editingVar, setEditingVar] = useState<{
    name: VarName;
    value: unknown;
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "config" | "state">("all");
  const validationErrors = validateVariableRelationships(vars);

  const groupedVars = Object.entries(WORKFLOW_VARIABLES)
    .filter(([_, meta]) => filter === "all" || meta.category === filter)
    .reduce(
      (acc, [key, meta]) => {
        const category = meta.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push({
          key: key as VarName,
          ...(meta as VariableMetadata)
        });
        return acc;
      },
      {} as Record<string, Array<{ key: VarName } & VariableMetadata>>
    );

  const handleSave = () => {
    if (editingVar) {
      onChange({ [editingVar.name]: editingVar.value });
      setEditingVar(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-3">
        <h2 className="text-sm font-semibold text-gray-900">Variables</h2>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={clsx(
              "text-xs px-2 py-1 rounded",
              filter === "all" ? "bg-blue-100 text-blue-700" : "text-gray-600"
            )}>
            All
          </button>
          <button
            onClick={() => setFilter("config")}
            className={clsx(
              "text-xs px-2 py-1 rounded",
              filter === "config" ?
                "bg-blue-100 text-blue-700"
              : "text-gray-600"
            )}>
            Config
          </button>
          <button
            onClick={() => setFilter("state")}
            className={clsx(
              "text-xs px-2 py-1 rounded",
              filter === "state" ? "bg-blue-100 text-blue-700" : "text-gray-600"
            )}>
            State
          </button>
        </div>
      </div>
      {validationErrors.length > 0 && (
        <div className="border-b border-zinc-200 bg-red-50 p-2">
          <h3 className="text-sm font-medium text-red-800 mb-1">
            Variable Validation Errors
          </h3>
          <ul className="text-xs text-red-700 space-y-1">
            {validationErrors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {Object.entries(groupedVars).map(([category, variables]) => (
          <div key={category} className="text-xs">
            <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 sticky top-0">
              {categoryTitles[category as keyof typeof categoryTitles]}
            </div>
            {variables.map(({ key, ...meta }) => (
              <VariableRow
                key={key}
                name={key}
                value={vars[key]}
                metadata={meta}
                onEdit={() =>
                  setEditingVar({ name: key, value: vars[key] ?? "" })
                }
              />
            ))}
          </div>
        ))}
      </div>

      <Dialog open={!!editingVar} onClose={() => setEditingVar(null)}>
        <DialogTitle>Edit Variable</DialogTitle>
        <DialogDescription>
          Update the value for{" "}
          <code className="font-mono">{editingVar?.name}</code>
        </DialogDescription>
        <DialogBody>
          <Field>
            <Label>Value</Label>
            {(
              WORKFLOW_VARIABLES[editingVar?.name as VarName]?.type
              === "boolean"
            ) ?
              <Switch
                checked={
                  editingVar?.value === true || editingVar?.value === "true"
                }
                onChange={(checked) =>
                  setEditingVar((prev) =>
                    prev ? { ...prev, value: checked } : null
                  )
                }
              />
            : <Input
                value={String(editingVar?.value || "")}
                onChange={(e) =>
                  setEditingVar((prev) =>
                    prev ? { ...prev, value: e.target.value } : null
                  )
                }
              />
            }
          </Field>
        </DialogBody>
        <DialogActions>
          <Button variant="ghost" onClick={() => setEditingVar(null)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function VariableRow({
  name,
  value,
  metadata,
  onEdit
}: {
  name: VarName;
  value: unknown;
  metadata: VariableMetadata;
  onEdit(): void;
}) {
  const relationships = [] as string[];
  if (metadata.producedBy) relationships.push(`↘ from ${metadata.producedBy}`);
  if (metadata.consumedBy?.length)
    relationships.push(`↗ to ${metadata.consumedBy.join(", ")}`);

  return (
    <div
      className="flex items-center border-b border-gray-100 px-3 py-2 hover:bg-gray-50 cursor-pointer"
      onClick={onEdit}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-gray-700 truncate">
            {camelToTitle(name)}
          </div>
          {metadata.configurable && (
            <EditIcon className="h-3 w-3 text-gray-400" />
          )}
        </div>
        {relationships.length > 0 && (
          <div className="text-xs text-gray-500 mt-0.5">
            {relationships.join(" ")}
          </div>
        )}
      </div>
      <div className="ml-2 text-xs text-gray-600 truncate max-w-[120px]">
        {value !== undefined ? String(value) : "Not set"}
      </div>
    </div>
  );
}

function camelToTitle(str: string): string {
  return str.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
