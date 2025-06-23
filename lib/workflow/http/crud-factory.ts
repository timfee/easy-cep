import { z } from "zod";
import type { HttpClient } from "../types/http-client";
import { ResourceBuilder } from "./fluent-builder";

export const empty = z.object({});

export interface CrudSchemas {
  get: z.ZodSchema<unknown>;
  list: z.ZodSchema<unknown>;
  flatten?: string | boolean;
  create: z.ZodSchema<unknown>;
  response: z.ZodSchema<unknown>;
  update: z.ZodSchema<unknown>;
}

export function createCrudMethods(
  client: HttpClient,
  basePath: string,
  schemas: CrudSchemas
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
  };
}
