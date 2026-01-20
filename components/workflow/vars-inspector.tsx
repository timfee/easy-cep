import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";

import { Database, Pencil } from "lucide-react";
import { useCallback, useState } from "react";

import type {
  VariableMetadata,
  VarName,
  WorkflowVars,
} from "@/lib/workflow/variables";

import { Input } from "@/components/ui/input";
import { categoryTitles } from "@/constants";
import { WORKFLOW_VARIABLES } from "@/lib/workflow/variables";

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
  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onUpdateEdit(event.target.value);
    },
    [onUpdateEdit]
  );
  const handleInputClick = useCallback(
    (event: MouseEvent<HTMLInputElement>) => {
      event.stopPropagation();
    },
    []
  );
  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        onSaveEdit();
      }
      if (event.key === "Escape") {
        onCancelEdit();
      }
    },
    [onSaveEdit, onCancelEdit]
  );

  const renderValue = () => {
    if (isEditing) {
      return (
        <Input
          autoFocus
          className="h-7 w-full rounded-none border-x-0 border-t-0 border-b border-border/60 bg-transparent px-0 text-xs text-foreground/90"
          onBlur={onSaveEdit}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleInputKeyDown}
          value={editingVar?.value}
        />
      );
    }

    if (value !== undefined) {
      const valueClasses =
        isConfigurable && !isEditing
          ? "text-foreground/80 group-hover:text-foreground"
          : "text-foreground/70";
      return (
        <code
          className={`block truncate py-0.5 font-mono text-xs ${valueClasses}`}
        >
          {meta.sensitive ? "••••••••" : String(value)}
        </code>
      );
    }

    const emptyClasses =
      isConfigurable && !isEditing
        ? "text-foreground/60 group-hover:text-foreground/70"
        : "text-foreground/50";
    return <span className={`text-xs italic ${emptyClasses}`}>(Not set)</span>;
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex w-full items-center gap-1.5">
        <Database className="h-2.5 w-2.5 text-foreground/50" />
        <span className="font-medium text-foreground text-xs">{varKey}</span>
        {isConfigurable && !isEditing && (
          <Pencil className="ml-auto h-3 w-3 text-foreground/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:text-foreground/60 group-focus-visible:opacity-100" />
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
  const baseClasses =
    "group block w-full px-3 py-1.5 text-left transition-colors duration-150";
  const readOnlyClasses =
    "cursor-default hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-inset";
  const interactiveClasses =
    "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-inset active:bg-muted/60";

  const handleStartEditing = useCallback(() => {
    onStartEditing(varKey, value);
  }, [onStartEditing, varKey, value]);

  if (isEditing) {
    return (
      <div className={`${baseClasses} bg-muted/30`}>
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
        className={`${baseClasses} ${interactiveClasses}`}
        onClick={handleStartEditing}
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
    <div className={`${baseClasses} ${readOnlyClasses}`}>
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

  const handleValueChange = useCallback(
    (key: VarName, value: string) => {
      onChange({ [key]: value });
    },
    [onChange]
  );

  const startEditing = useCallback((key: VarName, currentValue: unknown) => {
    setEditingVar({
      key,
      value: currentValue === undefined ? "" : String(currentValue),
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (editingVar) {
      handleValueChange(editingVar.key, editingVar.value);
      setEditingVar(null);
    }
  }, [editingVar, handleValueChange]);

  const cancelEdit = useCallback(() => {
    setEditingVar(null);
  }, []);

  const updateEdit = useCallback(
    (value: string) => {
      if (editingVar) {
        setEditingVar({ ...editingVar, value });
      }
    },
    [editingVar]
  );

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
              <h4 className="sticky top-0 z-10 bg-background/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/80 backdrop-blur shadow-[0_1px_0_0_hsl(var(--border)/0.7)]">
                {categoryTitle}
              </h4>

              <div className="divide-y divide-border/70 pt-0">
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
