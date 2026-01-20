import { z } from "zod";

/**
 * Schema for Google long-running operations.
 */
export const GoogleOperationSchema = z.object({
  done: z.boolean().optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string(),
      status: z.string().optional(),
    })
    .optional(),
  name: z.string().optional(),
  response: z.unknown().optional(),
});

/**
 * Typed Google operation payload.
 */
export type GoogleOperation = z.infer<typeof GoogleOperationSchema>;

export const ServicePrincipalIdSchema = z.object({
  value: z.array(z.object({ id: z.string() })),
});
