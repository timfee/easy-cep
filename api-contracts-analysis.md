# API Contracts Analysis for E2E Testing

This document provides a comprehensive analysis of the Google and Microsoft API contracts used in the Easy CEP workflow, based on official API documentation and research.

## Executive Summary

**Status**: Analysis in progress
**Last Updated**: 2025-10-23

### Prerequisites for E2E Testing

1. Valid Google Workspace admin bearer token with required scopes
2. Valid Microsoft Graph bearer token with required permissions
3. Test domain properly configured in both Google Workspace and Microsoft Entra ID
4. Appropriate admin privileges in both systems

---

## Google Workspace API Contracts

### 1. Cloud Identity API (cloudidentity.googleapis.com/v1)

#### Inbound SAML SSO Profiles

**Official Documentation**: https://cloud.google.com/identity/docs/reference/rest/v1/inboundSamlSsoProfiles

**Key Endpoints**:

- `GET /v1/inboundSamlSsoProfiles` - List all SAML profiles
- `POST /v1/inboundSamlSsoProfiles` - Create new SAML profile
- `GET /v1/{name}` - Get specific profile
- `DELETE /v1/{name}` - Delete profile
- `PATCH /v1/{name}` - Update profile

**Known Issues from E2E Testing**:
According to `e2e-notes.md`, attempting to create SAML profiles under `customers/my_customer` returns 404. The API appears to require a different endpoint structure or the feature may not be available in all environments.

**API Requirements**:

- Required OAuth Scope: `https://www.googleapis.com/auth/cloud-identity.inboundsso`
- Request body must include `displayName`, `idpConfig.entityId`, and `idpConfig.singleSignOnServiceUri`
- Response includes profile `name` (resource identifier)

**Idempotency Considerations**:

- Profile creation is NOT idempotent
- Must check for existing profiles by displayName before creation
- No server-side idempotency keys supported

#### Inbound SSO Assignments

**Official Documentation**: https://cloud.google.com/identity/docs/reference/rest/v1/inboundSsoAssignments

**Key Endpoints**:

- `GET /v1/inboundSsoAssignments` - List assignments
- `POST /v1/inboundSsoAssignments` - Create assignment
- `PATCH /v1/{name}` - Update assignment
- `DELETE /v1/{name}` - Delete assignment

**API Requirements**:

- Links users/groups to SAML profiles
- Supports filtering by `customer`, `ssoProfile`
- Can target all users with specific rank values

**Idempotency Considerations**:

- Assignment creation is NOT idempotent
- Must check existing assignments before creation

### 2. Admin Directory API (admin.googleapis.com/admin/directory/v1)

#### Domains

**Official Documentation**: https://developers.google.com/admin-sdk/directory/reference/rest/v1/domains

**Key Endpoints**:

- `GET /admin/directory/v1/customer/my_customer/domains` - List domains
- `GET /admin/directory/v1/customer/my_customer/domains/{domain}` - Get domain

**API Requirements**:

- Required OAuth Scope: `https://www.googleapis.com/auth/admin.directory.domain.readonly`
- Returns `verified` status for each domain
- Primary domain is marked with `isPrimary: true`

**Idempotency Considerations**:

- Read-only operations are naturally idempotent

#### Organizational Units

**Official Documentation**: https://developers.google.com/admin-sdk/directory/reference/rest/v1/orgunits

**Key Endpoints**:

- `GET /admin/directory/v1/customer/my_customer/orgunits` - List OUs
- `POST /admin/directory/v1/customer/my_customer/orgunits` - Create OU
- `DELETE /admin/directory/v1/customer/my_customer/orgunits/{orgUnitPath}` - Delete OU

**API Requirements**:

- Required OAuth Scope: `https://www.googleapis.com/auth/admin.directory.orgunit`
- Path must start with `/`
- Parent OU must exist before creating child

**Idempotency Considerations**:

- Creation returns 409 Conflict if OU already exists
- Must check existence before creation
- Path-based addressing requires URL encoding

#### Users

**Official Documentation**: https://developers.google.com/admin-sdk/directory/reference/rest/v1/users

**Key Endpoints**:

