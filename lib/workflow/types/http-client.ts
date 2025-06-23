import { z } from "zod";

export interface HttpClient {
  get<R>(
    url: string,
    schema: z.ZodSchema<R>,
    options?: { flatten?: boolean | string }
  ): Promise<R>;
  post<R>(
    url: string,
    schema: z.ZodSchema<R>,
    body?: unknown,
    options?: { flatten?: boolean | string }
  ): Promise<R>;
  put<R>(
    url: string,
    schema: z.ZodSchema<R>,
    body?: unknown,
    options?: { flatten?: boolean | string }
  ): Promise<R>;
  patch<R>(
    url: string,
    schema: z.ZodSchema<R>,
    body?: unknown,
    options?: { flatten?: boolean | string }
  ): Promise<R>;
  delete<R>(
    url: string,
    schema: z.ZodSchema<R>,
    options?: { flatten?: boolean | string }
  ): Promise<R>;
}
