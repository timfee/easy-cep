import { StepsList } from "@/components/steps-list";
import { VarsPanel } from "@/components/vars-panel";

export default function HomePage() {
  return (
    <>
      <section className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
        <StepsList />
      </section>
      <aside className="w-96 border-l bg-white overflow-y-auto">
        <VarsPanel />
      </aside>
    </>
  );
}
