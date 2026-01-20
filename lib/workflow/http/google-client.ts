import { z } from "zod";

import { ApiEndpoint } from "@/constants";

import type  { AdminPrivilege } from "../constants/google-admin";
import { GoogleOperationSchema } from "../types/api-schemas";
import type  { HttpClient } from "../types/http-client";
import { createCrudMethods, empty } from './crud-factory';
import type { CrudSchemas } from './crud-factory';
import { ResourceBuilder } from "./fluent-builder";

const userGetSchema = z
  .object({
    id: z.string().optional(),
    orgUnitPath: z.string().optional(),
    primaryEmail: z.string().optional(),
  })
  .passthrough();
const userListSchema = z.object({
  users: z
    .array(z.object({ id: z.string(), primaryEmail: z.string() }))
    .optional(),
});
const userCreateSchema = z.object({
  name: z.object({ familyName: z.string(), givenName: z.string() }),
  orgUnitPath: z.string(),
  password: z.string(),
  primaryEmail: z.string(),
});
const userResponseSchema = z.object({
  id: z.string(),
  primaryEmail: z.string(),
});
const userUpdateSchema = z.object({ password: z.string() });

const userSchemas = {
  create: userCreateSchema,
  flatten: "users",
  get: userGetSchema,
  list: userListSchema,
  response: userResponseSchema,
  update: userUpdateSchema,
} satisfies CrudSchemas<
  z.infer<typeof userGetSchema>,
  z.infer<typeof userListSchema>,
  z.infer<typeof userCreateSchema>,
  z.infer<typeof userResponseSchema>,
  z.infer<typeof userUpdateSchema>
>;
const ouGetSchema = z.object({
  name: z.string(),
  orgUnitId: z.string().optional(),
  orgUnitPath: z.string(),
});
const ouListSchema = z.object({
  organizationUnits: z
    .array(
      z.object({
        orgUnitId: z.string(),
        orgUnitPath: z.string(),
        parentOrgUnitId: z.string().optional(),
      })
    )
    .optional(),
});
const ouFlattenSchema = z.object({
  organizationUnits: z.array(
    z.object({
      orgUnitId: z.string(),
      orgUnitPath: z.string(),
      parentOrgUnitId: z.string().optional(),
    })
  ),
});
const ouCreateSchema = z.object({
  name: z.string(),
  parentOrgUnitPath: z.string(),
});
const ouResponseSchema = z.object({
  name: z.string(),
  orgUnitPath: z.string(),
  parentOrgUnitId: z.string(),
});

const ouSchemas = {
  create: ouCreateSchema,
  flatten: "organizationUnits",
  flattenResponse: ouFlattenSchema,
  get: ouGetSchema,
  list: ouListSchema,
  response: ouResponseSchema,
  update: empty,
} satisfies CrudSchemas<
  z.infer<typeof ouGetSchema>,
  z.infer<typeof ouListSchema>,
  z.infer<typeof ouCreateSchema>,
  z.infer<typeof ouResponseSchema>,
  z.infer<typeof empty>,
  z.infer<typeof ouFlattenSchema>
>;
const roleGetSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  rolePrivileges: z.array(
    z.object({ privilegeName: z.string(), serviceId: z.string() })
  ),
});
const roleListSchema = z.object({
  items: z
    .array(
      z.object({
        roleId: z.string(),
        roleName: z.string(),
        rolePrivileges: z.array(
          z.object({ privilegeName: z.string(), serviceId: z.string() })
        ),
      })
    )
    .optional(),
});
const roleCreateSchema = z.object({
  roleDescription: z.string(),
  roleName: z.string(),
  rolePrivileges: z.array(
    z.object({ privilegeName: z.string(), serviceId: z.string() })
  ),
});
const roleResponseSchema = z.object({ roleId: z.string() });

const roleSchemas = {
  create: roleCreateSchema,
  flatten: true,
  flattenResponse: roleListSchema,
  get: roleGetSchema,
  list: roleListSchema,
  response: roleResponseSchema,
  update: empty,
} satisfies CrudSchemas<
  z.infer<typeof roleGetSchema>,
  z.infer<typeof roleListSchema>,
  z.infer<typeof roleCreateSchema>,
  z.infer<typeof roleResponseSchema>,
  z.infer<typeof empty>,
  z.infer<typeof roleListSchema>
>;
const assignmentGetSchema = empty;
const assignmentListSchema = z.object({
  items: z
    .array(
      z.object({
        assignedTo: z.string(),
        roleAssignmentId: z.string(),
        roleId: z.string(),
      })
    )
    .optional(),
});
const assignmentCreateSchema = z.object({
  assignedTo: z.string(),
  roleId: z.string(),
  scopeType: z.string(),
});
const assignmentResponseSchema = z.object({ kind: z.string().optional() });

const assignmentSchemas = {
  create: assignmentCreateSchema,
  flatten: false,
  flattenResponse: assignmentListSchema,
  get: assignmentGetSchema,
  list: assignmentListSchema,
  response: assignmentResponseSchema,
  update: empty,
} satisfies CrudSchemas<
  z.infer<typeof assignmentGetSchema>,
  z.infer<typeof assignmentListSchema>,
  z.infer<typeof assignmentCreateSchema>,
  z.infer<typeof assignmentResponseSchema>,
  z.infer<typeof empty>,
  z.infer<typeof assignmentListSchema>
