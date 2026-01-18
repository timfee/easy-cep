import { z } from "zod";
import { ApiEndpoint } from "@/constants";
import { ServicePrincipalIdSchema } from "../types/api-schemas";
import type { HttpClient } from "../types/http-client";
import { type CrudSchemas, createCrudMethods, empty } from "./crud-factory";
import { ResourceBuilder } from "./fluent-builder";

const appGetSchema = z.object({
  id: z.string(),
  appId: z.string(),
  displayName: z.string(),
});
const appListSchema = z.object({
  value: z.array(
    z.object({ id: z.string(), appId: z.string(), displayName: z.string() })
  ),
});
const appCreateSchema = empty;
const appResponseSchema = z.object({
  id: z.string().optional(),
  appId: z.string().optional(),
  displayName: z.string().optional(),
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
  get: appGetSchema,
  list: appListSchema,
  flatten: "value",
  flattenResponse: appListSchema,
  create: appCreateSchema,
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
  id: z.string(),
  appId: z.string(),
  displayName: z.string(),
  preferredSingleSignOnMode: z.string().nullable(),
  samlSingleSignOnSettings: z
    .object({ relayState: z.string().nullable() })
    .nullable(),
});
const spListSchema = ServicePrincipalIdSchema;
const spCreateSchema = empty;
const spResponseSchema = z.object({
  id: z.string().optional(),
  appId: z.string().optional(),
  displayName: z.string().optional(),
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
  get: spGetSchema,
  list: spListSchema,
  flatten: "value",
  flattenResponse: spListSchema,
  create: spCreateSchema,
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
    z.object({ id: z.string(), displayName: z.string().optional() })
  ),
});
const claimsCreateSchema = z.object({
  definition: z.array(z.string()),
  displayName: z.string(),
  isOrganizationDefault: z.boolean(),
});
const claimsResponseSchema = z.object({ id: z.string() });

const claimsSchemas = {
  get: claimsGetSchema,
  list: claimsListSchema,
  flatten: "value",
  flattenResponse: claimsListSchema,
  create: claimsCreateSchema,
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
  value: z.array(z.object({ id: z.string(), factoryTag: z.string() })),
});
const jobItemSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  status: z.object({ code: z.string() }).optional(),
});
const syncJobSchema = z.object({
  id: z.string().optional(),
  templateId: z.string().optional(),
  status: z.object({ code: z.string() }).optional(),
  value: z.array(jobItemSchema).optional(),
});

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
              servicePrincipal: z.object({ id: z.string() }),
              application: z.object({ id: z.string(), appId: z.string() }),
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
                id: z.string().optional(),
                appId: z.string().optional(),
                displayName: z.string().optional(),
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
              keyId: z.string(),
              type: z.string(),
              usage: z.string(),
              key: z.string().optional(),
              startDateTime: z.string(),
              endDateTime: z.string(),
            })
          ),
      tokenSigningCertificates: (spId: string) => ({
        list: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.TokenSigningCertificates(spId))
            .accepts(
              z.object({
                value: z.array(
                  z.object({
                    keyId: z.string(),
                    key: z.string().nullable().optional(),
                    startDateTime: z.string(),
                    endDateTime: z.string(),
                  })
                ),
              })
            ),
        delete: (certId: string) =>
          this.builder()
            .path(
              `${ApiEndpoint.Microsoft.TokenSigningCertificates(spId)}/${certId}`
            )
            .accepts(empty),
      }),
      claimsMappingPolicies: (spId: string) => ({
        list: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.ReadClaimsPolicy(spId))
            .accepts(
              z.object({ value: z.array(z.object({ id: z.string() })) })
            ),
        assign: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.AssignClaimsPolicy(spId))
            .sends(z.object({ "@odata.id": z.string() }))
            .accepts(empty),
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
      templates: (spId: string) =>
        this.builder()
          .path(ApiEndpoint.Microsoft.SyncTemplates(spId))
          .accepts(syncTemplateSchema)
          .flatten("value"),
      jobs: (spId: string) => ({
        list: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.SyncJobs(spId))
            .accepts(syncJobSchema)
            .flatten("value"),
        create: () =>
          this.builder()
            .path(ApiEndpoint.Microsoft.SyncJobs(spId))
            .sends(z.object({ templateId: z.string() }))
            .accepts(syncJobSchema),
        delete: (jobId: string) =>
          this.builder()
            .path(`${ApiEndpoint.Microsoft.SyncJobs(spId)}/${jobId}`)
            .accepts(empty),
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
    };
  }

  get organization() {
    return this.builder()
      .path(ApiEndpoint.Microsoft.Organization)
      .accepts(ServicePrincipalIdSchema);
  }
}
