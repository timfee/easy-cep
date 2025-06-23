# Step API contracts

Below is a complete canvas of **11 steps**, each with:

- **Purpose**
- **State Check**: HTTP request, expected response, completion criteria, and extracted variables
- **Execution**: prerequisites, HTTP request(s), expected responses, and behavior
- **Required Inputs** (variables or tokens)

Before running or developing a step that performs live API calls, execute
`./scripts/token-info.sh` to confirm the Google and Microsoft bearer tokens are
valid. The script queries Google's tokeninfo endpoint and Microsoft Graph so you
can quickly verify access. These credentials point to test tenants, so API
mutations are allowed during step development.

## Step 1: `verifyPrimaryDomain`

## Implementation Pattern

Every step MUST follow this exact pattern:

1. Define the `CheckData` type for data extracted in your `check()` phase:

   - For non-empty payloads, declare an `interface CheckData { … }` listing each field.
   - If your step extracts no data, use the empty alias:

     ```ts
     import type { WorkflowVars } from "@/types";
     type CheckData = Partial<Pick<WorkflowVars, never>>;
     ```

2. Start with `defineStep(StepId.X)` then chain `.requires()`, `.provides()`,
   `.check()` and `.execute()`. Finish by calling `.build()`.
3. In `check()`: wrap in `try/catch`, then call exactly one of `markComplete`,
   `markIncomplete`, or `markCheckFailed`.
4. In `execute()`: wrap in `try/catch`, then call exactly one of `output`,
   `markFailed`, or `markPending`.
5. Use `ApiEndpoint` constants for ALL URLs.
6. Define Zod schemas inline before API calls (never use `z.any()`).
7. Reuse the types and constants under `lib/workflow/types/` and
   `lib/workflow/constants/` instead of redefining them.
8. You do _not_ need manual token/var checks—`defineStep` automatically fails
   the check if any declared `requires` variable is missing.
9. Document the HTTP requests and responses your step performs using block
   comments above each `check()` and `execute()` section.
10. Provide an `.undo()` handler for any step that mutates remote state so tests
    can clean up after themselves.

### Environment Variables in Steps

Steps must not read directly from `process.env`. Any required environment variables
must be declared in `env.ts` and accessed via the `env` import. All other runtime
state must use workflow `vars` (via the `Var` enum and `vars.require('x')`)
to ensure type safety and consistency.

Examples of URL usage:

```ts
// Static URLs
await google.get(ApiEndpoint.Google.Domains, DomainsSchema);

// Parameterized URLs
const email = vars.build("{prefix}@{domain}");
await google.get(ApiEndpoint.Google.user(email), UserSchema);

// With POST body
await google.post(ApiEndpoint.Google.Users, CreateUserSchema, {
  primaryEmail: email,
  name: { givenName: "Test", familyName: "User" }
});
```

Example:

```ts
interface CheckData {
  fieldFromCheck?: string;
}

export default defineStep(StepId.MyStep)
  .requires(Var.GoogleAccessToken)
  .provides(Var.Something)
  .check(async ({ google, markComplete, markIncomplete, markCheckFailed }) => {
    try {
      const Schema = z.object({
        /* ... */
      });
      const data = await google.get(ApiEndpoint.Google.Something, Schema);

      if (alreadyDone) {
        markComplete({ fieldFromCheck: data.field });
      } else {
        markIncomplete("Need to do work", { fieldFromCheck: data.field });
      }
    } catch (error) {
      markCheckFailed(error instanceof Error ? error.message : String(error));
    }
  })
  .execute(async ({ google, output, markFailed }) => {
    try {
      // Do work
      output({ something: result });
    } catch (error) {
      markFailed(error instanceof Error ? error.message : String(error));
    }
  })
  .build();
```

### Step 1 Purpose

Ensure Google Workspace primary domain exists and is verified.

### Step 1 State Check

#### Step 1 Check Request (path parameter)

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains
Authorization: Bearer {googleAccessToken}
```

#### Step 1 Success Response (`200 OK`)

```json
{
  "domains": [
    {
      "domainName": "example.com",
      "isPrimary": true,
      "verified": true
    }, ...
  ]
}
```

#### Step 1 Completion Criteria

`.domains[] | select(.isPrimary == true && .verified == true)` exists

#### Step 1 Variables Extracted

```ts
isDomainVerified = domains[] | select(.isPrimary == true) | .verified
```

### Step 1 Execution

**Manual DNS required**; no API mutation for completion

### Step 1 Required Inputs

- `googleAccessToken: string`

## Step 2: `createAutomationOU`

### Step 2 Purpose

Ensure the organizational unit `/Automation` exists.

### Step 2 State Check

#### Step 2 Check Request

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation
Authorization: Bearer {googleAccessToken}
```

#### Step 2 Success Response (`200 OK`)

