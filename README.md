# GesForma - backoffice ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada), com API Fastify, base migrável e formulário público de pré-inscrição.

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** - núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** - núcleo DGERT + **documentos** de elegibilidade (CC, CH, CU, IBAN, emprego), horas, relatório de execução

O menu **Dossiê TP** lista as turmas com a completude do dossiê e abre o DTP dessa turma.

**Inquéritos** (Gold e Financiada) permitem montar questionários de satisfação com texto, escolha múltipla, escala 1–5 e sim/não.

No cockpit da turma (Gold e Financiada, os mesmos separadores): plano de sessão, **sumário por sessão** e **presenças dentro da sessão** - não há menu isolado de presenças. O perfil do formador e os certificados também vivem na turma.

No separador **Documentos** (Gold / CCP):

- **PIP** - um ficheiro por formando. O estado passa a *Em falta*, *Parcial* ou *No dossiê* conforme os projetos carregados.
- **Simulação pedagógica inicial e final** - por aluno: um vídeo e uma folha de avaliação. A grelha usa os **parâmetros de avaliação do curso** (editáveis em Edição de Cursos), escala 1–5. Só fica no dossiê quando o vídeo e a grelha estão completos.

Cada **curso Gold** e cada **UFCD financiada** tem uma ficha própria (não um painel lateral): identidade visual, textos da página pública, parâmetros de avaliação quando aplicável, e publicação. A coluna da direita mostra a pré-visualização do que aparece em `ena.pt/cursos/…`. O progresso “Pronto para o site” indica o que ainda falta para publicar. Nas UFCD o código e a designação oficial do CNQ ficam separados do nome comercial.

A vista **Módulos** começa pelo filtro de curso: lista só os blocos desse curso e o botão **+ Novo módulo** está sempre disponível (no cabeçalho, no filtro e no estado vazio). A partir da ficha de um curso Gold ou de uma UFCD, **Módulos** abre já filtrado.

O catálogo **Módulos, Conteúdos, Datas, Locais e Áreas** existe nos dois lados (Gold e Financiada), com o mesmo layout e acento âmbar / azul. Em **Formandos Gold** (avulso) o olho abre a ficha com documentos - o lápis continua a editar. **Detalhes / Recibo** em Pagamentos, **Abrir** em Conteúdos, **Ver certificado**, **Gerar MB / Enviar recibo**, **download** no cockpit e **Ver todas as notificações** abrem ecrãs ou modais. Pré-inscrições, turmas, formadores, cursos, campanhas, blog e pagamentos persistem na base. Os uploads de documentos saem no Drive da entidade (pasta `GesForma / Gold|Financiada / …`).

Gold e Financiada têm cada uma o menu **Formadores**: ficha (contacto, CCP, NIF, especialidade), estado Ativo/Inactivo e os regimes em que lecciona. Quem marca os dois regimes aparece nas duas listas. Criar ou editar um formador actualiza os dropdowns do cronograma e das turmas.

No **Painel**, o bloco **Como conheceram a ENA** mostra a origem dos formandos (website, referência, redes, IEFP) a partir da pergunta da ficha de inscrição.

Em **Configurações**, cada cartão abre um **modal centrado** só com essa secção (Cancelar / Guardar). Não há gaveta lateral nem lista de separadores à esquerda.

A **secretaria** trabalha com rasto no topo (regime + percurso clicável), bloco **A fazer agora** no cockpit, listas em **cartões no telemóvel** e **acções com rótulo** no desktop (menu ⋯ no ecrã estreito). Eliminar pede sempre a mesma confirmação. A pesquisa **⌘K** abre atalhos do dia (pré-inscrições por contactar, pagamentos pendentes, DTP incompleto, inscrições a analisar). As notificações classificam-se em **Bloqueio**, **Aviso** e **Info**.

Os formulários de criar e editar (pré-inscrição, turma, formando, sessão, etc.) abrem em **modal ao centro**, não numa gaveta que desliza da direita.

Em **Emails automáticos**, a nova regra pede gatilho, template, curso e atraso, com **preview do email** ao lado. O olho nas regras e nos templates abre o mesmo preview.

Não existe `formandos.ena.pt` nem área de formando. O pedido público é a **pré-inscrição** (`/pre-inscricao`). A secretaria contacta a pessoa a seguir (telefone, WhatsApp ou email). Os emails automáticos levam a esse formulário ou a `mailto:formacao@ena.pt`.

Cada **turma** tem um **cronograma** e um toggle **Ativa / Inativa**. No cockpit, o separador Cronograma mostra o plano de sessões: resumo (sessões, horas, próxima, período), linha do tempo agrupada por mês e edição sessão a sessão. Cada sessão escolhe **um ou mais módulos** do curso e **um ou mais formadores** em dropdowns com pesquisa. A Visão Geral lista todos os formadores atribuídos às sessões (com o número de sessões de cada um). A tabela de Sessões mostra essa coluna. Regenerar pede confirmação porque substitui o plano atual. Só turmas ativas aparecem nas pré-inscrições Gold, na conversão de lead em formando, na mudança de turma de um formando e nas inscrições financiadas. Uma turma inativa mantém os formandos já inscritos, mas fecha novas entradas.

## Backend e automações de email

A secretaria entra com sessão (cookie httpOnly, SameSite=strict). A API Fastify fala **Postgres** na VPS; em desenvolvimento, se `DATABASE_URL` estiver vazio, usa **PGlite** (o mesmo SQL, ficheiro em `server/data/`).

