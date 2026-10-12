# Segurança — GesForma e área do formando

## Autenticação

- Sessão em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção.
- **Todas** as rotas `/v1/*` exigem sessão, excepto:
  - `/v1/public/*` (site, documentos por token, inquéritos públicos, webhooks).
  - Autenticação: login, recuperação, OAuth Google/Microsoft, pixel de email, cron com segredo.
- Perfil **formando** só acede a `/v1/area-formando`, `/v1/me` e mudança de palavra-passe; o resto do GesForma responde 403.
- Pedidos de escrita exigem origem permitida ou cabeçalho `X-Gesforma-Client: web`.

## Rate limit

- Global: 120 pedidos/minuto por IP (excepto `/health`).
- **Login**: 12/minuto por IP + bloqueio progressivo (5 falhas/minuto → 15 minutos) por IP+email (`login_rate`).
- Recuperação de palavra-passe: 5/minuto.

## Dados dos formandos (PII)

- Campos sensíveis (NIF, morada fiscal, código postal, telemóvel de pré-inscrição; telemóvel e dossier documental dos formandos) gravados em **`pii_enc` / `docs_enc`** com **AES-256-GCM**.
- Chave: variável de ambiente **`DATA_ENCRYPTION_KEY`** (32 bytes em base64). Obrigatória em produção com Postgres.
- Identificadores públicos: coluna **`public_id`** (UUID) e campo API **`ref`** — preferir partilhar `ref`/`publicId` em vez do id numérico interno.

## Row Level Security (PostgreSQL)

- Cada pedido define `app.role` e `app.user_id` na transacção.
- Políticas por perfil (comercial só vê leads atribuídos; financiada só CRM fin; formando só a própria ficha e documentos).
- A API só consulta a base com `gesforma.api=1` dentro de transacções controladas (`server/src/db/pool.ts`).

## Operação

- Palavras-passe: scrypt. Sessões: hash SHA-256 do token.
- Auditoria em `audit_log` (login falhado, alterações sensíveis).
- Helmet, CORS restrito, limite de corpo 32 KB.

Gerar chave de cifra: `openssl rand -base64 32`
