#!/bin/bash
# Spustí before_run.sql přes Supabase Management API
# Použití: ./_db/migrate.sh

set -e

TOKENS_FILE="$HOME/PhpstormProjects/starter/.tokens"
SQL_FILE="$(dirname "$0")/before_run.sql"

if [ ! -f "$TOKENS_FILE" ]; then
  echo "❌ Nenalezen soubor s tokeny: $TOKENS_FILE"
  exit 1
fi

source "$TOKENS_FILE"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN není nastaven v $TOKENS_FILE"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  ENV_FILE="$(dirname "$0")/../.env.local"
  if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
  fi
fi

PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co.*||')

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Nepodařilo se zjistit PROJECT_REF z NEXT_PUBLIC_SUPABASE_URL"
  exit 1
fi

echo "🚀 Spouštím migraci na projektu: $PROJECT_REF"

RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' < "$SQL_FILE")}")

if echo "$RESPONSE" | grep -q '"message"'; then
  echo "❌ Chyba:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo "✅ Migrace proběhla úspěšně"
