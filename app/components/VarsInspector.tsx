"use client";
import { validateVariableRelationships } from "@/lib/workflow/variable-validators";
import {
  VarName,
  WORKFLOW_VARIABLES,
  WORKFLOW_VAR_GROUPS,
  WorkflowVars
} from "@/lib/workflow/variables";
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

interface Props {
  vars: Partial<WorkflowVars>;
  onChange(vars: Partial<WorkflowVars>): void;
}

export default function VarsInspector({ vars, onChange }: Props) {
  const [editingVar, setEditingVar] = useState<{
    name: VarName;
    value: unknown;
  } | null>(null);
  const groups = WORKFLOW_VAR_GROUPS;
  const validationErrors = validateVariableRelationships(vars);

  const handleSave = () => {
    if (editingVar) {
      onChange({ [editingVar.name]: editingVar.value });
      setEditingVar(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Variables</h2>
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
        <div className="text-xs">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 sticky top-0">
                {group.title}
              </div>
              {group.vars.map((name) => (
                <div
                  key={name}
                  className="flex items-center border-b border-gray-100 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setEditingVar({ name, value: vars[name] ?? "" })
                  }>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {name}
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-gray-600 truncate max-w-[120px]">
                    {vars[name] !== undefined ? String(vars[name]) : "Not set"}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
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
            {WORKFLOW_VARIABLES[editingVar?.name as VarName] === "boolean" ?
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
          <Button plain onClick={() => setEditingVar(null)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
