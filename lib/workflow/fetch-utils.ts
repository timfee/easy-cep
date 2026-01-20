import type { z } from "zod";
import { HttpMethod, HttpStatus, LogLevel, type StepLogEntry } from "@/types";
import {
  ConflictError,
  HttpError,
  NotFoundError,
  PreconditionFailedError,
} from "./core/errors";
import { detectLRO, type LROMetadata } from "./lro-detector";

/**
 * Extra request options for workflow fetchers.
 */
export type FetchOpts = RequestInit & { flatten?: boolean | string };

/**
 * Logging and LRO hooks for fetch operations.
 */
export interface FetchContext {
  addLog: (entry: StepLogEntry) => void;
  onLroDetected?: (lro: LROMetadata) => void;
}

const URL_REGEX = /^https?:\/\//;

function isErrorResponseBody(
  value: unknown
): value is { error?: { message?: string } } {
  if (!value || typeof value !== "object") {
    return false;
  }
  return "error" in value;
}

/**
 * Convert HTTP responses into typed errors.
 */
async function handleResponseError(res: Response): Promise<never> {
  let detail = res.statusText;
  let errorBody: unknown;
  const errorClone = res.clone();
  try {
    errorBody = await res.json();
    if (isErrorResponseBody(errorBody)) {
      const err = errorBody.error;
      if (err?.message) {
        detail = err.message;
      }
    } else if (typeof errorBody === "string") {
      detail = errorBody;
    }
  } catch {
    try {
      detail = await errorClone.text();
    } catch {
      detail = res.statusText;
    }
  }

  switch (res.status) {
    case HttpStatus.NotFound:
      throw new NotFoundError(detail, errorBody);
    case HttpStatus.Conflict:
      throw new ConflictError(detail, errorBody);
    case HttpStatus.PreconditionFailed:
      throw new PreconditionFailedError(detail, errorBody);
    default:
      throw new HttpError(res.status, detail, errorBody);
  }
}

/**
 * Execute a single request with logging and schema parsing.
 */
async function executeSingleFetch<T>(
  url: string,
  reqInit: RequestInit,
  token: string,
  context: FetchContext,
  schema: z.ZodSchema<T>,
  expectNotFound: boolean
): Promise<T> {
  const method = reqInit.method ?? HttpMethod.GET;
  const body = reqInit.body;
  let parsedBody: unknown;
  if (typeof body === "string") {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }
  } else if (body) {
    parsedBody = body;
  }

  context.addLog({
    timestamp: Date.now(),
    message: "Request",
    method,
    url,
    data: {
      url,
      method,
      headers: {
        ...reqInit.headers,
        Authorization: `Bearer ${token.substring(0, 10)}...`,
      },
      body: parsedBody,
    },
    level: LogLevel.Debug,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      ...reqInit,
      headers: {
        ...(reqInit.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.addLog({
      timestamp: Date.now(),
      message: "Network error",
      method,
      url,
      data: message,
      level: LogLevel.Error,
    });
    throw new HttpError(0, message);
  }

  const clone = res.clone();
  let logData: unknown;
  const rawText = await clone.text();
  if (rawText) {
    try {
      logData = JSON.parse(rawText);
    } catch {
      logData = rawText;
    }
  } else {
    logData = rawText;
  }

  const is404 = res.status === HttpStatus.NotFound;
  const isExpected404 = is404 && expectNotFound;

  context.addLog({
    timestamp: Date.now(),
    message: "Response",
    method,
    status: res.status,
    url,
    data: logData,
    level: LogLevel.Debug,
  });

  if (!(res.ok || isExpected404)) {
    await handleResponseError(res);
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const getString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const readPageState = (page: Record<string, unknown>, key: string) => {
  const items = page[key];
  const nextToken = getString(page.nextPageToken);
  const nextLink =
    getString(page.nextLink) ?? getString(page["@odata.nextLink"]);
  return { items, nextToken, nextLink };
};

const toNextPageUrl = (
  nextToken: string | undefined,
  nextLink: string | undefined,
  baseUrl: string,
  baseSearch: URLSearchParams
) => {
  if (nextToken) {
    const next = new URL(baseUrl);
    const params = new URLSearchParams(baseSearch.toString());
    params.set("pageToken", nextToken);
    next.search = params.toString();
    return next.toString();
  }

  if (nextLink) {
    return URL_REGEX.test(nextLink)
      ? nextLink
      : new URL(nextLink, baseUrl).toString();
  }

  return undefined;
};

/**
 * Follow pagination links and merge responses.
 */
async function executePaginatedFetch<T>(
  url: string,
  flatten: boolean | string,
  fetcher: (url: string) => Promise<T>
): Promise<T> {
  const arrayKey = typeof flatten === "string" ? flatten : "items";
  let aggregated: T | undefined;
  const base = new URL(url);
  const baseSearch = new URLSearchParams(base.search);
  baseSearch.delete("pageToken");
  const baseUrl = `${base.origin}${base.pathname}`;
  let pageUrl: string | undefined = url;
  const allItems: unknown[] = [];

  while (pageUrl) {
    const page = await fetcher(pageUrl);
    if (aggregated === undefined) {
      aggregated = page;
    }

    if (!isRecord(page)) {
      pageUrl = undefined;
      continue;
    }

    const { items, nextToken, nextLink } = readPageState(page, arrayKey);
    if (Array.isArray(items)) {
      allItems.push(...items);
    }

    pageUrl = toNextPageUrl(nextToken, nextLink, baseUrl, baseSearch);
  }

  if (!aggregated) {
    throw new Error("No data returned from paginated fetch");
  }

  if (isRecord(aggregated)) {
    const record: Record<string, unknown> = aggregated;
    record[arrayKey] = allItems;
    record.nextPageToken = undefined;
    record.nextLink = undefined;
    record["@odata.nextLink"] = undefined;
  }
  return aggregated;
}

/**
 * Create a fetcher that injects auth and logs requests.
 */
export function createAuthenticatedFetch(
  token: string | undefined,
  context: FetchContext & { suppressExpectedErrors?: boolean }
) {
  return <T>(
    url: string,
    schema: z.ZodSchema<T>,
    init?: FetchOpts & { expectNotFound?: boolean }
  ): Promise<T> => {
    if (!token) {
      throw new Error("No auth token available");
    }

    const { flatten, ...reqInit } = init ?? {};

    const fetcher = (u: string) =>
      executeSingleFetch(
        u,
        reqInit,
        token,
        context,
        schema,
        !!init?.expectNotFound
      );

    if (flatten) {
      return executePaginatedFetch(url, flatten, fetcher);
    }

    return fetcher(url);
  };
}
