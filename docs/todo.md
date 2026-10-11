# Por fazer

Esta é a lista fechada do que ainda falta. Os outros documentos descrevem o que já funciona e apontam para aqui.

## Área do formando — dados reais

O ecrã de login e a área já existem em `/area-formando` (`src/site/AreaFormando.tsx`), a partir do Figma. A conta de demonstração é `formando@ena.pt`. O perfil `formando` está no `CHECK` de `users.role` (migração `057_users_role_formando.sql`).

Depois de a credencial estar aceite, o destino é `destinoDoPerfil` (`src/partilhado/destinoPerfil.ts`): formando fica em `/area-formando`; formador vai para `/gesforma/formador/turmas`; secretaria financiada (`financiada`) para `/gesforma/financiada`; administrador, comercial e secretaria para `/gesforma/gold`. A palavra-passe faz isto no ecrã. O Google e a Microsoft continuam a voltar a `/entrar`; dali o formando é enviado para a área e os outros perfis entram no GesForma. Se a pessoa abriu um endereço que o perfil dela já pode ver, esse endereço mantém-se. Um endereço de outro perfil manda-a para a área dela. O formando que abre `/entrar` ou `/gesforma` volta a `/area-formando`. Quem não é formando e abre `/area-formando` vai para o GesForma. As rotas do GesForma recusam o formando com 403, excepto mudar a própria palavra-passe. Ler a sessão e terminar sessão continuam abertos.

Na página inicial, «Área de formando» só aparece quando o formando tem sessão e substitui «Iniciar Sessão». Os dois abrem `/area-formando`. O login da secretaria continua em `/entrar`.

O que o ecrã ainda mostra de exemplo, e não da base:

- Cursos, progresso, agenda, certificados, notificações e faturas são o texto do Figma. Não vêm das turmas nem dos pagamentos.
- «Continuar no LMS» abre os módulos neste ecrã. O Moodle não está ligado.
- «Esqueci-me da palavra-passe» não envia email. A pessoa pede uma palavra-passe nova à secretaria.
- Guardar o perfil e as preferências de notificação só confirma neste ecrã. A ficha do GesForma não recebe a alteração.
- Os dados fiscais não se editam.

## Backend

O ecrã já está separado: `src/site` é o site público, `src/gesforma` é o backoffice, `src/partilhado` é o que os dois usam. O backend continua numa só árvore, `server/src`. As rotas públicas (`/v1/public/…`) e as rotas do GesForma estão misturadas nos mesmos módulos, por exemplo `app.ts`, `opsRoutes.ts`, `pedagogiaRoutes.ts` e `catalogRoutes.ts`.

A divisão segue as mesmas três pastas:

- Site. O que só o site público chama: catálogo, oferta, textos públicos, pré-inscrição, ligação de documentos, inquérito, cronograma publicado e listas que o formulário lê.
- GesForma. O que só o backoffice chama: CRM, turmas, pedagogia, utilizadores, gravação do site, emails, pagamentos da secretaria, dossiê, painel e conta do formador.
- Partilhado. Só o que os dois lados chamam, a lógica comum e a API parcial que os dois usam. A sessão, o cálculo de preço e os bytes das imagens do curso são deste grupo: o site mostra a imagem e o GesForma grava-a. Um endpoint que só um dos lados usa não fica aqui.

## Site público

Isto ainda não está ligado ao que o administrador insere em Sistema → Site. Fica de fora desse ecrã até ser feito.

- Assistente Eva. O nome, as frases e os objectivos («Competências digitais», «Gestão e liderança», «Saúde e segurança») estão escritos no código, em `src/site/SiteLanding.tsx`. Os cursos que a Eva mostra já vêm da oferta.
- Blog no site. O backoffice já tem Posts e Temáticas, em Gestão. O site público não os lista nem abre um artigo. O corpo, o SEO, a revisão e a publicação em `ena.pt` também faltam.
- Publicar a ficha do curso em `ena.pt`. O progresso «Pronto para o site» só indica o que falta. A ficha fica no GesForma.
- Fotografias de fundo. No destaque e na apresentação cola-se um endereço. Não há carregamento de ficheiro, ao contrário da miniatura de um regime no hero e da imagem da ficha de curso.
- Nota de satisfação. O `4,8/5` é um texto editável. Não é a média dos inquéritos gravados.
- Menu. Dá para mudar o texto de Formação e de Empresas. Não dá para acrescentar outra ligação.
- Contactos do rodapé. O email e o telefone que aparecem no site não alteram o SMTP Brevo nem os emails automáticos. Esses continuam em Configurações.

## Ligações externas

- Ler a nota real no Moodle da turma. O parâmetro já entra na média e a pauta do dossiê já sai da grelha, mas o valor do Moodle continua a ser lançado à mão. A integração com o Moodle ainda não existe.
- Acesso ao Moodle nos cursos de Acesso direto. O site já mostra «Aceder ao curso» e não abre a pré-inscrição nem o check-out. Falta criar a conta, inscrever a pessoa na disciplina e devolver o endereço da sala logo após o pedido. O Pré-pago usa o check-out do site.
- Recibos certificados (Moloni) e o contrato Ifthenpay ou SIBS. O pagamento fica pendente até um webhook do banco o marcar como pago.
- Publicar o dossiê fora do GesForma. O ZIP segue para o Google Drive da entidade.

## GesForma, ainda por construir

- Pré-inscrições: pontuação, próximo passo sugerido e resposta escrita pela máquina.
- Venda: rascunho de proposta a partir da ficha do curso e da pré-inscrição.
- Marketing: textos, anúncios, calendário editorial e ligação às plataformas. A campanha já calcula o ROI.
- Modelo da ENA. Linguagem própria, as quatro tarefas (pré-inscrições, venda, marketing e blog) e a consulta à oferta real antes de responder. A proposta está em `docs/requisitos-funcionais-e-modelo-ai.md`. Não está ligado ao produto. Nada grava nem envia sozinho.

## Decisão em aberto

Ainda não está decidido quem preenche o calendário de disponibilidade do formador: a secretaria na ficha, o próprio formador no GesForma, ou uma API de calendário partilhado, como o Google Calendar. Até essa decisão, a marcação faz-se na ficha. O cronograma só avisa quando o dia da sessão já está marcado e não cobre o horário. O ecrã actual está em `docs/formador-disponibilidade.md`.
