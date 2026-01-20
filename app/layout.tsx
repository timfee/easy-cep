import "./globals.css";
import type  { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";

import { WorkflowProvider } from "@/components/workflow/context";
import { WorkflowHeader } from "@/components/workflow/header";
import { PROTECTED_RESOURCES } from "@/constants";
import { env } from "@/env";
import { getAllSteps } from "@/lib/workflow/step-registry";
import { Var } from "@/lib/workflow/variables";

if (env.MICROSOFT_OAUTH_CLIENT_ID) {
  PROTECTED_RESOURCES.microsoftAppIds.add(env.MICROSOFT_OAUTH_CLIENT_ID);
}

const roboto = Roboto_Flex();

/**
 * Metadata for the application shell.
 */
export const metadata: Metadata = { title: "Easy CEP" };

/**
 * Root layout that wires workflow state and chrome.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const allSteps = getAllSteps().map((step) => ({
    id: step.id,
    provides: step.provides,
    requires: step.requires,
  }));

  const DEFAULT_CONFIG = {
    [Var.AutomationOuName]: "Automation",
    [Var.AutomationOuPath]: "/Automation",
    [Var.ProvisioningUserPrefix]: "azuread-provisioning",
    [Var.AdminRoleName]: "Microsoft Entra Provisioning",
    [Var.SamlProfileDisplayName]: "Azure AD",
    [Var.ProvisioningAppDisplayName]: "Google Workspace Provisioning",
    [Var.SsoAppDisplayName]: "Google Workspace SSO",
    [Var.ClaimsPolicyDisplayName]: "Google Workspace Basic Claims",
  };

  return (
    <html className="scroll-smooth antialiased" lang="en">
      <body
        className={`flex h-screen transform-gpu flex-col overflow-hidden scroll-smooth antialiased ${roboto.className}`}
      >
        <WorkflowProvider initialVars={DEFAULT_CONFIG} steps={allSteps}>
          <WorkflowHeader />
          <main className="flex h-[calc(100vh-64px)] overflow-hidden">
            {children}
          </main>
        </WorkflowProvider>
      </body>
    </html>
  );
}
