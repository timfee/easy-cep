import { ApiEndpoint } from "@/constants";
import { z } from "zod";
import type { AdminPrivilege } from "../constants/google-admin";
import { GoogleOperationSchema } from "../types/api-schemas";
import type { HttpClient } from "../types/http-client";
import { createCrudMethods, CrudSchemas, empty } from "./crud-factory";
import { ResourceBuilder } from "./fluent-builder";

const userGetSchema = z
  .object({
    id: z.string().optional(),
    primaryEmail: z.string().optional(),
    orgUnitPath: z.string().optional()
  })
  .passthrough();
const userListSchema = z.object({
  users: z
    .array(z.object({ id: z.string(), primaryEmail: z.string() }))
    .optional()
});
const userCreateSchema = z.object({
  primaryEmail: z.string(),
  name: z.object({ givenName: z.string(), familyName: z.string() }),
  password: z.string(),
  orgUnitPath: z.string()
});
const userResponseSchema = z.object({
  id: z.string(),
  primaryEmail: z.string()
});
const userUpdateSchema = z.object({ password: z.string() });

const userSchemas = {
  get: userGetSchema,
  list: userListSchema,
  flatten: "users",
  create: userCreateSchema,
  response: userResponseSchema,
  update: userUpdateSchema
} satisfies CrudSchemas<
  z.infer<typeof userGetSchema>,
  z.infer<typeof userListSchema>,
  z.infer<typeof userCreateSchema>,
  z.infer<typeof userResponseSchema>,
  z.infer<typeof userUpdateSchema>
>;
const ouGetSchema = z.object({ orgUnitPath: z.string(), name: z.string() });
const ouListSchema = z.object({
  organizationUnits: z
    .array(
      z.object({
        orgUnitId: z.string(),
        parentOrgUnitId: z.string().optional(),
        orgUnitPath: z.string()
      })
    )
    .optional()
});
const ouCreateSchema = z.object({
  name: z.string(),
  parentOrgUnitPath: z.string()
});
const ouResponseSchema = z.object({
  orgUnitPath: z.string(),
  name: z.string(),
  parentOrgUnitId: z.string()
});

const ouSchemas = {
  get: ouGetSchema,
  list: ouListSchema,
  flatten: "organizationUnits",
  create: ouCreateSchema,
  response: ouResponseSchema,
  update: empty
} satisfies CrudSchemas<
  z.infer<typeof ouGetSchema>,
  z.infer<typeof ouListSchema>,
  z.infer<typeof ouCreateSchema>,
  z.infer<typeof ouResponseSchema>,
  z.infer<typeof empty>
>;
const roleGetSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  rolePrivileges: z.array(
    z.object({ serviceId: z.string(), privilegeName: z.string() })
  )
});
const roleListSchema = z.object({
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
});
const roleCreateSchema = z.object({
  roleName: z.string(),
  roleDescription: z.string(),
  rolePrivileges: z.array(
    z.object({ serviceId: z.string(), privilegeName: z.string() })
  )
});
const roleResponseSchema = z.object({ roleId: z.string() });

const roleSchemas = {
  get: roleGetSchema,
  list: roleListSchema,
  flatten: true,
  create: roleCreateSchema,
  response: roleResponseSchema,
  update: empty
} satisfies CrudSchemas<
  z.infer<typeof roleGetSchema>,
  z.infer<typeof roleListSchema>,
  z.infer<typeof roleCreateSchema>,
  z.infer<typeof roleResponseSchema>,
  z.infer<typeof empty>
>;
const assignmentGetSchema = empty;
const assignmentListSchema = z.object({
  items: z
    .array(
      z.object({
        roleAssignmentId: z.string(),
        roleId: z.string(),
        assignedTo: z.string()
      })
    )
    .optional()
});
const assignmentCreateSchema = z.object({
  roleId: z.string(),
  assignedTo: z.string(),
  scopeType: z.string()
});
const assignmentResponseSchema = z.object({ kind: z.string().optional() });

const assignmentSchemas = {
  get: assignmentGetSchema,
  list: assignmentListSchema,
  flatten: false,
  create: assignmentCreateSchema,
  response: assignmentResponseSchema,
  update: empty
} satisfies CrudSchemas<
  z.infer<typeof assignmentGetSchema>,
  z.infer<typeof assignmentListSchema>,
  z.infer<typeof assignmentCreateSchema>,
  z.infer<typeof assignmentResponseSchema>,
  z.infer<typeof empty>
>;
const samlGetSchema = z.object({
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
});
const samlListSchema = z.object({
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
});
const samlCreateSchema = z.object({
  displayName: z.string(),
  idpConfig: z.object({
    entityId: z.string(),
    singleSignOnServiceUri: z.string()
  })
});
const samlResponseSchema = GoogleOperationSchema.extend({
  response: z.object({ name: z.string() }).optional()
});

const samlSchemas = {
  get: samlGetSchema,
  list: samlListSchema,
  flatten: "inboundSamlSsoProfiles",
  create: samlCreateSchema,
  response: samlResponseSchema,
  update: empty
} satisfies CrudSchemas<
  z.infer<typeof samlGetSchema>,
  z.infer<typeof samlListSchema>,
  z.infer<typeof samlCreateSchema>,
  z.infer<typeof samlResponseSchema>,
  z.infer<typeof empty>
>;
const ssoGetSchema = empty;
const ssoListSchema = z.object({
  inboundSsoAssignments: z
    .array(
      z.object({
        name: z.string(),
        targetGroup: z.string().optional(),
        targetOrgUnit: z.string().optional(),
        ssoMode: z.string().optional(),
        samlSsoInfo: z.object({ inboundSamlSsoProfile: z.string() }).optional()
      })
    )
    .optional()
});
const ssoCreateSchema = z.object({
  targetGroup: z.string().optional(),
  targetOrgUnit: z.string().optional(),
  samlSsoInfo: z.object({ inboundSamlSsoProfile: z.string() }).optional(),
  ssoMode: z.string()
});

const ssoSchemas = {
  get: ssoGetSchema,
  list: ssoListSchema,
  flatten: "inboundSsoAssignments",
  create: ssoCreateSchema,
  response: GoogleOperationSchema,
  update: empty
} satisfies CrudSchemas<
  z.infer<typeof ssoGetSchema>,
  z.infer<typeof ssoListSchema>,
  z.infer<typeof ssoCreateSchema>,
  z.infer<typeof GoogleOperationSchema>,
  z.infer<typeof empty>
>;
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
    const base = createCrudMethods(
      this.client,
      ApiEndpoint.Google.Roles,
      roleSchemas
    );
    const privilegeSchema: z.ZodType<AdminPrivilege> = z.lazy(() =>
      z.object({
        serviceId: z.string(),
        privilegeName: z.string(),
        childPrivileges: z.array(privilegeSchema).optional()
      })
    );
    return {
      ...base,
      privileges: () =>
        this.builder()
          .path(ApiEndpoint.Google.RolePrivileges)
          .accepts(z.object({ items: z.array(privilegeSchema) }))
          .flatten("items")
    };
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
      createForCustomer: () =>
        this.builder()
          .path(ApiEndpoint.Google.SsoProfilesCustomer)
          .sends(samlSchemas.create)
          .accepts(samlSchemas.response),
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
