"use client";

import { ProviderLogin } from "@/components/provider-login";
import Image from "next/image";
import { useWorkflow } from "./workflow-context";

export function WorkflowHeader() {
  const { updateVars } = useWorkflow();

  return (
    <div className="border-b px-6 py-2 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center py-2">
            <Image
              src="../icon.svg"
              alt="Easy CEP Logo"
              width="40"
              height="40"
              className="mb-1 mr-2"
            />
            <h1 className="text-xl font-semibold text-blue-700">Easy CEP</h1>
          </div>
        </div>
        <ProviderLogin onUpdate={updateVars} />
      </div>
    </div>
  );
}
