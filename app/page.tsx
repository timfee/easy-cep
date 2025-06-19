import { getAllSteps } from "@/lib/workflow/step-registry";
import type { StepInfo } from "./components/StepCard";
import WorkflowClient from "./components/WorkflowClient";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const steps: StepInfo[] = getAllSteps().map((s) => ({
    id: s.id,
    requires: s.requires,
    provides: s.provides
  }));
  return <WorkflowClient steps={steps} />;
}
