#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/token-info.sh [GOOGLE_TOKEN_FILE] [MICROSOFT_TOKEN_FILE]
# Defaults to ./google_bearer.token and ./microsoft_bearer.token

GOOGLE_TOKEN_FILE="${1:-./google_bearer.token}"
MS_TOKEN_FILE="${2:-./microsoft_bearer.token}"

if [[ ! -f "$GOOGLE_TOKEN_FILE" ]]; then
  echo "Google token file not found: $GOOGLE_TOKEN_FILE" >&2
  exit 1
fi
if [[ ! -f "$MS_TOKEN_FILE" ]]; then
  echo "Microsoft token file not found: $MS_TOKEN_FILE" >&2
  exit 1
fi

GOOGLE_TOKEN=$(cat "$GOOGLE_TOKEN_FILE")
MS_TOKEN=$(cat "$MS_TOKEN_FILE")

# Query Google tokeninfo endpoint
echo "# Google token info"
curl -fsSL "https://oauth2.googleapis.com/tokeninfo?access_token=${GOOGLE_TOKEN}" | jq .

echo

# Query Microsoft Graph to fetch organization domains
echo "# Microsoft organization"
curl -fsSL -H "Authorization: Bearer ${MS_TOKEN}" https://graph.microsoft.com/v1.0/organization | jq .
