import { LogLevel, StepLogEntry } from "@/types";
import { z } from "zod";

export type FetchOpts = RequestInit & { flatten?: boolean };

export interface FetchContext {
  addLog: (entry: StepLogEntry) => void;
}

export function createAuthenticatedFetch(
  token: string | undefined,
  context: FetchContext
) {
  return async <T>(
    url: string,
    schema: z.ZodSchema<T>,
    init?: FetchOpts
  ): Promise<T> => {
    if (!token) throw new Error("No auth token available");

    const { flatten, ...reqInit } = (init as FetchOpts) ?? {};

    const fetchPage = async (pageUrl: string): Promise<T> => {
      const method = reqInit.method ?? "GET";
      const body = reqInit.body;
      let parsedBody: unknown;
      if (body) {
        try {
          parsedBody = JSON.parse(body as string);
        } catch {
          parsedBody = body;
        }
      }

      context.addLog({
        timestamp: Date.now(),
        message: `Request ${method} ${pageUrl}`,
        data: {
          url: pageUrl,
          method,
          headers: reqInit.headers,
          body: parsedBody
        },
        level: LogLevel.Debug
      });

      const res = await fetch(pageUrl, {
        ...reqInit,
        headers: {
          ...(reqInit.headers ?? {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const clone = res.clone();
      let logData: unknown;
      try {
        logData = await clone.json();
      } catch {
        logData = await clone.text();
      }

      context.addLog({
        timestamp: Date.now(),
        message: `Response ${res.status} ${pageUrl}`,
        data: logData,
        level: LogLevel.Debug
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      return schema.parse(json);
    };

    if (flatten) {
      let aggregated: T | undefined;
      let nextToken: string | undefined;
      const allItems: unknown[] = [];
      const baseUrl = url;

      do {
        let pageUrl = baseUrl;
        if (nextToken) {
          const sep = baseUrl.includes("?") ? "&" : "?";
          pageUrl = `${baseUrl}${sep}pageToken=${encodeURIComponent(nextToken)}`;
        }
        const page = await fetchPage(pageUrl);
        if (aggregated === undefined) aggregated = page;
        const p = page as unknown as {
          items?: unknown[];
          nextPageToken?: string;
        };
        if (Array.isArray(p.items)) allItems.push(...p.items);
        nextToken = p.nextPageToken;
      } while (nextToken);

      const result = aggregated as unknown as { items: unknown[] };
      result.items = allItems;
      delete (result as unknown as { nextPageToken?: string }).nextPageToken;
      return aggregated!;
    }

    return fetchPage(url);
  };
}
