# GesForma - backoffice ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada), com API Fastify, base migrável e formulário público de pré-inscrição.

O site público está em `/`. O backoffice, com o ecrã de login e o painel conforme o perfil, está em `/entrar`.

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** - núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** - núcleo DGERT + **documentos** de elegibilidade (CC, CH, CU, IBAN, emprego), horas, relatório de execução

O menu **Dossiê TP** lista as turmas com a completude do dossiê e abre o DTP dessa turma.

**Inquéritos** (Gold e Financiada) permitem montar questionários de satisfação com texto, escolha múltipla, escala 1 a 5 e sim/não. **Pré-visualizar** abre o questionário como o formando o vê e permite lançar uma resposta recebida; **Ligação pública** gera um token (`/inquerito/:token`) para o formando responder online; **Exportar** dá o CSV das perguntas. A contagem e as métricas (média 1 a 5, % Sim, opção mais escolhida) saem das respostas gravadas.

No cockpit da turma (Gold e Financiada, os mesmos separadores): plano de sessão, **sumário por sessão** e **presenças dentro da sessão** - não há menu isolado de presenças. O perfil do formador e os certificados também vivem na turma. O **cronograma** mostra só a grelha (arrastar sessões); a lista lectiva está no separador **Sessões**. O separador **Avaliação** lança as notas dos formandos segundo os parâmetros da ficha do curso (escala, unidade, mínimo de aprovação, pesos e modo por módulo/capítulo ou avaliação final). Na grelha, arraste o quadrado da seleção para copiar um valor como no Excel.

No separador **Documentos** (Gold / CCP):

- **PIP** - um ficheiro por formando. O estado passa a *Em falta*, *Parcial* ou *No dossiê* conforme os projetos carregados.
- **Simulação pedagógica inicial e final** - por aluno: um vídeo e uma folha de avaliação. A grelha usa os critérios 1 a 5 da ficha do curso (CCP). Só fica no dossiê quando o vídeo e a grelha estão completos.

Cada **curso Gold** e cada **UFCD financiada** tem uma ficha própria (não um painel lateral): identidade visual, **Oferta** (tipo, categoria com «+», regime, preço, horas, tags e **vários locais** do catálogo), textos da página pública, **Programa**, **Avaliação** (parâmetros ponderados para a pauta da turma; nos CCP/UFCD pedagógicas mantém-se a folha 1 a 5 das simulações), **Documentos**, **Dossiê TP** e publicação. Na ficha, **Gold vs Financiada não se escolhe**: vem da rota (Gold → Cursos Gold vs Financiada → Cursos). O Guardar só cria o curso se os campos obrigatórios da Identidade e da Oferta estiverem preenchidos (tipo comercial, categoria, modalidade, preço/horas, tags e pelo menos um local). A pré-visualização da página lista automaticamente as **turmas libertadas** (local → horário → data). A coluna da direita mostra o que aparece em `ena.pt/cursos/…`. O progresso “Pronto para o site” indica o que ainda falta para publicar. Nas UFCD o código e a designação oficial do CNQ ficam separados do nome comercial.

O separador **Documentos** da ficha do curso fica imediatamente antes de **Dossiê TP**. Anexa-se um ficheiro do **curso**, de um **formando** ou de um **formador** e associa-se a um requisito do dossiê (Antes, Durante ou Fecho). O visto desse requisito na turma só fecha quando todas as partes responsáveis tiverem enviado: um ficheiro do curso vale para todas as turmas desse curso; no formando conta cada pessoa da turma; no formador conta o nome do formador atribuído à turma. Se o mesmo requisito tiver vários âmbitos, todos têm de estar completos. Isto é distinto do separador **Documentos** do cockpit da turma (PIP, simulações e listas da sessão).

O separador **Dossiê TP** da ficha lista os requisitos por fase (**Antes da turma**, **Durante**, **Fecho**) e marca como **universal** os que existem na autofinanciada e na financiada. Já não há formulário para acrescentar um documento novo nessa tab. Na **financiada** o dossiê é sempre o mesmo, independentemente da UFCD: a lista fica travada e não se grava um modelo por curso. No Gold, as normas continuam travadas; o que não é norma liga-se ou desliga-se, e extras já gravados ainda se editam.

