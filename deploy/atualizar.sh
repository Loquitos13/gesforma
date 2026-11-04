#!/usr/bin/env bash
# Atualiza o GesForma na VPS com o que está no GitHub (ramo main): constrói o site, reconstrói a API e reinicia.
# As migrações da base correm sozinhas no arranque da API. Faz uma cópia da base antes, por precaução.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "» cópia da base antes de atualizar"
docker compose exec -T tarefas /tarefas/backup.sh || echo "  (sem cópia: o serviço tarefas ainda não está a correr)"

echo "» código"
git pull --ff-only

echo "» site (dist/)"
docker compose --profile build run --rm construir

echo "» API, Caddy e tarefas"
docker compose up -d --build --remove-orphans
# O Caddy só relê o Caddyfile (pasta deploy/ montada) ao recarregar; se o recarregamento falhar, recria o contentor.
docker compose exec -T web caddy reload --config /etc/caddy-deploy/Caddyfile --adapter caddyfile || docker compose up -d --force-recreate web
docker image prune -f >/dev/null

echo "» estado"
sleep 5
docker compose ps
curl -fsS -o /dev/null -w "API: %{http_code}\n" http://127.0.0.1:43148/v1/public/robots.txt || echo "A API ainda não responde: veja docker compose logs api"