```json
{
  "orgUnitPath": "/Automation",
  "name": "Automation",
  …
}
```

#### Step 2 Completion Criteria

Response `200 OK` (OU exists)

### Step 2 Execution

#### Step 2 Prerequisites

- `googleAccessToken`
- `isDomainVerified`
- `provisioningUserId`

#### Step 2 Execution Request

```http
POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "name": "Automation",
  "parentOrgUnitPath": "/"
}
```

#### Step 2 Expected Responses

- `201 Created`: OU created
- `409 Conflict`: OU already exists (acceptable)
- `400/403`: validation or permission error

## Step 3: `createServiceUser`

### Step 3 Purpose

Ensure service account email `azuread-provisioning@{primaryDomain}` exists.

### Step 3 State Check

#### Step 3 Check Request

```http
GET https://admin.googleapis.com/admin/directory/v1/users/azuread-provisioning@{primaryDomain}
Authorization: Bearer {googleAccessToken}
```

#### Step 3 Success Response (`200 OK`)

```json
{
  "id": "12345",
  "primaryEmail": "azuread-provisioning@example.com",
  "orgUnitPath": "/Automation"
}
```

#### Step 3 Completion Criteria

Response `200 OK`

#### Step 3 Variables Extracted

```ts
provisioningUserId = .id
provisioningUserEmail = .primaryEmail
```

### Step 3 Execution

#### Step 3 Prerequisites

- `googleAccessToken`
- `isDomainVerified`

#### Step 3 Execution Request

```http
POST https://admin.googleapis.com/admin/directory/v1/users
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "primaryEmail": "azuread-provisioning@{primaryDomain}",
  "name": { "givenName": "Microsoft", "familyName": "Provisioning" },
  "password": "{generatedPassword}",
  "orgUnitPath": "/Automation"
}
```

#### Step 3 Expected Responses

- `201 Created`: User created
- `409 Conflict`: User already exists (acceptable)
- `400/403`: error

#### Step 3 Variables Extracted on Success

```ts
provisioningUserId = .id
provisioningUserEmail = .primaryEmail
generatedPassword = {generatedPassword}
```

## Step 4: `createAdminRoleAndAssignUser`

### Step 4 Purpose

Ensure custom admin role `Microsoft Entra Provisioning` exists with correct privileges and is assigned to the provisioning user.

### Step 4 State Check

#### Step 4 Check Request

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
Authorization: Bearer {googleAccessToken}
```

#### Step 4 Success Response (`200 OK`)

```json
{
  "kind": "admin#directory#roles",
  "items": [
    {
      "roleId": "91447453409035723",
      "roleName": "Microsoft Entra Provisioning",
      "roleDescription": "Custom role for Microsoft provisioning",
      "rolePrivileges": [
        { "privilegeName": "USERS_CREATE", "serviceId": "00haapch16h1ysv" },
        { "privilegeName": "USERS_RETRIEVE", "serviceId": "00haapch16h1ysv" },
        { "privilegeName": "USERS_UPDATE", "serviceId": "00haapch16h1ysv" }
      ]
    }
  ]
}
```

#### Step 4 Completion Criteria

`items[] | select(.roleName == "Microsoft Entra Provisioning")` exists

#### Step 4 Variables Extracted

```ts
adminRoleId = .roleId
directoryServiceId = .rolePrivileges[0].serviceId
```

### Step 4 Execution

#### Step 4 Prerequisites

- `googleAccessToken`
- `isDomainVerified`

#### Step 4 Execution Requests Sequence

1. **GET Privileges**

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/ALL/privileges
Authorization: Bearer {googleAccessToken}
```

```ts
directoryServiceId = .items[] | select(.privilegeName == "USERS_RETRIEVE") | .serviceId
```

1. **POST Create Role**

```http
POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "roleName": "Microsoft Entra Provisioning",
  "roleDescription": "Custom role for Microsoft provisioning",
  "rolePrivileges": [
    { "serviceId": "{directoryServiceId}", "privilegeName": "ORGANIZATION_UNITS_READ" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_RETRIEVE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_CREATE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_UPDATE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "GROUPS_RETRIEVE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "GROUPS_CREATE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "GROUPS_UPDATE" }
  ]
}
```

#### Step 4 Expected Responses (Create Role)

- `200 OK`: Role created
- `409 Conflict`: Role already exists (acceptable)
- `400/403`: error

#### Step 4 Variables Extracted on Success (Create Role)

```ts
adminRoleId = .roleId
```

1. **POST Role Assignment**

#### Step 4 Execution Request 3: Assign Role

```http
POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "roleId": "{adminRoleId}",
  "assignedTo": "{provisioningUserId}",
  "scopeType": "CUSTOMER"
}
```

Expected: `201 Created` or `409 Conflict`

#### Step 4 Expected Responses (Assign Role)

