#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/token-info.sh

if [[ -f ".env.test" ]]; then
  export $(grep -v '^#' .env.test | xargs)
fi

GOOGLE_TOKEN="${TEST_GOOGLE_BEARER_TOKEN:-}"
MS_TOKEN="${TEST_MS_BEARER_TOKEN:-}"

if [[ -z "$GOOGLE_TOKEN" ]]; then
  echo "Google token not found in environment or .env.test" >&2
  exit 1
fi
if [[ -z "$MS_TOKEN" ]]; then
  echo "Microsoft token not found in environment or .env.test" >&2
  exit 1
fi

# Query Google tokeninfo endpoint
echo "# Google token info"
curl -fsSL "https://oauth2.googleapis.com/tokeninfo?access_token=${GOOGLE_TOKEN}" | jq .

echo

# Query Microsoft Graph to fetch organization domains
echo "# Microsoft organization"
curl -fsSL -H "Authorization: Bearer ${MS_TOKEN}" https://graph.microsoft.com/v1.0/organization | jq .
