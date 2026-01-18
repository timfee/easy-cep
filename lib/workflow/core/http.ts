export function extractResourceId(
  resourceName: string,
  resourceType: string
): string {
  if (!resourceName.includes(resourceType)) {
    return resourceName;
  }
  const regex = new RegExp(`(?:.*\\/)?${resourceType}\\/(.*)`);
  const match = resourceName.match(regex);
  return match?.[1] || resourceName;
}

export function normalizePathSegment(value: string): string {
  if (!value) {
    return value;
  }
  const trimmed = value.startsWith("/") ? value.slice(1) : value;
  return encodeURIComponent(trimmed);
}

export type ResourceTypeValue =
  | "inboundSsoAssignments"
  | "inboundSamlSsoProfiles"
  | "id"
  | "orgUnits"
  | "roles"
  | "roleassignments"
  | "users"
  | "servicePrincipals"
  | "applications"
  | "synchronization/jobs"
  | "claimsMappingPolicies";

export const ResourceTypes: Record<
  | "InboundSsoAssignments"
  | "InboundSamlSsoProfiles"
  | "OrgUnitId"
  | "OrgUnits"
  | "Roles"
  | "RoleAssignments"
  | "Users"
  | "ServicePrincipals"
  | "Applications"
  | "SynchronizationJobs"
  | "ClaimsMappingPolicies",
  ResourceTypeValue
> = {
  InboundSsoAssignments: "inboundSsoAssignments",
  InboundSamlSsoProfiles: "inboundSamlSsoProfiles",
  OrgUnitId: "id",
  OrgUnits: "orgUnits",
  Roles: "roles",
  RoleAssignments: "roleassignments",
  Users: "users",
  ServicePrincipals: "servicePrincipals",
  Applications: "applications",
  SynchronizationJobs: "synchronization/jobs",
  ClaimsMappingPolicies: "claimsMappingPolicies",
};
