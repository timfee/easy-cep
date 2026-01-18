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
          className="h-7 w-full rounded-md text-xs"
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
        <code className="block truncate rounded-md px-4 py-0.5 font-mono text-muted-foreground text-xs">
          {meta.sensitive ? "••••••••" : String(value)}
        </code>
      );
    }

    return (
      <span className="px-4 text-muted-foreground/60 text-xs italic">
        (Not set)
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Database className="h-2.5 w-2.5 text-accent" />
        <span className="font-medium text-foreground text-xs">{varKey}</span>
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
    "group px-3 py-2 transition-colors duration-150 hover:bg-muted/50 block w-full text-left";

  if (isEditing) {
    // When editing, we render a div to contain the input form.
    // Interaction is handled by the input itself.
    return (
      <div className={commonClasses}>
        <VariableRowContent
          {...props}
          isConfigurable={!!isConfigurable}
          isEditing={isEditing}
        />
      </div>
    );
  }

  if (isConfigurable) {
    // When configurable and not editing, render a clickable container.
    return (
      <button
        className={`${commonClasses} cursor-pointer`}
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

  // Not configurable (read-only)
  return (
    <div className={commonClasses}>
      <VariableRowContent
        {...props}
        isConfigurable={!!isConfigurable}
        isEditing={isEditing}
      />
    </div>
  );
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
    Array<{ key: VarName } & VariableMetadata>
  > = { auth: [], domain: [], config: [], state: [] };

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
    <div className="flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {categories.map((category) => {
          const variables = groupedVars[category];
          const categoryTitle = categoryTitles[category];
          return (
            <div key={category}>
              <h4 className="top-0 border-border border-b bg-muted px-2 py-1.5 font-semibold text-foreground text-sm">
                {categoryTitle}
              </h4>

              <div className="divide-y divide-border/60">
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
