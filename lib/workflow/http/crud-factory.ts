import { z } from "zod";

import type { HttpClient } from "../types/http-client";

import { normalizePathSegment } from "../core/http";
import { ResourceBuilder } from "./fluent-builder";

/**
 * Default empty response schema.
 */
export const empty = z.object({});

/**
 * Zod schemas for CRUD operations.
 */
export interface CrudSchemas<
  G = unknown,
  L = unknown,
  C = unknown,
  R = unknown,
  U = unknown,
  F = unknown,
> {
  flatten?: string | boolean;
  flattenResponse?: z.ZodSchema<F>;
  get: z.ZodSchema<G>;
  list: z.ZodSchema<L>;
  create: z.ZodSchema<C>;
  response: z.ZodSchema<R>;
  update: z.ZodSchema<U>;
}

/**
 * Create CRUD builders for a base API path.
 */
export function createCrudMethods<G, L, C, R, U, F>(
  client: HttpClient,
  basePath: string,
  schemas: CrudSchemas<G, L, C, R, U, F>
) {
  const buildPath = (id: string) => `${basePath}/${normalizePathSegment(id)}`;

  return {
    create: () =>
      new ResourceBuilder(client, {})
        .path(basePath)
        .sends(schemas.create)
        .accepts(schemas.response),
    delete: (id: string) =>
      new ResourceBuilder(client, {}).path(buildPath(id)).accepts(empty),
    get: (id: string) =>
      new ResourceBuilder(client, {}).path(buildPath(id)).accepts(schemas.get),
    list: () => {
      let builder = new ResourceBuilder(client, {})
        .path(basePath)
        .accepts(schemas.list);
      if (schemas.flattenResponse) {
        builder = builder.accepts(schemas.flattenResponse);
      }
      if (schemas.flatten !== undefined) {
        builder = builder.flatten(schemas.flatten);
      }
      return builder;
    },
    update: (id: string) =>
      new ResourceBuilder(client, {})
        .path(buildPath(id))
        .sends(schemas.update)
        .accepts(schemas.response),
  };
}
