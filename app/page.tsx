import { WorkflowClient } from "@/components/workflow-client";
import { getAllSteps } from "@/lib/workflow/step-registry";
import { StepDefinition } from "@/types";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const steps: StepDefinition[] = getAllSteps().map((s) => ({
    id: s.id,
    requires: s.requires,
    provides: s.provides
  }));
  return <WorkflowClient steps={steps} />;
}
