#!/bin/sh
# Partilhas das pastas das turmas na Google Drive e arrumação dos recibos (o cron /v1/cron/drive da Vercel).
set -eu
. /tarefas.env
wget -q -O - -T 60 --header "Authorization: Bearer $CRON_SECRET" http://api:43148/v1/cron/drive
echo
