# GesForma - protótipo ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada).

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** - núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** - núcleo DGERT + **documentos** de elegibilidade (CC, CH, CU, IBAN, emprego), horas, relatório de execução

O menu **Dossiê TP** lista as turmas com a completude do dossiê e abre o DTP dessa turma.

**Inquéritos** (Gold e Financiada) permitem montar questionários de satisfação com texto, escolha múltipla, escala 1-5 e sim/não.

No cockpit da turma (Gold e Financiada, os mesmos separadores): plano de sessão, **sumário por sessão** e **presenças dentro da sessão** - não há menu isolado de presenças. O perfil do formador e os certificados também vivem na turma.

No separador **Documentos** (Gold / CCP):

- **PIP** - um ficheiro por formando. O estado passa a *Em falta*, *Parcial* ou *No dossiê* conforme os projetos carregados.
- **Simulação pedagógica inicial e final** - por aluno: um vídeo e uma folha de avaliação. A grelha usa os **parâmetros de avaliação do curso** (editáveis em Edição de Cursos), escala 1-5. Só fica no dossiê quando o vídeo e a grelha estão completos.

Cada **curso Gold** e cada **UFCD financiada** tem uma ficha própria (não um painel lateral): identidade visual, textos da página pública, parâmetros de avaliação quando aplicável, e publicação. A coluna da direita mostra a pré-visualização do que aparece em `ena.pt/cursos/…`. O progresso “Pronto para o site” indica o que ainda falta para publicar. Nas UFCD o código e a designação oficial do CNQ ficam separados do nome comercial.

A vista **Módulos** começa pelo filtro de curso: lista só os blocos desse curso e o botão **+ Novo módulo** está sempre disponível (no cabeçalho, no filtro e no estado vazio). A partir da ficha de um curso Gold ou de uma UFCD, **Módulos** abre já filtrado.

O catálogo **Módulos, Conteúdos, Datas, Locais e Áreas** existe nos dois lados (Gold e Financiada), com o mesmo layout e acento âmbar / azul. Em **Formandos Gold** (avulso) o olho abre a ficha com documentos - o lápis continua a editar. **Detalhes / Recibo** em Pagamentos, **Abrir** em Conteúdos, **Ver certificado**, **Gerar MB / Enviar recibo**, **download** no cockpit e **Ver todas as notificações** abrem ecrãs ou modais deste protótipo (sem backend).

Gold e Financiada têm cada uma o menu **Formadores**: ficha (contacto, CCP, NIF, especialidade), estado Ativo/Inactivo e os regimes em que lecciona. Quem marca os dois regimes aparece nas duas listas. Criar ou editar um formador actualiza os dropdowns do cronograma e das turmas.

No **Painel**, o bloco **Como conheceram a ENA** mostra a origem dos formandos (website, referência, redes, IEFP) a partir da pergunta da ficha de inscrição.

Em **Configurações**, cada cartão abre um **modal centrado** só com essa secção (Cancelar / Guardar). Não há gaveta lateral nem lista de separadores à esquerda.

A **secretaria** trabalha com rasto no topo (regime + percurso clicável), bloco **A fazer agora** no cockpit, listas em **cartões no telemóvel** e **acções com rótulo** no desktop (menu ⋯ no ecrã estreito). Eliminar pede sempre a mesma confirmação. A pesquisa **⌘K** abre atalhos do dia (pré-inscrições por contactar, pagamentos pendentes, DTP incompleto, inscrições a analisar). As notificações classificam-se em **Bloqueio**, **Aviso** e **Info**.

Os formulários de criar e editar (pré-inscrição, turma, formando, sessão, etc.) abrem em **modal ao centro**, não numa gaveta que desliza da direita.

Em **Emails automáticos**, a nova regra pede gatilho, template, curso e atraso, com **preview do email** ao lado. O olho nas regras e nos templates abre o mesmo preview.

Os botões **Novo curso**, **Nova turma**, **Novo módulo**, **Nova sessão** e equivalentes abrem um formulário. Quando é preciso escolher curso, turma, local, formador ou módulo, o campo é um **dropdown com pesquisa**. As listas da navegação usam a mesma barra de filtros: **curso** e **local** quando a tabela tem essas colunas (pré-inscrições, formandos, turmas, datas, conteúdos, DTP Gold, pagamentos); nas UFCD financiadas o filtro é por curso e não por polo (quase tudo em sala virtual); em catálogos (cursos, locais, áreas, blog) ficam só estado ou área temática.

