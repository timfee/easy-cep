"use client";

import type React from "react";

import { PROTECTED_RESOURCES } from "@/constants";
import { env } from "@/env";
import { listAdminRoles, listClaimsPolicies, listDomains, listEnterpriseApps, listOrgUnits, listProvisioningJobs, listSamlProfiles, listSsoAssignments, listUsers } from '@/lib/info';
import type { InfoItem } from '@/lib/info';
import { deleteClaimsPolicies, deleteEnterpriseApps, deleteGoogleRoles, deleteGoogleUsers, deleteOrgUnits, deleteProvisioningJobs, deleteSamlProfiles, deleteSsoAssignments } from '@/lib/workflow/info-actions';
import type { DeleteResult } from '@/lib/workflow/info-actions';

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
export const ProvisioningInfoButton = createInfoButton({
  context: (
    <a
      className="text-primary hover:underline"
      href="https://entra.microsoft.com/#view/Microsoft_AAD_Connect/ProvisioningMenuBlade"
      rel="noopener noreferrer"
      target="_blank"
    >
      Open in Microsoft Entra
    </a>
  ),
  deleteItems: env.ALLOW_INFO_PURGE ? deleteProvisioningJobs : undefined,
  fetchItems: listProvisioningJobs,
  title: "Existing Provisioning Jobs",
});

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
