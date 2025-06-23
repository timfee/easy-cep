import { ApiEndpoint } from "@/constants";
import { z } from "zod";
import { GoogleOperationSchema } from "../types/api-schemas";
import type { HttpClient } from "../types/http-client";
import { ResourceBuilder } from "./fluent-builder";

export class GoogleClient {
  constructor(private baseClient: HttpClient) {}

  // Domains
  get domains() {
    return new ResourceBuilder(this.baseClient, {})
      .path(ApiEndpoint.Google.Domains)
      .accepts(
        z.object({
          domains: z.array(
            z.object({
              domainName: z.string(),
              isPrimary: z.boolean(),
              verified: z.boolean()
            })
          )
        })
      )
      .flatten("domains");
  }

  // Users
  get users() {
    const client = this.baseClient;
    return {
      get: (email: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.Users}/${encodeURIComponent(email)}`)
          .accepts(
            z
              .object({
                id: z.string().optional(),
                primaryEmail: z.string().optional(),
                orgUnitPath: z.string().optional()
              })
              .passthrough()
          ),

      create: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.Users)
          .sends(
            z.object({
              primaryEmail: z.string(),
              name: z.object({ givenName: z.string(), familyName: z.string() }),
              password: z.string(),
              orgUnitPath: z.string()
            })
          )
          .accepts(z.object({ id: z.string(), primaryEmail: z.string() })),

      update: (userId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.Users}/${userId}`)
          .sends(z.object({ password: z.string() }))
          .accepts(z.object({})),

      delete: (userId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.Users}/${userId}`)
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.Users)
          .accepts(
            z.object({
              users: z
                .array(z.object({ id: z.string(), primaryEmail: z.string() }))
                .optional()
            })
          )
    };
  }

  // Organizational Units
  get orgUnits() {
    const client = this.baseClient;
    return {
      get: (path: string) =>
        new ResourceBuilder(client, {})
          .path(
            `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(path.replace(/^\//, ""))}`
          )
          .accepts(z.object({ orgUnitPath: z.string(), name: z.string() })),

      create: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.OrgUnits)
          .sends(z.object({ name: z.string(), parentOrgUnitPath: z.string() }))
          .accepts(
            z.object({
              orgUnitPath: z.string(),
              name: z.string(),
              parentOrgUnitId: z.string()
            })
          ),

      delete: (path: string) =>
        new ResourceBuilder(client, {})
          .path(
            `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(path.replace(/^\//, ""))}`
          )
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.OrgUnits)
          .accepts(
            z.object({
              organizationUnits: z
                .array(
                  z.object({
                    orgUnitId: z.string(),
                    parentOrgUnitId: z.string().optional(),
                    orgUnitPath: z.string()
                  })
                )
                .optional()
            })
          )
          .flatten("organizationUnits")
    };
  }

  // Roles
  get roles() {
    const client = this.baseClient;
    return {
      get: (roleId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.Roles}/${roleId}`)
          .accepts(
            z.object({
              roleId: z.string(),
              roleName: z.string(),
              rolePrivileges: z.array(
                z.object({ serviceId: z.string(), privilegeName: z.string() })
              )
            })
          ),

      create: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.Roles)
          .sends(
            z.object({
              roleName: z.string(),
              roleDescription: z.string(),
              rolePrivileges: z.array(
                z.object({ serviceId: z.string(), privilegeName: z.string() })
              )
            })
          )
          .accepts(z.object({ roleId: z.string() })),

      delete: (roleId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.Roles}/${roleId}`)
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.Roles)
          .accepts(
            z.object({
              items: z
                .array(
                  z.object({
                    roleId: z.string(),
                    roleName: z.string(),
                    rolePrivileges: z.array(
                      z.object({
                        serviceId: z.string(),
                        privilegeName: z.string()
                      })
                    )
                  })
                )
                .optional()
            })
          )
          .flatten(true),

      privileges: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.RolePrivileges)
          .accepts(
            z.object({
              items: z.array(
                z.lazy(() =>
                  z.object({
                    serviceId: z.string(),
                    privilegeName: z.string(),
                    childPrivileges: z
                      .array(
                        z.lazy(() =>
                          z.object({
                            serviceId: z.string(),
                            privilegeName: z.string(),
                            childPrivileges: z.array(z.any()).optional()
                          })
                        )
                      )
                      .optional()
                  })
                )
              )
            })
          )
    };
  }

  // Role Assignments
  get roleAssignments() {
    const client = this.baseClient;
    return {
      create: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.RoleAssignments)
          .sends(
            z.object({
              roleId: z.string(),
              assignedTo: z.string(),
              scopeType: z.string()
            })
          )
          .accepts(z.object({ kind: z.string().optional() })),

      delete: (assignmentId: string) =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.RoleAssignments}/${assignmentId}`)
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.RoleAssignments)
          .accepts(
            z.object({
              items: z
                .array(
                  z.object({
                    roleAssignmentId: z.string(),
                    roleId: z.string(),
                    assignedTo: z.string()
                  })
                )
                .optional()
            })
          )
    };
  }

  // SAML Profiles
  get samlProfiles() {
    const client = this.baseClient;
    return {
      get: (profileId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.SamlProfile(profileId))
          .accepts(
            z.object({
              name: z.string(),
              idpConfig: z
                .object({
                  entityId: z.string(),
                  singleSignOnServiceUri: z.string(),
                  signOutUri: z.string().optional()
                })
                .optional(),
              spConfig: z.object({
                entityId: z.string(),
                assertionConsumerServiceUri: z.string()
              })
            })
          ),

      create: () =>
        new ResourceBuilder(client, {})
          .path(
            `${ApiEndpoint.Google.SsoProfiles.replace("/inboundSamlSsoProfiles", "/customers/my_customer/inboundSamlSsoProfiles")}`
          )
          .sends(
            z.object({
              displayName: z.string(),
              idpConfig: z.object({
                entityId: z.string(),
                singleSignOnServiceUri: z.string()
              })
            })
          )
          .accepts(
            GoogleOperationSchema.extend({
              response: z.object({ name: z.string() }).optional()
            })
          ),

      update: (profileId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.SamlProfile(profileId))
          .accepts(
            GoogleOperationSchema.extend({ response: z.unknown().optional() })
          ),

      delete: (profileId: string) =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.SamlProfile(profileId))
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.SsoProfiles)
          .accepts(
            z.object({
              inboundSamlSsoProfiles: z
                .array(
                  z.object({
                    name: z.string(),
                    displayName: z.string().optional(),
                    spConfig: z.object({
                      entityId: z.string(),
                      assertionConsumerServiceUri: z.string()
                    })
                  })
                )
                .optional()
            })
          )
          .flatten("inboundSamlSsoProfiles"),

      credentials: (profileId: string) => ({
        add: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Google.SamlProfileCredentials(profileId))
            .sends(z.object({ pemData: z.string() }))
            .accepts(GoogleOperationSchema),

        list: () =>
          new ResourceBuilder(client, {})
            .path(ApiEndpoint.Google.SamlProfileCredentialsList(profileId))
            .accepts(
              z.object({
                idpCredentials: z
                  .array(
                    z.object({
                      name: z.string(),
                      updateTime: z.string().optional()
                    })
                  )
                  .optional()
              })
            )
            .flatten("idpCredentials"),

        delete: (credentialId: string) =>
          new ResourceBuilder(client, {})
            .path(
              `${ApiEndpoint.Google.SamlProfileCredentialsList(profileId)}/${credentialId}`
            )
            .accepts(z.object({}))
      })
    };
  }

  // SSO Assignments
  get ssoAssignments() {
    const client = this.baseClient;
    return {
      create: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.SsoAssignments)
          .sends(
            z.object({
              targetGroup: z.string().optional(),
              targetOrgUnit: z.string().optional(),
              samlSsoInfo: z
                .object({ inboundSamlSsoProfile: z.string() })
                .optional(),
              ssoMode: z.string()
            })
          )
          .accepts(GoogleOperationSchema),

      delete: (assignmentId: string) =>
        new ResourceBuilder(client, {})
          .path(
            `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(assignmentId)}`
          )
          .accepts(z.object({})),

      list: () =>
        new ResourceBuilder(client, {})
          .path(ApiEndpoint.Google.SsoAssignments)
          .accepts(
            z.object({
              inboundSsoAssignments: z
                .array(
                  z.object({
                    name: z.string(),
                    targetGroup: z.string().optional(),
                    targetOrgUnit: z.string().optional(),
                    ssoMode: z.string().optional(),
                    samlSsoInfo: z
                      .object({ inboundSamlSsoProfile: z.string() })
                      .optional()
                  })
                )
                .optional()
            })
          )
          .flatten("inboundSsoAssignments")
    };
  }

  // Site Verification
  get siteVerification() {
    const client = this.baseClient;
    return {
      getToken: () =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.SiteVerification}/token`)
          .sends(
            z.object({
              site: z.object({ type: z.string(), identifier: z.string() }),
              verificationMethod: z.string()
            })
          )
          .accepts(
            z.object({
              method: z.string(),
              type: z.string(),
              site: z.object({ type: z.string(), identifier: z.string() }),
              token: z.string()
            })
          ),

      verify: () =>
        new ResourceBuilder(client, {})
          .path(`${ApiEndpoint.Google.SiteVerification}/webResource`)
          .sends(
            z.object({
              site: z.object({ type: z.string(), identifier: z.string() }),
              verificationMethod: z.string()
            })
          )
          .accepts(
            z.object({
              id: z.string(),
              site: z.object({ type: z.string(), identifier: z.string() })
            })
          )
    };
  }
}
