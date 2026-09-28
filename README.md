# GesForma - backoffice ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada), com API Fastify, base migrável e formulário público de pré-inscrição.

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** - núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** - núcleo DGERT + **documentos** de elegibilidade (CC, CH, CU, IBAN, emprego), horas, relatório de execução

O menu **Dossiê TP** lista as turmas com a completude do dossiê e abre o DTP dessa turma.

**Inquéritos** (Gold e Financiada) permitem montar questionários de satisfação com texto, escolha múltipla, escala 1–5 e sim/não. **Pré-visualizar** abre o questionário como o formando o vê e permite lançar uma resposta recebida; **Ligação pública** gera um token (`/inquerito/:token`) para o formando responder online; **Exportar** dá o CSV das perguntas. A contagem e as métricas (média 1–5, % Sim, opção mais escolhida) saem das respostas gravadas.

No cockpit da turma (Gold e Financiada, os mesmos separadores): plano de sessão, **sumário por sessão** e **presenças dentro da sessão** - não há menu isolado de presenças. O perfil do formador e os certificados também vivem na turma.

No separador **Documentos** (Gold / CCP):

- **PIP** - um ficheiro por formando. O estado passa a *Em falta*, *Parcial* ou *No dossiê* conforme os projetos carregados.
- **Simulação pedagógica inicial e final** - por aluno: um vídeo e uma folha de avaliação. A grelha usa os **parâmetros de avaliação do curso** (editáveis em Edição de Cursos), escala 1–5. Só fica no dossiê quando o vídeo e a grelha estão completos.

Cada **curso Gold** e cada **UFCD financiada** tem uma ficha própria (não um painel lateral): identidade visual, **Oferta** (tipo, categoria com «+», regime, preço, horas, tags e **vários locais** do catálogo), textos da página pública, parâmetros de avaliação quando aplicável, e publicação. Na ficha, **Gold vs Financiada não se escolhe**: vem da rota (Gold → Cursos Gold vs Financiada → Cursos). O Guardar só cria o curso se os campos obrigatórios da Identidade e da Oferta estiverem preenchidos (tipo comercial, categoria, modalidade, preço/horas, tags e pelo menos um local). A pré-visualização da página lista automaticamente as **turmas libertadas** (local → horário → data). A coluna da direita mostra o que aparece em `ena.pt/cursos/…`. O progresso “Pronto para o site” indica o que ainda falta para publicar. Nas UFCD o código e a designação oficial do CNQ ficam separados do nome comercial.

A vista **Módulos** começa pelo filtro de curso: lista só os blocos desse curso e o botão **+ Novo módulo** está sempre disponível (no cabeçalho, no filtro e no estado vazio). A partir da ficha de um curso Gold ou de uma UFCD, **Módulos** abre já filtrado.

O catálogo **Módulos, Conteúdos, Datas, Locais, Horários e Áreas** existe no Gold (Horários só no Gold); Financiada mantém o mesmo *shell* para o resto. Kicker de regime, KPIs, pesquisa no painel, linha clicável, cartões no telemóvel e sem coluna de Id. Em **Formandos Gold** (avulso) o olho abre a ficha com documentos - o lápis continua a editar. **Detalhes / Recibo** em Pagamentos, **Abrir** em Conteúdos, **Ver certificado**, **Gerar MB / Enviar recibo**, **download** no cockpit e **Ver todas as notificações** abrem ecrãs ou modais. Pré-inscrições, turmas, formadores, cursos, campanhas, blog e pagamentos persistem na base. Os uploads de documentos saem no Drive da entidade (pasta `GesForma / Gold|Financiada / …`).

As listas de vocabulário (origem, meio de contacto, método de pagamento, motivo de desistência, tipo de módulo/conteúdo/parceria, categoria, regime) são **dropdown com pesquisa** e um **+ no cabeçalho** que abre um modal e grava em `catalog_items` (`kind = lista_opcoes`). Gestão → **Listas de opções** edita o mesmo catálogo. O formulário público (`/pre-inscricao`) lê `GET /v1/public/opcoes?lista=origens` sem o botão +. Estados do CRM, perfis e paginação continuam nativos.

Gold e Financiada têm cada uma o menu **Formadores**: ficha (contacto, CCP, NIF, especialidade), estado Ativo/Inactivo e os regimes em que lecciona. Quem marca os dois regimes aparece nas duas listas. Criar ou editar um formador actualiza os dropdowns do cronograma e das turmas.

