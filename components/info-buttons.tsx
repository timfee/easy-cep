"use client";

import { InfoButton } from "@/components/info-button";
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
  type InfoItem
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
  type DeleteResult
} from "@/lib/workflow/info-actions";
import React from "react";

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
        title={config.title}
        fetchItems={config.fetchItems}
        deleteItems={config.deleteItems}
        context={config.context}
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
      href="https://admin.google.com/ac/orgunits"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Google Admin
    </a>
  )
});

export const SamlInfoButton = createInfoButton({
  title: "Existing SAML Profiles",
  fetchItems: listSamlProfiles,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteSamlProfiles : undefined,
  context: (
    <a
      href="https://admin.google.com/ac/apps/saml"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Google Admin
    </a>
  )
});

export const DomainInfoButton = createInfoButton({
  title: "Existing Domains",
  fetchItems: listDomains,
  context: (
    <a
      href="https://admin.google.com/ac/domains"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Google Admin
    </a>
  )
});

export const UsersInfoButton = createInfoButton({
  title: "Existing Users",
  fetchItems: listUsers,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteGoogleUsers : undefined,
  context: (
    <a
      href="https://admin.google.com/ac/users"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Google Admin
    </a>
  )
});

export const RolesInfoButton = createInfoButton({
  title: "Existing Admin Roles",
  fetchItems: listAdminRoles,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteGoogleRoles : undefined,
  context: (
    <a
      href="https://admin.google.com/ac/roles"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Google Admin
    </a>
  )
});

export const SsoInfoButton = createInfoButton({
  title: "Existing SSO Assignments",
  fetchItems: listSsoAssignments,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteSsoAssignments : undefined,
  context: (
    <a
      href="https://admin.google.com/ac/security/inboundsso"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Google Admin
    </a>
  )
});

export const AppsInfoButton = createInfoButton({
  title: "Existing Enterprise Apps",
  fetchItems: async () => {
    const items = await listEnterpriseApps();
    return items.map((item) => ({
      ...item,
      deletable: !PROTECTED_RESOURCES.microsoftAppIds.has(item.id)
    }));
  },
  deleteItems: env.ALLOW_INFO_PURGE ? deleteEnterpriseApps : undefined,
  context: (
    <a
      href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Microsoft Entra
    </a>
  )
});

export const ProvisioningInfoButton = createInfoButton({
  title: "Existing Provisioning Jobs",
  fetchItems: listProvisioningJobs,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteProvisioningJobs : undefined,
  context: (
    <a
      href="https://entra.microsoft.com/#view/Microsoft_AAD_Connect/ProvisioningMenuBlade"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Microsoft Entra
    </a>
  )
});

export const ClaimsInfoButton = createInfoButton({
  title: "Existing Claims Policies",
  fetchItems: listClaimsPolicies,
  deleteItems: env.ALLOW_INFO_PURGE ? deleteClaimsPolicies : undefined,
  context: (
    <a
      href="https://entra.microsoft.com/#view/Microsoft_AAD_IAM/PoliciesMenuBlade/~/ClaimsMapping"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline">
      Open in Microsoft Entra
    </a>
  )
});
