#!/usr/bin/env bash
# get_tokens.sh – fetches fresh Google & Microsoft bearer tokens
# Requires: jq, openssl

set -euo pipefail

########################################
# 1. Google service-account user-delegated token
########################################
google_token_file="./google_bearer.token"
google_token_url="https://oauth2.googleapis.com/token"
google_scopes="openid email profile https://www.googleapis.com/auth/admin.directory.user \
https://www.googleapis.com/auth/admin.directory.orgunit \
https://www.googleapis.com/auth/admin.directory.domain \
https://www.googleapis.com/auth/admin.directory.rolemanagement \
https://www.googleapis.com/auth/cloud-identity.inboundsso \
https://www.googleapis.com/auth/siteverification \
https://www.googleapis.com/auth/admin.directory.rolemanagement"

# --- sanity checks -----------------------------------------------------------
: "${GOOGLE_SERVICE_ACCOUNT_KEY:?GOOGLE_SERVICE_ACCOUNT_KEY is not set}"
: "${GOOGLE_ADMIN_EMAIL:?GOOGLE_ADMIN_EMAIL is not set}"

# --- pull key material -------------------------------------------------------
client_email=$(printf '%s' "$GOOGLE_SERVICE_ACCOUNT_KEY" | jq -r '.client_email')
raw_privkey=$(printf '%s' "$GOOGLE_SERVICE_ACCOUNT_KEY" | jq -r '.private_key')

if [[ -z "$client_email" || -z "$raw_privkey" ]]; then
  echo "ERROR: Service-account JSON is missing client_email or private_key" >&2
  exit 1
fi

# jq leaves the private key with “\n” escapes – convert to real newlines
privkey_file=$(mktemp)
printf '%s' "$raw_privkey" | sed 's/\\n/\n/g' >"$privkey_file"

# --- build & sign JWT --------------------------------------------------------
now=$(date +%s)
exp=$((now + 3600))

b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

jwt_header='{"alg":"RS256","typ":"JWT"}'
jwt_claims=$(cat <<EOF
{
  "iss":"$client_email",
  "sub":"$GOOGLE_ADMIN_EMAIL",
  "scope":"$google_scopes",
  "aud":"$google_token_url",
  "iat":$now,
  "exp":$exp
}
EOF
)

header_enc=$(printf '%s' "$jwt_header"  | b64url)
claims_enc=$(printf '%s' "$jwt_claims"   | b64url)
unsigned_token="${header_enc}.${claims_enc}"

signature=$(printf '%s' "$unsigned_token" \
           | openssl dgst -sha256 -sign "$privkey_file" -binary \
           | b64url)

signed_jwt="${unsigned_token}.${signature}"

# --- exchange JWT for access-token ------------------------------------------
google_access_token=$(curl -sS \
  -d "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer" \
  --data-urlencode "assertion=$signed_jwt" \
  "$google_token_url" \
  | jq -r '.access_token // empty')

if [[ -z "$google_access_token" ]]; then
  echo "ERROR: Google token request failed" >&2
  exit 1
fi

printf '%s\n' "$google_access_token" >"$google_token_file"
echo "✓ Google bearer token written to $google_token_file"

########################################
# 2. Microsoft client-credentials token
########################################
ms_token_file="./microsoft_bearer.token"

: "${MS_TENANT_ID:?MS_TENANT_ID is not set}"
: "${MS_CLIENT_ID:?MS_CLIENT_ID is not set}"
: "${MS_CLIENT_SECRET:?MS_CLIENT_SECRET is not set}"

ms_token_url="https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token"

microsoft_access_token=$(curl -sS \
  -d "client_id=$MS_CLIENT_ID" \
  --data-urlencode "client_secret=$MS_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=https://graph.microsoft.com/.default" \
  "$ms_token_url" \
  | jq -r '.access_token // empty')

if [[ -z "$microsoft_access_token" ]]; then
  echo "ERROR: Microsoft token request failed" >&2
  exit 1
fi

printf '%s\n' "$microsoft_access_token" >"$ms_token_file"
echo "✓ Microsoft bearer token written to $ms_token_file"

########################################
echo "All done! Tokens are ready for use 🥳"

