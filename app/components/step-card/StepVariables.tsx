import { WORKFLOW_VARIABLES, VariableMetadata } from "@/lib/workflow/variables";
import { StepIdValue, VarName, WorkflowVars } from "@/types";
import { Input } from "../ui/input";

interface StepVariablesProps {
  stepId: StepIdValue;
  vars: Partial<WorkflowVars>;
  onChange: (key: VarName, value: unknown) => void;
}

function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
}

export function StepVariables({ stepId, vars, onChange }: StepVariablesProps) {
  const stepVars = (Object.entries(WORKFLOW_VARIABLES) as Array<[
    VarName,
    VariableMetadata
  ]>)
    .filter(
      ([, meta]) =>
        meta.consumedBy?.includes(stepId) || meta.producedBy === stepId
    )
    .map(([key, meta]) => ({ key: key as VarName, ...meta }));

  if (stepVars.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Variables</h4>
      {stepVars.map(({ key, ...meta }) => {
        const isProducer = meta.producedBy === stepId;
        const isShared =
          (meta.consumedBy?.length || 0) > 1 ||
          (meta.consumedBy && meta.producedBy);
        return (
          <div key={key} className="relative">
            {isShared && (
              <div className="absolute -left-2 top-2">
                <div className="group relative">
                  <svg
                    className="h-4 w-4 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                      Shared with: {meta.consumedBy?.filter((id) => id !== stepId).join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">
                  {camelToTitle(key)}
                </label>
                {isProducer && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    Provides
                  </span>
                )}
              </div>
              {meta.configurable && !vars[key] ? (
                <Input
                  value={typeof vars[key] === 'string' ? vars[key] : ''}
                  onChange={(e) => onChange(key, e.target.value)}
                  placeholder={meta.description}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-500">
                  {vars[key] ? (
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      {meta.sensitive ? '••••••••' : String(vars[key])}
                    </code>
                  ) : (
                    <span className="italic">Not set</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
