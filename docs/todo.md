# Por fazer

Esta é a lista fechada do que ainda falta. Os outros documentos descrevem o que já funciona e apontam para aqui.

## Área do formando — o que ainda falta

O ecrã de login e a área estão em `/area-formando` (`src/site/AreaFormando.tsx`). No ambiente de demonstração, `formando@ena.pt` fica ligada à primeira ficha `formandos_fin` (`ligarFormandoDemo` no seed). O perfil `formando` está no `CHECK` de `users.role` (migração `057_users_role_formando.sql`). A ligação à ficha está em `formandos_gold.user_id` e `formandos_fin.user_id` (migração `058_area_noticias_disponibilidade.sql`).

A secção **Documentos** na área do formando (formação financiada) mostra o estado do dossiê, observações de recusa e permite upload autenticado. O portal público por token está em `/documentos-formando/:token`.

O acesso nasce na ficha do formando, Gold ou financiada, com **Gerar acesso**. A palavra-passe aparece uma vez. **Gerar nova palavra-passe** troca-a e encerra as sessões. A pessoa não se regista sozinha.

Cursos, sessões, progresso (sessões já realizadas sobre as sessões datadas), certificados emitidos, pagamentos e notificações saem dessa ficha. O nome, o apelido e o telemóvel gravados na área voltam à ficha. O email de acesso não se altera aqui. «Esqueci-me da palavra-passe» envia um email com uma ligação de duas horas. Sem SMTP, a mensagem fica no registo da API (`[mail:log]`) e a resposta ao visitante é sempre a mesma.

Depois de a credencial estar aceite, o destino é `destinoPosLogin` (`src/partilhado/destinoPerfil.ts`): formando fica em `/area-formando`; formador vai para `/gesforma/formador/turmas`; secretaria financiada (`financiada`) para `/gesforma/financiada`; administrador, comercial e secretaria para `/gesforma/gold`. Com `?destino=/gesforma/…` (seguro, só caminhos GesForma) a sessão abre nessa rota após login. O Google e a Microsoft voltam a `/area-formando`. Quem abre `/gesforma` sem sessão é enviado para `/area-formando?destino=…`. `/entrar` redirecciona para `/area-formando`. As rotas do GesForma recusam o formando com 403, excepto mudar a própria palavra-passe e ler a própria área.

Na página inicial, «Área de formando» e «Entrar» abrem `/area-formando`.

Ainda por fazer nesta área:

- «Continuar» abre os módulos neste ecrã com a **estrutura pedagógica** da ficha (vídeos, PDF, flashcards, quizzes nativos, SCORM e H5P). Hoje só existe o desenho parcial da sala; falta o runtime completo descrito em `docs/conteudos-pedagogicos.md`.
- Progresso, pontuação e conclusão por formando (incluindo `cmi.*` SCORM e eventos H5P) gravados no GesForma; o Moodle continua por ligar.
- Os dados fiscais não se editam.
- Um certificado só se descarrega quando a secretaria já anexou o ficheiro. O GesForma não gera o PDF.

## Backend

O ecrã já está separado: `src/site` é o site público, `src/gesforma` é o backoffice, `src/partilhado` é o que os dois usam. O backend continua numa só árvore, `server/src`. As rotas públicas (`/v1/public/…`) e as rotas do GesForma estão misturadas nos mesmos módulos, por exemplo `app.ts`, `opsRoutes.ts`, `pedagogiaRoutes.ts` e `catalogRoutes.ts`.

A divisão segue as mesmas três pastas:

- Site. O que só o site público chama: catálogo, oferta, textos públicos, pré-inscrição, ligação de documentos, inquérito, cronograma publicado e listas que o formulário lê.
- GesForma. O que só o backoffice chama: CRM, turmas, pedagogia, utilizadores, gravação do site, emails, pagamentos da secretaria, dossiê, painel e conta do formador.
- Partilhado. Só o que os dois lados chamam, a lógica comum e a API parcial que os dois usam. A sessão, o cálculo de preço e os bytes das imagens do curso são deste grupo: o site mostra a imagem e o GesForma grava-a. Um endpoint que só um dos lados usa não fica aqui.

## Site público

O nome da Eva, a frase de boas-vindas e os objectivos editam-se em Sistema → Site. Os cursos que ela mostra continuam a vir da oferta. A nota do destaque é a média das respostas de escala (1 a 5) dos inquéritos gravados. Enquanto não houver nenhuma, usa-se o texto de recurso, por omissão `4,8/5`. As fotografias de fundo do destaque e da apresentação carregam-se como ficheiro; o endereço entra no rascunho e o site público só muda depois de Guardar site.

