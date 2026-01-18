/**
 * Metadata describing detected long-running operations.
 */
export interface LROMetadata {
  type: "google-operation" | "ms-async" | "estimated";
  operationId?: string;
  estimatedSeconds?: number;
  pollUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Detect long-running operations from API responses.
 */
export function detectLRO(
  response: unknown,
  status: number
): LROMetadata | null {
  if (isRecord(response) && "name" in response && "done" in response) {
    const operationId = getString(response.name);
    if (operationId) {
      return { type: "google-operation", operationId, estimatedSeconds: 30 };
    }
  }

  if (status === 202) {
    return { type: "ms-async", estimatedSeconds: 60 };
  }

  return null;
}
