import type { StepInfo } from "./components/StepCard";
import WorkflowClient from "./components/WorkflowClient";
import { getAllSteps } from "./workflow/step-registry";

export default function HomePage() {
  const steps: StepInfo[] = getAllSteps().map((s) => ({
    id: s.id,
    requires: s.requires,
    provides: s.provides
  }));
  return <WorkflowClient steps={steps} />;
}
