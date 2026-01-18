import { z } from "zod";
import { HttpMethod } from "@/types";
import type { HttpClient } from "../types/http-client";

export interface BuilderConfig {
  basePath?: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  requestSchema?: z.ZodSchema<unknown>;
  responseSchema?: z.ZodSchema<unknown>;
  flatten?: boolean | string;
  retries?: number;
  timeout?: number;
}

export class ResourceBuilder<TContext = Record<string, never>> {
  private readonly config: BuilderConfig = {};
  private readonly client: HttpClient;

  constructor(client: HttpClient, initialConfig?: BuilderConfig) {
    this.client = client;
    if (initialConfig) {
      this.config = { ...initialConfig };
    }
  }

  path(template: string): ResourceBuilder<TContext & { path: string }> {
    this.config.basePath = template;
    return new ResourceBuilder<TContext & { path: string }>(
      this.client,
      this.config
    );
  }

  params(params: Record<string, string>): ResourceBuilder<TContext> {
    this.config.pathParams = { ...this.config.pathParams, ...params };
    return new ResourceBuilder<TContext>(this.client, this.config);
  }

  query(
    params: Record<string, string | number | boolean>
  ): ResourceBuilder<TContext> {
    this.config.queryParams = {
      ...this.config.queryParams,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
    };
    return new ResourceBuilder<TContext>(this.client, this.config);
  }

  headers(headers: Record<string, string>): ResourceBuilder<TContext> {
    this.config.headers = { ...this.config.headers, ...headers };
    return new ResourceBuilder<TContext>(this.client, this.config);
  }

  flatten(key?: boolean | string): ResourceBuilder<TContext> {
    this.config.flatten = key === undefined ? true : key;
    return new ResourceBuilder<TContext>(this.client, this.config);
  }

  retry(times: number): ResourceBuilder<TContext> {
    this.config.retries = times;
    return new ResourceBuilder<TContext>(this.client, this.config);
  }

  timeout(ms: number): ResourceBuilder<TContext> {
    this.config.timeout = ms;
    return new ResourceBuilder<TContext>(this.client, this.config);
  }

  accepts<T>(
    schema: z.ZodSchema<T>
  ): ResourceBuilder<TContext & { response: T }> {
    this.config.responseSchema = schema;
    return new ResourceBuilder<TContext & { response: T }>(
      this.client,
      this.config
    );
  }

  sends<T>(schema: z.ZodSchema<T>): ResourceBuilder<TContext & { request: T }> {
    this.config.requestSchema = schema;
    return new ResourceBuilder<TContext & { request: T }>(
      this.client,
      this.config
    );
  }

  // Terminal methods
  get() {
    return this.send(HttpMethod.GET);
  }

  post(body?: TContext extends { request: infer B } ? B : unknown) {
    const parsedBody =
      body && this.config.requestSchema
        ? this.config.requestSchema.parse(body)
        : body;
    return this.send(HttpMethod.POST, parsedBody);
  }

  put(body?: TContext extends { request: infer B } ? B : unknown) {
    const parsedBody =
      body && this.config.requestSchema
        ? this.config.requestSchema.parse(body)
        : body;
    return this.send(HttpMethod.PUT, parsedBody);
  }

  patch(body?: TContext extends { request: infer B } ? B : unknown) {
    const parsedBody =
      body && this.config.requestSchema
        ? this.config.requestSchema.parse(body)
        : body;
    return this.send(HttpMethod.PATCH, parsedBody);
  }

  delete() {
    return this.send(HttpMethod.DELETE);
  }

  private buildUrl(): string {
    let url = this.config.basePath || "";

    if (this.config.pathParams) {
      // ENCODING: Path parameters are encoded here and ONLY here
      for (const [key, value] of Object.entries(this.config.pathParams)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      }
    }

    if (
      this.config.queryParams &&
      Object.keys(this.config.queryParams).length > 0
    ) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(this.config.queryParams)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    return url;
  }

  private buildOptions(): Record<string, unknown> {
    const options: Record<string, unknown> = {};
    if (this.config.headers) {
      options.headers = this.config.headers;
    }
    if (this.config.flatten !== undefined) {
      options.flatten = this.config.flatten;
    }
    return options;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const retries = this.config.retries || 0;
    let lastError: unknown;

    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
        }
      }
    }

    throw lastError;
  }

  private send(method: HttpMethod, body?: unknown): Promise<unknown> {
    const url = this.buildUrl();
    const options = this.buildOptions();
    return this.executeWithRetry(async () => {
      const responseSchema = this.config.responseSchema ?? z.unknown();
      const response = await this.client.request(url, responseSchema, {
        ...options,
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!responseSchema.safeParse(response).success) {
        throw new Error("Unexpected response schema");
      }
      return response;
    });
  }
}
