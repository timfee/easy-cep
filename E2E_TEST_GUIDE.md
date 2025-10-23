# E2E Test Execution Guide

This guide provides detailed instructions for setting up and running the E2E test suite reliably.

## Prerequisites

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Obtain Test Credentials

You need bearer tokens for both Google Workspace and Microsoft Graph with appropriate permissions.

#### Google Workspace Token

**Required Scopes:**
```
https://www.googleapis.com/auth/admin.directory.domain.readonly
https://www.googleapis.com/auth/admin.directory.orgunit
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.rolemanagement
https://www.googleapis.com/auth/cloud-identity.inboundsso
```

**How to Obtain:**
1. Set up an OAuth 2.0 client in Google Cloud Console
2. Use OAuth 2.0 Playground or custom flow to get access token
3. Ensure the authenticated user has Super Admin privileges in Google Workspace

**Save Token:**
```bash
echo "YOUR_GOOGLE_ACCESS_TOKEN" > google_bearer.token
```

#### Microsoft Graph Token

**Required Permissions:**
```
Application.ReadWrite.All
Directory.ReadWrite.All
Organization.Read.All
Policy.ReadWrite.ApplicationConfiguration
```

**How to Obtain:**
1. Register an application in Azure AD / Microsoft Entra ID
2. Grant the required permissions (may require admin consent)
3. Use OAuth 2.0 authorization code flow or device code flow
4. Ensure the authenticated user has Global Administrator role

**Save Token:**
```bash
echo "YOUR_MICROSOFT_ACCESS_TOKEN" > microsoft_bearer.token
```

### 3. Configure Test Domain

Set the test domain environment variable:

```bash
export TEST_DOMAIN="your-test-domain.com"
```

Or the default `test.example.com` will be used.

## Validation Steps

### Step 1: Verify Tokens

Run the token validation script to ensure your credentials are valid:

```bash
pnpm tsx scripts/validate-test-credentials.ts
```

Expected output:
```
✅ VALID - Google Workspace Credentials
✅ VALID - Microsoft Graph Credentials
✅ All available credentials are valid
✅ E2E tests should be able to run
```

### Step 2: Test API Contracts

Run the API contract tests to verify all endpoints are accessible:

```bash
pnpm tsx scripts/test-api-contracts.ts
```

This will:
- Test each API endpoint used in the workflow
- Verify request/response formats
- Check for permission issues
- Generate detailed reports in JSON and Markdown format

Review the generated files:
- `api-contract-test-results.json` - Machine-readable results
- `api-contract-test-results.md` - Human-readable report

### Step 3: Check Token Info

Use the built-in script to see token metadata:

```bash
./scripts/token-info.sh
```

This displays:
- Token expiration time
- Authorized scopes
- Organization information
- Verified domains

## Running E2E Tests

### Option 1: Using test-live.sh

The convenience script handles setup and execution:

```bash
./test-live.sh
```

This script:
1. Validates tokens exist
2. Runs pre-test cleanup
3. Executes the E2E test suite
4. Reports results

### Option 2: Manual Execution

For more control, run tests manually:

```bash
# Clean environment first
pnpm tsx scripts/e2e-setup.ts

# Run tests
pnpm test test/e2e/workflow.test.ts

# Optional: Run specific test
pnpm test test/e2e/workflow.test.ts -t "Execute: verify-primary-domain"
```

### Option 3: With Environment Variables

```bash
export TEST_GOOGLE_BEARER_TOKEN=$(cat google_bearer.token)
export TEST_MS_BEARER_TOKEN=$(cat microsoft_bearer.token)
export TEST_DOMAIN="your-test-domain.com"

pnpm test test/e2e/workflow.test.ts
```

## Understanding Test Results

### Success Criteria

Each step should complete with status `complete` or `blocked`:
- `complete` - Step executed successfully
- `blocked` - Step cannot execute due to API limitations (acceptable in some cases)

### Common Issues

#### Token Expired

