# Easy CEP Directory Federation Orchestrator

![screenshot](https://github.com/user-attachments/assets/63ee1ced-3095-40e2-bac7-9bb234827586)

Automates the integration between Google Workspace and Microsoft Entra ID (Azure AD) by orchestrating the API calls necessary to create and configure provisioning and SAML operations.

## What It Does

This application automates the manual process of setting up federation between Google Workspace and Microsoft 365. It executes a series of 10 steps that:

- Create service accounts and organizational units in Google Workspace
- Configure SAML profiles and SSO assignments
- Set up Microsoft enterprise applications
- Configure provisioning and claims policies
- Exchange certificates and metadata between platforms

## Requirements

- Node.js and pnpm
- Google Workspace admin account
- Microsoft Entra ID admin account
- OAuth applications in both platforms

## Setup

```bash
pnpm install

# Create .env.local with:
AUTH_SECRET=<random-string>
GOOGLE_OAUTH_CLIENT_ID=<your-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<your-client-secret>
MICROSOFT_OAUTH_CLIENT_ID=<your-client-id>
MICROSOFT_OAUTH_CLIENT_SECRET=<your-client-secret>

pnpm dev
```

## Workflow Steps

1. **Verify Primary Domain** - Checks domain verification in Google Workspace
2. **Create Automation OU** - Creates `/Automation` organizational unit
3. **Create Service User** - Creates `azuread-provisioning@domain` account
4. **Create Admin Role and Assign User** - Sets up custom role with required privileges
5. **Configure Google SAML Profile** - Creates inbound SAML configuration
6. **Create Microsoft Apps** - Instantiates provisioning and SSO applications
7. **Configure Microsoft Sync and SSO** - Sets up synchronization job
8. **Setup Microsoft Claims Policy** - Creates claims mapping policy
9. **Complete Google SSO Setup** - Updates SAML profile with Azure AD metadata
10. **Assign Users to SSO** - Enables SSO for all users

## Architecture

### Frontend

- Next.js 15 with React Server Components
- Real-time workflow status updates
- Variable inspector for configuration values
- Expandable step cards with execution logs

### Backend

- Server actions for step execution
- OAuth 2.0 authentication with encrypted cookie storage
- Type-safe API calls with Zod validation

### Step Implementation

Steps are defined in `lib/workflow/steps/` following this pattern:

```typescript
export default defineStep(StepId.StepName)
  .requires(Var.InputVariable)
  .provides(Var.OutputVariable)
  .check(
    async ({
      vars,
      google,
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed
    }) => {
      // Check if already complete
    }
  )
  .execute(
    async ({ vars, google, microsoft, output, markFailed, markPending }) => {
      // Perform the work
    }
  )
  .undo(async ({ vars, google, microsoft, markReverted, markFailed }) => {
    // Rollback if needed
  })
  .build();
```

## Testing

```bash
# Run tests
pnpm test

# Clean test environment
pnpm tsx scripts/full-cleanup.ts

# Verify tokens
./scripts/token-info.sh
```

## API Endpoints

The application calls these primary endpoints:

**Google**

- `admin.googleapis.com/admin/directory/v1` - Directory API
- `cloudidentity.googleapis.com/v1` - Cloud Identity API

**Microsoft**

- `graph.microsoft.com/v1.0` - Microsoft Graph API
- `graph.microsoft.com/beta` - Beta endpoints for claims policies

## Security

- OAuth tokens stored in encrypted, chunked HTTP-only cookies
- No credentials persisted to disk
- Service accounts use generated passwords
- Protected resources cannot be deleted through the UI

## Scripts

- `scripts/token-info.sh` - Display token information
- `scripts/cleanup-apps.sh` - Remove applications created in last 10 days
- `scripts/full-cleanup.ts` - Remove all test resources
- `scripts/e2e-setup.ts` - Prepare clean test environment
