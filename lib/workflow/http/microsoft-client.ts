import { z } from "zod";

import { ApiEndpoint } from "@/constants";

import { ServicePrincipalIdSchema } from "../types/api-schemas";
import type  { HttpClient } from "../types/http-client";
import { createCrudMethods, empty } from './crud-factory';
import type { CrudSchemas } from './crud-factory';
import { ResourceBuilder } from "./fluent-builder";

const appGetSchema = z.object({
  appId: z.string(),
  displayName: z.string(),
  id: z.string(),
  identifierUris: z.array(z.string()).optional(),
  web: z
    .object({ redirectUris: z.array(z.string()).optional() })
    .nullable()
    .optional(),
});
const appListSchema = z.object({
  value: z.array(
    z.object({ appId: z.string(), displayName: z.string(), id: z.string() })
  ),
});
const appCreateSchema = empty;
const appResponseSchema = z.object({
  appId: z.string().optional(),
  displayName: z.string().optional(),
  id: z.string().optional(),
  identifierUris: z.array(z.string()).optional(),
  web: z.object({ redirectUris: z.array(z.string()).optional() }).optional(),
});
const appUpdateSchema = z
  .object({
    identifierUris: z.array(z.string()).optional(),
    web: z.object({ redirectUris: z.array(z.string()).optional() }).optional(),
  })
  .passthrough();

const appSchemas = {
  create: appCreateSchema,
  flatten: "value",
  flattenResponse: appListSchema,
  get: appGetSchema,
  list: appListSchema,
  response: appResponseSchema,
  update: appUpdateSchema,
} satisfies CrudSchemas<
  z.infer<typeof appGetSchema>,
  z.infer<typeof appListSchema>,
  z.infer<typeof appCreateSchema>,
  z.infer<typeof appResponseSchema>,
  z.infer<typeof appUpdateSchema>,
  z.infer<typeof appListSchema>
>;

const spGetSchema = z.object({
  appId: z.string(),
  displayName: z.string(),
  id: z.string(),
  preferredSingleSignOnMode: z.string().nullable(),
  samlSingleSignOnSettings: z
    .object({ relayState: z.string().nullable() })
    .nullable(),
});
const spListSchema = ServicePrincipalIdSchema;
const spCreateSchema = empty;
const spResponseSchema = z.object({
  appId: z.string().optional(),
  displayName: z.string().optional(),
  id: z.string().optional(),
  preferredSingleSignOnMode: z.string().nullable().optional(),
  samlSingleSignOnSettings: z
    .object({ relayState: z.string().nullable() })
    .nullable()
    .optional(),
});
const spUpdateSchema = z
  .object({
    preferredSingleSignOnMode: z.string().nullable().optional(),
    samlSingleSignOnSettings: z
      .object({ relayState: z.string().nullable() })
      .nullable()
      .optional(),
  })
  .passthrough();

const spSchemas = {
  create: spCreateSchema,
  flatten: "value",
  flattenResponse: spListSchema,
  get: spGetSchema,
  list: spListSchema,
  response: spResponseSchema,
  update: spUpdateSchema,
} satisfies CrudSchemas<
  z.infer<typeof spGetSchema>,
  z.infer<typeof spListSchema>,
  z.infer<typeof spCreateSchema>,
  z.infer<typeof spResponseSchema>,
  z.infer<typeof spUpdateSchema>,
  z.infer<typeof spListSchema>
>;

const claimsGetSchema = empty;
const claimsListSchema = z.object({
  value: z.array(
    z.object({ displayName: z.string().optional(), id: z.string() })
  ),
});
const claimsCreateSchema = z.object({
  definition: z.array(z.string()),
  displayName: z.string(),
  isOrganizationDefault: z.boolean(),
});
const claimsResponseSchema = z.object({ id: z.string() });

const claimsSchemas = {
  create: claimsCreateSchema,
  flatten: "value",
  flattenResponse: claimsListSchema,
  get: claimsGetSchema,
  list: claimsListSchema,
  response: claimsResponseSchema,
  update: empty,
} satisfies CrudSchemas<
  z.infer<typeof claimsGetSchema>,
  z.infer<typeof claimsListSchema>,
  z.infer<typeof claimsCreateSchema>,
  z.infer<typeof claimsResponseSchema>,
  z.infer<typeof empty>,
  z.infer<typeof claimsListSchema>
>;

const syncTemplateSchema = z.object({
  value: z.array(z.object({ factoryTag: z.string(), id: z.string() })),
});
const jobItemSchema = z.object({
  id: z.string(),
  status: z.object({ code: z.string() }).optional(),
  templateId: z.string(),
});
const syncJobSchema = z.object({
  id: z.string().optional(),
  status: z.object({ code: z.string() }).optional(),
  templateId: z.string().optional(),
  value: z.array(jobItemSchema).optional(),
});

