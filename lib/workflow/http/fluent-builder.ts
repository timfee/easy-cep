import { HttpMethod } from "@/types";
import { z } from "zod";
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
  private config: BuilderConfig = {};

  constructor(
    private client: HttpClient,
    initialConfig?: BuilderConfig
  ) {
    if (initialConfig) {
      this.config = { ...initialConfig };
    }
  }

  path(template: string): ResourceBuilder<TContext & { path: string }> {
    this.config.basePath = template;
    return this as unknown as ResourceBuilder<TContext & { path: string }>;
  }

  params(params: Record<string, string>): this {
    this.config.pathParams = { ...this.config.pathParams, ...params };
    return this;
  }

  query(params: Record<string, string | number | boolean>): this {
    this.config.queryParams = {
      ...this.config.queryParams,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      )
    };
    return this;
  }

  headers(headers: Record<string, string>): this {
    this.config.headers = { ...this.config.headers, ...headers };
    return this;
  }

  flatten(key?: boolean | string): this {
    this.config.flatten = key === undefined ? true : key;
    return this;
  }

  retry(times: number): this {
    this.config.retries = times;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }

  accepts<T>(
    schema: z.ZodSchema<T>
  ): ResourceBuilder<TContext & { response: T }> {
    this.config.responseSchema = schema;
    return this as unknown as ResourceBuilder<TContext & { response: T }>;
  }

  sends<T>(schema: z.ZodSchema<T>): ResourceBuilder<TContext & { request: T }> {
    this.config.requestSchema = schema;
    return this as unknown as ResourceBuilder<TContext & { request: T }>;
  }

  // Terminal methods
  async get<
    T = TContext extends { response: infer R } ? R : unknown
  >(): Promise<T> {
    return this.send<T>(HttpMethod.GET);
  }

  async post<T = TContext extends { response: infer R } ? R : unknown>(
    body?: TContext extends { request: infer B } ? B : unknown
  ): Promise<T> {
    const parsedBody =
      body && this.config.requestSchema ?
        this.config.requestSchema.parse(body)
      : body;
    return this.send<T>(HttpMethod.POST, parsedBody);
  }

  async put<T = TContext extends { response: infer R } ? R : unknown>(
    body?: TContext extends { request: infer B } ? B : unknown
  ): Promise<T> {
    const parsedBody =
      body && this.config.requestSchema ?
        this.config.requestSchema.parse(body)
      : body;
    return this.send<T>(HttpMethod.PUT, parsedBody);
  }

  async patch<T = TContext extends { response: infer R } ? R : unknown>(
    body?: TContext extends { request: infer B } ? B : unknown
  ): Promise<T> {
    const parsedBody =
      body && this.config.requestSchema ?
        this.config.requestSchema.parse(body)
      : body;
    return this.send<T>(HttpMethod.PATCH, parsedBody);
  }

  async delete<
    T = TContext extends { response: infer R } ? R : unknown
  >(): Promise<T> {
    return this.send<T>(HttpMethod.DELETE);
  }

  private buildUrl(): string {
    let url = this.config.basePath || "";

    if (this.config.pathParams) {
      // ENCODING: Path parameters are encoded here and ONLY here
      Object.entries(this.config.pathParams).forEach(([key, value]) => {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      });
    }

    if (
      this.config.queryParams
      && Object.keys(this.config.queryParams).length > 0
    ) {
      const params = new URLSearchParams();
      Object.entries(this.config.queryParams).forEach(([key, value]) => {
        params.append(key, String(value));
      });
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
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i) * 1000)
          );
        }
      }
    }

    throw lastError;
  }

  private send<T>(method: HttpMethod, body?: unknown): Promise<T> {
    const url = this.buildUrl();
    const options = this.buildOptions();
    return this.executeWithRetry(() =>
      this.client.request(
        url,
        (this.config.responseSchema ?? z.unknown()) as z.ZodSchema<T>,
        {
          ...options,
          method,
          body: body !== undefined ? JSON.stringify(body) : undefined
        }
      )
    );
  }
}
