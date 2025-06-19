#!/usr/bin/env bash
set -euo pipefail

# Delete Microsoft Graph and Google Cloud apps/projects created in the last 10 days
# Usage: ./scripts/cleanup-apps.sh [GOOGLE_TOKEN_FILE] [MICROSOFT_TOKEN_FILE]
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

# ISO timestamp for 10 days ago
THRESHOLD_DATE=$(date -u -v-10d +%Y-%m-%dT%H:%M:%SZ)

urlencode() {
  local raw="$1"
  /usr/bin/python3 - "$raw" <<PY
import urllib.parse, sys
print(urllib.parse.quote(sys.argv[1]))
PY
}

FILTER=$(urlencode "createdDateTime ge $THRESHOLD_DATE")

echo "# Deleting Microsoft apps created since $THRESHOLD_DATE"
MS_APPS=$(curl -fsSL -H "Authorization: Bearer ${MS_TOKEN}" \
  "https://graph.microsoft.com/v1.0/applications?\$filter=${FILTER}")

echo "$MS_APPS" | jq -r '.value[].id' | while read -r APP_ID; do
  echo "Deleting Microsoft app $APP_ID"
  curl -fsSL -X DELETE -H "Authorization: Bearer ${MS_TOKEN}" \
    "https://graph.microsoft.com/v1.0/applications/${APP_ID}"
  echo
done

echo "# Deleting Google projects created since $THRESHOLD_DATE"
GOOGLE_PROJECTS=$(curl -fsSL -X POST -H "Authorization: Bearer ${GOOGLE_TOKEN}" \
  -H 'Content-Type: application/json' \
  'https://cloudresourcemanager.googleapis.com/v1/projects:list')

echo "$GOOGLE_PROJECTS" | jq -r --arg th "$THRESHOLD_DATE" \
  '.projects[] | select(.createTime >= $th) | .projectId' | \
while read -r PROJECT_ID; do
  echo "Deleting Google project $PROJECT_ID"
  curl -fsSL -X DELETE -H "Authorization: Bearer ${GOOGLE_TOKEN}" \
    -H 'Content-Type: application/json' \
    "https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}"
  echo
done

