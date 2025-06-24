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

export const ResourceTypes = {
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
  ClaimsMappingPolicies: "claimsMappingPolicies"
} as const;
