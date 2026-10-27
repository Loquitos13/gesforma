#!/usr/bin/env bash
# Copia as cópias da base (backups/) para fora da VPS, na Storage Box da Hetzner (rsync por SSH, porta 23).
# Corre no anfitrião pelo cron (docs/hetzner.md › Cópias de segurança). Variável no .env:
#   STORAGE_BOX=u123456@u123456.your-storagebox.de
set -euo pipefail
cd "$(dirname "$0")/.."
STORAGE_BOX="$(grep -E '^STORAGE_BOX=' .env | cut -d= -f2- || true)"
if [[ -z "$STORAGE_BOX" ]]; then
  echo "Falta STORAGE_BOX no .env" >&2
  exit 1
fi
rsync -a --delete -e "ssh -p 23 -o BatchMode=yes" backups/ "$STORAGE_BOX:gesforma-backups/"
echo "copiado para $STORAGE_BOX:gesforma-backups/ ($(ls backups/*.dump 2>/dev/null | wc -l) cópias)"
