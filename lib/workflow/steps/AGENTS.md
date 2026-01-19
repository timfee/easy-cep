# Step API Contracts

## Commands (Repo-wide)

- `bun run build` / `bun run check` / `bun run lint` / `bun run format`
- `bun test` (runs all tests)
- `bun test path/to/file.test.ts` or `bun test --filter "name"` (single test)
- `RUN_E2E=1 bun test` (live E2E), `UPDATE_FIXTURES=1` or `CHECK_FIXTURES=1` for fixtures, `SKIP_E2E=1` to skip
- `bun run e2e:live` (live E2E runner)

Below is a complete canvas of **12 steps**, each with:

- **Purpose**
- **State Check**: HTTP request, expected response, completion criteria, and extracted variables
- **Execution**: prerequisites, HTTP request(s), expected responses, and behavior
- **Required Inputs** (variables or tokens)

Before running or developing a step that performs live API calls, confirm the
Google and Microsoft bearer tokens are valid (sourced from `.env.local` via the
refresh token or service account flow). These credentials point to test tenants,
so API mutations are allowed during step development.

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
5. Use the fluent `google` and `microsoft` clients for all API calls.
6. Define Zod schemas inline before API calls (never use `z.any()`).
7. Reuse the types and constants under `lib/workflow/types/` and
   `lib/workflow/constants/` instead of redefining them.
8. You do _not_ need manual token/var checks—`defineStep` automatically fails
   the check if any declared `requires` variable is missing.
9. Document the HTTP requests and responses your step performs in this file
   under the step’s **State Check** and **Execution** sections.
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
await google.domains.get();

// Parameterized URLs
const email = vars.build("{prefix}@{domain}");
await google.users.get(email).get();

// With POST body
await google.users
  .create()
  .post({
    primaryEmail: email,
    name: { givenName: "Test", familyName: "User" },
    password: "secret"
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
      const data = await google.samlProfiles.list().get();

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
POST https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles
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

### Step 7 State Check

#### Step 7 Check Request

```http
GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
Authorization: Bearer {msGraphToken}
```

#### Step 7 Success Response (`200 OK`)

```json
{ "value": [{ "status": { "code": "Active" } }] }
```

#### Step 7 Completion Criteria

Any job with `status.code != "Paused"`

### Step 7 Execution

#### Step 7 Execution Requests

```http
GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/templates
Authorization: Bearer {msGraphToken}
```

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "templateId": "{templateId}" }
```

```http
PUT https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/secrets
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{
  "value": [
    { "key": "BaseAddress", "value": "https://admin.googleapis.com/admin/directory/v1" },
    { "key": "SecretToken", "value": "{generatedPassword}" }
  ]
}
```

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}/start
Authorization: Bearer {msGraphToken}
```

#### Step 7 Expected Responses

- `204 No Content`: sync job started
- `400/403`: error

## Step 8: `configureMicrosoftSso`

### Step 8 Purpose

Configure Microsoft SAML SSO settings and generate signing certificate.

### Step 8 State Check

#### Step 9 Check Request

```http
GET https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}?$select=preferredSingleSignOnMode,samlSingleSignOnSettings
Authorization: Bearer {msGraphToken}
```

```http
GET https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/tokenSigningCertificates
Authorization: Bearer {msGraphToken}
```

#### Step 8 Completion Criteria

`preferredSingleSignOnMode == "saml"` and at least one active certificate exists

### Step 8 Execution

#### Step 9 Execution Requests

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

2. Assign to SP

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies/$ref
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "@odata.id": "https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/{claimsPolicyId}" }
```

Expected Responses:

- `204 No Content`
- `409 Conflict` if a policy is already assigned (only one allowed)

## Step 10: `completeGoogleSsoSetup`

### Step 10 Purpose

Automatically configure Google SSO using Azure AD metadata.

### Step 10 State Check

#### Step 10 Check Request

```http
GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles/{samlProfileId}
Authorization: Bearer {googleAccessToken}
```

### Step 10 Execution

#### Step 10 Execution Requests

```http
PATCH https://cloudidentity.googleapis.com/v1/{samlProfile}?updateMask=idpConfig.entityId,idpConfig.singleSignOnServiceUri,idpConfig.signOutUri,idpConfig.changePasswordUri
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{ "idpConfig": { "entityId": "{entityId}", "singleSignOnServiceUri": "{loginUrl}", "signOutUri": "{loginUrl}", "changePasswordUri": "https://account.activedirectory.windowsazure.com/ChangePassword.aspx" } }
```

```http
POST https://cloudidentity.googleapis.com/v1/{samlProfile}/certificates
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{ "pemData": "-----BEGIN CERTIFICATE-----..." }
```

#### Step 10 Expected Responses

- `200 OK` for profile update
- `200 OK` operation for certificate upload

Example responses can be found in `test/e2e/fixtures/ms-organization.json`
and `test/e2e/fixtures/ms-token-certs.json`.

## Step 11: `assignUsersToSso`

### Step 11 Purpose

Enable SAML SSO for all users in the domain.

### Step 11 State Check

#### Step 11 Check Request

```http
GET https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
Authorization: Bearer {googleAccessToken}
```

#### Step 11 Success Response (`200 OK`)

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

#### Step 11 Completion Criteria

Assignments exist for both:

1. `targetOrgUnit = "orgUnits/{rootOrgUnitId}"` with `ssoMode = "SAML_SSO"` and matching `samlProfileId`
2. `targetOrgUnit = "{automationOuPath}"` with `ssoMode = "SSO_OFF"`

### Step 11 Execution

#### Step 11 Prerequisites

- `googleAccessToken`
- `samlProfileId`

#### Step 11 Execution Request

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

#### Step 11 Expected Responses

- `200 OK` returning an [Operation](https://cloud.google.com/identity/docs/reference/rest/Shared.Types/Operation) with `done: true`
- `409 Conflict` (already assigned)

## Step 12: `testSsoConfiguration`

### Step 12 Purpose

Verify end-to-end SAML SSO is functioning.

### Step 12 State Check & Execution

Manual step — requires human interaction

#### Step 12 Required Conditions

- Previously configured steps must be complete
- A test user exists

#### Step 12 Procedure

1. Open private or incognito browser window
2. Navigate to Google Workspace login
3. Enter test user email
4. Confirm redirect to Microsoft authentication
5. Complete login and verify return to Google
