import { z } from "zod";

export const GoogleOperationSchema = z.object({
  name: z.string(),
  done: z.boolean(),
  response: z.unknown().optional(),
  error: z
    .object({
      message: z.string(),
      code: z.number().optional(),
      status: z.string().optional()
    })
    .optional()
});

export type GoogleOperation = z.infer<typeof GoogleOperationSchema>;

export const GraphListSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    value: z.array(itemSchema),
    "@odata.nextLink": z.string().optional(),
    nextPageToken: z.string().optional()
  });

export const ServicePrincipalIdSchema = z.object({
  value: z.array(z.object({ id: z.string() }))
});
