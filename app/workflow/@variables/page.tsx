"use client";

import { VarsInspector } from "@/components/vars-inspector";
import { Variable } from "lucide-react";
import { useWorkflow } from "../context/workflow-context";

export default function VariablesPage() {
  const { varsRaw, updateVars } = useWorkflow();

  return (
    <div className="h-full">
      <h3 className="font-medium mb-4 flex items-center gap-2 text-slate-900">
        <div className="p-1 bg-purple-100 rounded">
          <Variable className="h-4 w-4 text-purple-600" />
        </div>
        Global Variables
      </h3>
      <VarsInspector vars={varsRaw} onChange={updateVars} />
    </div>
  );
}