A vista **Módulos** começa pelo filtro de curso: lista só os blocos desse curso e o botão **+ Novo módulo** está sempre disponível (no cabeçalho, no filtro e no estado vazio). A partir da ficha de um curso Gold ou de uma UFCD, **Módulos** abre já filtrado.

O catálogo **Módulos, Conteúdos, Datas, Locais, Horários e Áreas** existe no Gold (Horários só no Gold); Financiada mantém o mesmo *shell* para o resto. Kicker de regime, KPIs, pesquisa no painel, linha clicável, cartões no telemóvel e sem coluna de Id. Em **Formandos Gold** (avulso) o olho abre a ficha com documentos - o lápis continua a editar. **Detalhes / Recibo** em Pagamentos, **Abrir** em Conteúdos, **Ver certificado**, **Gerar MB / Enviar recibo**, **download** no cockpit e **Ver todas as notificações** abrem ecrãs ou modais. Pré-inscrições, turmas, formadores, cursos, campanhas, blog e pagamentos persistem na base. Os uploads de documentos saem no Drive da entidade (pasta `GesForma / Gold|Financiada / …`).

As listas de vocabulário (origem, meio de contacto, método de pagamento, motivo de desistência, tipo de módulo/conteúdo/parceria, categoria, regime) são **dropdown com pesquisa** e um **+ no cabeçalho** que abre um modal e grava em `catalog_items` (`kind = lista_opcoes`). Gestão → **Listas de opções** edita o mesmo catálogo. O formulário público (`/pre-inscricao`) lê `GET /v1/public/opcoes?lista=origens` sem o botão +. Estados do CRM, perfis e paginação continuam nativos.

Gold e Financiada têm cada uma o menu **Formadores**: ficha (contacto, CCP, NIF, especialidade), estado Ativo/Inactivo e os regimes em que lecciona. Quem marca os dois regimes aparece nas duas listas. Criar ou editar um formador actualiza os dropdowns do cronograma e das turmas.

O **Painel** (um em Gold e outro em Financiada) e as **notificações** saem da API com os dados reais desse regime. Aceita filtros de **período, curso, local, horário** e **pré-inscritos vs formandos** (inscritos). A receita, o funil, a desagregação, o ranking e o gráfico seguem o mesmo filtro. A receita por mês é um **gráfico circular**: cada mês tem a sua cor; ao passar o rato aparece o mês, a receita e um balão com os cursos mais vendidos (até 5) e a comparação com o mês passado ou o ano passado. O clique fixa o balão para se poder mudar essa comparação; fecha-se no X ou ao clicar noutra fatia. O preço por local e horário não está no painel: configura-se na tab **Oferta** do curso Gold (local, horário, ou os dois) e a pré-inscrição usa a regra mais específica. Sem ligação à API o painel fica offline em vez de inventar números. As notificações sinalizam pagamentos pendentes, pré-inscrições por contactar, turmas lotadas ou vazias, documentos de elegibilidade em falta e DTP abaixo de 60%; marcar como lida fica gravado por utilizador.

Em **Configurações**, cada cartão abre um **modal centrado** só com essa secção (Cancelar / Guardar), excepto os cartões de integração (Drive, Microsoft, WhatsApp e **SMTP Brevo**), que se editam na própria grelha.

A **secretaria** trabalha com rasto no topo (regime + percurso clicável), bloco **A fazer agora** no cockpit, listas em **cartões no telemóvel** e **acções com rótulo** no desktop (menu ⋯ no ecrã estreito). Eliminar pede sempre a mesma confirmação, incluindo nos catálogos e no blog. A pesquisa geral **⌘K** é larga, reconhece nome, telemóvel, email ou id, consulta a base de dados e agrupa os resultados; ao clicar abre a ficha do formando/formador ou a view da formação/turma. As notificações classificam-se em **Bloqueio**, **Aviso** e **Info**.

