## 1. Reuse the shared tenant (`tim@timtest.cc`)

If you just want to hover over the UI, click buttons, and not think about Azure AD manifests, this is the path I recommend. The heavy lifting is already done for the `timtest.cc` domain, so you mostly grab credentials, run the token helper, and move on with your life.

1. Open the password vault: <https://timtest.cc/passwords>. That page tells you the current Google/Microsoft passwords, the refresh tokens the team reuses, and any other temporary bits we rotate. Bookmark it. Seriously.
2. Sign in to <https://admin.google.com> with `tim@timtest.cc`. No new YouTube tutorials needed—this account already has the OAuth consent screen and scopes listed later, including Admin SDK + Cloud Identity + site verification. Close the tab when you see the admin dashboard. Nothing else is required for this tenant unless you want to peek under the hood.
3. Sign in to <https://entra.microsoft.com> with the same email. Use **Settings > Directories + subscriptions** to double-check you are within the `timtest.cc` tenant, and note that the account already has **Cloud Application Administrator** powers. If a prompt asks for consent, just accept—it’s part of the same flow.
4. Run `bun run tokens:generate`. Pick `tim@timtest.cc` when the browser cycles through Google and Microsoft. The script writes fresh `TEST_GOOGLE_REFRESH_TOKEN` and `TEST_MS_REFRESH_TOKEN` values back into `.env.local`. That’s literally the only time you need to go through a login.

Once those tokens land, skip ahead to the Environment variables section to make sure the rest of the secrets match what’s in the vault. Sections 7 and 8 explain how to run the UI and the test suite using this tenant.

## 2. Build everything from scratch (when you cannot use `tim@timtest.cc`)

If you are deploying this for your own organization, congratulations—you get to go through every step. No shortcuts here, but I promise it’s not as painful as it feels when you first read it. Start with Section 3 so you know who needs access on each side, and then keep rolling through Sections 4–6. Treat Sections 7–9 as your launch checklist once the credentials are wired up.

## 3. Accounts & permissions

You need two humans with admin keys:

- **Google Workspace Admin**: Must be a Super Admin (or have custom roles for SSO/OU/User/Schema management).
- **Microsoft Entra Admin**: Must be a Global Admin or Cloud Application Administrator to create Enterprise Apps and Service Principals.

If your Google domain and Microsoft tenant share the same verified domain (like `cep-netnew.cc`), life is easier because the workflow matches users by domain. If they do not, you can still run everything; you just need to keep track of which domain feeds into `GOOGLE_HD_DOMAIN` and which tenant string becomes `MICROSOFT_TENANT`.

## 4. Google OAuth + service account

### Create the OAuth client for the UI

1. Go to <https://console.cloud.google.com/apis/dashboard> and pick (or create) the Google Cloud project tied to your Workspace tenant.
2. Under **APIs & Services > Credentials**, click **Create Credentials > OAuth client ID**.
3. Choose **Web application**, name it (I like `easy-cep-ui-dev`), and add the redirect URI `http://localhost:3000/api/auth/callback/google`. Later, add the production origin’s callback if you deploy.
4. Copy the Client ID/Secret into `.env.local` as `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`.

### Enable APIs

Search for and enable these APIs in the library:

- **Admin SDK API** (for users, OUs, roles)
- **Cloud Identity API** (for SSO profiles)
- **Google Site Verification API** (for domain checks)

### Create a Service Account (Optional but Recommended)

If you hate clicking login buttons (me too), create a service account so the tests can run headlessly.

1. **Credentials > Create Credentials > Service Account**. Name it `e2e-tester`.
2. Grant it **Owner** on the project (overkill, but easiest for now).
3. Create a JSON key and save the file path in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_FILE` (or paste the JSON content into `GOOGLE_SERVICE_ACCOUNT_JSON`).
4. **Important**: Go to <https://admin.google.com/ac/owl/domainwidedelegation>.
5. Add a new client with the Service Account’s **Unique ID** (from the GCP console).
6. Paste the comma-separated scopes from `lib/testing/tokens.ts` (e.g., `https://www.googleapis.com/auth/admin.directory.user`, etc.).
7. Set `GOOGLE_IMPERSONATED_ADMIN_EMAIL` in `.env.local` to `tim@timtest.cc` (or your admin email).

The code in `lib/testing/tokens.ts` prefers the service account over refresh tokens, so you only need the manual tokens if you skip the JSON key. If the service account is missing or misconfigured, the fallback path still uses `TEST_GOOGLE_REFRESH_TOKEN`.

## 5. Microsoft OAuth + app registration

### Register the confidential client

1. Log into <https://entra.microsoft.com> with the Entra admin.
2. Switch tenants via **Settings > Directories + subscriptions** if necessary.
3. Under **Identity > Applications > App registrations**, click **New registration**.
4. Name it (e.g., `easy-cep-ui`), pick **Accounts in this organizational directory only**, and skip the redirect URI for now.
5. Copy the **Application (client) ID** and **Directory (tenant) ID** into `.env.local`.

### Add a client secret

1. **Certificates & secrets > Client secrets > New client secret**.
2. Copy the **Value** immediately (it vanishes later) into `.env.local` as `MICROSOFT_OAUTH_CLIENT_SECRET`.