O **Painel** e as **notificações** são calculados na API a partir dos dados reais: pré-inscritos, formandos, turmas e cursos ativos, receita confirmada, receita do mês, ticket médio, pendentes, funil, métodos de pagamento, top cursos e o bloco **Como conheceram a ENA** (a partir da origem das pré-inscrições). Sem ligação à API o painel diz que está offline em vez de inventar números. As notificações sinalizam pagamentos pendentes, leads por contactar, turmas lotadas ou vazias, documentos de elegibilidade em falta e DTP abaixo de 60%; marcar como lida fica gravado por utilizador.

Em **Configurações**, cada cartão abre um **modal centrado** só com essa secção (Cancelar / Guardar). Não há gaveta lateral nem lista de separadores à esquerda.

A **secretaria** trabalha com rasto no topo (regime + percurso clicável), bloco **A fazer agora** no cockpit, listas em **cartões no telemóvel** e **acções com rótulo** no desktop (menu ⋯ no ecrã estreito). Eliminar pede sempre a mesma confirmação, incluindo nos catálogos e no blog. A pesquisa geral **⌘K** é larga, reconhece nome, telemóvel, email ou id, consulta a base de dados e agrupa os resultados; ao clicar abre a ficha do formando/formador ou a view da formação/turma. As notificações classificam-se em **Bloqueio**, **Aviso** e **Info**.

O **menu segue o perfil** do utilizador: a Comercial Gold vê Principal (Painel, CRM e Equipa), Gold e Gestão; a Secretaria Financiada vê Principal, Financiada e Gestão; só a Administração vê Sistema.

A vista **Equipa** (Principal) lista os comerciais Gold: estatísticas na lista e, na ficha, propostas comerciais (estado + resposta do cliente), leads atribuídos com notas, e o diário de contactos. As contas com perfil *Comercial* criam-se em Utilizadores; a API é `GET /v1/equipa` e `GET /v1/equipa/:id`.

No **CRM**, o volume vem de **três inputs**: a **pré-inscrição** pública (`/pre-inscricao`, `POST /v1/public/preinscricoes`), a **lead manual** (`POST /v1/preinscricoes`) com nota comercial no mesmo passo, e o bot WhatsApp. Criar uma lead no balcão pede **nome + telemóvel ou email**; NIF e morada fiscal são **opcionais** até à etapa **Pré-inscrição**. O funil é Não contactado → 1.º → 2.º → Pago → **Pré-inscrição** → Formando (e **Desistiu**). Na Pré-inscrição o comercial completa o dossiê (incluindo NIF de 9 dígitos e morada fiscal); **quando o último campo obrigatório é gravado**, a lead entrega-se sozinha à secretaria (`secretaria_em`). Só admin/secretaria passam a Formando. Ligar e WhatsApp na lista e no pipeline **registam o contacto** no diário. Vista **Hoje**, dono comercial, lote (atribuir, etiqueta, adiar), pipeline até 80 cartões, ficha em gaveta com diário, modelos de nota e duplicados. Rotas extra: `GET /v1/crm/leads/:id`, `GET /v1/crm/duplicados`, `GET /v1/crm/comerciais`, `POST /v1/crm/leads/:id/notas/:nid/fixar`.

O bot WhatsApp trata **pré-inscrição** e **consulta de estado** pelo número ou email. A pré-inscrição (site, CRM e WhatsApp) pede **Nome, Apelido, Telemóvel, Email, Concelho** e depois **Dados do curso**: curso → local → horário → data de início. Locais e horários são catálogo (Gold → Edição de Cursos). A oferta pública é só **turmas Gold libertadas** (`estado = Ativa`): cada turma é um **curso individual** com **local + horário + data de início** e os seus formandos. Para o mesmo curso + local, um par horário + data só entra na pré-inscrição quando essa turma está libertada. O horário e a data **dependem do local**. Não confirma pagamentos — isso continua no webhook MB / MB Way. Em **Configurações** há o cartão **WhatsApp**: cole só o token temporário da API Setup do Meta e grave (`PUT /v1/crm/whatsapp/config`). O número de teste e o verify token preenchem-se sozinhos; o token fica cifrado na base. Sem token o CRM tem um **simulador de conversa**. Webhook público: `GET|POST /api/v1/public/whatsapp/webhook`. Simulador: `POST /v1/crm/whatsapp/simular`. Oferta pública: `GET /v1/public/oferta`.

