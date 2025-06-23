import { z } from "zod";

export interface HttpClient {
  request<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
}

export { GoogleClient } from "../http/google-client";
export { MicrosoftClient } from "../http/microsoft-client";
