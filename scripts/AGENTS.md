# Script Guidelines

- Shell scripts should start with `#!/usr/bin/env bash` and `set -euo pipefail`.
- Node scripts are written in TypeScript and run with `pnpm tsx`.
- Scripts expect bearer tokens via environment variables or token files.
- Do not embed real credentials or tenant IDs directly in scripts.
- Use the constants in `constants.ts` for API endpoints.
