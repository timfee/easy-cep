#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Checking tokens..."
if [[ ! -f "./google_bearer.token" ]]; then
  echo "❌ Missing google_bearer.token"
  exit 1
fi

if [[ ! -f "./microsoft_bearer.token" ]]; then
  echo "❌ Missing microsoft_bearer.token"
  exit 1
fi

export TEST_GOOGLE_BEARER_TOKEN=$(cat ./google_bearer.token)
export TEST_MS_BEARER_TOKEN=$(cat ./microsoft_bearer.token)
export TEST_DOMAIN=${TEST_DOMAIN:-"test.example.com"}

echo "🧹 Running pre-test cleanup..."
pnpm tsx scripts/e2e-setup.ts

echo "🧪 Running tests..."
pnpm test test/e2e/workflow.test.ts

echo "✅ Done"
