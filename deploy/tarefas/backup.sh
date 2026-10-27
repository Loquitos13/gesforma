#!/bin/sh
# Cópia diária da base (pg_dump, formato custom: restaura com pg_restore). Ficam as 14 mais recentes.
# A cópia para fora da VPS (Storage Box) faz-se no anfitrião: deploy/copia-externa.sh.
set -eu
. /tarefas.env
stamp=$(date -u +%Y%m%d-%H%M%S)
dest="/backups/gesforma-$stamp.dump"
pg_dump -Fc --no-owner -h db -U gesforma gesforma > "$dest.parcial"
mv "$dest.parcial" "$dest"
echo "backup: $dest ($(du -h "$dest" | cut -f1))"
ls -1 /backups/gesforma-*.dump 2>/dev/null | sort | head -n -14 | xargs -r rm --
