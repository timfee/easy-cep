import { WORKFLOW_VARIABLES } from "@/lib/workflow/variables";
import { Var } from "@/types";
import { z } from "zod";

// Create a union of all valid Var values
const VarSchema = z.enum([
  Var.GoogleAccessToken,
  Var.MsGraphToken,
  Var.PrimaryDomain,
  Var.IsDomainVerified,
  Var.VerificationToken,
  Var.AutomationOuName,
  Var.AutomationOuPath,
  Var.ProvisioningUserPrefix,
  Var.AdminRoleName,
  Var.SamlProfileDisplayName,
  Var.ProvisioningAppDisplayName,
  Var.SsoAppDisplayName,
  Var.ClaimsPolicyDisplayName,
  Var.ProvisioningUserId,
  Var.ProvisioningUserEmail,
  Var.GeneratedPassword,
  Var.AdminRoleId,
  Var.DirectoryServiceId,
  Var.SsoServicePrincipalId,
  Var.ProvisioningServicePrincipalId,
  Var.SsoAppId,
  Var.SamlProfileId,
  Var.EntityId,
  Var.AcsUrl,
  Var.ClaimsPolicyId,
  Var.MsSigningCertificate,
  Var.MsSsoLoginUrl,
  Var.MsSsoEntityId
] as const);

const StepStatusSchema = z.enum([
  "idle",
  "checking",
  "executing",
  "complete",
  "failed",
  "pending",
  "undoing",
  "reverted"
]);

const StepUIStateSchema = z.object({
  status: StepStatusSchema,
  summary: z.string().optional(),
  error: z.string().optional(),
  notes: z.string().optional()
});

// Schema for persisted workflow vars (filters out ephemeral ones)
const PersistedVarsSchema = z
  .record(VarSchema, z.string().optional())
  .transform((vars) => {
    // Filter out ephemeral variables during parsing
    const filtered: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (
        !WORKFLOW_VARIABLES[key as keyof typeof WORKFLOW_VARIABLES]?.ephemeral
      ) {
        filtered[key] = value;
      }
    }
    return filtered;
  });

export const PersistedStateSchema = z.object({
  vars: PersistedVarsSchema.optional(),
  status: z.record(z.string(), StepUIStateSchema).optional()
});

export type PersistedState = z.infer<typeof PersistedStateSchema>;

/**
 * Safely parse persisted state with validation
 */
export function parsePersistedState(data: unknown): PersistedState | null {
  try {
    return PersistedStateSchema.parse(data);
  } catch (error) {
    console.error("Failed to parse persisted state:", error);
    return null;
  }
}

/**
 * Prepare state for persistence (removes ephemeral vars)
 */
export function prepareStateForPersistence(
  vars: Record<string, unknown>,
  status: Record<string, unknown>
): string {
  const filtered = PersistedStateSchema.parse({ vars, status });
  return JSON.stringify(filtered);
}
