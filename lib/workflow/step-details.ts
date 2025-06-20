export interface StepDetail {
  title: string;
  description: string;
}

export const STEP_DETAILS: Record<string, StepDetail> = {
  "verify-primary-domain": {
    title: "Verify Primary Domain",
    description:
      "Checks that your Google Workspace primary domain is present and verified. If verification is pending you'll need to add the DNS record provided by Google."
  },
  "create-automation-ou": {
    title: "Create Automation OU",
    description:
      "Ensures the Automation organizational unit exists. When missing, a new OU is created under the root to contain service accounts."
  },
  "create-service-user": {
    title: "Create Service User",
    description:
      "Creates a dedicated provisioning account in Google Workspace. The user is placed in the Automation OU and assigned the generated password."
  },
  "create-admin-role-and-assign-user": {
    title: "Create Admin Role and Assign User",
    description:
      "Defines a custom admin role with the required privileges and assigns it to the provisioning account. This grants the service user the permissions needed to manage resources."
  },
  "configure-google-saml-profile": {
    title: "Configure Google SAML Profile",
    description:
      "Ensures a SAML profile exists in Google Workspace for Azure AD. If one is not found the step creates a new profile using the provided display name."
  },
  "create-microsoft-apps": {
    title: "Create Microsoft Apps",
    description:
      "Instantiates the Google Workspace provisioning and SSO applications in Microsoft Entra. Corresponding service principals are created automatically."
  },
  "configure-microsoft-sync-and-sso": {
    title: "Configure Microsoft Sync and SSO",
    description:
      "Sets up Azure AD provisioning and single sign‑on. Credentials are stored and an initial synchronization job is started."
  },
  "setup-microsoft-claims-policy": {
    title: "Setup Microsoft Claims Policy",
    description:
      "Creates a claims mapping policy and attaches it to the SSO service principal so Google receives the correct SAML claims."
  },
  "complete-google-sso-setup": {
    title: "Complete Google SSO Setup",
    description:
      "Updates the Google SAML profile with Azure AD metadata and uploads the signing certificate. This finalizes the SSO configuration."
  },
  "assign-users-to-sso": {
    title: "Assign Users to SSO",
    description:
      "Enables SAML single sign‑on for all users by creating an inbound assignment that points to the configured SAML profile."
  }
};
