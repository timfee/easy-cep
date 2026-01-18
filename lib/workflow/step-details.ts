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
  "verify-primary-domain": {
    title: "Verify Primary Domain",
    description:
      "Checks that your Google Workspace primary domain is present and verified. If verification is pending you'll need to add the DNS record provided by Google.",
  },
  "create-automation-ou": {
    title: "Create Automation OU",
    description:
      "Ensures the Automation organizational unit exists. When missing, a new OU is created under the root to contain service accounts.",
  },
  "create-service-user": {
    title: "Create Service User",
    description:
      "Creates a dedicated provisioning account in Google Workspace. The user is placed in the Automation OU and assigned the generated password.",
  },
  "create-admin-role-and-assign-user": {
    title: "Create Admin Role and Assign User",
    description:
      "Defines a custom admin role with the required privileges and assigns it to the provisioning account. This grants the service user the permissions needed to manage resources.",
  },
  "configure-google-saml-profile": {
    title: "Configure Google SAML Profile",
    description:
      "Ensures a SAML profile exists in Google Workspace for Azure AD. If one is not found the step creates a new profile using the provided display name.",
    estimatedDuration: { typical: 15, maximum: 60 },
  },
  "create-microsoft-apps": {
    title: "Create Microsoft Apps",
    description:
      "Instantiates the Google Workspace provisioning and SSO applications in Microsoft Entra. Corresponding service principals are created automatically.",
  },
  "setup-microsoft-provisioning": {
    title: "Setup Microsoft Provisioning",
    description:
      "Configures Azure AD user provisioning to Google Workspace. Creates a synchronization job, sets credentials, and starts the initial sync.",
  },
  "configure-microsoft-sso": {
    title: "Configure Microsoft SSO",
    description:
      "Configures SAML single sign-on settings in Microsoft Entra. Sets SSO mode, configures SAML URLs, updates application settings, and generates signing certificates.",
  },
  "setup-microsoft-claims-policy": {
    title: "Setup Microsoft Claims Policy",
    description:
      "Creates a claims mapping policy and attaches it to the SSO service principal so Google receives the correct SAML claims.",
  },
  "complete-google-sso-setup": {
    title: "Complete Google SSO Setup",
    description:
      "Updates the Google SAML profile with Azure AD metadata and uploads the signing certificate. This finalizes the SSO configuration.",
  },
  "assign-users-to-sso": {
    title: "Assign Users to SSO",
    description:
      "Enables SAML single sign‑on for all users by creating an inbound assignment that points to the configured SAML profile.",
  },
};