`/noticias` lista os posts com estado Ativo. O artigo abre em `/noticias/:slug` e desenha os blocos do post: parágrafo, título, imagem, hero, secção, citação, lista, botão e separador. A edição é em Gestão → Blog. Um post Inactivo fica de fora. A ficha do curso continua no GesForma.

Ainda por fazer no site:

- Publicar a ficha do curso em `ena.pt`. O progresso «Pronto para o site» só indica o que falta.
- Campos de SEO e revisão editorial, e a publicação do blog em `ena.pt`. O editor de blocos e a vista pública neste projecto já estão feitos.
- Menu. Dá para mudar o texto de Formação, Notícias e Empresas. Não dá para acrescentar outra ligação.
- Contactos do rodapé. O email e o telefone que aparecem no site não alteram o SMTP Brevo nem os emails automáticos. Esses continuam em Configurações.

## Conteúdos pedagógicos — SCORM / H5P

O editor na ficha (**Conteúdos Moodle**) já grava a sequência por módulo. Falta construir o **runtime** e a persistência para suportar **tudo** o que a estrutura prevê. Detalhe técnico em `docs/conteudos-pedagogicos.md`.

- **SCORM.** Validar pacote (manifest 1.2 e 2004), armazenar metadados do SCO, player com API SCORM completa, `suspend_data`, conclusão, pontuação e tempo; bloquear o seguinte se o módulo tiver percurso sequencial.
- **H5P.** Validar `.h5p`, servir bibliotecas, player com content types do pacote, capturar conclusão e nota (xAPI ou equivalente).
- **Quizzes, flashcards, vídeo e PDF nativos.** Render na área do formando, correcção automática ou manual, tentativas, nota mínima (%), flashcards com ordem aleatória e repetição.
- **Progresso.** Tabelas/API por formando e turma; pré-visualização «como formando» no backoffice; biblioteca multimédia alinhada com o Drive da entidade (não só `drive_files` do GesForma).
- **Moodle (GesForma + área do formando).** Ver `docs/moodle-integracao.md` e secção homónima abaixo — **por fazer**; independente do player SCORM/H5P no site.

## Formação financiada (pedagógica)

A Financiada é gestão do **departamento pedagógico** (coordenadores, turmas UFCD, elegibilidade, sessões, dossiê TP). O perfil `financiada` não isola esta área da pedagogia.

Implementado (sem Moodle): CRM fin → `formandos_fin` ao validar; pipeline `inscricoes_fin` → ficha; documentos com upload, validação/recusa e auditoria (`validated_by` / `audit_log`); portal `/documentos-formando/:token` e secção Documentos na área do formando; lembrete por API com ligação ao portal; fecho formal da turma (`POST /v1/turmas/fin/:id/fecho`) com relatório de execução no dossiê; dossiê turma dinâmico; fila pedagógica no painel.

## Integração Moodle (GesForma + área do formando)

**Não implementado.** Detalhe em `docs/moodle-integracao.md`.

- Sincronizar conteúdos (criar/editar/eliminar) entre GesForma e disciplinas Moodle.
- Importar notas, progresso e conclusão; reflectir no cockpit, certificados e dossiê.
- Contas e inscrições Moodle (Acesso directo e pós-validação); SSO ou link na área do formando.
- Configuração, teste de ligação e fila de sincronização.

## Ligações externas

- Notas Moodle e «Aceder ao curso» — dependem da integração Moodle (secção anterior). Até lá, notas manuais na grelha.
- Recibos certificados (Moloni) e o contrato Ifthenpay ou SIBS. O pagamento fica pendente até um webhook do banco o marcar como pago.
- Publicar o dossiê fora do GesForma. O ZIP segue para o Google Drive da entidade.

## GesForma, ainda por construir

- Pré-inscrições: pontuação, próximo passo sugerido e resposta escrita pela máquina.
- Venda: rascunho de proposta a partir da ficha do curso e da pré-inscrição.
- Marketing: textos, anúncios, calendário editorial e ligação às plataformas. A campanha já calcula o ROI.
- Modelo da ENA. Linguagem própria, as quatro tarefas (pré-inscrições, venda, marketing e blog) e a consulta à oferta real antes de responder. A proposta está em `docs/requisitos-funcionais-e-modelo-ai.md`. Não está ligado ao produto. Nada grava nem envia sozinho.

## Disponibilidade do formador

A fonte de verdade é o próprio formador, no calendário do GesForma (`/gesforma/formador/calendario`). Regista os horários CCP que já existiam: laboral, pós-laboral, sábado de manhã e sábado à tarde. Estar alocado a uma turma não lhe fecha o editor. A secretaria continua a poder ajustar os mesmos horários na ficha. O cronograma avisa quando a sessão não cabe nesses horários. O detalhe está em `docs/formador-disponibilidade.md`. Um calendário dia a dia, ou uma API de calendário partilhado, não faz parte disto.