**Symptom:** 401 Unauthorized errors

**Solution:**
```bash
# Refresh tokens and update files
echo "NEW_TOKEN" > google_bearer.token
echo "NEW_TOKEN" > microsoft_bearer.token

# Verify
pnpm tsx scripts/validate-test-credentials.ts
```

#### Insufficient Permissions

**Symptom:** 403 Forbidden errors

**Solution:**
- Review required scopes/permissions in `api-contracts-analysis.md`
- Ensure tokens have all required permissions
- Check that user has admin privileges

#### Rate Limiting

**Symptom:** 429 Too Many Requests

**Solution:**
- Wait for rate limit window to reset (usually 1 minute)
- Run tests with longer delays between operations
- Check for concurrent API usage

#### Resource Already Exists

**Symptom:** Test fails because resource from previous run exists

**Solution:**
```bash
# Run cleanup
pnpm tsx scripts/e2e-setup.ts

# Or full cleanup
pnpm tsx scripts/full-cleanup.ts

# Then retry tests
pnpm test test/e2e/workflow.test.ts
```

#### Async Operation Not Complete

**Symptom:** Step fails because previous operation still processing

**Solution:**
- Increase Jest timeout in test file
- Add polling/wait logic in step implementation
- Check for long-running operations (LROs)

## Test Workflow Stages

The E2E test executes these stages in order:

### Stage 1: Pre-Test Cleanup
- Deletes test service users
- Removes test organizational units
- Deletes test admin roles
- Cleans up SAML profiles
- Removes Microsoft apps and policies

### Stage 2: Execute Forward Steps
1. **Verify Primary Domain** - Confirms domain is verified
2. **Create Automation OU** - Creates `/test-automation-{id}` OU
3. **Create Service User** - Creates `test-azuread-provisioning-{id}@domain`
4. **Create Admin Role** - Creates custom role with provisioning privileges
5. **Configure Google SAML Profile** - Sets up inbound SAML (may be blocked)
6. **Create Microsoft Apps** - Instantiates provisioning and SSO apps
7. **Setup Microsoft Provisioning** - Configures sync job and credentials
8. **Configure Microsoft SSO** - Sets SSO mode and generates certificate
9. **Setup Microsoft Claims Policy** - Creates and assigns claims policy
10. **Complete Google SSO Setup** - Updates SAML with Azure metadata
11. **Assign Users to SSO** - Enables SSO for users

### Stage 3: Execute Undo Steps
Reverses all operations in reverse order to clean up test resources.

### Stage 4: Post-Test Cleanup
Final cleanup to ensure environment is clean.

## Debugging Failed Tests

### Enable Detailed Logging

The test already logs detailed information. To see more:

1. Check step logs in console output
2. Look for HTTP method, URL, and status codes
3. Review error data structures

### Examine Specific Step

To debug a single step:

```typescript
// In test file, comment out other steps and focus on one:
const steps = [
  // StepId.VerifyPrimaryDomain,
  // StepId.CreateAutomationOU,
  StepId.CreateServiceUser  // Only test this step
  // ... rest commented
];
```

### Check API Responses Manually

Use curl to test API calls directly:

```bash
# Google example
curl -H "Authorization: Bearer $(cat google_bearer.token)" \
  https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains

# Microsoft example  
curl -H "Authorization: Bearer $(cat microsoft_bearer.token)" \
  https://graph.microsoft.com/v1.0/organization
```

### Review Cleanup Status

Ensure cleanup completed successfully:

```bash
# Check Google resources
pnpm tsx scripts/e2e-setup.ts

# Check Microsoft resources
# (cleanup runs automatically, check logs for errors)
```

## Best Practices

### 1. Always Cleanup Before Tests

```bash
pnpm tsx scripts/e2e-setup.ts
```

This prevents conflicts with resources from previous runs.

### 2. Use Unique Test Identifiers

The test suite uses `testRunId` (timestamp) to create unique resource names:
```typescript
const testRunId = Date.now().toString(36);
[Var.AutomationOuName]: `test-automation-${testRunId}`
```

