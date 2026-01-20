# SETUP

I wrote this guide because every time I try to explain the federation workflow it turns into a three-hour hangout where we keep trading links back and forth. You really only need two things:

- A Google Workspace + Microsoft Entra tenant pair that already has the right apps and scopes. (That’s the `tim@timtest.cc` path.)
- Or, your own fresh tenant pair where we build the OAuth clients, service account, and secrets together from the ground up.

Both roads end with the same `.env.local` file, which is the door that opens the UI and the tests. Pick whichever suits your patience level and skip whichever steps feel redundant.


## 1. Reuse the shared tenant (`tim@timtest.cc`)

If you just want to hover over the UI, click buttons, and not think about Azure AD manifests, this is the path I recommend. The heavy lifting is already done for the `timtest.cc` domain, so you mostly grab credentials, run the token helper, and move on with your life.

1. Open the password vault: https://timtest.cc/passwords. That page tells you the current Google/Microsoft passwords, the refresh tokens the team reuses, and any other temporary bits we rotate. Bookmark it. Seriously.
2. Sign in to https://admin.google.com with `tim@timtest.cc`. No new YouTube tutorials needed—this account already has the OAuth consent screen and scopes listed later, including Admin SDK + Cloud Identity + site verification. Close the tab when you see the admin dashboard. Nothing else is required for this tenant unless you want to peek under the hood.
3. Sign in to https://entra.microsoft.com with the same email. Use **Settings > Directories + subscriptions** to double-check you are within the `timtest.cc` tenant, and note that the account already has **Cloud Application Administrator** powers. If a prompt asks for consent, just accept—it’s part of the same flow.
4. Run `bun run tokens:generate`. Pick `tim@timtest.cc` when the browser cycles through Google and Microsoft. The script writes fresh `TEST_GOOGLE_REFRESH_TOKEN` and `TEST_MS_REFRESH_TOKEN` values back into `.env.local`. That’s literally the only time you need to go through a login.

Once those tokens land, skip ahead to the Environment variables section to make sure the rest of the secrets match what’s in the vault. Sections 7 and 8 explain how to run the UI and the test suite using this tenant.


## 2. Build everything from scratch (when you cannot use `tim@timtest.cc`)

If you are deploying this for your own organization, congratulations—you get to go through every step. No shortcuts here, but I promise it’s not as painful as it feels when you first read it. Start with Section 3 so you know who needs access on each side, and then keep rolling through Sections 4–6. Treat Sections 7–9 as your launch checklist once the credentials are wired up.


## 3. Accounts & permissions

You need two humans with admin keys:

- **Google Workspace admin** – ideally a super-admin who can turn on the Admin SDK, Cloud Identity API, and Site Verification API inside a Google Cloud project, manage domains/org units/roles, and consent to OAuth scopes. This person also copies the client ID/secret and optionally configures domain-wide delegation for the service account.
- **Microsoft Entra admin** – the least privileged role that works is **Cloud Application Administrator**. This person registers the OAuth app, consents to Graph permissions, and will later create service principals via the workflow. Personal Microsoft accounts belong in another universe; the test suite rejects tenant ID `9188040d-6c67-4c5b-b112-36a304b66dad`.

If your Google domain and Microsoft tenant share the same verified domain (like `cep-netnew.cc`), life is easier because the workflow matches users by domain. If they do not, you can still run everything; you just need to keep track of which domain feeds into `GOOGLE_HD_DOMAIN` and which tenant string becomes `MICROSOFT_TENANT`.


## 4. Google OAuth + service account

### Create the OAuth client for the UI

1. Go to https://console.cloud.google.com/apis/dashboard and pick (or create) the Google Cloud project tied to your Workspace tenant.
2. Under **APIs & Services > Credentials**, click **Create Credentials > OAuth client ID**.
3. Choose **Web application**, name it (I like `easy-cep-ui-dev`), and add the redirect URI `http://localhost:3000/api/auth/callback/google`. Later, add the production origin’s callback if you deploy.
4. Copy the Client ID/Secret into `.env.local` as `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`.

You must consent to this exact scope list (copied from `lib/auth.ts` and `lib/testing/tokens.ts`):

```
openid
email
profile
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.orgunit
https://www.googleapis.com/auth/admin.directory.domain
https://www.googleapis.com/auth/admin.directory.rolemanagement
https://www.googleapis.com/auth/cloud-identity.inboundsso
https://www.googleapis.com/auth/siteverification
```

The code already sets `access_type=offline` and `prompt=consent`, so the first login hands you refresh tokens. To keep the login gated to your Workspace domain, set `GOOGLE_HD_DOMAIN` to something like `cep-netnew.cc`; that writes the `hd` parameter into the OAuth URL and stops outside accounts from sneaking in.

