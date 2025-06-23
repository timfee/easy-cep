import { ApiEndpoint } from "@/constants";
import { z } from "zod";
import { ServicePrincipalIdSchema } from "../types/api-schemas";
import type { HttpClient } from "../types/http-client";
import { ResourceBuilder } from "./fluent-builder";

export class MicrosoftClient {
  constructor(private baseClient: HttpClient) {}

  // Applications
  get applications() {
    const client = this.baseClient;
    return {
      get: (appId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.Applications}/${appId}`)
          .accepts(
            z.object({
              id: z.string(),
              appId: z.string(),
              displayName: z.string()
            })
          ),

      delete: (appId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.Applications}/${appId}`)
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.Applications)
          .accepts(
            z.object({
              value: z.array(
                z.object({
                  id: z.string(),
                  appId: z.string(),
                  displayName: z.string()
                })
              )
            })
          )
          .flatten("value"),

      update: (appId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.Applications}/${appId}`)
          .accepts(z.object({})),

      instantiate: (templateId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.Templates(templateId))
          .sends(z.object({ displayName: z.string() }))
          .accepts(
            z.object({
              servicePrincipal: z.object({ id: z.string() }),
              application: z.object({ id: z.string(), appId: z.string() })
            })
          )
    };
  }

  // Service Principals
  get servicePrincipals() {
    const client = this.baseClient;
    return {
      get: (spId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`)
          .accepts(
            z.object({
              id: z.string(),
              appId: z.string(),
              displayName: z.string(),
              preferredSingleSignOnMode: z.string().nullable(),
              samlSingleSignOnSettings: z
                .object({ relayState: z.string().nullable() })
                .nullable()
            })
          ),

      update: (spId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`)
          .accepts(z.object({})),

      delete: (spId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`)
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.ServicePrincipals)
          .accepts(ServicePrincipalIdSchema)
          .flatten("value"),

      addTokenSigningCertificate: (spId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.AddTokenSigningCertificate(spId))
          .sends(z.object({ displayName: z.string(), endDateTime: z.string() }))
          .accepts(
            z.object({
              keyId: z.string(),
              type: z.string(),
              usage: z.string(),
              key: z.string().nullable()
            })
          ),

      tokenSigningCertificates: (spId: string) => ({
        list: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.TokenSigningCertificates(spId))
            .accepts(
              z.object({
                value: z.array(
                  z.object({
                    keyId: z.string(),
                    startDateTime: z.string(),
                    endDateTime: z.string(),
                    key: z.string().nullable()
                  })
                )
              })
            ),

        delete: (certId: string) =>
          new ResourceBuilder(client, {})
            .path(
              `${ApiEndpoint.Microsoft.TokenSigningCertificates(spId)}/${certId}`
            )
            .accepts(z.object({}))
      }),

      claimsMappingPolicies: (spId: string) => ({
        list: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.ReadClaimsPolicy(spId))
            .accepts(ServicePrincipalIdSchema)
            .flatten("value"),

        assign: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.AssignClaimsPolicy(spId))
            .sends(z.object({ "@odata.id": z.string() }))
            .accepts(z.object({})),

        unassign: (policyId: string) =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.UnassignClaimsPolicy(spId, policyId))
            .accepts(z.object({}))
      })
    };
  }

  // Synchronization
  get synchronization() {
    const client = this.baseClient;
    return {
      templates: (spId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.SyncTemplates(spId))
          .accepts(
            z.object({
              value: z.array(
                z.object({ id: z.string(), factoryTag: z.string() })
              )
            })
          )
          .flatten("value"),

      jobs: (spId: string) => ({
        list: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.SyncJobs(spId))
            .accepts(
              z.object({
                value: z.array(
                  z.object({
                    id: z.string(),
                    templateId: z.string(),
                    status: z.object({ code: z.string() }).optional()
                  })
                )
              })
            )
            .flatten("value"),

        create: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.SyncJobs(spId))
            .sends(z.object({ templateId: z.string() }))
            .accepts(
              z.object({
                id: z.string(),
                templateId: z.string(),
                status: z.object({ code: z.string() }).optional()
              })
            ),

        delete: (jobId: string) =>
          new ResourceBuilder(client, {})
            .path(`${ApiEndpoint.Microsoft.SyncJobs(spId)}/${jobId}`)
            .accepts(z.object({})),

        start: (jobId: string) =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Microsoft.StartSync(spId, jobId))
            .accepts(z.object({}))
      }),

      secrets: (spId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.SyncSecrets(spId))
          .sends(
            z.object({
              value: z.array(z.object({ key: z.string(), value: z.string() }))
            })
          )
          .accepts(z.object({}))
    };
  }

  // Claims Policies
  get claimsPolicies() {
    const client = this.baseClient;
    return {
      create: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.ClaimsPolicies)
          .sends(
            z.object({
              definition: z.array(z.string()),
              displayName: z.string(),
              isOrganizationDefault: z.boolean()
            })
          )
          .accepts(z.object({ id: z.string() })),

      delete: (policyId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Microsoft.ClaimsPolicies}/${policyId}`)
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Microsoft.ClaimsPolicies)
          .accepts(
            z.object({
              value: z.array(
                z.object({ id: z.string(), displayName: z.string().optional() })
              )
            })
          )
          .flatten("value")
    };
  }

  // Organization
  get organization() {
    return new ResourceBuilder(this.baseClient, {})
      .path(ApiEndpoint.Microsoft.Organization)
      .accepts(ServicePrincipalIdSchema);
  }
}