This allows multiple test runs without conflicts.

### 3. Monitor Token Expiration

Tokens typically expire in 1 hour. For long test runs:
- Refresh tokens periodically
- Use refresh tokens if available
- Monitor token expiration warnings

### 4. Run Tests in Isolation

Avoid running multiple test suites simultaneously:
- Race conditions may occur
- Rate limits may be hit
- Resources may conflict

### 5. Verify Cleanup Completed

After tests, verify all test resources were removed:

```bash
# List remaining test resources in Google
curl -H "Authorization: Bearer $(cat google_bearer.token)" \
  "https://admin.googleapis.com/admin/directory/v1/users?domain=test.example.com&query=email:test-azuread-provisioning-*"

# List remaining test apps in Microsoft
curl -H "Authorization: Bearer $(cat microsoft_bearer.token)" \
  "https://graph.microsoft.com/beta/applications?\$filter=startswith(displayName,'Test ')"
```

## Continuous Integration

For CI/CD pipelines:

### Store Tokens Securely

```bash
# GitHub Actions example
- name: Setup credentials
  env:
    GOOGLE_TOKEN: ${{ secrets.TEST_GOOGLE_BEARER_TOKEN }}
    MS_TOKEN: ${{ secrets.TEST_MS_BEARER_TOKEN }}
  run: |
    echo "$GOOGLE_TOKEN" > google_bearer.token
    echo "$MS_TOKEN" > microsoft_bearer.token
```

### Run Validation First

```yaml
- name: Validate credentials
  run: pnpm tsx scripts/validate-test-credentials.ts

- name: Test API contracts
  run: pnpm tsx scripts/test-api-contracts.ts
  
- name: Run E2E tests
  run: pnpm test test/e2e/workflow.test.ts
```

### Handle Failures Gracefully

```yaml
- name: Cleanup on failure
  if: failure()
  run: pnpm tsx scripts/e2e-setup.ts
```

### Archive Test Results

```yaml
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      api-contract-test-results.json
      api-contract-test-results.md
```

## Troubleshooting Guide

### Problem: "No tokens found"

**Cause:** Token files don't exist or environment variables not set

**Fix:**
```bash
# Create token files
echo "your-token-here" > google_bearer.token
echo "your-token-here" > microsoft_bearer.token

# Or set environment variables
export TEST_GOOGLE_BEARER_TOKEN="your-token"
export TEST_MS_BEARER_TOKEN="your-token"
```

### Problem: "SAML profile creation returns 404"

**Cause:** Google Cloud Identity API has restrictions in some environments

**Status:** This is a known issue documented in `e2e-notes.md`

**Current Solution:** Tests accept `blocked` status for this step

### Problem: "Service principal not found after app creation"

**Cause:** Async provisioning delay

**Fix:** Add polling logic in step implementation to wait for SP availability

### Problem: Tests pass but resources remain

**Cause:** Cleanup failed or skipped

**Fix:**
```bash
# Run full cleanup
pnpm tsx scripts/full-cleanup.ts

# Verify manually
./scripts/token-info.sh
pnpm tsx scripts/test-api-contracts.ts
```

### Problem: "Rate limit exceeded"

**Cause:** Too many API calls in short time

**Fix:**
- Wait 1-2 minutes before retrying
- Add delays between test steps
- Check for other processes using APIs

## Getting Help

If you encounter issues:

1. Check `api-contracts-analysis.md` for API contract details
2. Review `e2e-notes.md` for known issues
3. Run validation scripts to isolate the problem
4. Check API documentation for changes
5. Open an issue with:
   - Token validation output
   - API contract test results
   - Full error logs
   - Steps to reproduce

## Next Steps

After successful E2E test execution:

1. Review test coverage gaps
2. Add tests for edge cases
3. Improve error handling in steps
4. Enhance idempotency checks
5. Consider adding mock mode for development