### (Optional) Service account + domain-wide delegation for tests

If you hate clicking login buttons (me too), create a service account so the tests can mint tokens automatically:

1. In **IAM & Admin > Service accounts**, create an account (e.g., `easy-cep-automation`).
2. Download a JSON key. Dump it into `GOOGLE_SERVICE_ACCOUNT_JSON` inside `.env.local` (wrap it in single quotes) or point to it with `GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/key.json`.
3. Toggle on **Domain-wide delegation** and keep the numeric client ID handy.
4. In the Workspace Admin console go to **Security > Access and data control > API Controls > Domain wide delegation** and hit **Manage domain wide delegation**. Add the client ID and paste the comma-delimited scope list above. This gives the service account permission to impersonate users.
5. Set `GOOGLE_IMPERSONATED_ADMIN_EMAIL` to a Workspace admin account. The automation will impersonate that person when it asks for tokens.

The code in `lib/testing/tokens.ts` prefers the service account over refresh tokens, so you only need the manual tokens if you skip the JSON key. If the service account is missing or misconfigured, the fallback path still uses `TEST_GOOGLE_REFRESH_TOKEN`.


## 5. Microsoft OAuth + app registration

### Register the confidential client

1. Log into https://entra.microsoft.com with the Entra admin.
2. Switch tenants via **Settings > Directories + subscriptions** if necessary.
3. Under **Identity > Applications > App registrations**, click **New registration**.
4. Name it (e.g., `easy-cep-ui`), pick **Accounts in this organizational directory only**, and skip the redirect URI for now.
5. Register it, then copy the **Application (client) ID** into `MICROSOFT_OAUTH_CLIENT_ID`.
6. Under **Authentication > Platform configurations**, add a **Web** platform with `http://localhost:3000/api/auth/callback/microsoft`. Later add your production callback if you publish.
7. In **Certificates & secrets**, create a **New client secret** and paste the value into `MICROSOFT_OAUTH_CLIENT_SECRET`.

### Grant the required Graph permissions

Go to **API permissions** and add these delegated permissions for Microsoft Graph (the workflow hits both v1.0 and beta routes):

```
User.Read
Directory.Read.All
Application.ReadWrite.All
AppRoleAssignment.ReadWrite.All
Policy.ReadWrite.ApplicationConfiguration
```

After adding them, click **Grant admin consent**. If you skip this, `/api/auth/status` and `test/setup.ts` will complain with `missing_scope` or `invalid_token` errors.

### Tenant hints

If your tenant domain is `cep-netnew.cc` or similar, set `MICROSOFT_TENANT` to the domain or the tenant GUID. This value feeds into the authorization URL to add `domain_hint` and ensures the token request hits the right endpoint (see `lib/auth.ts`).

### What the workflow does later

The steps under the hood instantiate applications from the Google Workspace Connector template (`01303a13-8322-4e06-bee5-80d612907131`). To avoid permission issues, make sure the Graph token has `Application.ReadWrite.All`, `Directory.Read.All`, `AppRoleAssignment.ReadWrite.All`, and `Policy.ReadWrite.ApplicationConfiguration`. Otherwise the claims policies and provisioning sync jobs fail.

If you want to pre-create those enterprise apps, fine—just ensure the UI regularly signs in with the OAuth client whose secret you stored in `.env.local`.


## 6. Environment variables (`.env.local`)

Here is the skeleton `.env.local`. Run `bun install` first so any scripts or tests can read these values.

```
AUTH_SECRET=<32+ character secret, e.g., `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`>
GOOGLE_OAUTH_CLIENT_ID=<from Google Cloud>
GOOGLE_OAUTH_CLIENT_SECRET=<from Google Cloud>
MICROSOFT_OAUTH_CLIENT_ID=<from Entra app registration>
MICROSOFT_OAUTH_CLIENT_SECRET=<new client secret>
MICROSOFT_TENANT=<your tenant domain or GUID>
GOOGLE_HD_DOMAIN=<Workspace domain used for hd filtering>
GOOGLE_IMPERSONATED_ADMIN_EMAIL=<admin email for service-account impersonation>
GOOGLE_SERVICE_ACCOUNT_JSON='...paste JSON blob...'
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/to/key.json
TEST_DOMAIN=<optional domain used by tests>
TEST_GOOGLE_REFRESH_TOKEN=<refresh token from bun run tokens:generate>
TEST_MS_REFRESH_TOKEN=<refresh token from bun run tokens:generate>
TEST_GOOGLE_BEARER_TOKEN=<optional access token for cleanups>
TEST_MS_BEARER_TOKEN=<optional access token for cleanups>
ALLOW_INFO_PURGE=true
```

