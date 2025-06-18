# Directory Federation Orchestrator

This application automates the integration between **Google Workspace** and **Microsoft Entra ID** (Azure AD) by orchestrating the API calls necessary to create and configure provisioning and SAML operations.

## Setup

Node.js and [PNPM](https://pnpm.io/) must be installed. Run `pnpm install` once before executing `pnpm check`, `pnpm dev`, or `pnpm lint` so that all dependencies are available. Authentication utilities, including cookie helpers, reside in `./lib/auth.ts`.

## Architecture

This project defines a series of discrete, type-safe `step` files. Each step:

- Encapsulates one unit of setup (e.g. create service user, configure SAML)
- Implements `check()` to detect current state
- Implements `execute()` to perform a mutation (if needed)
- Declares which variables it `requires` and what it `provides`
- Contributes to global state (`vars`) in a type-safe way

The runtime engine orchestrates execution across steps using these declarations.

Workflow variables live in `./app/workflow/variables.ts` and step identifiers
in `./app/workflow/step-ids.ts`. These are re-exported from `types.ts` so most
code can simply import from `@/types`.

## Steps

Steps follow a two-phase pattern:

1. **Check Phase**: Determines if work needs to be done

   - Must handle errors (service might be down)
   - Calls one of: markComplete, markIncomplete, markCheckFailed
   - Passes typed data to execute phase

2. **Execute Phase**: Performs the actual work
   - Receives typed checkData from check phase
   - Must handle errors
   - Calls one of: markSucceeded, markFailed, markPending

State is managed client-side in React. Each step reports its status through callbacks.

Error handling is mandatory at every level - both phases must use try-catch.

### Environment Variables in Steps

Steps must not read directly from `process.env`. Any required environment variables must be declared in `env.ts` and accessed via the `env` import. All other runtime state must use workflow `vars` (via the `Var` enum and `getVar(vars, Var.X)` helper) to ensure type safety and consistency.

## Notes

Use `pnpm` for package management and execution.

## Network access

Internet access is available to install dependencies during the setup script phase. During the agent phase, internet access is disabled by default, but you can configure the environment to have limited or full internet access. [Learn more about agent internet access.](https://platform.openai.com/docs/codex/agent-network)

Environments run behind an HTTP/HTTPS network proxy for security and abuse prevention purposes. All outbound internet traffic passes through this proxy.

Environments are pre-configured to work with common tools and package managers:

- Codex sets standard environment variables including `http_proxy` and `https_proxy`. These settings are respected by tools such as `curl`, `npm`, and `pip`.
- Codex installs a proxy certificate into the system trust store. This certificate's path is available as the environment variable `$CODEX_PROXY_CERT`. Additionally, specific package manager variables (e.g., `PIP_CERT`, `NODE_EXTRA_CA_CERTS`) are set to this certificate path.

If you're encountering connectivity issues, verify and/or configure the following:

- Ensure you are connecting via the proxy at `http://proxy:8080`.
- Ensure you are trusting the proxy certificate located at `$CODEX_PROXY_CERT`. Always reference this environment variable instead of using a hardcoded file path, as the path may change.

The `scripts/token-info.sh` script will output bearer tokens in text format for using against Google and Microsoft as `./google_bearer.token` and `./microsoft_bearer.token` that you can use to verify commands.

## Testing

1. Run `pnpm install`.
2. Obtain Google and Microsoft bearer tokens and store them in `google_bearer.token` and `microsoft_bearer.token`.
3. Run `pnpm test`.

Tests require network access and will use `undici` through the proxy unless `USE_UNDICI_PROXY=false`.

**NOTE:** YOU HAVE BEEN PROVIDED FULL INTERNET ACCESS. IF YOU ENCOUNTER ANY ISSUES, IT IS PROXY RELATED; NOT CODEX CONFIGURATION.