O **menu segue o perfil** do utilizador: a Comercial Gold vê Gold e Gestão; a Secretaria Financiada vê Financiada e Gestão; só a Administração vê Sistema. **Painel, CRM e Equipa vivem dentro de Gold e dentro de Financiada**, cada um só com os dados desse regime.

A vista **Equipa** lista, no Gold, os comerciais (`role = comercial`) e, na Financiada, a secretaria financiada (`role = financiada`): estatísticas na lista e, na ficha, propostas (estado + resposta do cliente), pré-inscrições atribuídas com notas, e o diário de contactos. As contas criam-se em Utilizadores; a API é `GET /v1/equipa?regime=gold|fin` e `GET /v1/equipa/:id?regime=gold|fin`.

No **CRM**, o volume vem de **três inputs**: a **pré-inscrição** pública (`/pre-inscricao`, `POST /v1/public/preinscricoes`), a **pré-inscrição manual** (`POST /v1/preinscricoes`) com nota comercial no mesmo passo, e o bot WhatsApp. No interface, cada pedido chama-se **pré-inscrição**. Ao entrar (manual, site ou WhatsApp) a plataforma envia o email de boas-vindas com **ligação única** `/documentos/:token`. Se esse email for mesmo enfileirado, o estado passa a **1.º Contacto**. Quem já está mais à frente no funil (Pago, etapa Pré-inscrição, Formando) não recua. Os obrigatórios no Gold são cartão de cidadão, contrato e regulamento; na Financiada, cartão de cidadão, habilitações, CV, IBAN e comprovativo de emprego. Cada ficheiro fica na **ficha** (CRM e, se já for formando, no dossiê do formando).

Na ficha, a secretaria **valida** ou **recusa** cada documento. A recusa leva uma observação (o que está incorrecto). O cliente vê essa observação na ligação pessoal. Quando há documentos recusados, **Alertar documentos incorrectos** envia um email com o botão **Corrigir documentos**: a pessoa só volta a enviar esses ficheiros. O novo upload repõe o documento em pendente, limpa a observação e volta a avisar a secretaria. O aviso no backoffice é um toast fixo, até **Dispensar** ou até um documento dessa ficha ser validado. Quando todos os obrigatórios estão **validados**, a ligação fecha. Se a formação Gold ainda precisar de pagamento, a mesma ligação fica aberta só para o **comprovativo**. Enquanto os obrigatórios não estão todos validados, o envio completo (Gold) continua a disparar o email com **referência Multibanco**.

Uma pré-inscrição pode passar à **etapa Pré-inscrição** em qualquer etapa (excepto Formando/Desistiu) e reenvia a ligação de documentos. O funil é Não contactado → 1.º Contacto → 2.º Contacto → Pago → **Pré-inscrição** → Formando (e **Desistiu**). Só avança.

O bot WhatsApp trata **pré-inscrição** e **consulta de estado** pelo número ou email. A pré-inscrição (site, CRM e WhatsApp) pede **Nome, Apelido, Telemóvel, Email, Concelho** e depois **Dados do curso**: curso → local → horário → data de início. Locais e horários são catálogo (Gold → Edição de Cursos). A oferta pública é só **turmas Gold libertadas** (`estado = Ativa`): cada turma é um **curso individual** com **local + horário + data de início** e os seus formandos. Para o mesmo curso + local, um par horário + data só entra na pré-inscrição quando essa turma está libertada. O horário e a data **dependem do local**. Não confirma pagamentos - isso continua no webhook MB / MB Way. Em **Configurações** há o cartão **WhatsApp**: cole só o token temporário da API Setup do Meta e grave (`PUT /v1/crm/whatsapp/config`). O número de teste e o verify token preenchem-se sozinhos; o token fica cifrado na base. Sem token o CRM tem um **simulador de conversa**. Webhook público: `GET|POST /api/v1/public/whatsapp/webhook`. Simulador: `POST /v1/crm/whatsapp/simular`. Oferta pública: `GET /v1/public/oferta`.

