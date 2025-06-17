# Step API contracts

Below is a complete canvas of **12 steps**, each with:

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

1. Define interface for check data
2. Call createStep with generic parameter
3. In check: ALWAYS wrap in try-catch, ALWAYS call one of: markComplete, markIncomplete, markCheckFailed
4. In execute: ALWAYS wrap in try-catch, ALWAYS call one of: markSucceeded, markFailed, markPending
5. Use ApiEndpoint constants for ALL URLs
6. Define Zod schemas inline before API calls

Examples of URL usage:

```ts
// Static URLs
await fetchGoogle(ApiEndpoint.Google.Domains, DomainsSchema);

// Parameterized URLs
const email = "user@example.com";
await fetchGoogle(ApiEndpoint.Google.user(email), UserSchema);

// With POST body
await fetchGoogle(ApiEndpoint.Google.Users, CreateUserSchema, {
  method: "POST",
  body: JSON.stringify({ name: "Test User", email })
});
```

Example:

```ts
interface CheckData {
  fieldFromCheck?: string;
}

export default createStep<CheckData>({
  id: StepId.MyStep,
  requires: [Var.GoogleAccessToken],
  provides: [Var.Something],

  async check({ fetchGoogle, markComplete, markIncomplete, markCheckFailed }) {
    try {
      const Schema = z.object({ ... });
      const data = await fetchGoogle(ApiEndpoint.Google.Something, Schema);

      if (alreadyDone) {
        markComplete({ fieldFromCheck: data.field });
      } else {
        markIncomplete("Need to do work", { fieldFromCheck: data.field });
      }
    } catch (error) {
      markCheckFailed(error.message);
    }
  },

  async execute({ fetchGoogle, checkData, markSucceeded, markFailed }) {
    try {
      // Do work
      markSucceeded({ [Var.Something]: result });
    } catch (error) {
      markFailed(error.message);
    }
  }
});
```

### Purpose

Ensure Google Workspace primary domain exists and is verified.

### State Check

#### Request

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

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

#### Completion Criteria

`.domains[] | select(.isPrimary == true && .verified == true)` exists

#### Variables Extracted

```ts
primaryDomain = domains[] | select(.isPrimary == true) | .domainName
isDomainVerified = domains[] | select(.isPrimary == true) | .verified
```

### Execution

**Manual DNS required**; no API mutation for completion

### Required Inputs

- `googleAccessToken: string`

## Step 2: `createAutomationOU`

### Purpose

Ensure the organizational unit `/Automation` exists.

### State Check

#### Request

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits?orgUnitPath=/Automation
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

```json
{
  "organizationUnits": [
    { "orgUnitPath": "/Automation", "name": "Automation", ... }
  ]
}
```

#### Completion Criteria

`organizationUnits[] | select(.orgUnitPath == "/Automation")` exists

### Execution

#### Prerequisites

- `googleAccessToken`
- `isDomainVerified`

#### Request

```http
POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{ "name": "Automation", "parentOrgUnitPath": "/" }
```

#### Expected Responses

- `201 Created`: OU created
- `409 Conflict`: OU already exists (acceptable)
- `400/403`: validation or permission error

## Step 3: `createServiceUser`

### Purpose

Ensure service account email `azuread-provisioning@{primaryDomain}` exists.

### State Check

#### Request

```http
GET https://admin.googleapis.com/admin/directory/v1/users/azuread-provisioning@{primaryDomain}
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

```json
{
  "id": "12345",
  "primaryEmail": "azuread-provisioning@example.com",
  "orgUnitPath": "/Automation"
}
```

#### Completion Criteria

Response `200 OK`

#### Variables Extracted

```ts
provisioningUserId = .id
provisioningUserEmail = .primaryEmail
```

### Execution

#### Prerequisites

- `googleAccessToken`
- `primaryDomain` variable set
- `isDomainVerified`

#### Request

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

#### Expected Responses

- `201 Created`: User created
- `409 Conflict`: User already exists (acceptable)
- `400/403`: error

#### Variables Extracted on Success

```ts
provisioningUserId = .id
provisioningUserEmail = .primaryEmail
generatedPassword = <plaintext password from body>
```

## Step 4: `createCustomAdminRole`

### Purpose

Ensure custom admin role `Microsoft Entra Provisioning` exists with correct privileges.

### State Check

#### Request

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

```json
{
  "items": [
    {
      "roleId": "R123",
      "roleName": "Microsoft Entra Provisioning",
      "rolePrivileges": [ { "serviceId": "svc", ... }, ... ]
    }, ...
  ]
}
```

#### Completion Criteria

`items[] | select(.roleName == "Microsoft Entra Provisioning")` exists

#### Variables Extracted

```ts
adminRoleId = .roleId
directoryServiceId = .rolePrivileges[0].serviceId
```

### Execution

#### Prerequisites

- `googleAccessToken`
- `isDomainVerified`

#### Requests Sequence

1. **GET Privileges**

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/ALL/privileges
Authorization: Bearer {googleAccessToken}
```