- `GET /admin/directory/v1/users` - List/search users
- `POST /admin/directory/v1/users` - Create user
- `GET /admin/directory/v1/users/{userKey}` - Get user
- `DELETE /admin/directory/v1/users/{userKey}` - Delete user

**API Requirements**:

- Required OAuth Scope: `https://www.googleapis.com/auth/admin.directory.user`
- Primary email must be unique
- Password required at creation (min 8 characters)
- Can specify OU path for placement

**Idempotency Considerations**:

- Email uniqueness enforced server-side
- Creation fails if user already exists
- Must query before creation for idempotency

#### Roles

**Official Documentation**: https://developers.google.com/admin-sdk/directory/reference/rest/v1/roles

**Key Endpoints**:

- `GET /admin/directory/v1/customer/my_customer/roles` - List roles
- `POST /admin/directory/v1/customer/my_customer/roles` - Create role
- `DELETE /admin/directory/v1/customer/my_customer/roles/{roleId}` - Delete role

**API Requirements**:

- Required OAuth Scope: `https://www.googleapis.com/auth/admin.directory.rolemanagement`
- Must specify `roleName` and `rolePrivileges` array
- Privileges referenced by ID from privileges endpoint

**Idempotency Considerations**:

- Role name uniqueness not enforced by API
- Multiple roles with same name can exist
- Must check by name before creation

#### Role Assignments

**Official Documentation**: https://developers.google.com/admin-sdk/directory/reference/rest/v1/roleAssignments

**Key Endpoints**:

- `GET /admin/directory/v1/customer/my_customer/roleassignments` - List assignments
- `POST /admin/directory/v1/customer/my_customer/roleassignments` - Create assignment
- `DELETE /admin/directory/v1/customer/my_customer/roleassignments/{roleAssignmentId}` - Delete

**API Requirements**:

- Links user to role
- Requires `assignedTo` (user ID), `roleId`, and `scopeType`
- Can filter by `roleId` and `userKey`

**Idempotency Considerations**:

- Duplicate assignments return error
- Must check existing assignments

---

## Microsoft Graph API Contracts

### 1. Applications (beta/applications)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/resources/application

**Key Endpoints**:

- `GET /beta/applications` - List applications
- `POST /beta/applications` - Create application
- `GET /beta/applications/{id}` - Get application
- `DELETE /beta/applications/{id}` - Delete application
- `PATCH /beta/applications/{id}` - Update application

**API Requirements**:

- Required Permission: `Application.ReadWrite.All`
- `displayName` required for creation
- Returns `id` (object ID) and `appId` (client ID)
- Support for various authentication configurations

**Idempotency Considerations**:

- No built-in idempotency
- Must check by displayName before creation
- Multiple apps with same name allowed

### 2. Application Templates (v1.0/applicationTemplates)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/applicationtemplate-instantiate

**Key Endpoints**:

- `POST /v1.0/applicationTemplates/{id}/instantiate` - Create from template

**Template IDs**:

- Google Workspace: `01303a13-8322-4e06-bee5-80d612907131`

**API Requirements**:

- Required Permission: `Application.ReadWrite.All`
- Takes `displayName` parameter
- Creates both Application and ServicePrincipal
- Long-running operation (may take 10-30 seconds)

**Idempotency Considerations**:

- Not idempotent - creates new instances each time
- Must check for existing apps before instantiation
- Returns immediately but provisioning continues asynchronously

### 3. Service Principals (beta/servicePrincipals)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/resources/serviceprincipal

**Key Endpoints**:

- `GET /beta/servicePrincipals` - List service principals
- `GET /beta/servicePrincipals/{id}` - Get service principal
- `PATCH /beta/servicePrincipals/{id}` - Update service principal
- `DELETE /beta/servicePrincipals/{id}` - Delete service principal

**API Requirements**:

- Required Permission: `Application.ReadWrite.All`
- Associated with Applications via `appId`
- Contains authentication and authorization settings
- Used for SSO and provisioning configuration

**Filtering**:

- Can filter by `appId`: `$filter=appId eq '{appId}'`

**Idempotency Considerations**:

- Updates are idempotent with PATCH
- Must verify service principal exists after app instantiation

