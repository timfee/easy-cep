import { StepsList } from "@/components/workflow/steps-list";
import { VarsPanel } from "@/components/workflow/vars-panel";

/**
 * Main workflow page showing steps and variables.
 */
export default function HomePage() {
  return (
    <>
      <section className="flex-1 overflow-y-auto bg-muted/40 p-4">
        <StepsList />
      </section>
      <aside className="w-96 shrink-0 overflow-y-auto border-l">
        <VarsPanel />
      </aside>
    </>
  );
}
