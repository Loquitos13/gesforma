# GesForma na Hetzner (VPS)

O site público e o backoffice são **a mesma aplicação**: uma VPS serve os dois. Fica tudo numa só máquina, com Docker:

| Serviço | O que faz | Na Vercel era |
|---|---|---|
| `web` (Caddy) | HTTPS automático (Let's Encrypt), ficheiros do site, encaminha `/api`, as páginas (SEO), `sitemap.xml` e `robots.txt` | CDN + `vercel.json` |
| `api` (Node) | A API, a fila de emails e os avisos (a cada 2,5 s, no próprio processo) | função serverless + cron `/v1/cron/email` |
| `db` (Postgres) | A base de dados | Neon |
| `tarefas` | Cópia diária da base (02:00 UTC) e sincronização da Google Drive (03:30 UTC) | cron `/v1/cron/drive` |

Os ficheiros (dossiês, documentos, certificados) continuam na **Google Drive** da ENA: não mudam de sítio.
A configuração está em `docker-compose.yml`, `deploy/Caddyfile` e `deploy/tarefas/`.

## 1. Servidor

- **Tipo**: 2 vCPU, **4 GB de RAM**, 40 GB+ de disco chegam para a ENA (API, Postgres e a geração de PDF). Se houver muitos utilizadores em simultâneo, 4 vCPU e 8 GB. Os preços da Hetzner mudaram em 2026 e as linhas disponíveis variam: confirmar na consola na altura de encomendar.
- **Localização**: Alemanha (Falkenstein/Nuremberga) ou Finlândia (Helsínquia), dentro da UE (RGPD: há dados pessoais dos formandos).
- **Imagem**: Ubuntu 24.04.
- **Chave SSH**: entrar só com chave, nunca com palavra-passe.
- **Backups da Hetzner**: ligar (custa +20 % do servidor; guarda 7 imagens da máquina).
- **Firewall da Hetzner** (Cloud › Firewalls), entradas:
  - TCP 22 (SSH), de preferência só a partir dos IPs de quem administra;
  - TCP 80 e TCP 443 (site);
  - UDP 443 (HTTP/3).
- **Storage Box** (BX11, 1 TB): para as cópias da base fora da VPS (ponto 7).

## 2. Preparar a máquina

```bash
ssh root@IP_DA_VPS
apt update && apt -y upgrade
apt -y install git unattended-upgrades rsync
dpkg-reconfigure -plow unattended-upgrades   # atualizações de segurança automáticas
curl -fsSL https://get.docker.com | sh       # Docker + docker compose
```

Código (no GitHub, criar uma *deploy key* só de leitura para a VPS):

```bash
ssh-keygen -t ed25519 -C "vps-gesforma" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # GitHub › repositório › Settings › Deploy keys › Add (só leitura)
git clone git@github.com:Loquitos13/gesforma.git /opt/gesforma
cd /opt/gesforma
```

## 3. Variáveis (`.env`)

```bash
cp .env.example .env && chmod 600 .env && nano .env
```

**Copiar da Vercel** (Project › Settings › Environment Variables) **com os mesmos valores**:

- `SESSION_SECRET`, e também `LEGACY_SESSION_SECRET` se existir.
- `DATA_ENCRYPTION_KEY`: **obrigatoriamente a mesma**. Os dados pessoais estão cifrados com ela; com outra chave ficam ilegíveis.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- `GOOGLE_*`, `MICROSOFT_*`, `SMTP_URL`, `MAIL_*`, `PAYMENT_WEBHOOK_KEY` e `WHATSAPP_*`, os que existirem.

**Novos**:

```
NODE_ENV=production
DOMINIO=ena.pt                      # no ensaio: novo.ena.pt (ponto 5)
APP_ORIGIN=https://ena.pt           # sempre https://<DOMINIO>
EMAIL_CERTIFICADOS=informatica@ena.pt
POSTGRES_PASSWORD=...               # openssl rand -base64 24
POSTGRES_VERSAO=17                  # a mesma versão principal da Neon (ponto 4)
CRON_SECRET=...                     # openssl rand -hex 32
STORAGE_BOX=u123456@u123456.your-storagebox.de
```

O `DATABASE_URL` não se põe: o `docker-compose.yml` liga a API ao Postgres da própria máquina.

**Email**: a Hetzner bloqueia as portas 25 e 465 de saída nas contas novas. O SMTP do Brevo funciona na **587**: se o `SMTP_URL` (ou Configurações › Emails) usa a 465, passar para a 587.

## 4. Versão do Postgres

Na consola da Neon (SQL Editor), correr `SELECT version();` e pôr em `POSTGRES_VERSAO` a mesma versão principal (16, 17…). Escolhe-se uma vez: mudar depois obriga a exportar e importar a base.

## 5. Ensaio com um subdomínio (sem tocar no site atual)

1. No DNS do domínio, criar um registo `A` `novo.ena.pt` → IP da VPS. Em `.env`, pôr `DOMINIO=novo.ena.pt` e `APP_ORIGIN=https://novo.ena.pt`.
2. Arrancar:
   ```bash
   docker compose --profile build run --rm construir   # constrói o site (dist/)
   docker compose up -d --build
   docker compose logs -f api                           # esperar «GesForma API pronta»
   ```
3. Copiar a base da Neon para a VPS. O URL da Neon está na Vercel, em `DATABASE_URL`.
   ```bash
   docker compose stop api
   docker run --rm -v "$PWD/backups:/b" postgres:${POSTGRES_VERSAO:-17}-alpine \
     pg_dump -Fc --no-owner --no-acl -f /b/neon.dump "URL_DA_NEON"
   docker compose exec -T db pg_restore --clean --if-exists --no-owner -U gesforma -d gesforma < backups/neon.dump
   docker compose start api
   ```
4. Testar em `https://novo.ena.pt`: entrar, abrir turmas, gerar um PDF, um email de teste e um upload para a Drive.
   - Para o login Google/Microsoft e a Drive funcionarem aqui, acrescentar temporariamente os URIs de retorno com `novo.ena.pt` nas consolas da Google e da Microsoft.
   - O ensaio fica sempre fora da Google: só `ena.pt` é indexado (`podeIndexar` em `server/src/seo.ts`).

## 6. Mudança (dia escolhido, fora do horário da secretaria)

1. **Na véspera**: baixar o TTL dos registos DNS do domínio para 300 s.
2. **Congelar**: avisar a equipa; a partir daqui ninguém grava na Vercel (o que se gravar lá depois da cópia perde-se).
3. **Cópia final**: repetir o ponto 5.3 (exportar da Neon e importar na VPS).
4. **Domínio**: em `.env`, `DOMINIO=ena.pt` e `APP_ORIGIN=https://ena.pt`; correr `docker compose up -d`.
5. **DNS**: os registos `A` de `ena.pt` (e de `www`) passam a apontar para o IP da VPS; tirar os da Vercel.
   - O Caddy pede o certificado sozinho quando o DNS chegar (1 a 5 minutos).
   - Com o `www` a apontar para a VPS, tirar o `#` das 3 linhas do fim de `deploy/Caddyfile` e correr `docker compose restart web`.
6. **Serviços externos**: se o domínio for o mesmo que já se usava, os URIs de retorno (Google, Microsoft), o webhook dos pagamentos e o do WhatsApp não mudam. Se antes se usava o endereço `*.vercel.app`, atualizá-los para `https://ena.pt/api/...`, como em `.env.example`.
7. **Verificar**: `https://ena.pt`, `https://ena.pt/robots.txt`, entrar no backoffice, um pagamento de teste e um email.
8. **Desligar a Vercel e a Neon só depois de 2 semanas sem problemas**: até lá, voltar atrás é só repor o DNS.

## 7. Cópias de segurança

- **Na VPS**: o serviço `tarefas` faz um `pg_dump` às 02:00 UTC em `backups/` e guarda os últimos 14.
- **Fora da VPS**, na Storage Box:
  ```bash
  # uma vez: ativar o SSH na Storage Box (consola da Hetzner) e instalar a chave
  cat ~/.ssh/id_ed25519.pub | ssh -p 23 u123456@u123456.your-storagebox.de install-ssh-key
  # todos os dias às 02:30 UTC
  (crontab -l 2>/dev/null; echo "30 2 * * * /opt/gesforma/deploy/copia-externa.sh >> /var/log/gesforma-copia.log 2>&1") | crontab -
  ```
- **Imagem da máquina**: os Backups da Hetzner (ponto 1).
- **O `.env` não vai nas cópias**: guardá-lo num gestor de palavras-passe da ENA. Sem a `DATA_ENCRYPTION_KEY` as cópias não servem.

Repor uma cópia:

```bash
docker compose stop api
docker compose exec -T db pg_restore --clean --if-exists --no-owner -U gesforma -d gesforma < backups/gesforma-AAAAMMDD-HHMMSS.dump
docker compose start api
```

## 8. Dia a dia

- **Atualizar** (depois de cada alteração enviada para o `main`): `/opt/gesforma/deploy/atualizar.sh`.
  - Faz uma cópia da base, puxa o código, constrói o site e reinicia.
  - As migrações da base correm sozinhas.
  - O site fica uns segundos indisponível.
- **Logs**: `docker compose logs -f api` (ou `web`, `tarefas`).
- **Estado**: `docker compose ps`.
- **Disco**: `df -h` e `du -sh backups`.
