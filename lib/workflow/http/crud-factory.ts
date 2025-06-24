import { z } from "zod";
import type { HttpClient } from "../types/http-client";
import { ResourceBuilder } from "./fluent-builder";

export const empty = z.object({});

export interface CrudSchemas<
  G = unknown,
  L = unknown,
  C = unknown,
  R = unknown,
  U = unknown
> {
  get: z.ZodSchema<G>;
  list: z.ZodSchema<L>;
  flatten?: string | boolean;
  create: z.ZodSchema<C>;
  response: z.ZodSchema<R>;
  update: z.ZodSchema<U>;
}

export function createCrudMethods<G, L, C, R, U>(
  client: HttpClient,
  basePath: string,
  schemas: CrudSchemas<G, L, C, R, U>
) {
  return {
    get: (id: string) =>
      new ResourceBuilder(client, {})
        .path(`${basePath}/${id}`)
        .accepts(schemas.get),
    list: () => {
      let builder = new ResourceBuilder(client, {})
        .path(basePath)
        .accepts(schemas.list);
      if (schemas.flatten !== undefined) {
        builder = builder.flatten(schemas.flatten);
      }
      return builder;
    },
    create: () =>
      new ResourceBuilder(client, {})
        .path(basePath)
        .sends(schemas.create)
        .accepts(schemas.response),
    delete: (id: string) =>
      new ResourceBuilder(client, {}).path(`${basePath}/${id}`).accepts(empty),
    update: (id: string) =>
      new ResourceBuilder(client, {})
        .path(`${basePath}/${id}`)
        .sends(schemas.update)
        .accepts(schemas.response)
  };
}