```ts
directoryServiceId = .items[] | select(.privilegeName == "USERS_RETRIEVE") | .serviceId
```

2. **POST Create Role**

```http
POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "roleName": "Microsoft Entra Provisioning",
  "roleDescription": "Custom role for Microsoft provisioning",
  "rolePrivileges": [
    { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_RETRIEVE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_CREATE" },
    { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_UPDATE" }
  ]
}
```

#### Expected Responses

- `201 Created`: Role created
- `409 Conflict`: Role already exists (acceptable)
- `400/403`: error

#### Variables Extracted on Success

```ts
adminRoleId = .roleId
```

## Step 5: `assignRoleToUser`

### Purpose

Ensure the custom role is assigned to the service user.

### State Check

#### Request

```http
GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments?roleId={adminRoleId}&userKey={provisioningUserId}
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

```json
{ "items": [ { ... } ] }
```

#### Completion Criteria

`items` array length >= 1

### Execution

#### Prerequisites

- `googleAccessToken`
- `adminRoleId`, `provisioningUserId`, `isDomainVerified`

#### Request

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

#### Expected Responses

- `201 Created` or `409 Conflict`
- `400/404/403`: error

## Step 6: `configureGoogleSamlProfile`

### Purpose

Ensure at least one inbound SAML profile exists for Google.

### State Check

#### Request

```http
GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

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

#### Completion Criteria

`inboundSamlSsoProfiles` array length >= 1

#### Variables Extracted

```ts
samlProfileId = .inboundSamlSsoProfiles[0].name
entityId = .inboundSamlSsoProfiles[0].spConfig.entityId
acsUrl = .inboundSamlSsoProfiles[0].spConfig.assertionConsumerServiceUri
```

### Execution

#### Prerequisites

- `googleAccessToken`

#### Request

```http
POST https://cloudidentity.googleapis.com/v1/customers/my_customer/inboundSamlSsoProfiles
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "displayName": "Azure AD",
  "idpConfig": { "entityId": "", "singleSignOnServiceUri": "" }
}
```

#### Expected Responses

- `200 OK` with `operation` and `done: true`
  → Details in `.response`

Extract:

```ts
samlProfileId = .response.name
entityId = .response.spConfig.entityId
acsUrl = .response.spConfig.assertionConsumerServiceUri
```

- `400`/`403`: error

## Step 7: `createMicrosoftApps`

### Purpose

Instantiate provisioning and SSO Microsoft enterprise apps from template.

### State Check

#### Request

```http
GET https://graph.microsoft.com/beta/applications?$filter=applicationTemplateId eq '01303a13-8322-4e06-bee5-80d612907131'
Authorization: Bearer {msGraphToken}
```

#### Success Response (`200 OK`)

```json
{ "value": [{ "servicePrincipalId": "...", "appId": "..." }] }
```

#### Completion Criteria

`value` array length >= 1

#### Variables Extracted

```ts
provisioningServicePrincipalId = .value[0].servicePrincipalId
ssoServicePrincipalId = .value[0].servicePrincipalId
ssoAppId = .value[0].appId
```

### Execution

#### Prerequisites

- `msGraphToken`

#### Requests

1. Provisioning App

```http
POST https://graph.microsoft.com/v1.0/applicationTemplates/01303a13-8322-4e06-bee5-80d612907131/instantiate
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "displayName": "Google Workspace Provisioning" }
```