### 4. Synchronization (v1.0/servicePrincipals/{id}/synchronization)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/resources/synchronization-overview

**Key Endpoints**:

- `GET /v1.0/servicePrincipals/{id}/synchronization/templates` - List templates
- `POST /v1.0/servicePrincipals/{id}/synchronization/jobs` - Create sync job
- `GET /v1.0/servicePrincipals/{id}/synchronization/jobs` - List jobs
- `PUT /v1.0/servicePrincipals/{id}/synchronization/secrets` - Set credentials
- `POST /v1.0/servicePrincipals/{id}/synchronization/jobs/{jobId}/start` - Start sync

**API Requirements**:

- Required Permission: `Application.ReadWrite.All`, `Directory.ReadWrite.All`
- Template must be selected (Google Workspace uses 'gsuite' tag)
- Secrets must be set before starting job
- Job can be validated before starting

**Idempotency Considerations**:

- Multiple sync jobs can exist per service principal
- Must check for existing jobs before creation
- Job start is idempotent if already running

### 5. Claims Mapping Policies (beta/policies/claimsMappingPolicies)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/resources/claimsmappingpolicy

**Key Endpoints**:

- `GET /beta/policies/claimsMappingPolicies` - List policies
- `POST /beta/policies/claimsMappingPolicies` - Create policy
- `DELETE /beta/policies/claimsMappingPolicies/{id}` - Delete policy
- `POST /v1.0/servicePrincipals/{id}/claimsMappingPolicies/$ref` - Assign to SP
- `DELETE /v1.0/servicePrincipals/{id}/claimsMappingPolicies/{policyId}/$ref` - Unassign

**API Requirements**:

- Required Permission: `Policy.ReadWrite.ApplicationConfiguration`
- JSON definition in `definition` array
- Can be assigned to multiple service principals

**Idempotency Considerations**:

- Policy creation not idempotent
- Assignment is idempotent (assigning twice has no effect)
- Must check existence by displayName

### 6. Token Signing Certificates (beta/servicePrincipals/{id}/tokenSigningCertificates)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/serviceprincipal-addtokensigningcertificate

**Key Endpoints**:

- `POST /beta/servicePrincipals/{id}/addTokenSigningCertificate` - Add certificate
- `GET /beta/servicePrincipals/{id}/tokenSigningCertificates` - List certificates

**API Requirements**:

- Required Permission: `Application.ReadWrite.All`
- Can specify `displayName` and `endDateTime`
- Returns certificate with `keyId` and base64-encoded `key` (X.509)

**Idempotency Considerations**:

- Creates new certificate each time
- Multiple certificates can exist
- Should check for existing valid certificates

### 7. Organization (v1.0/organization)

**Official Documentation**: https://learn.microsoft.com/en-us/graph/api/resources/organization

**Key Endpoints**:

- `GET /v1.0/organization` - Get organization details

**API Requirements**:

- Required Permission: `Organization.Read.All`
- Returns tenant information including verified domains
- Read-only endpoint

**Idempotency Considerations**:

- Read-only, naturally idempotent

---

## API Rate Limits and Throttling

### Google Workspace

**Rate Limits**:

- Directory API: 2400 queries per minute per project
- Cloud Identity API: 600 queries per minute per project
- Per-user limits apply

**Retry Strategy**:

- Exponential backoff recommended
- Use `Retry-After` header when present
- 429 Too Many Requests indicates throttling

**Reference**: https://developers.google.com/admin-sdk/directory/v1/limits

### Microsoft Graph

**Rate Limits**:

- Throttling based on tenant, user, and application
- Varies by endpoint (typically 2000-10000 requests per 10 seconds)
- Beta endpoints may have lower limits

**Retry Strategy**:

- Use `Retry-After` header
- Implement exponential backoff
- 429 status code indicates throttling

**Reference**: https://learn.microsoft.com/en-us/graph/throttling

---

## E2E Test Determinism Issues

### Identified Challenges

1. **Asynchronous Operations**

   - Microsoft app instantiation is async (10-30s delay)
   - Service principal provisioning may lag
   - Synchronization job startup has delay

2. **Name Uniqueness**

   - Google roles don't enforce unique names
   - Microsoft allows duplicate display names
   - Must implement client-side uniqueness checks