As migrações estão em `server/src/db/migrations/` (`001` … `007`) e correm no arranque. O seed cria o admin, os templates de email e, se as tabelas estiverem vazias, o operacional (cursos, turmas, formadores, leads, pagamentos) e os **catálogos** (módulos, locais, datas, conteúdos, áreas, formandos avulso, inscrições financiadas, temáticas do blog, inquéritos). O backoffice lê `GET /v1/ops` e grava nos CRUD e em `/v1/catalog/:kind`. As **Configurações** ficam em `app_settings`.

Os ficheiros da secretaria (PIP, certificados, conteúdos, documentos do formador) vão para o **Google Drive da entidade**. Em Configurações a administradora liga a conta Google via **OAuth 2.0**. Enquanto a conta não estiver ligada, o upload fica no servidor (`server/data/drive-files/`) para o trabalho não parar. Na Vercel sem Drive os ficheiros locais vão para `/tmp` e somem entre invocações — ligue a conta da ENA.

O worker de email também dispara o lembrete **24h antes do início** da turma (formandos da turma) e o certificado quando o estado do formando passa a concluído.

O formulário público `POST /v1/public/preinscricoes` (8 pedidos / minuto) cria um lead em **Não contactado**. Na lista Gold, **Contactar** passa a **1.º Contacto** e regista a nota.

Arquitectura na VPS: **um Compose, três papéis, rede só interna**.

1. `db` - Postgres 16. Não é publicado na internet.
2. `api` - só em `127.0.0.1:43148`. O Caddy/nginx faz TLS e encaminha `/api` para aqui.
3. `web` - esta app Vite, no mesmo domínio, para os cookies funcionarem.

Não separam a base para outro servidor até haver necessidade: um contentor Postgres no mesmo host é mais rápido, o backup é um `pg_dump` e a API não atravessa a rede pública.

**Emails automáticos** - uma regra = gatilho + template + atraso. A secretaria regista uma pré-inscrição ou um pagamento; a API enfileira o envio (incluindo **contacto após a venda**, 1 hora depois do pagamento). O worker corre na própria API, sem Redis. Sem SMTP (`MAIL_MODE=log`) o email fica no histórico; com `SMTP_URL` sai pelo correio.

### Segurança

- Palavras-passe com scrypt; o token de sessão só existe em hash na base.
- CORS e `Origin` fechados a `APP_ORIGIN`. Pedidos de escrita exigem o cabeçalho `X-Gesforma-Client`.
- Helmet, limite de corpo 32 KB (JSON), uploads multipart até 10 MB, rate limit (8 tentativas de login / minuto).
- Tokens OAuth do Drive guardados cifrados (AES-256-GCM) com `SESSION_SECRET`. O callback valida `state` de uso único.
- SQL só com parâmetros. Assunto e destinatário sem quebras de linha (injecção de cabeçalhos).
- Em produção a API recusa-se a arrancar sem `DATABASE_URL`, `SESSION_SECRET` (≥32) e `ADMIN_PASSWORD` diferente do valor de desenvolvimento.

### Backup completo

`pg_dump -Fc` (formato custom) copia **todos** os dados. Restaura com `pg_restore`. Na VPS:

```bash
docker compose --profile backup run --rm backup
# ou, no host:
npm run backup
```

Os ficheiros ficam em `backups/`. Para ponto-no-tempo (WAL) no futuro: pgBackRest - não é preciso no primeiro servidor.

### Correr localmente

```bash
cp .env.example .env
# em desenvolvimento: ADMIN_PASSWORD=altere-me-no-primeiro-arranque
npm install
npm install --prefix server
npm run api    # outra consola - http://127.0.0.1:43148/health
npm run dev    # http://127.0.0.1:43147
```

Entrar com `tania@ena.pt` e a palavra-passe do `.env`.

Para o Drive da entidade: no Google Cloud Console active a **Google Drive API**, crie um cliente OAuth «Aplicação Web» com o URI `http://127.0.0.1:43147/api/v1/drive/oauth/callback`, e preencha `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Em **Configurações** clique em *Ligar conta Google* com a conta da secretaria (não uma conta pessoal). Sem estas variáveis os uploads continuam a funcionar, mas ficam no disco local.

Formulário público (sem login): [http://127.0.0.1:43147/pre-inscricao](http://127.0.0.1:43147/pre-inscricao). Aceita `?curso=` e `?email=`.

Na VPS, depois de preencher `.env` com segredos gerados (`openssl rand -base64 48`):

```bash
docker compose up -d db api
```

### Vercel

A API vai no **mesmo projecto** que a app (`/api`), para o cookie de sessão ser do mesmo domínio. A Vercel é serverless: não há `setInterval`. A fila de email corre no fim de cada evento, ao abrir o histórico, e num cron diário (`/api/v1/cron/email`).

1. Claim ou ligue o Git à Vercel.
2. Variáveis: `DATABASE_URL` (Neon ou Vercel Postgres), `SESSION_SECRET`, `ADMIN_PASSWORD`, `APP_ORIGIN=https://o-seu-dominio.vercel.app`, `MAIL_MODE`, `SMTP_URL`, e para o Drive `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (URI de callback `{APP_ORIGIN}/api/v1/drive/oauth/callback`).
3. Sem `DATABASE_URL` a função usa PGlite em `/tmp` - some entre invocações. Para produção, Neon é o par habitual da Vercel.

`vercel.json` já encaminha `/api/*` para a função.
