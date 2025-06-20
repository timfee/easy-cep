"use client";

import { VarsInspector } from "@/components/vars-inspector";
import { useWorkflow } from "@/components/workflow-context";

export function VarsPanel() {
  const { varsRaw, updateVars } = useWorkflow();
  return <VarsInspector vars={varsRaw} onChange={updateVars} />;
}

export default VarsPanel;
