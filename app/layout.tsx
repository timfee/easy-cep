/* eslint-disable workflow/no-hardcoded-config */
import { WorkflowProvider } from "@/components/workflow-context";
import { WorkflowHeader } from "@/components/workflow-header";
import { PROTECTED_RESOURCES } from "@/constants";
import { env } from "@/env";
import { getAllSteps } from "@/lib/workflow/step-registry";
import { Var } from "@/types";
import type { Metadata } from "next";
import "./globals.css";

// Initialize protected resources
if (env.MICROSOFT_OAUTH_CLIENT_ID) {
  PROTECTED_RESOURCES.microsoftAppIds.add(env.MICROSOFT_OAUTH_CLIENT_ID);
}

export const metadata: Metadata = { title: "Easy CEP" };

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const allSteps = getAllSteps().map((step) => ({
    id: step.id,
    requires: step.requires,
    provides: step.provides
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
    [Var.GeneratedPassword]: Math.random().toString(36).slice(-12)
  };

  return (
    <html lang="en">
      <body>
        <WorkflowProvider steps={allSteps} initialVars={DEFAULT_CONFIG}>
          <WorkflowHeader />
          <main className="flex h-[calc(100vh-64px)]">{children}</main>
        </WorkflowProvider>
      </body>
    </html>
  );
}