### Add API permissions

1. **API permissions > Add a permission > Microsoft Graph > Delegated permissions**.
2. Add: `Directory.Read.All`, `Application.ReadWrite.All`, `AppRoleAssignment.ReadWrite.All`, `Policy.ReadWrite.ApplicationConfiguration` (and `User.Read` is usually there by default).
3. **Grant admin consent for [Your Tenant]** so users don’t see a scary prompt.

### Add a redirect URI

1. **Authentication > Add a platform > Web**.
2. URL: `http://localhost:3000/api/auth/callback/microsoft`.
3. Check **ID tokens** (implicit flow) if you plan to use them, but the code mostly uses the authorization code flow.

The steps under the hood instantiate applications from the Google Workspace Connector template. That requires a service principal with permission to instantiate templates. The permission list above covers it.

If you want to pre-create those enterprise apps, fine—just ensure the UI regularly signs in with the OAuth client whose secret you stored in `.env.local`.

## 6. Environment variables (`.env.local`)

Here is the skeleton `.env.local`. Run `bun install` first so any scripts or tests can read these values.

```bash
# App & Auth
NODE_ENV=development
AUTH_SECRET=generate_something_random_here_please

# Google
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_HD_DOMAIN=timtest.cc
# Optional: Service Account
GOOGLE_SERVICE_ACCOUNT_FILE=./service-account.json
GOOGLE_IMPERSONATED_ADMIN_EMAIL=tim@timtest.cc

# Microsoft
MICROSOFT_OAUTH_CLIENT_ID=...
MICROSOFT_OAUTH_CLIENT_SECRET=...
MICROSOFT_TENANT=timtest.cc

# Testing (generated via bun run tokens:generate)
TEST_GOOGLE_REFRESH_TOKEN=...
TEST_MS_REFRESH_TOKEN=...
TEST_DOMAIN=timtest.cc

# Flags
ALLOW_INFO_PURGE=true
```

The `TEST_*_BEARER_TOKEN` values are only needed when you run `bun run cleanup:apps` or `scripts/full-cleanup.ts`. Those scripts delete apps/projects based on short-lived access tokens, so rotate them whenever you refresh credentials.

## 7. Serving mode (development/production)

1. `bun install` (this only needs to happen once unless dependencies change).
2. `bun run dev` starts the Next.js app on port 3000.
3. Open `http://localhost:3000`. You should see the step wizard.

The exact same `.env.local` works for production—just run `bun run build` followed by `bun run start` and update the production redirect URIs inside Google and Microsoft consoles.

## 8. Test mode (`NODE_ENV=test`)

The automated tests demand valid Google and Microsoft tokens with the scopes listed above. The environment must include the OAuth clients, `MICROSOFT_TENANT`, `GOOGLE_HD_DOMAIN` (or `TEST_DOMAIN`), plus either the refresh tokens or the service account credentials. The helper in `test/setup.ts` doubles as a guard rail—it calls `/tokeninfo` and `graph.microsoft.com/me` and fails fast whenever a scope or domain doesn't match expectations.

### Refresh tokens

If you skipped the service account, you need refresh tokens.

Run:

```
bun run tokens:generate
```

That script starts a temporary server on `http://localhost:3000`, prints clickable Google and Microsoft URLs (with `prompt=consent`, `access_type=offline`, and the tenant hints), waits for the callback with the code, exchanges it, and writes the refresh tokens straight into `.env.local`. Pick the Workspace admin first, then the Entra admin. Watch the console—each successful callback prints a “token saved” confirmation.

### Run the test suite

```bash
# Run everything (unit + E2E)
NODE_ENV=test bun test

# Run a specific file
NODE_ENV=test bun test test/workflow/steps/configure-google-saml.test.ts
```

The test helpers also expose cleanup knobs:

- `cleanupGoogleEnvironment()`: nukes test users, OUs, and SSO profiles matching the `_test` suffix.
- `cleanupMicrosoftEnvironment()`: nukes test apps and service principals matching the `_test` suffix.

If you need a full reset, run `bun x tsx scripts/full-cleanup.ts`. It also relies on `TEST_*_BEARER_TOKEN`.

## 9. Troubleshooting notes

- `/api/auth/status` complains `missing_scope`: clear your cookies (so the stale tokens vanish), then reauthenticate with the admin consent screen that includes the full scope list above.
- Google 400 `admin_policy_enforced`: you are trying to use a consumer Gmail account or an admin account without API access enabled in the Admin Console.
- Microsoft token thinks you’re on the wrong tenant or a personal MSA: log in with the correct Entra account via the Microsoft link in `bun run tokens:generate`, even if the browser keeps suggesting a different tenant.
- Rate-limited tests: `bun run e2e:setup` before rerunning `NODE_ENV=test bun test` gives you a clean slate and avoids leftover provisioning jobs.

## 10. References

- Google service account & domain-wide delegation guide: <https://developers.google.com/identity/protocols/oauth2/service-account>
- Google OAuth client example (authorization code + refresh tokens): <https://github.com/googleapis/google-auth-library-nodejs/blob/main/README.md>
- Microsoft identity platform app registration walkthrough: <https://learn.microsoft.com/en-us/graph/auth-register-app-v2>