2. SSO App

```http
POST https://graph.microsoft.com/v1.0/applicationTemplates/01303a13-8322-4e06-bee5-80d612907131/instantiate
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{ "displayName": "Google Workspace SSO" }
```

#### Expected Response (`201 Created`)

Return includes `servicePrincipal.id` and `application.appId`

#### Variables Extracted

```ts
provisioningServicePrincipalId = .servicePrincipal.id
ssoServicePrincipalId = .servicePrincipal.id
ssoAppId = .application.appId
```

## Step 8: `configureMicrosoftSyncAndSso`

### Purpose

Configure Azure AD provisioning and SSO settings.

### State Check

#### Request

```http
GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
Authorization: Bearer {msGraphToken}
```

#### Success Response (`200 OK`)

```json
{ "value": [ { "status": { "code": "Active" } }, ... ] }
```

#### Completion Criteria

At least one `value[].status.code != "Paused"`

### Execution

#### Prerequisites

- `msGraphToken`
- `provisioningServicePrincipalId`, `generatedPassword`

#### Requests

1. Set Secrets

```http
PATCH https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization
Authorization: Bearer {msGraphToken}
Content-Type: application/json

{
  "secrets": [
    { "key": "BaseAddress", "value": "https://admin.googleapis.com/admin/directory/v1" },
    { "key": "SecretKey", "value": "{generatedPassword}" }
  ]
}
```

Expected: `204 No Content`

2. Start Job

```http
POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/Initial/start
Authorization: Bearer {msGraphToken}
```

Expected: `204 No Content`

## Step 9: `setupMicrosoftClaimsPolicy`

### Purpose

Ensure a claims mapping policy exists and is assigned to the SSO service principal.

### State Check

#### Request

```http
GET https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies
Authorization: Bearer {msGraphToken}
```

#### Success Response (`200 OK`)

```json
{ "value": [ { "id": "policy123" }, ... ] }
```

#### Completion Criteria

`value` array length >= 1

#### Variables Extracted

```ts
claimsPolicyId = .value[0].id
```

### Execution

#### Prerequisites

- `msGraphToken`
- `ssoServicePrincipalId`

#### Requests

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

Expected: `204 No Content`

## Step 10: `completeGoogleSsoSetup`

### Purpose

Manual configuration in Google Admin Console of SSO federation.

### State Check & Execution

Manual step — no API interaction

#### Required Inputs

- `samlProfileId`, `entityId`, `acsUrl`

#### Instructions

1. Sign in to Google Admin Console
2. Navigate to _Security → Authentication → SSO with third-party IdP_
3. Input the values from prior steps and upload certificates
4. Save configuration

## Step 11: `assignUsersToSso`

### Purpose

Enable SAML SSO for all users in the domain.

### State Check

#### Request

```http
GET https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
Authorization: Bearer {googleAccessToken}
```

#### Success Response (`200 OK`)

```json
{
  "inboundSsoAssignments": [
    {
      "targetGroup": { "id": "allUsers" },
      "samlSsoInfo": { "inboundSamlSsoProfile": "{samlProfileId}" }
    }
  ]
}
```

#### Completion Criteria

Assignment exists with `targetGroup.id = "allUsers"` and matching `samlProfileId`

### Execution

#### Prerequisites

- `googleAccessToken`
- `samlProfileId`

#### Request

```http
POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
Authorization: Bearer {googleAccessToken}
Content-Type: application/json

{
  "targetGroup": { "id": "allUsers" },
  "samlSsoInfo": { "inboundSamlSsoProfile": "{samlProfileId}" },
  "ssoMode": "SAML_SSO"
}
```

#### Expected Responses

- `200 OK` (operation returned)
- `409 Conflict` (already assigned)

## Step 12: `testSsoConfiguration`

### Purpose

Verify end-to-end SAML SSO is functioning.

### State Check & Execution

Manual step — requires human interaction

#### Required Conditions

- Previously configured steps must be complete
- A test user exists

#### Procedure

1. Open private or incognito browser window
2. Navigate to Google Workspace login
3. Enter test user email
4. Confirm redirect to Microsoft authentication
5. Complete login and verify return to Google
