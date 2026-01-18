"use client";

import Image from "next/image";
import { useWorkflow } from "@/components/workflow/context";
import { ProviderLogin } from "@/components/workflow/provider-login";

export function WorkflowHeader() {
  const { updateVars } = useWorkflow();

  return (
    <header className="flex items-center justify-between border-b bg-white py-2">
      <section>
        <div className="flex items-center">
          <Image
            alt="Easy CEP Logo"
            className="mr-2 ml-3.5"
            height="36"
            src="/icon.svg"
            width="36"
          />
          <h1 className="font-bold text-3xl">Easy CEP</h1>
        </div>
      </section>
      <section className="mr-2 flex space-x-4">
        <ProviderLogin onUpdate={updateVars} />
      </section>
    </header>
  );
}
