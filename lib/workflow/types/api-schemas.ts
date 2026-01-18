import { z } from "zod";

export const GoogleOperationSchema = z.object({
  name: z.string(),
  done: z.boolean(),
  response: z.unknown().optional(),
  error: z
    .object({
      message: z.string(),
      code: z.number().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

export type GoogleOperation = z.infer<typeof GoogleOperationSchema>;

export const ServicePrincipalIdSchema = z.object({
  value: z.array(z.object({ id: z.string() })),
});
