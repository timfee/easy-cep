# E2E Testing Documentation Index

This directory contains comprehensive documentation and tooling for E2E testing of the Easy CEP workflow.

## Quick Start

**If you have test credentials:**

```bash
# 1. Validate credentials
pnpm tsx scripts/validate-test-credentials.ts

# 2. Test API contracts
pnpm tsx scripts/test-api-contracts.ts

# 3. Run E2E tests
./test-live.sh
```

**If you don't have credentials yet**, see [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) for instructions on obtaining them.

## Documentation Files

### [FINDINGS.md](./FINDINGS.md) - **START HERE**
**Purpose**: Comprehensive analysis report addressing the problem statement

**Contains**:
- Executive summary of analysis
- Credential status and requirements
- Detailed API contract research findings
- Determinism and idempotency analysis
- Known blockers and workarounds
- Recommendations for production-ready tests
- Success criteria and next steps

**Audience**: Project leads, stakeholders, and developers needing overview

---

### [api-contracts-analysis.md](./api-contracts-analysis.md)
**Purpose**: Detailed API contract documentation and research

**Contains**:
- Google Workspace API contracts (Directory, Cloud Identity)
- Microsoft Graph API contracts (Applications, Service Principals, etc.)
- Required OAuth scopes and permissions
- Rate limits and throttling strategies
- Idempotency considerations for each endpoint
- API documentation references

**Audience**: Developers implementing or debugging workflow steps

---

### [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md)
**Purpose**: Step-by-step guide for running E2E tests

**Contains**:
- Prerequisites and setup instructions
- How to obtain test credentials
- Validation workflow before running tests
- Running tests (multiple methods)
- Understanding test results
- Troubleshooting common issues
- Best practices for reliable testing
- CI/CD integration guidance

**Audience**: QA engineers, developers running tests, CI/CD maintainers

---

### [e2e-notes.md](./e2e-notes.md)
**Purpose**: Known issues log

**Contains**:
- SAML profile creation 404 issue
- Workarounds currently in place
- Investigation history

**Audience**: Developers debugging known issues

---

## Scripts and Tools

### Validation Tools

#### `scripts/validate-test-credentials.ts`
Validates bearer tokens and checks API access.

**Usage**:
```bash
pnpm tsx scripts/validate-test-credentials.ts
```

**Features**:
- Checks token validity and expiration
- Verifies required OAuth scopes
- Tests API endpoint access
- Provides detailed diagnostic information

#### `scripts/test-api-contracts.ts`
Tests each API endpoint used in the workflow.

**Usage**:
```bash
pnpm tsx scripts/test-api-contracts.ts
```

**Features**:
- Tests all Google and Microsoft endpoints
- Generates JSON and Markdown reports
- Measures response times
- Categorizes failures vs warnings

#### `scripts/token-info.sh`
Displays token metadata and organization info.

**Usage**:
```bash
./scripts/token-info.sh
```

### Test Execution Scripts

#### `test-live.sh`
Convenience script that runs complete test workflow.

**Usage**:
```bash
./test-live.sh
```

**Steps**:
1. Validates tokens exist
2. Runs cleanup
3. Executes E2E tests
4. Reports results

#### `scripts/e2e-setup.ts`
Cleans test environment before/after tests.

**Usage**:
```bash
pnpm tsx scripts/e2e-setup.ts
```

**Features**:
- Deletes test resources from Google Workspace
- Deletes test resources from Microsoft
- Protects production resources
- Can be used for pre-test and post-test cleanup

#### `scripts/full-cleanup.ts`
More aggressive cleanup for stuck resources.

**Usage**:
```bash
pnpm tsx scripts/full-cleanup.ts
```

## Test Workflow Overview

### 1. Pre-Test Validation
```
validate-test-credentials.ts → test-api-contracts.ts → Review results
```

### 2. Environment Preparation
```
e2e-setup.ts (cleanup) → Verify clean state
```

### 3. Test Execution
```
test/e2e/workflow.test.ts → Execute 11 workflow steps → Undo steps
```

### 4. Post-Test Validation
```
e2e-setup.ts (final cleanup) → Verify no leaks
```

## Understanding Test Results

### Exit Codes
- `0` - All tests passed
- `1` - Some tests failed or credentials invalid

### Step Status Values
- `complete` - Step executed successfully
- `blocked` - Step cannot execute (API limitation, acceptable in some cases)
- `failed` - Step execution failed (needs investigation)
- `stale` - Step needs to be re-executed

### Report Files Generated
- `api-contract-test-results.json` - Machine-readable test results
- `api-contract-test-results.md` - Human-readable test report

## Key Findings Summary

### ✅ Working Well
- Token validation and API access checks
- Comprehensive documentation and tooling
- Test structure and cleanup logic
- Most API endpoints functional

### ⚠️ Needs Improvement
- Step idempotency (multiple create operations)
- Async operation handling (app provisioning)
- Error handling and retry logic
- Role name uniqueness (Google)

### ❌ Critical Blockers
- **Google SAML Profile Creation**: Returns 404 error
  - Blocks SSO setup completion
  - Documented in `e2e-notes.md`
  - Needs investigation with Google support

## Next Steps

### For Developers

1. **Read**: [FINDINGS.md](./FINDINGS.md) for complete analysis
2. **Review**: Known issues in each API section
3. **Implement**: Recommended idempotency improvements
4. **Test**: Individual steps with validation tools

### For QA/Testing

1. **Read**: [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md)
2. **Setup**: Obtain and configure test credentials
3. **Validate**: Run validation scripts
4. **Execute**: Run E2E tests
5. **Report**: Document any new issues found

### For Project Leads

1. **Read**: Executive Summary in [FINDINGS.md](./FINDINGS.md)
2. **Review**: Critical blockers and recommendations
3. **Prioritize**: Resolve SAML profile issue
4. **Plan**: Implement idempotency improvements
5. **Schedule**: Regular E2E test execution

## Credential Requirements

### Google Workspace
- Super Admin privileges
- 5 required OAuth scopes (see documentation)
- Bearer token (1 hour expiry)

### Microsoft Entra ID
- Global Administrator role
- 4 required Graph API permissions (see documentation)
- Bearer token (1 hour expiry)

## Support and Troubleshooting

### Common Issues

**Problem**: No tokens found
- **Solution**: See [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md#obtain-test-credentials)

**Problem**: Token expired
- **Solution**: Refresh tokens and re-validate

**Problem**: SAML profile 404
- **Solution**: Known issue, see [e2e-notes.md](./e2e-notes.md)

**Problem**: Tests fail on re-run
- **Solution**: Run cleanup: `pnpm tsx scripts/e2e-setup.ts`

### Getting Help

1. Check troubleshooting sections in guides
2. Review API contract documentation
3. Run validation tools for diagnostics
4. Check known issues
5. Open issue with detailed logs

## Contributing

When adding new workflow steps:

1. Document API contracts in `api-contracts-analysis.md`
2. Add endpoint tests to `test-api-contracts.ts`
3. Implement proper idempotency in step
4. Add validation in `check` method
5. Update test guides with new information

## Version History

- **v1.0** (2025-10-23): Initial comprehensive documentation
  - Complete API contract analysis
  - Validation and testing tools
  - E2E test guide
  - Findings report

---

**Last Updated**: 2025-10-23  
**Status**: Analysis Complete - Awaiting Live Credentials for Testing
