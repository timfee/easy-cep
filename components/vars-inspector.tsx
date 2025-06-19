import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { categoryTitles } from "@/constants";
import {
  VariableMetadata,
  WORKFLOW_VARIABLES,
  WorkflowVars
} from "@/lib/workflow/variables";
import { VarName } from "@/types";
import { Database, Edit3 } from "lucide-react";
import { useState } from "react";

interface VarsInspectorProps {
  vars: Partial<WorkflowVars>;
  onChange(vars: Partial<WorkflowVars>): void;
}

export function VarsInspector({ vars, onChange }: VarsInspectorProps) {
  const [editingVar, setEditingVar] = useState<{
    key: VarName;
    value: string;
  } | null>(null);

  const handleValueChange = (key: VarName, value: string) => {
    onChange({ [key]: value });
  };

  const startEditing = (key: VarName, currentValue: unknown) => {
    setEditingVar({
      key,
      value: currentValue !== undefined ? String(currentValue) : ""
    });
  };

  const saveEdit = () => {
    if (editingVar) {
      handleValueChange(editingVar.key, editingVar.value);
      setEditingVar(null);
    }
  };

  const groupedVars = Object.entries(WORKFLOW_VARIABLES).reduce(
    (acc, [key, meta]) => {
      const category = meta.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push({ key: key as VarName, ...meta });
      return acc;
    },
    {} as Record<string, Array<{ key: VarName } & VariableMetadata>>
  );

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg">
      <ScrollArea className="flex-1">
        {Object.entries(groupedVars).map(([category, variables]) => (
          <div key={category}>
            <h4 className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 sticky top-0 border-b border-slate-200">
              {categoryTitles[category as VariableMetadata["category"]]}
            </h4>
            <div className="divide-y divide-slate-100">
              {variables.map(({ key, ...meta }) => (
                <div
                  key={key}
                  className={`px-3 py-2 group hover:bg-slate-50/50 transition-colors duration-150 ${meta.configurable ? "cursor-pointer" : ""}`}
                  onClick={() =>
                    meta.configurable
                    && !editingVar
                    && startEditing(key, vars[key])
                  }>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Database className="h-2.5 w-2.5 text-purple-500" />
                        <span className="text-xs font-medium text-slate-800">
                          {key}
                        </span>
                      </div>
                      {meta.configurable && editingVar?.key !== key && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(key, vars[key]);
                          }}
                          aria-label={`Edit ${key}`}>
                          <Edit3 className="h-2.5 w-2.5" />
                        </Button>
                      )}
                    </div>
                    <div>
                      {editingVar?.key === key ?
                        <Input
                          autoFocus
                          value={editingVar.value}
                          onChange={(e) =>
                            setEditingVar({
                              ...editingVar,
                              value: e.target.value
                            })
                          }
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingVar(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 text-xs w-full rounded-md"
                        />
                      : vars[key] !== undefined ?
                        <code className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md block truncate">
                          {meta.sensitive ? "••••••••" : String(vars[key])}
                        </code>
                      : <span className="italic text-slate-400 text-xs">
                          Not set
                        </span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(groupedVars).length === 0 && (
          <p className="p-4 text-sm text-slate-500 text-center">
            No variables in this category.
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
