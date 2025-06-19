import { StepIdValue } from "@/types";

export const stepDescriptions: Record<StepIdValue, string> = {
  "verify-primary-domain":
    "Ensure Google Workspace primary domain exists and is verified.",
  "create-automation-ou":
    "Ensure the organizational unit `/Automation` exists.",
  "create-service-user":
    "Ensure service account email `azuread-provisioning@{primaryDomain}` exists.",
  "create-admin-role-and-assign-user":
    "Ensure custom admin role `Microsoft Entra Provisioning` exists with correct privileges and is assigned to the provisioning user.",
  "configure-google-saml-profile":
    "Ensure at least one inbound SAML profile exists for Google.",
  "create-microsoft-apps":
    "Instantiate provisioning and SSO Microsoft enterprise apps from template.",
  "configure-microsoft-sync-and-sso":
    "Configure Azure AD provisioning and SSO settings.",
  "setup-microsoft-claims-policy":
    "Ensure a claims mapping policy exists and is assigned to the SSO service principal.",
  "complete-google-sso-setup":
    "Automatically configure Google SSO using Azure AD metadata.",
  "assign-users-to-sso": "Enable SAML SSO for all users in the domain.",
  "test-sso-configuration": "Verify end-to-end SAML SSO is functioning."
};
