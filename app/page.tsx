import { StepsList } from "@/components/steps-list";
import { VarsPanel } from "@/components/vars-panel";
import { WorkflowHeader } from "@/components/workflow-header";

export default function HomePage() {
  return (
    <>
      <WorkflowHeader />
      <main className="flex h-[calc(100vh-64px)]">
        <section className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
          <StepsList />
        </section>
        <aside className="w-96 border-l bg-white overflow-y-auto p-6">
          <VarsPanel />
        </aside>
      </main>
    </>
  );
}
