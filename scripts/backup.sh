#!/usr/bin/env bash
# Cópia completa dos dados.
# - Com Docker/Postgres: pg_dump em formato custom (restaura com pg_restore).
# - Sem Docker (PGlite local): arquivo da pasta de dados.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/backups"
stamp="$(date -u +%Y%m%d-%H%M%S)"

if [[ -n "${DATABASE_URL:-}" ]] && command -v pg_dump >/dev/null 2>&1; then
  dest="$root/backups/gesforma-$stamp.dump"
  pg_dump -Fc --no-owner --dbname="$DATABASE_URL" --file="$dest"
  echo "Postgres (pg_dump): $dest"
  exit 0
fi

if command -v docker >/dev/null 2>&1 && [[ -f "$root/docker-compose.yml" ]]; then
  (cd "$root" && docker compose --profile backup run --rm backup)
  exit 0
fi

pglite="$root/server/data/pglite"
if [[ -d "$pglite" ]]; then
  dest="$root/backups/gesforma-pglite-$stamp.tgz"
  tar -czf "$dest" -C "$root/server/data" pglite
  echo "PGlite (cópia total): $dest"
  exit 0
fi

echo "Não há Postgres nem pasta PGlite para copiar." >&2
exit 1