Os formulários de criar e editar (pré-inscrição, turma, formando, sessão, etc.) abrem em **modal ao centro**, não numa gaveta que desliza da direita.

Em **Emails automáticos**, a nova regra pede gatilho, template, curso e atraso, com **preview do email** ao lado. O olho nas regras e nos templates abre o mesmo preview.

Não existe `formandos.ena.pt` nem área de formando. O pedido público é a **pré-inscrição** (`/pre-inscricao`) e o **inquérito de satisfação** (`/inquerito/:token`). No backoffice, esses pedidos entram no **CRM** (menu Principal): a lista é **paginada no servidor** (pesquisa, filtros, CSV até 2 000 linhas, acções em lote até 100 leads). A vista **Hoje** junta por contactar, atrasados e follow-ups; o pipeline mostra até 80 cartões por etapa. A pesquisa global (⌘K) consulta formandos, formadores, turmas, formações e CRM na base de dados.

A referência Multibanco / MB Way na ficha do formando grava um pagamento **Pendente** (com email e referência). O banco confirma em `GET|POST /api/v1/public/pagamentos/webhook` (`chave`, `referencia` ou `id`, `valor`). A chave vive em `PAYMENT_WEBHOOK_KEY` ou em Configurações → Gold → **Chave webhook pagamentos**. A confirmação marca o pagamento como Pago, actualiza o formando Gold, passa o lead do CRM a **Pago** e dispara `payment.confirmed` na fila de email. Recibos legais certificados (Moloni) e o contrato Ifthenpay/SIBS ficam de fora até existirem credenciais.

Cada **turma Gold** tem um **cronograma** e um toggle **Liberada / Não libertada** (`Ativa` / `Inativa` na base). No cockpit, o separador Cronograma mostra a **grelha ENA** com **todos os dias** do período (mesmo sem eventos). Clique num dia para adicionar um evento: metodologia, horário e módulos (opcional, vários). Se o horário ainda não existir, a grelha cria uma linha nova. **+ Linha de horário** faz o mesmo sem escolher o dia. **Imprimir / PDF** abre o cronograma oficial numa **única tabela** (cabeçalho da escola, datas, local mapeado, meses em colunas e legendas), como no documento da ENA. A lista de sessões lectivas por baixo serve para formadores. Regenerar pede confirmação porque substitui o plano atual. Só turmas **libertadas** aparecem nas pré-inscrições Gold (site e WhatsApp), na conversão de lead em formando, na mudança de turma de um formando e nas inscrições financiadas. Uma turma não libertada mantém os formandos já inscritos, mas fecha novas entradas.

## Backend e automações de email

A secretaria entra com sessão (cookie httpOnly, SameSite=strict). A API Fastify fala **Postgres** na VPS; em desenvolvimento, se `DATABASE_URL` estiver vazio, usa **PGlite** (o mesmo SQL, ficheiro em `server/data/`).

As migrações estão em `server/src/db/migrations/` (`001` … `028`) e correm no arranque. O seed cria o admin, dois comerciais de demonstração (`ines.costa@ena.pt` / `tiago.melo@ena.pt`), os templates de email e, se as tabelas estiverem vazias, o operacional (cursos, turmas, formadores, leads, pagamentos) e os **catálogos** (módulos, locais, horários, datas, conteúdos, áreas, formandos avulso, inscrições financiadas, temáticas do blog, inquéritos). Leads sem comercial recebem um da equipa; propostas de exemplo são gravadas uma vez. O backoffice lê `GET /v1/ops` e grava nos CRUD e em `/v1/catalog/:kind`. As **Configurações** ficam em `app_settings`.

A **execução pedagógica da turma** vive na base: `turma_sessoes` (plano, sumário e presenças por sessão), `turma_documentos` (PIP, simulações e listas do separador Documentos), `turma_dtp` (estado manual do dossiê), `turma_certificados` (nota, e-learning e emissão), `curso_fichas` (conteúdo do site e critérios da simulação), `formando_docs` / `formando_notas`, `formador_docs` e `inquerito_respostas`. As rotas são `/v1/turmas/:regime/:id/pedagogia`, `/v1/dtp/:regime`, `/v1/cursos/:regime/:id/ficha`, `/v1/formandos/:regime/:id/dossier`, `/v1/formadores/:id/docs`, `/v1/inqueritos/:id/respostas`, `/v1/dashboard` e `/v1/notificacoes`.

