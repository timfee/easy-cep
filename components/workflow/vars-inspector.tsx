import { Database } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { categoryTitles } from "@/constants";
import {
  type VariableMetadata,
  type VarName,
  WORKFLOW_VARIABLES,
  type WorkflowVars,
} from "@/lib/workflow/variables";

interface VarsInspectorProps {
  vars: Partial<WorkflowVars>;
  onChange(vars: Partial<WorkflowVars>): void;
}

interface VariableRowProps {
  varKey: VarName;
  meta: VariableMetadata;
  value: unknown;
  editingVar: { key: VarName; value: string } | null;
  onStartEditing: (key: VarName, value: unknown) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdateEdit: (value: string) => void;
}

function VariableRowContent({
  varKey,
  meta,
  value,
  editingVar,
  onSaveEdit,
  onCancelEdit,
  onUpdateEdit,
  isConfigurable,
}: Omit<VariableRowProps, "onStartEditing"> & {
  isEditing: boolean;
  isConfigurable: boolean;
}) {
  const isEditing = editingVar?.key === varKey;

  const renderValue = () => {
    if (isEditing) {
      return (
        <Input
          autoFocus
          className="h-7 w-full rounded-md bg-background text-xs text-foreground/90"
          onBlur={onSaveEdit}
          onChange={(e) => onUpdateEdit(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSaveEdit();
            }
            if (e.key === "Escape") {
              onCancelEdit();
            }
          }}
          value={editingVar?.value}
        />
      );
    }

    if (value !== undefined) {
      return (
        <code className="block truncate rounded-md bg-muted/30 px-3 py-0.5 font-mono text-foreground/70 text-xs">
          {meta.sensitive ? "••••••••" : String(value)}
        </code>
      );
    }

    return (
      <span className="px-3 text-foreground/50 text-xs italic">
        (Not set)
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Database className="h-2.5 w-2.5 text-foreground/50" />
        <span className="font-medium text-foreground text-xs">{varKey}</span>
        {isConfigurable && !isEditing && (
          <span className="rounded-full border border-foreground/15 bg-muted/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/60">
            Editable
          </span>
        )}
      </div>
      <div>{renderValue()}</div>
    </div>
  );
}

function VariableRow(props: VariableRowProps) {
  const { varKey, editingVar, meta, onStartEditing, value } = props;
  const isEditing = editingVar?.key === varKey;
  const isConfigurable = meta.configurable;
  const commonClasses =
    "group block w-full rounded-md px-3 py-1.5 text-left transition-colors duration-150 hover:bg-muted/50";

  if (isEditing) {
    return (
      <div className={`${commonClasses} border-l-2 border-l-primary/30`}>
        <VariableRowContent
          {...props}
          isConfigurable={!!isConfigurable}
          isEditing={isEditing}
        />
      </div>
    );
  }

  if (isConfigurable) {
    return (
      <button
        className={`${commonClasses} cursor-pointer border-l-2 border-l-primary/30 hover:border-l-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background`}
        onClick={() => onStartEditing(varKey, value)}
        type="button"
      >
        <VariableRowContent
          {...props}
          isConfigurable={!!isConfigurable}
          isEditing={isEditing}
        />
      </button>
    );
  }

  return (
    <div className={`${commonClasses} border-l-2 border-l-transparent`}>
      <VariableRowContent
        {...props}
        isConfigurable={!!isConfigurable}
        isEditing={isEditing}
      />
    </div>
  );
}

/**
 * Display and edit workflow variables grouped by category.
 */
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
      value: currentValue !== undefined ? String(currentValue) : "",
    });
  };

  const saveEdit = () => {
    if (editingVar) {
      handleValueChange(editingVar.key, editingVar.value);
      setEditingVar(null);
    }
  };

  const cancelEdit = () => {
    setEditingVar(null);
  };

  const updateEdit = (value: string) => {
    if (editingVar) {
      setEditingVar({ ...editingVar, value });
    }
  };

  const groupedVars: Record<
    VariableMetadata["category"],
    ({ key: VarName } & VariableMetadata)[]
  > = { auth: [], config: [], domain: [], state: [] };

  const isVarName = (value: string): value is VarName =>
    value in WORKFLOW_VARIABLES;

  for (const key of Object.keys(WORKFLOW_VARIABLES)) {
    if (!isVarName(key)) {
      continue;
    }
    const meta = WORKFLOW_VARIABLES[key];
    groupedVars[meta.category] = [
      ...groupedVars[meta.category],
      { key, ...meta },
    ];
  }

  const categories: VariableMetadata["category"][] = [
    "auth",
    "domain",
    "config",
    "state",
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto py-2">
        {categories.map((category) => {
          const variables = groupedVars[category];
          const categoryTitle = categoryTitles[category];
          return (
            <div className="py-3" key={category}>
              <h4 className="sticky top-0 z-10 border-border/70 border-b bg-background/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/80 backdrop-blur">
                {categoryTitle}
              </h4>

              <div className="divide-y divide-border/70">
                {variables.map((entry) => {
                  const { key, ...meta } = entry;
                  return (
                    <VariableRow
                      editingVar={editingVar}
                      key={key}
                      meta={meta}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={saveEdit}
                      onStartEditing={startEditing}
                      onUpdateEdit={updateEdit}
                      value={vars[key]}
                      varKey={key}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
