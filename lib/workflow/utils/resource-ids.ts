/**
 * Extracts resource ID from Google/Microsoft resource names
 *
 * Examples:
 * - "inboundSsoAssignments/abc123" → "abc123"
 * - "customers/C123/inboundSsoAssignments/abc123" → "abc123"
 * - "abc123" → "abc123" (already extracted)
 */
export function extractResourceId(
  resourceName: string,
  resourceType: string
): string {
  // If it doesn't contain the resource type, assume it's already an ID
  if (!resourceName.includes(resourceType)) {
    return resourceName;
  }

  // Match everything after the last occurrence of resourceType/
  const regex = new RegExp(`(?:.*\\/)?${resourceType}\\/(.*)`);
  const match = resourceName.match(regex);
  return match?.[1] || resourceName;
}

/**
 * Common resource types
 */
export const ResourceTypes = {
  // Google
  InboundSsoAssignments: "inboundSsoAssignments",
  InboundSamlSsoProfiles: "inboundSamlSsoProfiles",
  OrgUnitId: "id",
  OrgUnits: "orgUnits",
  Roles: "roles",
  RoleAssignments: "roleassignments",
  Users: "users",

  // Microsoft
  ServicePrincipals: "servicePrincipals",
  Applications: "applications",
  SynchronizationJobs: "synchronization/jobs",
  ClaimsMappingPolicies: "claimsMappingPolicies"
} as const;

/**
 * Builds a resource name from components
 */
export function buildResourceName(
  resourceType: string,
  id: string,
  prefix?: string
): string {
  return prefix ? `${prefix}/${resourceType}/${id}` : `${resourceType}/${id}`;
}