3. **Resource Dependencies**

   - Service principal must exist before sync configuration
   - SSO certificate must exist before Google SAML update
   - OU must exist before user creation

4. **Cleanup Challenges**

   - Protected resources must not be deleted
   - Cascading deletes not always automatic
   - Orphaned resources if cleanup fails mid-process

5. **Token Expiration**
   - Bearer tokens expire (typically 1 hour)
   - Long test runs may hit expiration
   - No refresh token mechanism in tests

### Recommendations for Deterministic Testing

1. **Implement Proper Wait Conditions**

   - Poll for resource availability after creation
   - Check service principal provisioning status
   - Verify sync job is actually created before starting

2. **Add Unique Test Identifiers**

   - Use timestamp or UUID in resource names
   - Prevents conflicts from previous failed runs
   - Already implemented with `testRunId` in E2E tests

3. **Improve Idempotency Checks**

   - Query before create for all resources
   - Return success if resource exists with expected state
   - Use etags for concurrent modification detection

4. **Enhanced Error Recovery**

   - Implement retry with exponential backoff
   - Distinguish between transient and permanent failures
   - Log detailed error information for debugging

5. **Comprehensive Cleanup**

   - Order cleanup in reverse dependency order
   - Retry failed deletes
   - Verify cleanup completed successfully
   - Handle already-deleted resources gracefully

6. **Token Management**
   - Validate tokens before test execution
   - Provide clear error when tokens expire
   - Consider token refresh mechanism for long runs

---

## Current Test Credential Status

**Test Credential Files**:

- `google_bearer.token` - Missing (not in repository, .gitignored)
- `microsoft_bearer.token` - Missing (not in repository, .gitignored)

**Test Credential Script**:

- `./scripts/token-info.sh` - Validates token and shows metadata

**Environment Variables**:

- `TEST_GOOGLE_BEARER_TOKEN` - Not set
- `TEST_MS_BEARER_TOKEN` - Not set
- `TEST_DOMAIN` - Defaults to "test.example.com"

**Status**: Cannot execute E2E tests without valid bearer tokens

---

## Next Steps for E2E Test Improvement

### Immediate Actions

1. **Create Token Validation Tool**

   - Check token validity before tests
   - Display token scopes and expiration
   - Verify required permissions are present

2. **Add API Contract Tests**

   - Test each endpoint independently
   - Verify request/response schemas
   - Document actual vs expected behavior

3. **Implement Polling Utilities**
   - Wait for async operations to complete
   - Configurable timeout and polling interval
   - Clear error messages on timeout

### Medium-term Improvements

1. **Enhanced Step Idempotency**

   - Refactor all steps to be truly idempotent
   - Add `check` implementation to all steps
   - Verify state before execute

2. **Better Error Diagnostics**

   - Log full request/response for failures
   - Include rate limit information
   - Suggest remediation steps

3. **Parallel Test Safety**
   - Ensure test resources don't conflict
   - Use resource locking if needed
   - Support test isolation

### Long-term Goals

1. **Mock Mode for Development**

   - Record real API responses
   - Replay for fast local testing
   - Maintain contract compatibility

2. **Continuous Integration**

   - Run E2E tests on schedule
   - Alert on API contract changes
   - Track flaky test patterns

3. **Documentation Generation**
   - Auto-generate API docs from code
   - Keep examples up to date
   - Link to official documentation

---

## Appendix: Required OAuth Scopes

### Google Workspace

```
https://www.googleapis.com/auth/admin.directory.domain.readonly
https://www.googleapis.com/auth/admin.directory.orgunit
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.rolemanagement
https://www.googleapis.com/auth/cloud-identity.inboundsso
```

### Microsoft Graph

```
Application.ReadWrite.All
Directory.ReadWrite.All
Organization.Read.All
Policy.ReadWrite.ApplicationConfiguration
```

---

## References

- [Google Admin SDK Directory API](https://developers.google.com/admin-sdk/directory)
- [Google Cloud Identity API](https://cloud.google.com/identity/docs/reference/rest)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/overview)
- [Microsoft Graph Permissions](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform](https://learn.microsoft.com/en-us/entra/identity-platform/)
