"use client";

import Image from "next/image";

import { useWorkflow } from "@/components/workflow/context";
import { ProviderLogin } from "@/components/workflow/provider-login";

/**
 * Header with branding and provider login actions.
 */
export function WorkflowHeader() {
  const { updateVars } = useWorkflow();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
      <section>
        <div className="flex items-center gap-2">
          <Image
            alt="Easy CEP Logo"
            className="shrink-0"
            height="36"
            src="/icon.svg"
            width="36"
          />
          <h1 className="font-semibold text-2xl tracking-tight">Easy CEP</h1>
        </div>
      </section>
      <section className="flex items-center gap-4">
        <ProviderLogin onUpdate={updateVars} />
      </section>
    </header>
  );
}
