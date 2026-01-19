# Easy CEP Directory Federation Orchestrator

Automates the integration between Google Workspace and Microsoft Entra ID (Azure AD) by orchestrating the API calls necessary to create and configure provisioning and SAML operations.

![Sample Screenshot](https://github.com/user-attachments/assets/12941a04-4544-48aa-8f41-d592c58a2dfd)

## What It Does

This application automates the manual process of setting up federation between Google Workspace and Microsoft 365. It executes a series of steps that:

- Create service accounts and organizational units in Google Workspace
- Configure SAML profiles and SSO assignments
- Set up Microsoft enterprise applications
- Configure provisioning and claims policies
- Exchange certificates and metadata between platforms

## Requirements

- Node.js and Bun
- Google Workspace admin account
- Microsoft Entra ID admin account
- OAuth applications in both platforms

## Setup

```bash
bun install

# Create .env.local with:
AUTH_SECRET=<random-string>
GOOGLE_OAUTH_CLIENT_ID=<your-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<your-client-secret>
MICROSOFT_OAUTH_CLIENT_ID=<your-client-id>
MICROSOFT_OAUTH_CLIENT_SECRET=<your-client-secret>

bun run dev
```

## Workflow Steps

1. **Verify Primary Domain** - Checks domain verification in Google Workspace
2. **Create Automation OU** - Creates `/Automation` organizational unit
3. **Create Service User** - Creates `azuread-provisioning@domain` account
4. **Create Admin Role and Assign User** - Sets up custom role with required privileges
5. **Configure Google SAML Profile** - Creates inbound SAML configuration
6. **Create Microsoft Apps** - Instantiates provisioning and SSO applications
7. **Setup Microsoft Provisioning** - Configures Azure AD user provisioning
8. **Configure Microsoft SSO** - Sets SSO mode and generates signing certificate
9. **Setup Microsoft Claims Policy** - Creates claims mapping policy
10. **Complete Google SSO Setup** - Updates SAML profile with Azure AD metadata
11. **Assign Users to SSO** - Enables SSO for all users
12. **Test SSO Configuration** - Manual end-to-end verification in browser

## Architecture

### Frontend

- Next.js 16 with React Server Components
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

Shared interfaces for API operations and HTTP clients live under
`lib/workflow/types/`, while reusable workflow constants can be found in
`lib/workflow/constants/`. Import these helpers rather than redefining them in
individual steps. The `google` and `microsoft` clients use a fluent API
implemented by `ResourceBuilder` so requests are written as chainable
expressions:

```ts
const user = await google.users.get("alice@example.com").get();
const created = await microsoft.applications
  .instantiate(templateId)
  .post({ displayName: "My App" });
```

## Testing

```bash
# Run tests
bun --env-file=.env.local test

# Run live E2E tests
RUN_E2E=1 bun --env-file=.env.local test

# Required for live E2E (.env.local)
# TEST_GOOGLE_REFRESH_TOKEN=<refresh-token>
# TEST_MS_REFRESH_TOKEN=<refresh-token>
# GOOGLE_OAUTH_CLIENT_ID=<your-client-id>
# GOOGLE_OAUTH_CLIENT_SECRET=<your-client-secret>
# MICROSOFT_OAUTH_CLIENT_ID=<your-client-id>
# MICROSOFT_OAUTH_CLIENT_SECRET=<your-client-secret>
# MICROSOFT_TENANT=<your-tenant-id>
# GOOGLE_HD_DOMAIN=<your-domain>
# TEST_DOMAIN=<domain>
# GOOGLE_SERVICE_ACCOUNT_JSON=<json> (optional)
# GOOGLE_SERVICE_ACCOUNT_FILE=<path> (optional)
# GOOGLE_IMPERSONATED_ADMIN_EMAIL=<email> (optional)

# Clean test environment
bun run e2e:cleanup

# Run live E2E tests (scripted)
bun run e2e:live

# Delete recent test apps/projects
bun run cleanup:apps
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
