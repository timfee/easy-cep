# Manual Testing Guide

## Pre-requisites

1. Two test tenants (Google Workspace and Microsoft 365)
2. Admin access to both tenants
3. API credentials configured in `.env`

## Test Scenarios

### 1. Happy Path

- Start with clean environment
- Run all steps in sequence
- Verify each step completes successfully
- Test SSO login at the end

### 2. Recovery Testing

For each step, test:

- Running when already completed
- Running after partial completion
- Running after failure

### 3. Error Injection

- Invalid credentials
- Insufficient permissions
- Network timeouts
- Rate limiting

### 4. Rollback Testing

- Delete resources in reverse order
- Verify no orphaned resources

## Manual Steps

The following workflow step cannot be automated and must be completed through the respective admin portal:

1. **test-sso-configuration** – perform a real sign‑in to verify SSO works end‑to‑end.

## Verification Steps

### Google Side

1. Check Admin Console > Directory > Users for service account
2. Verify Organizational Units shows /Automation
3. Check Admin Roles for custom role
4. Verify Security > Set up SSO shows configuration

### Microsoft Side

1. Check Azure Portal > Enterprise Applications
2. Verify provisioning configuration
3. Check synchronization status (should be "Active")
4. Verify claims policy assignment

### End-to-End SSO Test

1. Open incognito browser
2. Navigate to Gmail or Google Workspace app
3. Enter user email
4. Should redirect to Microsoft login
5. Complete Microsoft auth
6. Should return to Google app authenticated
