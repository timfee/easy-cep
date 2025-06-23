import { LogLevel, StepLogEntry } from "@/types";
import { z } from "zod";
import {
  ConflictError,
  HttpError,
  NotFoundError,
  PreconditionFailedError
} from "./errors";
import { HttpMethod, HttpStatus } from "./http-constants";
import { detectLRO, type LROMetadata } from "./lro-detector";

export type FetchOpts = RequestInit & { flatten?: boolean | string };

export interface FetchContext {
  addLog: (entry: StepLogEntry) => void;
  onLroDetected?: (lro: LROMetadata) => void;
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
      const method = reqInit.method ?? HttpMethod.GET;
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
        message: `Request`,
        method,
        url: pageUrl,
        data: {
          url: pageUrl,
          method,
          headers: reqInit.headers,
          body: parsedBody
        },
        level: LogLevel.Debug
      });

      let res: Response;
      try {
        res = await fetch(pageUrl, {
          ...reqInit,
          headers: {
            ...(reqInit.headers ?? {}),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
      } catch (error) {
        context.addLog({
          timestamp: Date.now(),
          message: "Network error",
          method,
          url: pageUrl,
          data: error instanceof Error ? error.message : String(error),
          level: LogLevel.Error
        });
        throw new HttpError(
          0,
          error instanceof Error ? error.message : String(error)
        );
      }

      const clone = res.clone();
      let logData: unknown;
      try {
        logData = await clone.json();
      } catch {
        logData = await clone.text();
      }

      context.addLog({
        timestamp: Date.now(),
        message: `Response`,
        method,
        status: res.status,
        url: pageUrl,
        data: logData,
        level: LogLevel.Debug
      });

      if (!res.ok) {
        let detail = res.statusText;
        let body: unknown;
        const errorClone = res.clone();
        try {
          body = await res.json();
          const err = (body as { error?: { message?: string } }).error;
          if (err?.message) {
            detail = err.message;
          } else if (typeof body === "string") {
            detail = body;
          }
        } catch {
          try {
            detail = await errorClone.text();
          } catch {
            // ignore
          }
        }

        switch (res.status) {
          case HttpStatus.NotFound:
            throw new NotFoundError(detail, body);
          case HttpStatus.Conflict:
            throw new ConflictError(detail, body);
          case HttpStatus.PreconditionFailed:
            throw new PreconditionFailedError(detail, body);
          default:
            throw new HttpError(res.status, detail, body);
        }
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      const lroMeta = detectLRO(json, res.status);
      if (lroMeta) {
        context.onLroDetected?.(lroMeta);
      }
      return schema.parse(json);
    };

    if (flatten) {
      const arrayKey = typeof flatten === "string" ? flatten : "items";
      let aggregated: T | undefined;
      const base = new URL(url);
      const baseSearch = new URLSearchParams(base.search);
      baseSearch.delete("pageToken");
      const baseUrl = `${base.origin}${base.pathname}`;
      let pageUrl: string | undefined = url;
      const allItems: unknown[] = [];

      while (pageUrl) {
        const page = await fetchPage(pageUrl);
        if (aggregated === undefined) aggregated = page;
        const pageData = page as unknown as Record<string, unknown>;
        const items = pageData[arrayKey];
        if (Array.isArray(items)) allItems.push(...items);
        const nextToken = pageData["nextPageToken"] as string | undefined;
        const nextLink =
          (pageData["nextLink"] as string | undefined)
          ?? (pageData["@odata.nextLink"] as string | undefined);

        if (nextToken) {
          const next = new URL(baseUrl);
          const params = new URLSearchParams(baseSearch.toString());
          params.set("pageToken", nextToken);
          next.search = params.toString();
          pageUrl = next.toString();
        } else if (nextLink) {
          if (/^https?:\/\//.test(nextLink)) {
            pageUrl = nextLink;
          } else {
            const next = new URL(nextLink, baseUrl);
            pageUrl = next.toString();
          }
        } else {
          pageUrl = undefined;
        }
      }

      const result = aggregated as unknown as Record<string, unknown>;
      (result as Record<string, unknown>)[arrayKey] = allItems;
      delete result["nextPageToken"];
      delete result["nextLink"];
      delete result["@odata.nextLink"];
      return aggregated!;
    }

    return fetchPage(url);
  };
}
