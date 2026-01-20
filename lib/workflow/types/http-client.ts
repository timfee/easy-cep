import  { type z } from "zod";

export interface HttpClient {
  request<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
}