Os formulários de criar e editar (pré-inscrição, turma, formando, sessão, etc.) abrem em **modal ao centro**, não numa gaveta que desliza da direita.

Em **Emails automáticos**, a nova regra pede gatilho, template, curso e atraso, com **preview do email** ao lado (HTML com botão). O olho nas regras e nos templates abre o mesmo preview. **Testar** envia a regra ao destinatário de exemplo e não altera o estado da pré-inscrição. Gatilhos: nova pré-inscrição, pré-inscrição promovida, documentos submetidos, 1.º contacto registado, sem pagamento há 3 dias, pagamento confirmado, contacto após a venda, 24 horas antes do início, formando concluído, 30 dias sem compra e sumário assinado. O rótulo antigo “Lead passou a pré-inscrito” continua a disparar a mesma regra que “Pré-inscrição promovida”.

Não existe `formandos.ena.pt` nem área de formando. O pedido público é a **pré-inscrição** (`/pre-inscricao`) e o **inquérito de satisfação** (`/inquerito/:token`). No backoffice, esses pedidos entram no **CRM** do regime (Gold ou Financiada): a lista é **paginada no servidor** (pesquisa, filtros, CSV até 2 000 linhas, acções em lote até 100 pré-inscrições). A vista **Hoje** junta por contactar, atrasados e follow-ups; o pipeline mostra até 80 cartões por etapa. A pesquisa global (⌘K) consulta formandos, formadores, turmas, formações e CRM na base de dados.

A referência Multibanco / MB Way na ficha do formando grava um pagamento **Pendente** (com email e referência). O banco confirma em `GET|POST /api/v1/public/pagamentos/webhook` (`chave`, `referencia` ou `id`, `valor`). A chave vive em `PAYMENT_WEBHOOK_KEY` ou em Configurações → Gold → **Chave webhook pagamentos**. A confirmação marca o pagamento como Pago, actualiza o formando Gold, passa a pré-inscrição do CRM a **Pago** e dispara `payment.confirmed` na fila de email. Recibos legais certificados (Moloni) e o contrato Ifthenpay/SIBS ficam de fora até existirem credenciais.

Nas vistas **Turmas** (Gold e Financiada) há **regras de abertura**: curso, local, horário, vagas, horas e próxima data. **Aplicar regras** cria a turma e o cronograma; na Financiada as sessões são de **3 horas**.

Cada **turma Gold** tem um **cronograma** e um toggle **Liberada / Não libertada** (`Ativa` / `Inativa` na base). No cockpit, o separador Cronograma mostra a **grelha ENA** com **todos os dias** do período (mesmo sem eventos). Clique num dia para adicionar um evento: metodologia, horário e módulos (opcional, vários). Se o horário ainda não existir, a grelha cria uma linha nova. **+ Linha de horário** faz o mesmo sem escolher o dia. **Imprimir / PDF** abre o cronograma oficial numa **única tabela** (cabeçalho da escola, datas, local mapeado, meses em colunas e legendas), como no documento da ENA. A lista de sessões lectivas por baixo serve para formadores. Regenerar pede confirmação porque substitui o plano atual. Só turmas **libertadas** aparecem nas pré-inscrições Gold (site e WhatsApp), na conversão de pré-inscrição em formando, na mudança de turma de um formando e nas inscrições financiadas. Uma turma não libertada mantém os formandos já inscritos, mas fecha novas entradas.

## Backend e automações de email

A secretaria entra com sessão (cookie httpOnly, SameSite=strict). A API Fastify fala **Postgres** na VPS; em desenvolvimento, se `DATABASE_URL` estiver vazio, usa **PGlite** (o mesmo SQL, ficheiro em `server/data/`).