/**
 * Fluent client for Microsoft Graph workflow APIs.
 */
export class MicrosoftClient {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }
  private builder() {
    return new ResourceBuilder(this.client, {});
  }

  get applications() {
    return {
      ...createCrudMethods(
        this.client,
        ApiEndpoint.Microsoft.Applications,
        appSchemas
      ),
      instantiate: (templateId: string) =>
        this.builder()
          .path(ApiEndpoint.Microsoft.Templates(templateId))
          .sends(z.object({ displayName: z.string() }))
          .accepts(
            z.object({
              application: z.object({ appId: z.string(), id: z.string() }),
              servicePrincipal: z.object({ id: z.string() }),
            })
          ),
    };
  }

  get servicePrincipals() {
    const base = createCrudMethods(
      this.client,
      ApiEndpoint.Microsoft.ServicePrincipals,
      spSchemas
    );
    return {
      ...base,
      getPartial: (spId: string) =>
        this.builder()
          .path(`${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`)
          .accepts(
            z
              .object({
                appId: z.string().optional(),
                displayName: z.string().optional(),
                id: z.string().optional(),
                preferredSingleSignOnMode: z.string().nullable().optional(),
                samlSingleSignOnSettings: z
                  .object({ relayState: z.string().nullable() })
                  .nullable()
                  .optional(),
              })
              .passthrough()
          ),
      addTokenSigningCertificate: (spId: string) =>
        this.builder()
          .path(ApiEndpoint.Microsoft.AddTokenSigningCertificate(spId))
          .sends(z.object({ displayName: z.string(), endDateTime: z.string() }))
          .accepts(
            z.object({
              endDateTime: z.string(),
              key: z.string().optional(),
              keyId: z.string(),
              startDateTime: z.string(),
              type: z.string(),
              usage: z.string(),
            })
          ),
      tokenSigningCertificates: (spId: string) => ({
        delete: (certId: string) =>
          this.builder()
            .path(
              `${ApiEndpoint.Microsoft.TokenSigningCertificates(spId)}/${certId}`
            )
            .accepts(empty),
        list: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.TokenSigningCertificates(spId))
            .accepts(
              z.object({
                value: z.array(
                  z.object({
                    endDateTime: z.string(),
                    key: z.string().nullable().optional(),
                    keyId: z.string(),
                    startDateTime: z.string(),
                  })
                ),
              })
            ),
      }),
      claimsMappingPolicies: (spId: string) => ({
        assign: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.AssignClaimsPolicy(spId))
            .sends(z.object({ "@odata.id": z.string() }))
            .accepts(empty),
        list: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.ReadClaimsPolicy(spId))
            .accepts(
              z.object({ value: z.array(z.object({ id: z.string() })) })
            ),
        unassign: (policyId: string) =>
          this.builder()
            .path(ApiEndpoint.Microsoft.UnassignClaimsPolicy(spId, policyId))
            .accepts(empty),
      }),
    };
  }

  get claimsPolicies() {
    return createCrudMethods(
      this.client,
      ApiEndpoint.Microsoft.ClaimsPolicies,
      claimsSchemas
    );
  }

  get synchronization() {
    return {
      jobs: (spId: string) => ({
        create: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.SyncJobs(spId))
            .sends(z.object({ templateId: z.string() }))
            .accepts(syncJobSchema),
        delete: (jobId: string) =>
          this.builder()
            .path(`${ApiEndpoint.Microsoft.SyncJobs(spId)}/${jobId}`)
            .accepts(empty),
        list: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.SyncJobs(spId))
            .accepts(syncJobSchema)
            .flatten("value"),
        start: (jobId: string) =>
          this.builder()
            .path(ApiEndpoint.Microsoft.StartSync(spId, jobId))
            .accepts(empty),
      }),
      secrets: (spId: string) =>
        this.builder()
          .path(ApiEndpoint.Microsoft.SyncSecrets(spId))
          .sends(
            z.object({
              value: z.array(z.object({ key: z.string(), value: z.string() })),
            })
          )
          .accepts(empty),
      templates: (spId: string) =>
        this.builder()
          .path(ApiEndpoint.Microsoft.SyncTemplates(spId))
          .accepts(syncTemplateSchema)
          .flatten("value"),
    };
  }

  get organization() {
    return this.builder()
      .path(ApiEndpoint.Microsoft.Organization)
      .accepts(ServicePrincipalIdSchema);
  }
}
