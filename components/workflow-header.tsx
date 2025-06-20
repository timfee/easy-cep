"use client";

import { ProviderLogin } from "@/components/provider-login";
import Image from "next/image";
import { useWorkflow } from "./workflow-context";

export function WorkflowHeader() {
  const { updateVars } = useWorkflow();

  return (
    <div className="border-b">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center">
            <Image
              src="../icon.svg"
              alt="Easy CEP Logo"
              width="36"
              height="36"
              className="ml-3.5 mr-2 my-4"
            />
            <h1 className="text-3xl font-semibold text-blue-700">Easy CEP</h1>
          </div>
        </div>
        <ProviderLogin onUpdate={updateVars} />
      </div>
    </div>
  );
}