A **estrutura do dossiê é configurável por curso**, no separador **Dossiê TP** da ficha do curso (`curso_dtp_modelos`). Cada regime tem a sua base: **Gold / autofinanciada** = núcleo DGERT + extras do CCP (PIP, simulações, comprovativo de 5 anos, recibos); **Financiada** = núcleo DGERT + execução do financiador (referencial UFCD, elegibilidade, IBAN, mapa de horas, relatório de execução). Os documentos que são **norma** aparecem travados e não se removem. O resto liga-se e desliga-se conforme o curso e podem acrescentar-se documentos próprios, com **âmbito** turma, formando ou formador. Os extras de formando/formador aparecem na ficha da pessoa para anexar o PDF; o DTP da turma conta quantos já estão no Drive. As turmas de um curso herdam a estrutura; o estado de cada documento continua a ser por turma.

A **completude do DTP** é calculada e não escrita à mão: o cronograma, os planos, os sumários assinados, as folhas de presença, o PIP, as simulações, os contratos, os documentos de elegibilidade e os certificados emitidos saem dos dados da turma (aparecem marcados como *automático*). Os documentos administrativos ficam em estado manual e podem ser validados no painel - ou devolvidos ao estado automático. Cada item do dossiê aceita um **anexo no Drive**. **Exportar pasta DTP** descarrega um **ZIP** com os PDFs da turma no Drive (e um `indice-dtp.txt` se ainda não houver ficheiros).

Os **ficheiros** (DTP, documentos de formandos e de formadores, conteúdos) vão para o **Google Drive da entidade**. Na Vercel não se grava em disco (`/tmp` desaparece): sem Drive ligado o upload é recusado. Em desenvolvimento local, sem OAuth, o ficheiro ainda pode ficar em `server/data/drive-files/` como recurso.

As **campanhas** mostram inscrições, pagamentos, conversão, ticket médio, por contactar, desistências, origens e ROI **calculados** a partir das pré-inscrições (campo campanha / curso) e dos pagamentos. O custo, o canal, as datas e as notas são da campanha.

A **taxa de abertura** dos emails automáticos sai do pixel `GET /api/v1/email/open/:id.gif`. O preview usa um destinatário real da base (lead, formando ou formador). O cron na Vercel corre **de hora a hora**; o lembrete “24 h antes” cobre turmas que começam hoje ou amanhã, para não falhar a janela se o plano só permitir um cron diário.

A ficha do curso e o blog **ficam no GesForma**. Ainda não há publicação em `ena.pt` - falta o código de integração do site.

Se a API falhar, as listas **não ficam com o seed de demonstração**: ficam vazias e aparece um aviso. As gravações (POST/PUT/PATCH/DELETE) mostram toast quando falham. O overlay branco com o logo ENA só aparece se um pedido à API demorar mais de cerca de 2,5 segundos - mudanças de vista com dados já carregados não o disparam.

O login aceita **email e palavra-passe**, **Continuar com Google** e **Continuar com Microsoft**. Nos dois casos externos a sessão só é criada se o email já existir como utilizador activo: a autenticação externa identifica a pessoa, não dá acesso. O cliente Google e a aplicação Microsoft configuram-se em **Configurações** (ou por variáveis de ambiente `GOOGLE_*` / `MICROSOFT_*`, que passam a mandar). A aplicação Microsoft pede o *Application (client) ID*, o *client secret* e o *Directory (tenant) ID* - com o tenant da ENA só entra a organização; com `common` entra qualquer organização. O segredo fica cifrado (AES-256-GCM) como o do Google, e o URI de redireccionamento a registar no portal Azure é `{APP_ORIGIN}/api/v1/auth/microsoft/callback`.

Em **Sistema → Gestão → Utilizadores** a administração cria contas da secretaria (nome, email, perfil, palavra-passe, activo). Quem não estiver nesta lista não entra - nem com Google. Os perfis são Administração, Secretaria, Comercial Gold e Secretaria Financiada. Não se pode desactivar nem apagar o último administrador.

