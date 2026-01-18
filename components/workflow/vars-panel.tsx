"use client";

import { useWorkflow } from "@/components/workflow/context";
import { VarsInspector } from "@/components/workflow/vars-inspector";

/**
 * Side panel wrapper for workflow variables.
 */
export function VarsPanel() {
  const { varsRaw, updateVars } = useWorkflow();
  return <VarsInspector onChange={updateVars} vars={varsRaw} />;
}
