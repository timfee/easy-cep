export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, initialDelay * Math.pow(2, i))
        );
      }
    }
  }
  throw lastError;
}

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

export function buildResourceName(
  resourceType: string,
  id: string,
  prefix?: string
): string {
  return prefix ? `${prefix}/${resourceType}/${id}` : `${resourceType}/${id}`;
}