`GOOGLE_SERVICE_ACCOUNT_JSON` and `_FILE` are optional twins—use whichever makes you less anxious about leaking secrets. If both are empty, the test suite falls back to `TEST_*_REFRESH_TOKEN`. The service account path quietly creates access tokens via JWT assertions (see `lib/testing/tokens.ts`) so you don’t even have to run the refresh flow.

The `TEST_*_BEARER_TOKEN` values are only needed when you run `bun run cleanup:apps` or `scripts/full-cleanup.ts`. Those scripts delete apps/projects based on short-lived access tokens, so rotate them whenever you refresh credentials.


## 7. Serving mode (development/production)

1. `bun install` (this only needs to happen once unless dependencies change).
2. Make sure `.env.local` contains the OAuth clients, `AUTH_SECRET`, and any optional tokens you rely on.
3. Start the dev server with `bun run dev` and open `http://localhost:3000`.
4. Click the Google or Microsoft buttons; the backend handles the OAuth dance, stores encrypted chunked cookies, and `/api/auth/status` will report whether the tokens are live.
5. When you rotate client secrets, stop the server, clear your browser cookies, and restart so the new tokens overwrite the old ones.

The exact same `.env.local` works for production—just run `bun run build` followed by `bun run start` and update the production redirect URIs inside Google and Microsoft consoles.


## 8. Test mode (`NODE_ENV=test`)

The automated tests demand valid Google and Microsoft tokens with the scopes listed above. The environment must include the OAuth clients, `MICROSOFT_TENANT`, `GOOGLE_HD_DOMAIN` (or `TEST_DOMAIN`), plus either the refresh tokens or the service account credentials. The helper in `test/setup.ts` doubles as a guard rail—it calls `/tokeninfo` and `graph.microsoft.com/me` and fails fast whenever a scope or domain doesn't match expectations.

### Generate refresh tokens

Run:

```
bun run tokens:generate
```
That script starts a temporary server on `http://localhost:3000`, prints clickable Google and Microsoft URLs (with `prompt=consent`, `access_type=offline`, and the tenant hints), waits for the callback with the code, exchanges it, and writes the refresh tokens straight into `.env.local`. Pick the Workspace admin first, then the Entra admin. Watch the console—each successful callback prints a “token saved” confirmation.

### Run the test suite

1. Confirm `TEST_GOOGLE_REFRESH_TOKEN` and `TEST_MS_REFRESH_TOKEN` are populated (or that the service account values exist).
2. Execute `NODE_ENV=test bun test` (or use `NODE_ENV=test bun test path/to/file.test.ts`). The setup script validates the tokens before any tests run, so if you hit a scope error you’ll see it before the suites start.
3. If you rotate tokens manually, rerun the generator. The tests keep reusing the values already in `.env.local`.

The test helpers also expose cleanup knobs:

- `bun run cleanup:apps` removes Microsoft apps and Google projects created in the last ten days. It expects `TEST_*_BEARER_TOKEN` values.
- `bun run e2e:setup` removes stale users/org units/roles/SSO profiles/apps/claims policies so that the live E2E run starts clean.
- `bun run e2e:live` requires the refresh tokens and runs the live workflow against both tenants.

If you need a full reset, run `bun x tsx scripts/full-cleanup.ts`. It also relies on `TEST_*_BEARER_TOKEN`.


## 9. Troubleshooting notes

- `/api/auth/status` complains `missing_scope`: clear your cookies (so the stale tokens vanish), then reauthenticate with the admin consent screen that includes the full scope list above.
- Google token `hd` claim doesn’t match your domain: rerun the token generator with the correct Workspace admin account. The warning from `test/setup.ts` will tell you the domain it expected.
- Microsoft token thinks you’re on the wrong tenant or a personal MSA: log in with the correct Entra account via the Microsoft link in `bun run tokens:generate`, even if the browser keeps suggesting a different tenant.
- Rate-limited tests: `bun run e2e:setup` before rerunning `NODE_ENV=test bun test` gives you a clean slate and avoids leftover provisioning jobs.


## 10. References

- Google service account & domain-wide delegation guide: https://developers.google.com/identity/protocols/oauth2/service-account
- Google OAuth client example (authorization code + refresh tokens): https://github.com/googleapis/google-auth-library-nodejs/blob/main/README.md
- Microsoft identity platform app registration walkthrough: https://learn.microsoft.com/en-us/graph/auth-register-app-v2

