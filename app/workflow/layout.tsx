/* eslint-disable workflow/no-hardcoded-config */
import { getAllSteps } from "@/lib/workflow/step-registry";
import { Var } from "@/types";
import { WorkflowHeader } from "./components/workflow-header";
import { WorkflowSidebar } from "./components/workflow-sidebar";
import { WorkflowProvider } from "./context/workflow-context";

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

export default function WorkflowLayout({
  children,
  steps,
  variables
}: {
  children: React.ReactNode;
  steps: React.ReactNode;
  variables: React.ReactNode;
}) {
  const allSteps = getAllSteps().map((s) => ({
    id: s.id,
    requires: s.requires,
    provides: s.provides
  }));

  return (
    <WorkflowProvider steps={allSteps} initialVars={DEFAULT_CONFIG}>
      <div className="flex h-screen bg-background">
        <WorkflowSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <WorkflowHeader />
          <main className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-slate-50/30">
              <div className="p-6">
                {children}
                {steps}
              </div>
            </div>
            <aside className="w-96 border-l bg-white overflow-y-auto">
              <div className="p-6">{variables}</div>
            </aside>
          </main>
        </div>
      </div>
    </WorkflowProvider>
  );
}