>;
const samlGetSchema = z.object({
  displayName: z.string().optional(),
  idpConfig: z
    .object({
      changePasswordUri: z.string().optional(),
      entityId: z.string().optional(),
      signOutUri: z.string().optional(),
      singleSignOnServiceUri: z.string().optional(),
    })
    .optional(),
  name: z.string(),
  spConfig: z.object({
    assertionConsumerServiceUri: z.string(),
    entityId: z.string(),
  }),
});

const samlListSchema = z.object({
  inboundSamlSsoProfiles: z
    .array(
      z.object({
        displayName: z.string().optional(),
        name: z.string(),
        spConfig: z.object({
          assertionConsumerServiceUri: z.string(),
          entityId: z.string(),
        }),
      })
    )
    .optional(),
});
const samlCreateSchema = z.object({
  displayName: z.string(),
  idpConfig: z.object({
    entityId: z.string(),
    singleSignOnServiceUri: z.string(),
  }),
});
const samlResponseSchema = GoogleOperationSchema.extend({
  response: z.object({ name: z.string() }).optional(),
});
const samlUpdateSchema = z
  .object({
    idpConfig: z
      .object({
        changePasswordUri: z.string().optional(),
        entityId: z.string().optional(),
        signOutUri: z.string().optional(),
        singleSignOnServiceUri: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const samlSchemas = {
  create: samlCreateSchema,
  flatten: "inboundSamlSsoProfiles",
  flattenResponse: samlListSchema,
  get: samlGetSchema,
  list: samlListSchema,
  response: samlResponseSchema,
  update: samlUpdateSchema,
} satisfies CrudSchemas<
  z.infer<typeof samlGetSchema>,
  z.infer<typeof samlListSchema>,
  z.infer<typeof samlCreateSchema>,
  z.infer<typeof samlResponseSchema>,
  z.infer<typeof samlUpdateSchema>,
  z.infer<typeof samlListSchema>
>;
const ssoGetSchema = empty;
const ssoListSchema = z.object({
  inboundSsoAssignments: z
    .array(
      z.object({
        name: z.string(),
        samlSsoInfo: z.object({ inboundSamlSsoProfile: z.string() }).optional(),
        ssoMode: z.string().optional(),
        targetGroup: z.string().optional(),
        targetOrgUnit: z.string().optional(),
      })
    )
    .optional(),
});
const ssoCreateSchema = z.object({
  samlSsoInfo: z.object({ inboundSamlSsoProfile: z.string() }).optional(),
  ssoMode: z.string(),
  targetGroup: z.string().optional(),
  targetOrgUnit: z.string().optional(),
});

const ssoSchemas = {
  create: ssoCreateSchema,
  flatten: "inboundSsoAssignments",
  flattenResponse: ssoListSchema,
  get: ssoGetSchema,
  list: ssoListSchema,
  response: GoogleOperationSchema,
  update: empty,
} satisfies CrudSchemas<
  z.infer<typeof ssoGetSchema>,
  z.infer<typeof ssoListSchema>,
  z.infer<typeof ssoCreateSchema>,
  z.infer<typeof GoogleOperationSchema>,
  z.infer<typeof empty>,
  z.infer<typeof ssoListSchema>
>;

/**
 * Fluent client for Google Admin and Cloud Identity APIs.
 */
export class GoogleClient {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

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
              verified: z.boolean(),
            })
          ),
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
        childPrivileges: z.array(privilegeSchema).optional(),
        privilegeName: z.string(),
        serviceId: z.string(),
      })
    );
    return {
      ...base,
      privileges: () =>
        this.builder()
          .path(ApiEndpoint.Google.RolePrivileges)
          .accepts(z.object({ items: z.array(privilegeSchema) }))
          .flatten("items"),
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
          .path(ApiEndpoint.Google.SsoProfiles)
          .sends(samlSchemas.create)
          .accepts(samlSchemas.response),
      credentials: (profileId: string) => ({
        add: () =>
          this.builder()
            .path(ApiEndpoint.Google.SamlProfileCredentials(profileId))
            .sends(z.object({ pemData: z.string() }))
            .accepts(GoogleOperationSchema),
        delete: (credentialId: string) =>
          this.builder()
            .path(
              `${ApiEndpoint.Google.SamlProfileCredentialsList(profileId)}/${credentialId}`
            )
            .accepts(empty),
        list: () =>
          this.builder()
            .path(ApiEndpoint.Google.SamlProfileCredentialsList(profileId))
            .accepts(
              z.object({
                idpCredentials: z
                  .array(
                    z.object({
                      name: z.string(),
                      updateTime: z.string().optional(),
                    })
                  )
                  .optional(),
              })
            ),
      }),
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
              site: z.object({ identifier: z.string(), type: z.string() }),
              verificationMethod: z.string(),
            })
          )
          .accepts(
            z.object({
              method: z.string(),
              site: z.object({ identifier: z.string(), type: z.string() }),
              token: z.string(),
              type: z.string(),
            })
          ),
      verify: () =>
        this.builder()
          .path(`${ApiEndpoint.Google.SiteVerification}/webResource`)
          .sends(
            z.object({
              site: z.object({ identifier: z.string(), type: z.string() }),
              verificationMethod: z.string(),
            })
          )
          .accepts(
            z.object({
              id: z.string(),
              site: z.object({ identifier: z.string(), type: z.string() }),
            })
          ),
    };
  }
}
