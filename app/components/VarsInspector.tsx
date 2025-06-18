"use client";
import {
  VarName,
  WORKFLOW_VARIABLES,
  WorkflowVars
} from "@/lib/workflow/variables";
import { useState } from "react";
import { Badge } from "./ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";

interface Props {
  vars: Partial<WorkflowVars>;
  onChange(vars: Partial<WorkflowVars>): void;
}

export default function VarsInspector({ vars, onChange }: Props) {
  const [editingVar, setEditingVar] = useState<{
    name: VarName;
    value: unknown;
  } | null>(null);
  const entries = Object.keys(WORKFLOW_VARIABLES) as VarName[];

  const handleSave = () => {
    if (editingVar) {
      onChange({ [editingVar.name]: editingVar.value });
      setEditingVar(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Variables</h2>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <Table dense bleed>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Value</TableHeader>
              <TableHeader className="w-20"></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((name) => {
              const value = vars[name];
              const type = WORKFLOW_VARIABLES[name];
              const hasValue = value !== undefined && value !== null;

              return (
                <TableRow key={name}>
                  <TableCell className="font-mono text-sm">{name}</TableCell>
                  <TableCell>
                    {hasValue ?
                      type === "boolean" ?
                        <Badge color={value ? "green" : "zinc"}>
                          {String(value)}
                        </Badge>
                      : <span className="text-sm text-zinc-700 truncate max-w-[200px] block">
                          {String(value).length > 20 ?
                            `${String(value).slice(0, 20)}…`
                          : String(value)}
                        </span>

                    : <span className="text-sm text-zinc-400 italic">
                        Not set
                      </span>
                    }
                  </TableCell>
                  <TableCell>
                    <Button
                      plain
                      className="text-xs"
                      onClick={() =>
                        setEditingVar({ name, value: value ?? "" })
                      }>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
