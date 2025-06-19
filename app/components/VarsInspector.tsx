"use client";
import {
  VarName,
  WORKFLOW_VARIABLES,
  WORKFLOW_VAR_GROUPS,
  WorkflowVars
} from "@/lib/workflow/variables";
import { Fragment, useState } from "react";
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
  const groups = WORKFLOW_VAR_GROUPS;

  const handleSave = () => {
    if (editingVar) {
      onChange({ [editingVar.name]: editingVar.value });
      setEditingVar(null);
    }
  };

  return (
    <div className="rounded-xl rounded-tl-none border border-zinc-200 bg-white shadow-sm text-xs">
      <div className="border-b border-zinc-200 p-2">
        <h2 className="text-base font-semibold text-gray-900">Variables</h2>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <Table dense bleed className="!whitespace-normal">
          <TableHead>
            <TableRow>
              <TableHeader className="w-32">Name</TableHeader>
              <TableHeader>Value</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.title}>
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="bg-zinc-50 font-semibold text-zinc-700">
                    {group.title}
                  </TableCell>
                </TableRow>
                {group.vars.map((name) => {
                  const value = vars[name];
                  const type = WORKFLOW_VARIABLES[name];
                  const hasValue = value !== undefined && value !== null;

                  return (
                    <TableRow key={name}>
                      <TableCell className="text-xs font-medium text-zinc-800">
                        {name}
                      </TableCell>
                      <TableCell
                        onClick={() =>
                          setEditingVar({ name, value: value ?? "" })
                        }
                        className="cursor-pointer text-xs font-mono text-blue-700 underline decoration-dotted">
                        {hasValue ?
                          type === "boolean" ?
                            <Badge color={value ? "green" : "zinc"}>
                              {String(value)}
                            </Badge>
                          : <span className="truncate max-w-[260px] block">
                              {String(value)}
                            </span>

                        : <span className="italic text-zinc-400">Not set</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
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
