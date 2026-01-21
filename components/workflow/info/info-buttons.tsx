"use client";

import type React from "react";

import Link from "next/link";
import { useMemo } from "react";

import type { InfoItem } from "@/lib/info";
import type { DeleteResult } from "@/lib/workflow/info-actions";

import { useWorkflow } from "@/components/workflow/context";
import { PROTECTED_RESOURCES } from "@/constants";
import { env } from "@/env";
import {
  listAdminRoles,
  listClaimsPolicies,
  listDomains,
  listEnterpriseApps,
  listOrgUnits,
  listProvisioningJobs,
  listSamlProfiles,
  listSsoAssignments,
  listUsers,
} from "@/lib/info";
import {
  deleteClaimsPolicies,
  deleteEnterpriseApps,
  deleteGoogleRoles,
  deleteGoogleUsers,
  deleteOrgUnits,
  deleteProvisioningJobs,
  deleteSamlProfiles,
  deleteSsoAssignments,
} from "@/lib/workflow/info-actions";
import { Var } from "@/lib/workflow/variables";

import { InfoButton } from "./info-button";

interface InfoButtonConfig {
  title: string;
  fetchItems: () => Promise<InfoItem[]>;
  deleteItems?: (ids: string[]) => Promise<DeleteResult>;
  context?: React.ReactNode;
}

/**
 * Create a configured info button component.
 */
export function createInfoButton(config: InfoButtonConfig): React.FC {
  return function GeneratedInfoButton() {
    return (
      <InfoButton
        context={config.context}
        deleteItems={config.deleteItems}
        fetchItems={config.fetchItems}
        title={config.title}
      />
    );
  };
}

/**
 * Inspect existing organizational units.
 */
export const OuInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://admin.google.com/ac/orgunits"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Google Admin
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteOrgUnits : undefined,
  fetchItems: listOrgUnits,
  title: "Existing Organizational Units",
});

/**
 * Inspect existing SAML profiles.
 */
export const SamlInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://admin.google.com/ac/apps/saml"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Google Admin
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteSamlProfiles : undefined,
  fetchItems: listSamlProfiles,
  title: "Existing SAML Profiles",
});

/**
 * Inspect existing domains.
 */
export const DomainInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://admin.google.com/ac/domains"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Google Admin
    </a>
  ),
  fetchItems: listDomains,
  title: "Existing Domains",
});

/**
 * Inspect existing user accounts.
 */
export const UsersInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://admin.google.com/ac/users"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Google Admin
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteGoogleUsers : undefined,
  fetchItems: listUsers,
  title: "Existing Users",
});

/**
 * Inspect existing admin roles.
 */
export const RolesInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://admin.google.com/ac/roles"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Google Admin
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteGoogleRoles : undefined,
  fetchItems: listAdminRoles,
  title: "Existing Admin Roles",
});

/**
 * Inspect existing SSO assignments.
 */
export const SsoInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://admin.google.com/ac/security/inboundsso"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Google Admin
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteSsoAssignments : undefined,
  fetchItems: listSsoAssignments,
  title: "Existing SSO Assignments",
});

/**
 * Inspect existing Microsoft enterprise apps.
 */
export const AppsInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Microsoft Entra
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteEnterpriseApps : undefined,
  fetchItems: async () => {
    const items = await listEnterpriseApps();
    return items.map((item) => ({
      ...item,
      deletable: !PROTECTED_RESOURCES.microsoftAppIds.has(item.id),
    }));
  },
  title: "Existing Enterprise Apps",
});

/**
 * Inspect existing provisioning jobs.
 */
const PROVISIONING_PORTAL_BASE =
  "https://portal.azure.com/#view/Microsoft_AAD_Connect_Provisioning/ProvisioningMenuBlade";
const PROVISIONING_OVERVIEW_PATH = `${PROVISIONING_PORTAL_BASE}/~/OverviewPreview`;
const PROVISIONING_APP_ID = "417cd3a1-7ada-4b98-a0d4-099ec66bc6cd";

function ProvisioningContextLink() {
  const { varsRaw } = useWorkflow();
  const userId = varsRaw[Var.ProvisioningUserId];
  const href = useMemo(() => {
    if (!userId) {
      return PROVISIONING_PORTAL_BASE;
    }
    return `${PROVISIONING_OVERVIEW_PATH}/objectId/${userId}/appId/${PROVISIONING_APP_ID}`;
  }, [userId]);

  const label = userId
    ? "Open provisioning user in Microsoft Entra"
    : "Open provisioning in Microsoft Entra";

  return (
    <Link
      className="text-primary hover:underline"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {label}
    </Link>
  );
}

export function ProvisioningInfoButton() {
  return (
    <InfoButton
      context={<ProvisioningContextLink />}
      deleteItems={env.ALLOW_INFO_PURGE ? deleteProvisioningJobs : undefined}
      fetchItems={listProvisioningJobs}
      title="Existing Provisioning Jobs"
    />
  );
}

/**
 * Inspect existing claims policies.
 */
export const ClaimsInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://entra.microsoft.com/#view/Microsoft_AAD_IAM/PoliciesMenuBlade/~/ClaimsMapping"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Microsoft Entra
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteClaimsPolicies : undefined,
  fetchItems: listClaimsPolicies,
  title: "Existing Claims Policies",
});
