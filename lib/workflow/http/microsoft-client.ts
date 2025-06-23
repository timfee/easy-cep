import { ApiEndpoint } from "@/constants";
import { z } from "zod";
import { ServicePrincipalIdSchema } from "../types/api-schemas";
import type { HttpClient } from "../types/http-client";
import { createCrudMethods, CrudSchemas, empty } from "./crud-factory";
import { ResourceBuilder } from "./fluent-builder";

const appSchemas: CrudSchemas = {
  get: z.object({ id: z.string(), appId: z.string(), displayName: z.string() }),
  list: z.object({ value: z.array(z.object({ id: z.string(), appId: z.string(), displayName: z.string() })) }),
  flatten: "value",
  create: empty,
  response: z.object({}),
  update: empty
};

const spSchemas: CrudSchemas = {
  get: z.object({ id: z.string(), appId: z.string(), displayName: z.string(), preferredSingleSignOnMode: z.string().nullable(), samlSingleSignOnSettings: z.object({ relayState: z.string().nullable() }).nullable() }),
  list: ServicePrincipalIdSchema,
  flatten: "value",
  create: empty,
  response: z.object({}),
  update: empty
};

const claimsSchemas: CrudSchemas = {
  get: empty,
  list: z.object({ value: z.array(z.object({ id: z.string(), displayName: z.string().optional() })) }),
  flatten: "value",
  create: z.object({ definition: z.array(z.string()), displayName: z.string(), isOrganizationDefault: z.boolean() }),
  response: z.object({ id: z.string() }),
  update: empty
};

const syncTemplateSchema = z.object({ value: z.array(z.object({ id: z.string(), factoryTag: z.string() })) });
const syncJobSchema = z.object({ value: z.array(z.object({ id: z.string(), templateId: z.string(), status: z.object({ code: z.string() }).optional() })) });

export class MicrosoftClient {
  constructor(private client: HttpClient) {}
  private builder() { return new ResourceBuilder(this.client, {}); }

  get applications() {
    return {
      ...createCrudMethods(this.client, ApiEndpoint.Microsoft.Applications, appSchemas),
      instantiate: (templateId: string) => this.builder().path(ApiEndpoint.Microsoft.Templates(templateId)).sends(z.object({ displayName: z.string() })).accepts(z.object({ servicePrincipal: z.object({ id: z.string() }), application: z.object({ id: z.string(), appId: z.string() }) }))
    };
  }

  get servicePrincipals() {
    const base = createCrudMethods(this.client, ApiEndpoint.Microsoft.ServicePrincipals, spSchemas);
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
                  .optional()
              })
              .passthrough()
          ),
      addTokenSigningCertificate: (spId: string) => this.builder().path(ApiEndpoint.Microsoft.AddTokenSigningCertificate(spId)).sends(z.object({ displayName: z.string(), endDateTime: z.string() })).accepts(z.object({ keyId: z.string(), type: z.string(), usage: z.string(), key: z.string().nullable() })),
      tokenSigningCertificates: (spId: string) => ({
        list: () => this.builder().path(ApiEndpoint.Microsoft.TokenSigningCertificates(spId)).accepts(z.object({ value: z.array(z.object({ keyId: z.string(), startDateTime: z.string(), endDateTime: z.string(), key: z.string().nullable() })) })),
        delete: (certId: string) => this.builder().path(`${ApiEndpoint.Microsoft.TokenSigningCertificates(spId)}/${certId}`).accepts(empty)
      }),
      claimsMappingPolicies: (spId: string) => ({
        list: () => this.builder().path(ApiEndpoint.Microsoft.ReadClaimsPolicy(spId)).accepts(ServicePrincipalIdSchema).flatten("value"),
        assign: () => this.builder().path(ApiEndpoint.Microsoft.AssignClaimsPolicy(spId)).sends(z.object({ "@odata.id": z.string() })).accepts(empty),
        unassign: (policyId: string) => this.builder().path(ApiEndpoint.Microsoft.UnassignClaimsPolicy(spId, policyId)).accepts(empty)
      })
    };
  }

  get claimsPolicies() { return createCrudMethods(this.client, ApiEndpoint.Microsoft.ClaimsPolicies, claimsSchemas); }

  get synchronization() {
    return {
      templates: (spId: string) => this.builder().path(ApiEndpoint.Microsoft.SyncTemplates(spId)).accepts(syncTemplateSchema).flatten("value"),
      jobs: (spId: string) => ({
        list: () => this.builder().path(ApiEndpoint.Microsoft.SyncJobs(spId)).accepts(syncJobSchema).flatten("value"),
        create: () => this.builder().path(ApiEndpoint.Microsoft.SyncJobs(spId)).sends(z.object({ templateId: z.string() })).accepts(syncJobSchema),
        delete: (jobId: string) => this.builder().path(`${ApiEndpoint.Microsoft.SyncJobs(spId)}/${jobId}`).accepts(empty),
        start: (jobId: string) => this.builder().path(ApiEndpoint.Microsoft.StartSync(spId, jobId)).accepts(empty)
      }),
      secrets: (spId: string) => this.builder().path(ApiEndpoint.Microsoft.SyncSecrets(spId)).sends(z.object({ value: z.array(z.object({ key: z.string(), value: z.string() })) })).accepts(empty)
    };
  }

  get organization() { return this.builder().path(ApiEndpoint.Microsoft.Organization).accepts(ServicePrincipalIdSchema); }
}
