/**
 * Titles and descriptions for workflow steps.
 */
export const STEP_DETAILS: Record<
  string,
  {
    title: string;
    description: string;
    estimatedDuration?: { typical: number; maximum: number };
  }
> = {
  "assign-users-to-sso": {
    description:
      "Enables SAML single sign‑on for all users by creating an inbound assignment that points to the configured SAML profile.",
    title: "Assign Users to SSO",
  },
  "complete-google-sso-setup": {
    description:
      "Updates the Google SAML profile with Azure AD metadata and uploads the signing certificate. This finalizes the SSO configuration.",
    title: "Complete Google SSO Setup",
  },
  "configure-google-saml-profile": {
    description:
      "Ensures a SAML profile exists in Google Workspace for Azure AD. If one is not found the step creates a new profile using the provided display name.",
    estimatedDuration: { typical: 15, maximum: 60 },
    title: "Configure Google SAML Profile",
  },
  "configure-microsoft-sso": {
    description:
      "Configures SAML single sign-on settings in Microsoft Entra. Sets SSO mode, configures SAML URLs, updates application settings, and generates signing certificates.",
    title: "Configure Microsoft SSO",
  },
  "create-admin-role-and-assign-user": {
    description:
      "Defines a custom admin role with the required privileges and assigns it to the provisioning account. This grants the service user the permissions needed to manage resources.",
    title: "Create Admin Role and Assign User",
  },
  "create-automation-ou": {
    description:
      "Ensures the Automation organizational unit exists. When missing, a new OU is created under the root to contain service accounts.",
    title: "Create Automation OU",
  },
  "create-microsoft-apps": {
    description:
      "Instantiates the Google Workspace provisioning and SSO applications in Microsoft Entra. Corresponding service principals are created automatically.",
    title: "Create Microsoft Apps",
  },
  "create-service-user": {
    description:
      "Creates a dedicated provisioning account in Google Workspace. The user is placed in the Automation OU and assigned the generated password.",
    title: "Create Service User",
  },
  "setup-microsoft-claims-policy": {
    description:
      "Creates a claims mapping policy and attaches it to the SSO service principal so Google receives the correct SAML claims.",
    title: "Setup Microsoft Claims Policy",
  },
  "setup-microsoft-provisioning": {
    description:
      "Configures Azure AD user provisioning to Google Workspace. Creates a synchronization job, sets credentials, and starts the initial sync.",
    title: "Setup Microsoft Provisioning",
  },
  "verify-primary-domain": {
    description:
      "Checks that your Google Workspace primary domain is present and verified. If verification is pending you'll need to add the DNS record provided by Google.",
    title: "Verify Primary Domain",
  },
};