As migrações estão em `server/src/db/migrations/` (`001` … `037`) e correm no arranque. A `037` acrescenta o estado e a observação de cada documento da pré-inscrição, o fecho da ligação, os alertas in-app e os ficheiros do curso associados a um requisito do dossiê. Também passa a **1.º Contacto** quem ainda estava em Não contactado e já tinha um email de boas-vindas na fila. O seed cria o admin, dois comerciais de demonstração (`ines.costa@ena.pt` / `tiago.melo@ena.pt`), os templates de email e, se as tabelas estiverem vazias, o operacional (cursos, turmas, formadores, pré-inscrições, pagamentos) e os **catálogos** (módulos, locais, horários, datas, conteúdos, áreas, formandos avulso, inscrições financiadas, temáticas do blog, inquéritos). Pré-inscrições sem comercial recebem um da equipa; propostas de exemplo são gravadas uma vez. O backoffice lê `GET /v1/ops` e grava nos CRUD e em `/v1/catalog/:kind`. As **Configurações** ficam em `app_settings`.

A **execução pedagógica da turma** vive na base: `turma_sessoes` (plano, sumário e presenças por sessão), `turma_documentos` (PIP, simulações e listas do separador Documentos), `turma_dtp` (estado manual do dossiê), `turma_certificados` (nota, e-learning e emissão), `curso_fichas` (conteúdo do site e critérios da simulação), `formando_docs` / `formando_notas`, `formador_docs` e `inquerito_respostas`. As rotas são `/v1/turmas/:regime/:id/pedagogia`, `/v1/dtp/:regime`, `/v1/cursos/:regime/:id/ficha`, `/v1/formandos/:regime/:id/dossier`, `/v1/formadores/:id/docs`, `/v1/inqueritos/:id/respostas`, `/v1/dashboard` e `/v1/notificacoes`.

A **estrutura do dossiê** vive no separador **Dossiê TP** da ficha do curso (`curso_dtp_modelos`), organizada em **antes**, **durante** e **fecho**. Cada regime tem a sua base: **Gold / autofinanciada** = núcleo DGERT + extras do CCP (PIP, simulações, comprovativo de 5 anos, recibos); **Financiada** = núcleo DGERT + execução do financiador (referencial UFCD, elegibilidade, IBAN, mapa de horas, relatório de execução), **igual para todas as UFCD**. Os requisitos comuns aos dois regimes aparecem como **universais**. Os que são **norma** ficam travados. No Gold, o resto liga-se e desliga-se; extras já gravados (âmbito turma, formando ou formador) ainda se editam nessa tab, mas o documento novo anexa-se no separador **Documentos** do curso. Os ficheiros de `curso_ficheiros` fecham o visto na turma quando as partes responsáveis entregaram. O estado de cada documento continua a ser por turma.

A **completude do DTP** é calculada e não escrita à mão: o cronograma, os planos, os sumários assinados, as folhas de presença, o PIP, as simulações, os contratos, os documentos de elegibilidade e os certificados emitidos saem dos dados da turma (aparecem marcados como *automático*). Os documentos administrativos ficam em estado manual e podem ser validados no painel - ou devolvidos ao estado automático. **Exportar pasta DTP** descarrega um ZIP cujo nome e pasta-raiz trazem a turma (`DTP-Gold-VNG-SM-07-09.zip` → pasta `DTP Gold VNG-SM-07-09/`), organizado por **categorias** (`01-Identificacao e programa`, `02-Formandos`, `03-Formador`, `04-Pedagogia`, `05-Avaliacao`, `06-Certificacao e relatorios`). Os mesmos níveis são usados no Drive. Cada categoria leva um `_indice.txt`; o `00-Indice geral.txt` lista o dossiê e os ficheiros. A ficha do curso continua a indicar *quando* recolher cada documento (antes / durante / fecho); o arquivo não segue essas etapas.

Os **ficheiros** (DTP, documentos de formandos e de formadores, conteúdos) vão para o **Google Drive da entidade**. Na Vercel não se grava em disco (`/tmp` desaparece): sem Drive ligado o upload é recusado. Em desenvolvimento local, sem OAuth, o ficheiro ainda pode ficar em `server/data/drive-files/` como recurso.

As **campanhas** mostram inscrições, pagamentos, conversão, ticket médio, por contactar, desistências, origens e ROI **calculados** a partir das pré-inscrições (campo campanha / curso) e dos pagamentos. O custo, o canal, as datas e as notas são da campanha.

