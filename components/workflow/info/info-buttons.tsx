"use client";

import type React from "react";
import { PROTECTED_RESOURCES } from "@/constants";
import { env } from "@/env";
import {
  type InfoItem,
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
  type DeleteResult,
  deleteClaimsPolicies,
  deleteEnterpriseApps,
  deleteGoogleRoles,
  deleteGoogleUsers,
  deleteOrgUnits,
  deleteProvisioningJobs,
  deleteSamlProfiles,
  deleteSsoAssignments,
} from "@/lib/workflow/info-actions";
import { InfoButton } from "./info-button";

interface InfoButtonConfig {
  title: string;
  fetchItems: () => Promise<InfoItem[]>;
  deleteItems?: (ids: string[]) => Promise<DeleteResult>;
  context?: React.ReactNode;
}

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

export const OuInfoButton = createInfoButton({
  title: "Existing Organizational Units",
  fetchItems: listOrgUnits,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteOrgUnits : undefined,
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
});

export const SamlInfoButton = createInfoButton({
  title: "Existing SAML Profiles",
  fetchItems: listSamlProfiles,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteSamlProfiles : undefined,
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
});

export const DomainInfoButton = createInfoButton({
  title: "Existing Domains",
  fetchItems: listDomains,
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
});

export const UsersInfoButton = createInfoButton({
  title: "Existing Users",
  fetchItems: listUsers,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteGoogleUsers : undefined,
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
});

export const RolesInfoButton = createInfoButton({
  title: "Existing Admin Roles",
  fetchItems: listAdminRoles,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteGoogleRoles : undefined,
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
});

export const SsoInfoButton = createInfoButton({
  title: "Existing SSO Assignments",
  fetchItems: listSsoAssignments,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteSsoAssignments : undefined,
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
});

export const AppsInfoButton = createInfoButton({
  title: "Existing Enterprise Apps",
  fetchItems: async () => {
    const items = await listEnterpriseApps();
    return items.map((item) => ({
      ...item,
      deletable: !PROTECTED_RESOURCES.microsoftAppIds.has(item.id),
    }));
  },
  deleteItems: env.ALLOW_INFO_PURGE ? deleteEnterpriseApps : undefined,
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
});

export const ProvisioningInfoButton = createInfoButton({
  title: "Existing Provisioning Jobs",
  fetchItems: listProvisioningJobs,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteProvisioningJobs : undefined,
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
});

export const ClaimsInfoButton = createInfoButton({
  title: "Existing Claims Policies",
  fetchItems: listClaimsPolicies,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteClaimsPolicies : undefined,
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
});
