"use client";

import { ProviderLogin } from "@/components/provider-login";
import Image from "next/image";
import { useWorkflow } from "./workflow-context";

export function WorkflowHeader() {
  const { updateVars } = useWorkflow();

  return (
    <header className="border-b flex items-center justify-between py-2.5">
      <section>
        <div className="flex items-center">
          <Image
            src="../icon.svg"
            alt="Easy CEP Logo"
            width="36"
            height="36"
            className="ml-3.5 mr-2"
          />
          <h1 className="text-3xl font-bold text-blue-700">Easy CEP</h1>
        </div>
      </section>
      <section className="space-x-4 flex mr-2">
        <ProviderLogin onUpdate={updateVars} />
      </section>
    </header>
  );
}
