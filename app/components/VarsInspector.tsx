"use client";
import {
  VarName,
  WORKFLOW_VARIABLES,
  WorkflowVars
} from "@/lib/workflow/variables";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm
} from "./ui/description-list";
import { Input } from "./ui/input";

interface Props {
  vars: Partial<WorkflowVars>;
  onChange(vars: Partial<WorkflowVars>): void;
}

export default function VarsInspector({ vars, onChange }: Props) {
  const entries = Object.keys(WORKFLOW_VARIABLES) as VarName[];
  return (
    <div className="rounded-xl border border-zinc-200 p-4 bg-white shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Variables</h2>
      <DescriptionList className="text-sm">
        {entries.map((name) => (
          <VarItem
            key={name}
            name={name}
            type={WORKFLOW_VARIABLES[name]}
            value={vars[name]}
            onSave={(val) => onChange({ [name]: val })}
          />
        ))}
      </DescriptionList>
    </div>
  );
}

function VarItem({
  name,
  type,
  value,
  onSave
}: {
  name: VarName;
  type: "string" | "boolean";
  value: unknown;
  onSave(value: unknown): void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value ?? "");

  const display = value === undefined || value === null ? "" : String(value);
  const truncated = display.length > 20 ? display.slice(0, 20) + "…" : display;

  const startEdit = () => {
    setLocal(display);
    setEditing(true);
  };

  const handleSave = () => {
    let val: unknown = local;
    if (type === "boolean") {
      val = local === "true" || local === true;
    }
    onSave(val as Partial<WorkflowVars>[typeof name]);
    setEditing(false);
  };

  return (
    <>
      <DescriptionTerm className="whitespace-nowrap font-mono">
        {name}
      </DescriptionTerm>
      <DescriptionDetails>
        {editing ?
          <div className="flex items-center gap-2">
            {type === "boolean" ?
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={local === true || local === "true"}
                onChange={(e) => setLocal(e.target.checked ? "true" : "false")}
              />
            : <Input
                value={String(local)}
                onChange={(e) => setLocal(e.target.value)}
              />
            }
            <Button color="blue" size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button color="zinc" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        : <div className="flex items-center justify-between gap-2">
            <span className="truncate text-gray-700">{truncated}</span>
            <button
              className="text-blue-700 hover:underline text-xs"
              onClick={startEdit}>
              Edit
            </button>
          </div>
        }
      </DescriptionDetails>
    </>
  );
}