A **taxa de abertura** dos emails automáticos sai do pixel `GET /api/v1/email/open/:id.gif`. O preview usa um destinatário real da base (pré-inscrição, formando ou formador). O cron na Vercel corre **de hora a hora**; o lembrete “24 h antes” cobre turmas que começam hoje ou amanhã, para não falhar a janela se o plano só permitir um cron diário.

A ficha do curso e o blog **ficam no GesForma**. Ainda não há publicação em `ena.pt` - falta o código de integração do site.

Se a API falhar, as listas **não ficam com o seed de demonstração**: ficam vazias e aparece um aviso. As gravações (POST/PUT/PATCH/DELETE) mostram toast quando falham. O overlay branco com o logo ENA só aparece se um pedido à API demorar mais de cerca de 2,5 segundos - mudanças de vista com dados já carregados não o disparam.

O login aceita **email e palavra-passe**, **Continuar com Google** e **Continuar com Microsoft**. Nos dois casos externos a sessão só é criada se o email já existir como utilizador activo: a autenticação externa identifica a pessoa, não dá acesso. O cliente Google e a aplicação Microsoft configuram-se em **Configurações** (ou por variáveis de ambiente `GOOGLE_*` / `MICROSOFT_*`, que passam a mandar). A aplicação Microsoft pede o *Application (client) ID*, o *client secret* e o *Directory (tenant) ID* - com o tenant da ENA só entra a organização; com `common` entra qualquer organização. O segredo fica cifrado (AES-256-GCM) como o do Google, e o URI de redireccionamento a registar no portal Azure é `{APP_ORIGIN}/api/v1/auth/microsoft/callback`.

Em **Sistema → Gestão → Utilizadores** a administração cria contas da secretaria (nome, email, perfil, palavra-passe, activo). Quem não estiver nesta lista não entra - nem com Google. Os perfis são Administração, Secretaria, Comercial Gold e Secretaria Financiada. Não se pode desactivar nem apagar o último administrador.

Os ficheiros da secretaria (PIP, certificados, conteúdos, documentos do formador e da ficha do curso) vão para o **Google Drive da entidade**. Em Configurações a administradora liga a conta Google via **OAuth 2.0**. Em desenvolvimento, sem essa conta, o ficheiro pode ficar em `server/data/drive-files/`. Na Vercel, sem Drive, o upload é recusado.

O worker de email também dispara o lembrete **24h antes do início** da turma (formandos da turma) e o certificado quando o estado do formando passa a concluído. No CRM, o cron (`/api/v1/cron/email`) envia o lembrete **sem pagamento há 3 dias** (estado **2.º Contacto**) e o **reengajamento aos 30 dias**.

O formulário público `POST /v1/public/preinscricoes` (8 pedidos / minuto) cria uma pré-inscrição em **Não contactado** e dispara as boas-vindas. Se o email de boas-vindas ficar na fila, o estado passa a **1.º Contacto** (o mesmo acontece na pré-inscrição manual e no WhatsApp). **Contactar** à mão também passa a **1.º Contacto** e regista a nota. Sem pagamento há 3 dias, ou 30 dias sem compra, passa a **2.º Contacto**. Marcar pago (ficha ou webhook) passa a **Pago** e envia a confirmação + contacto após a venda. Inscrever numa turma passa a **Formando**. A página pública `/documentos/:token` pede **um ficheiro de cada vez**, com visto no que já está na ficha. Em correcção mostra só os recusados e a observação da secretaria.

Arquitectura na VPS: **um Compose, três papéis, rede só interna**.

1. `db` - Postgres 16. Não é publicado na internet.
2. `api` - só em `127.0.0.1:43148`. O Caddy/nginx faz TLS e encaminha `/api` para aqui.
3. `web` - esta app Vite, no mesmo domínio, para os cookies funcionarem.

Não separam a base para outro servidor até haver necessidade: um contentor Postgres no mesmo host é mais rápido, o backup é um `pg_dump` e a API não atravessa a rede pública.

