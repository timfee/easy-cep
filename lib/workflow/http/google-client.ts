import { ApiEndpoint } from "@/constants";
import { z } from "zod";
import { GoogleOperationSchema } from "../types/api-schemas";
import type { HttpClient } from "../types/http-client";
import { createCrudMethods, CrudSchemas, empty } from "./crud-factory";
import { ResourceBuilder } from "./fluent-builder";
const userSchemas: CrudSchemas = {
  get: z
    .object({
      id: z.string().optional(),
      primaryEmail: z.string().optional(),
      orgUnitPath: z.string().optional()
    })
    .passthrough(),
  list: z.object({
    users: z
      .array(z.object({ id: z.string(), primaryEmail: z.string() }))
      .optional()
  }),
  flatten: "users",
  create: z.object({
    primaryEmail: z.string(),
    name: z.object({ givenName: z.string(), familyName: z.string() }),
    password: z.string(),
    orgUnitPath: z.string()
  }),
  response: z.object({ id: z.string(), primaryEmail: z.string() }),
  update: z.object({ password: z.string() })
};
const ouSchemas: CrudSchemas = {
  get: z.object({ orgUnitPath: z.string(), name: z.string() }),
  list: z.object({
    organizationUnits: z
      .array(
        z.object({
          orgUnitId: z.string(),
          parentOrgUnitId: z.string().optional(),
          orgUnitPath: z.string()
        })
      )
      .optional()
  }),
  flatten: "organizationUnits",
  create: z.object({ name: z.string(), parentOrgUnitPath: z.string() }),
  response: z.object({
    orgUnitPath: z.string(),
    name: z.string(),
    parentOrgUnitId: z.string()
  }),
  update: empty
};
const roleSchemas: CrudSchemas = {
  get: z.object({
    roleId: z.string(),
    roleName: z.string(),
    rolePrivileges: z.array(
      z.object({ serviceId: z.string(), privilegeName: z.string() })
    )
  }),
  list: z.object({
    items: z
      .array(
        z.object({
          roleId: z.string(),
          roleName: z.string(),
          rolePrivileges: z.array(
            z.object({ serviceId: z.string(), privilegeName: z.string() })
          )
        })
      )
      .optional()
  }),
  flatten: true,
  create: z.object({
    roleName: z.string(),
    roleDescription: z.string(),
    rolePrivileges: z.array(
      z.object({ serviceId: z.string(), privilegeName: z.string() })
    )
  }),
  response: z.object({ roleId: z.string() }),
  update: empty
};
const assignmentSchemas: CrudSchemas = {
  get: empty,
  list: z.object({
    items: z
      .array(
        z.object({
          roleAssignmentId: z.string(),
          roleId: z.string(),
          assignedTo: z.string()
        })
      )
      .optional()
  }),
  flatten: false,
  create: z.object({
    roleId: z.string(),
    assignedTo: z.string(),
    scopeType: z.string()
  }),
  response: z.object({ kind: z.string().optional() }),
  update: empty
};
const samlSchemas: CrudSchemas = {
  get: z.object({
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
  }),
  list: z.object({
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
  }),
  flatten: "inboundSamlSsoProfiles",
  create: z.object({
    displayName: z.string(),
    idpConfig: z.object({
      entityId: z.string(),
      singleSignOnServiceUri: z.string()
    })
  }),
  response: GoogleOperationSchema.extend({
    response: z.object({ name: z.string() }).optional()
  }),
  update: empty
};
const ssoSchemas: CrudSchemas = {
  get: empty,
  list: z.object({
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
  }),
  flatten: "inboundSsoAssignments",
  create: z.object({
    targetGroup: z.string().optional(),
    targetOrgUnit: z.string().optional(),
    samlSsoInfo: z.object({ inboundSamlSsoProfile: z.string() }).optional(),
    ssoMode: z.string()
  }),
  response: GoogleOperationSchema,
  update: empty
};
export class GoogleClient {
  constructor(private client: HttpClient) {}
  private builder() {
    return new ResourceBuilder(this.client, {});
  }
  get domains() {
    return this.builder()
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
  get users() {
    return createCrudMethods(
      this.client,
      ApiEndpoint.Google.Users,
      userSchemas
    );
  }
  get orgUnits() {
    return createCrudMethods(
      this.client,
      ApiEndpoint.Google.OrgUnits,
      ouSchemas
    );
  }
  get roles() {
    return createCrudMethods(
      this.client,
      ApiEndpoint.Google.Roles,
      roleSchemas
    );
  }
  get roleAssignments() {
    return createCrudMethods(
      this.client,
      ApiEndpoint.Google.RoleAssignments,
      assignmentSchemas
    );
  }
  get samlProfiles() {
    return {
      ...createCrudMethods(
        this.client,
        ApiEndpoint.Google.SsoProfiles,
        samlSchemas
      ),
      credentials: (profileId: string) => ({
        add: () =>
          this.builder()
            .path(ApiEndpoint.Google.SamlProfileCredentials(profileId))
            .sends(z.object({ pemData: z.string() }))
            .accepts(GoogleOperationSchema),
        list: () =>
          this.builder()
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
          this.builder()
            .path(
              `${ApiEndpoint.Google.SamlProfileCredentialsList(profileId)}/${credentialId}`
            )
            .accepts(empty)
      })
    };
  }
  get ssoAssignments() {
    return createCrudMethods(
      this.client,
      ApiEndpoint.Google.SsoAssignments,
      ssoSchemas
    );
  }
  get siteVerification() {
    return {
      getToken: () =>
        this.builder()
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
        this.builder()
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