- `200 OK` or `409 Conflict`
- `400/404/403`: error

Example success:

```json
{
  "roleAssignmentId": "91447453409034880",
  "roleId": "91447453409035734",
  "assignedTo": "103898700330622175095"
}
```

Conflict example:

```json
{
  "error": {
    "code": 409,
    "message": "Role assignment already exists for the role"
  }
}
```

#### Step 4 Variables Extracted on Success (Assign Role)

```ts
adminRoleId = .roleId
```

## Step 5: `configureGoogleSamlProfile`

### Step 5 Purpose

Ensure at least one inbound SAML profile exists for Google.

### Step 5 State Check

#### Step 5 Check Request

```http
GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles
Authorization: Bearer {googleAccessToken}
```

#### Step 5 Success Response (`200 OK`)

```json
{
  "inboundSamlSsoProfiles": [
    {
      "name": "...",
      "spConfig": { "entityId": "...", "assertionConsumerServiceUri": "..." }
    }
  ]
}
```

#### Step 5 Completion Criteria

`inboundSamlSsoProfiles` array length >= 1

#### Step 5 Variables Extracted

```ts
samlProfileId = .inboundSamlSsoProfiles[0].name
entityId = .inboundSamlSsoProfiles[0].spConfig.entityId
acsUrl = .inboundSamlSsoProfiles[0].spConfig.assertionConsumerServiceUri
```

### Step 5 Execution

#### Step 5 Prerequisites

- `googleAccessToken`

#### Step 5 Execution Request

```http
POST https://cloudidentity.googleapis.com/v1/customers/my_customer/inboundSamlSsoProfiles
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "displayName": "Azure AD",
  "idpConfig": { "entityId": "", "singleSignOnServiceUri": "" }
}
```

#### Step 5 Expected Responses