**Emails automáticos** - uma regra = gatilho + template + atraso. O HTML leva o botão do template (documentos, comprovativo ou secretaria). A secretaria regista uma pré-inscrição ou um pagamento; a API enfileira o envio (incluindo **contacto após a venda**, 1 hora depois do pagamento) e actualiza o funil do CRM. As boas-vindas só avançam para **1.º Contacto** quando o job é mesmo criado. O worker de email corre na própria API, sem Redis. Sem SMTP, o email fica no histórico (`[mail:log]`). O envio real configura-se em **Configurações → Emails · SMTP Brevo** (login e chave SMTP, email dos automáticos e email para redireccionar as respostas; a chave fica cifrada). `SMTP_URL` / `MAIL_FROM` / `MAIL_REPLY_TO` no servidor mandam sobre o que está na app. O email de documentos incorrectos sai directo por este SMTP, com o botão para a ligação pessoal.

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

Para o Drive da entidade e o login Google: no Google Cloud Console active a **Google Drive API**, crie um cliente OAuth «Aplicação Web» e registe **exactamente** os URI do site, não os de um deployment `*.vercel.app` à parte. Em local: `http://127.0.0.1:43147/api/v1/drive/oauth/callback` e `http://127.0.0.1:43147/api/v1/auth/google/callback`. Em produção, com `APP_ORIGIN=https://gesforma-alpha.vercel.app`: `https://gesforma-alpha.vercel.app/api/v1/drive/oauth/callback` e `https://gesforma-alpha.vercel.app/api/v1/auth/google/callback`. O GesForma devolve os hosts `*.vercel.app` que não são o `APP_ORIGIN` para esse domínio, e grava o URI usado em `oauth_states`, para o callback trocar o código com o mesmo valor. Enquanto o consentimento OAuth estiver em **Teste**, a conta que liga o Drive tem de estar em Google Auth platform → **Público-alvo** (os tokens de teste expiram ao fim de 7 dias; uma app **Interna** do Workspace evita isso). Em **Configurações** cole o Client ID e o secret, grave, e clique em *Ligar conta Google* com a conta da secretaria. Se o campo do ID da pasta tiver um valor colado à mão, apague-o: com o âmbito `drive.file` a API não vê pastas que não criou e volta a criar a pasta GesForma. Sem cliente OAuth, em local os uploads ficam em disco; na Vercel são recusados. O botão Google no login fica indisponível sem cliente OAuth.

Formulário público (sem login): [http://127.0.0.1:43147/pre-inscricao](http://127.0.0.1:43147/pre-inscricao). Aceita `?curso=` e `?email=`.

Na VPS, depois de preencher `.env` com segredos gerados (`openssl rand -base64 48`):

```bash
docker compose up -d db api
```

### Vercel

A API vai no **mesmo projecto** que a app (`/api`), para o cookie de sessão ser do mesmo domínio. A Vercel é serverless: não há `setInterval`. A fila de email corre no fim de cada evento, ao abrir o histórico, e num cron horário (`/api/v1/cron/email`). No plano Hobby a Vercel pode limitar a 1×/dia - a janela do lembrete 24h cobre hoje e amanhã.

1. Claim ou ligue o Git à Vercel.
2. Variáveis: `DATABASE_URL` (Neon ou Vercel Postgres), `SESSION_SECRET`, `ADMIN_PASSWORD`, `APP_ORIGIN=https://o-seu-dominio.vercel.app`. SMTP também se configura na app (Brevo). `SMTP_URL` é opcional e manda sobre a app. Drive: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (URI de callback `{APP_ORIGIN}/api/v1/drive/oauth/callback`). WhatsApp (opcional): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` - o callback no Meta é `{APP_ORIGIN}/api/v1/public/whatsapp/webhook`.
3. Sem `DATABASE_URL` a função usa PGlite em `/tmp` - some entre invocações. Para produção, Neon é o par habitual da Vercel.

`vercel.json` já encaminha `/api/*` para a função.