Os ficheiros da secretaria (PIP, certificados, conteúdos, documentos do formador) vão para o **Google Drive da entidade**. Em Configurações a administradora liga a conta Google via **OAuth 2.0**. Enquanto a conta não estiver ligada, o upload fica no servidor (`server/data/drive-files/`) para o trabalho não parar. Na Vercel sem Drive os ficheiros locais vão para `/tmp` e somem entre invocações - ligue a conta da ENA.

O worker de email também dispara o lembrete **24h antes do início** da turma (formandos da turma) e o certificado quando o estado do formando passa a concluído. No CRM, o cron (`/api/v1/cron/email`) envia o lembrete **sem pagamento há 3 dias** (estado **2.º Contacto**) e o **reengajamento aos 30 dias**.

O formulário público `POST /v1/public/preinscricoes` (8 pedidos / minuto) cria um lead em **Não contactado** e dispara as boas-vindas. **Contactar** passa a **1.º Contacto** e regista a nota. Marcar pago (ficha ou webhook) passa a **Pago** e envia a confirmação + contacto após a venda. Inscrever numa turma passa a **Formando**.

Arquitectura na VPS: **um Compose, três papéis, rede só interna**.

1. `db` - Postgres 16. Não é publicado na internet.
2. `api` - só em `127.0.0.1:43148`. O Caddy/nginx faz TLS e encaminha `/api` para aqui.
3. `web` - esta app Vite, no mesmo domínio, para os cookies funcionarem.

Não separam a base para outro servidor até haver necessidade: um contentor Postgres no mesmo host é mais rápido, o backup é um `pg_dump` e a API não atravessa a rede pública.

**Emails automáticos** - uma regra = gatilho + template + atraso. A secretaria regista uma pré-inscrição ou um pagamento; a API enfileira o envio (incluindo **contacto após a venda**, 1 hora depois do pagamento) e actualiza o funil do CRM. O worker corre na própria API, sem Redis. Sem SMTP (`MAIL_MODE=log`) o email fica no histórico; com `SMTP_URL` sai pelo correio.

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

O formulário de login abre vazio. O seed cria o utilizador da secretaria `aguiar@ena.pt` (mesmo que a base já exista). Também pode entrar com **Continuar com Google** se o email da conta Google já existir como utilizador.

Para o Drive da entidade e o login Google: no Google Cloud Console active a **Google Drive API**, crie um cliente OAuth «Aplicação Web» com os URI `http://127.0.0.1:43147/api/v1/drive/oauth/callback` e `http://127.0.0.1:43147/api/v1/auth/google/callback`. Em **Configurações** cole o Client ID e o secret, grave, e clique em *Ligar conta Google* com a conta da secretaria (não uma conta pessoal). Em produção também pode pôr `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` no ambiente e os URI de `https://gesforma-alpha.vercel.app`. Sem cliente OAuth os uploads continuam a funcionar, mas ficam no disco local; o botão Google no login fica indisponível.

Formulário público (sem login): [http://127.0.0.1:43147/pre-inscricao](http://127.0.0.1:43147/pre-inscricao). Aceita `?curso=` e `?email=`.

Na VPS, depois de preencher `.env` com segredos gerados (`openssl rand -base64 48`):

```bash
docker compose up -d db api
```

### Vercel

A API vai no **mesmo projecto** que a app (`/api`), para o cookie de sessão ser do mesmo domínio. A Vercel é serverless: não há `setInterval`. A fila de email corre no fim de cada evento, ao abrir o histórico, e num cron horário (`/api/v1/cron/email`). No plano Hobby a Vercel pode limitar a 1×/dia - a janela do lembrete 24h cobre hoje e amanhã.

1. Claim ou ligue o Git à Vercel.
2. Variáveis: `DATABASE_URL` (Neon ou Vercel Postgres), `SESSION_SECRET`, `ADMIN_PASSWORD`, `APP_ORIGIN=https://o-seu-dominio.vercel.app`, `MAIL_MODE`, `SMTP_URL`, e para o Drive `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (URI de callback `{APP_ORIGIN}/api/v1/drive/oauth/callback`). Para o WhatsApp (opcional): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` — o callback no Meta é `{APP_ORIGIN}/api/v1/public/whatsapp/webhook`.
3. Sem `DATABASE_URL` a função usa PGlite em `/tmp` - some entre invocações. Para produção, Neon é o par habitual da Vercel.

`vercel.json` já encaminha `/api/*` para a função.
