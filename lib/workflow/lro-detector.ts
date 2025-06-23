export interface LROMetadata {
  type: "google-operation" | "ms-async" | "estimated";
  operationId?: string;
  estimatedSeconds?: number;
  pollUrl?: string;
}

export function detectLRO(
  response: unknown,
  status: number
): LROMetadata | null {
  const body = response as Record<string, unknown> | undefined;
  if (body && typeof body === "object" && "name" in body && "done" in body) {
    const op = body as { name: string };
    return {
      type: "google-operation",
      operationId: op.name,
      estimatedSeconds: 30
    };
  }

  if (status === 202) {
    return { type: "ms-async", estimatedSeconds: 60 };
  }

  return null;
}