Cada **turma** tem um **cronograma** e um toggle **Ativa / Inativa**. No cockpit, o separador Cronograma mostra o plano de sessões: resumo (sessões, horas, próxima, período), linha do tempo agrupada por mês e edição sessão a sessão. Cada sessão escolhe **um ou mais módulos** do curso e **um ou mais formadores** em dropdowns com pesquisa. A Visão Geral lista todos os formadores atribuídos às sessões (com o número de sessões de cada um). A tabela de Sessões mostra essa coluna. Regenerar pede confirmação porque substitui o plano atual. Só turmas ativas aparecem nas pré-inscrições Gold, na conversão de lead em formando, na mudança de turma de um formando e nas inscrições financiadas. Uma turma inativa mantém os formandos já inscritos, mas fecha novas entradas.

## Backend e automações de email

A secretaria entra com sessão (cookie httpOnly, SameSite=strict). A API Fastify fala **Postgres** na VPS; em desenvolvimento, se `DATABASE_URL` estiver vazio, usa **PGlite** (o mesmo SQL, ficheiro em `server/data/`).

Arquitectura na VPS: **um Compose, três papéis, rede só interna**.

1. `db`  -  Postgres 16. Não é publicado na internet.
2. `api`  -  só em `127.0.0.1:43148`. O Caddy/nginx faz TLS e encaminha `/api` para aqui.
3. `web`  -  esta app Vite, no mesmo domínio, para os cookies funcionarem.

Não separam a base para outro servidor até haver necessidade: um contentor Postgres no mesmo host é mais rápido, o backup é um `pg_dump` e a API não atravessa a rede pública.

**Emails automáticos**  -  uma regra = gatilho + template + atraso. A secretaria regista uma pré-inscrição ou um pagamento; a API enfileira o envio (incluindo **contacto após a venda**, 1 hora depois do pagamento). O worker corre na própria API, sem Redis. Sem SMTP (`MAIL_MODE=log`) o email fica no histórico; com `SMTP_URL` sai pelo correio.

### Segurança

- Palavras-passe com scrypt; o token de sessão só existe em hash na base.
- CORS e `Origin` fechados a `APP_ORIGIN`. Pedidos de escrita exigem o cabeçalho `X-Gesforma-Client`.
- Helmet, limite de corpo 32 KB, rate limit (8 tentativas de login / minuto).
- SQL só com parâmetros. Assunto e destinatário sem quebras de linha (injecção de cabeçalhos).
- Em produção a API recusa-se a arrancar sem `DATABASE_URL`, `SESSION_SECRET` (≥32) e `ADMIN_PASSWORD` diferente do valor de desenvolvimento.

### Backup completo

`pg_dump -Fc` (formato custom) copia **todos** os dados. Restaura com `pg_restore`. Na VPS:

```bash
docker compose --profile backup run --rm backup
# ou, no host:
npm run backup
```

Os ficheiros ficam em `backups/`. Para ponto-no-tempo (WAL) no futuro: pgBackRest  -  não é preciso no primeiro servidor.

### Correr localmente

```bash
cp .env.example .env
# em desenvolvimento: ADMIN_PASSWORD=altere-me-no-primeiro-arranque
npm install
npm install --prefix server
npm run api    # outra consola  -  http://127.0.0.1:43148/health
npm run dev    # http://127.0.0.1:43147
```

Entrar com `tania@ena.pt` e a palavra-passe do `.env`.

Na VPS, depois de preencher `.env` com segredos gerados (`openssl rand -base64 48`):

```bash
docker compose up -d db api
```

### Vercel

A API vai no **mesmo projecto** que a app (`/api`), para o cookie de sessão ser do mesmo domínio. A Vercel é serverless: não há `setInterval`. A fila de email corre no fim de cada evento, ao abrir o histórico, e num cron diário (`/api/v1/cron/email`).

1. Claim ou ligue o Git à Vercel.
2. Variáveis: `DATABASE_URL` (Neon ou Vercel Postgres), `SESSION_SECRET`, `ADMIN_PASSWORD`, `APP_ORIGIN=https://o-seu-dominio.vercel.app`, `MAIL_MODE`, `SMTP_URL`.
3. Sem `DATABASE_URL` a função usa PGlite em `/tmp`  -  some entre invocações. Para produção, Neon é o par habitual da Vercel.

`vercel.json` já encaminha `/api/*` para a função.