- `200 OK` returning an [Operation](https://cloud.google.com/identity/docs/reference/rest/Shared.Types/Operation)
  when `done: true`, profile details are under `.response`

Example:

```json
{
  "name": "operations/abc123",
  "done": true,
  "response": {
    "name": "inboundSamlSsoProfiles/010xi5tr1szon40",
    "spConfig": { "entityId": "...", "assertionConsumerServiceUri": "..." }
  }
}
```

Extract:

```ts
samlProfileId = .response.name
entityId = .response.spConfig.entityId
acsUrl = .response.spConfig.assertionConsumerServiceUri
```

- `400`/`403`: error

## Step 6: `createMicrosoftApps`

### Step 6 Purpose

Instantiate provisioning and SSO Microsoft enterprise apps from template.

### Step 6 State Check

#### Step 6 Check Request

```http
# Provisioning app lookup
GET https://graph.microsoft.com/beta/applications?$filter=applicationTemplateId eq '01303a13-8322-4e06-bee5-80d612907131'
Authorization: Bearer {msGraphToken}

# SSO app lookup
GET https://graph.microsoft.com/beta/applications?$filter=applicationTemplateId eq '01303a13-8322-4e06-bee5-80d612907131'
Authorization: Bearer {msGraphToken}

# Service principal queries
GET https://graph.microsoft.com/beta/servicePrincipals?$filter=appId eq '{appId}'
Authorization: Bearer {msGraphToken}
```

#### Step 6 Success Response (`200 OK`)

```json
# Application lookup example
{ "value": [{ "id": "...", "appId": "..." }] }

# Service principal lookup example
{ "value": [{ "id": "..." }] }
```

#### Step 6 Completion Criteria

Apps exist for both instances and their service principals are found. The same template ID is used for provisioning and SSO. The check logs whether the two instances share a single application or use separate ones.

#### Step 6 Check Variables Extracted

```ts
provisioningServicePrincipalId = provisioningSp.value[0].id;
ssoServicePrincipalId = ssoSp.value[0].id;
ssoAppId = ssoApp.appId;
```

### Step 6 Execution

#### Step 6 Prerequisites

- `msGraphToken`

#### Step 6 Execution Requests

1. Provisioning App

```http
POST https://graph.microsoft.com/v1.0/applicationTemplates/01303a13-8322-4e06-bee5-80d612907131/instantiate
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "displayName": "Google Workspace Provisioning" }
```

1. SSO App

```http
POST https://graph.microsoft.com/v1.0/applicationTemplates/01303a13-8322-4e06-bee5-80d612907131/instantiate
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "displayName": "Google Workspace SSO" }
```

#### Step 6 Expected Response (`201 Created`)

Return includes `servicePrincipal.id` and `application.appId`

#### Step 6 Execution Variables Extracted

```ts
provisioningServicePrincipalId = .servicePrincipal.id
ssoServicePrincipalId = .servicePrincipal.id
ssoAppId = .application.appId
```

## Step 7: `setupMicrosoftProvisioning`

### Step 7 Purpose

Configure Azure AD provisioning to sync users to Google Workspace.

### Step 7 Execution

1. Get sync template ID
2. Create synchronization job
3. Set credentials (BaseAddress and SecretToken)
4. Start synchronization

## Step 8: `configureMicrosoftSso`

### Step 8 Purpose

Configure Microsoft SAML SSO settings and generate signing certificate.

### Step 8 Execution

1. Set preferredSingleSignOnMode to "saml" on service principal
2. Configure SAML URLs on service principal
3. Set identifierUris and redirectUris on application object
4. Generate token signing certificate
5. Extract certificate and SSO URLs for Google configuration

### Step 8 Purpose

Ensure a claims mapping policy exists and is assigned to the SSO service principal.

### Step 8 State Check

#### Step 8 Check Request

```http
GET https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies
Authorization: Bearer {msGraphToken}
```

#### Step 8 Success Response (`200 OK`)

```json
{ "value": [ { "id": "policy123" }, ... ] }
```

#### Step 8 Completion Criteria

`value` array length >= 1

#### Step 8 Variables Extracted

```ts
claimsPolicyId = .value[0].id
```

### Step 8 Execution

#### Step 8 Prerequisites

- `msGraphToken`
- `ssoServicePrincipalId`

#### Step 8 Execution Requests

1. Create Policy

```http
POST https://graph.microsoft.com/beta/policies/claimsMappingPolicies
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{
  "definition": ["{\"ClaimsMappingPolicy\":{\"Version\":1,\"IncludeBasicClaimSet\":true,\"ClaimsSchema\":[]}}"],
  "displayName": "Google Workspace Basic Claims",
 "isOrganizationDefault": false
}
```

Expected Responses:

- `201 Created`: policy created → extract `claimsPolicyId`
- `409 Conflict`: existing policy → query fetching needed

1. Assign to SP

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies/$ref
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "@odata.id": "https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/{claimsPolicyId}" }
```

Expected Responses:

- `204 No Content`
- `409 Conflict` if a policy is already assigned (only one allowed)

## Step 9: `completeGoogleSsoSetup`

### Step 9 Purpose

Automatically configure Google SSO using Azure AD metadata.

### Step 9 State Check

Fetch the existing SAML profile and verify `idpConfig` is populated.

### Step 9 Execution

1. Query Microsoft Graph for tenant ID and token signing certificate
2. PATCH the Google SAML profile with Azure AD SAML endpoints
3. Upload the signing certificate to Google

Example responses can be found in `test/e2e/fixtures/ms-organization.json`
and `test/e2e/fixtures/ms-token-certs.json`.

## Step 10: `assignUsersToSso`

### Step 10 Purpose

Enable SAML SSO for all users in the domain.

### Step 10 State Check

#### Step 10 Check Request

```http
GET https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
Authorization: Bearer {googleAccessToken}
```

#### Step 10 Success Response (`200 OK`)

```json
{
  "inboundSsoAssignments": [
    {
      "targetOrgUnit": "orgUnits/{rootOrgUnitId}",
      "samlSsoInfo": { "inboundSamlSsoProfile": "{samlProfileId}" },
      "ssoMode": "SAML_SSO"
    },
    { "targetOrgUnit": "{automationOuPath}", "ssoMode": "SSO_OFF" }
  ]
}
```

#### Step 10 Completion Criteria

Assignments exist for both:

1. `targetOrgUnit = "orgUnits/{rootOrgUnitId}"` with `ssoMode = "SAML_SSO"` and matching `samlProfileId`
2. `targetOrgUnit = "{automationOuPath}"` with `ssoMode = "SSO_OFF"`

### Step 10 Execution

#### Step 10 Prerequisites

- `googleAccessToken`
- `samlProfileId`

#### Step 10 Execution Request

```http
POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "targetOrgUnit": "orgUnits/{rootOrgUnitId}",
  "samlSsoInfo": { "inboundSamlSsoProfile": "{samlProfileId}" },
  "ssoMode": "SAML_SSO"
}

POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "targetOrgUnit": "{automationOuPath}",
  "ssoMode": "SSO_OFF"
}
```

#### Step 10 Expected Responses

- `200 OK` returning an [Operation](https://cloud.google.com/identity/docs/reference/rest/Shared.Types/Operation) with `done: true`
- `409 Conflict` (already assigned)

## Step 11: `testSsoConfiguration`

### Step 11 Purpose

Verify end-to-end SAML SSO is functioning.

### Step 11 State Check & Execution

Manual step — requires human interaction

#### Step 11 Required Conditions

- Previously configured steps must be complete
- A test user exists

#### Step 11 Procedure

1. Open private or incognito browser window
2. Navigate to Google Workspace login
3. Enter test user email
4. Confirm redirect to Microsoft authentication
5. Complete login and verify return to Google
