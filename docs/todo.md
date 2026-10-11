# Por fazer

Esta é a lista fechada do que ainda falta. Os outros documentos descrevem o que já funciona e apontam para aqui.

## Área do formando — o que ainda falta

O ecrã de login e a área estão em `/area-formando` (`src/site/AreaFormando.tsx`). A conta de demonstração `formando@ena.pt` não está ligada a nenhuma ficha: a área fica vazia até a secretaria gerar o acesso. O perfil `formando` está no `CHECK` de `users.role` (migração `057_users_role_formando.sql`). A ligação à ficha está em `formandos_gold.user_id` e `formandos_fin.user_id` (migração `058_area_noticias_disponibilidade.sql`).

O acesso nasce na ficha do formando, Gold ou financiada, com **Gerar acesso**. A palavra-passe aparece uma vez. **Gerar nova palavra-passe** troca-a e encerra as sessões. A pessoa não se regista sozinha.

Cursos, sessões, progresso (sessões já realizadas sobre as sessões datadas), certificados emitidos, pagamentos e notificações saem dessa ficha. O nome, o apelido e o telemóvel gravados na área voltam à ficha. O email de acesso não se altera aqui. «Esqueci-me da palavra-passe» envia um email com uma ligação de duas horas. Sem SMTP, a mensagem fica no registo da API (`[mail:log]`) e a resposta ao visitante é sempre a mesma.

Depois de a credencial estar aceite, o destino é `destinoDoPerfil` (`src/partilhado/destinoPerfil.ts`): formando fica em `/area-formando`; formador vai para `/gesforma/formador/turmas`; secretaria financiada (`financiada`) para `/gesforma/financiada`; administrador, comercial e secretaria para `/gesforma/gold`. A palavra-passe faz isto no ecrã. O Google e a Microsoft continuam a voltar a `/entrar`; dali o formando é enviado para a área e os outros perfis entram no GesForma. Se a pessoa abriu um endereço que o perfil dela já pode ver, esse endereço mantém-se. Um endereço de outro perfil manda-a para a área dela. O formando que abre `/entrar` ou `/gesforma` volta a `/area-formando`. Quem não é formando e abre `/area-formando` vai para o GesForma. As rotas do GesForma recusam o formando com 403, excepto mudar a própria palavra-passe e ler a própria área. Ler a sessão e terminar sessão continuam abertos.

Na página inicial, «Área de formando» só aparece quando o formando tem sessão e substitui «Iniciar Sessão». Os dois abrem `/area-formando`. O login da secretaria continua em `/entrar`.

Ainda por fazer nesta área:

- «Continuar» abre os módulos neste ecrã. O Moodle não está ligado. O progresso não é a conclusão do Moodle.
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

## Ligações externas

- Os textos de cada módulo (introdução, textos, recursos e atividades) editam-se no separador Conteúdos Moodle da ficha do curso e ficam gravados nessa ficha. Não são enviados para o Moodle.
- Ler a nota real no Moodle da turma. O parâmetro já entra na média e a pauta do dossiê já sai da grelha, mas o valor do Moodle continua a ser lançado à mão. A integração com o Moodle ainda não existe.
- Acesso ao Moodle nos cursos de Acesso direto. O site já mostra «Aceder ao curso» e não abre a pré-inscrição nem o check-out. Falta criar a conta, inscrever a pessoa na disciplina e devolver o endereço da sala logo após o pedido. O Pré-pago usa o check-out do site.
- Recibos certificados (Moloni) e o contrato Ifthenpay ou SIBS. O pagamento fica pendente até um webhook do banco o marcar como pago.
- Publicar o dossiê fora do GesForma. O ZIP segue para o Google Drive da entidade.

## GesForma, ainda por construir

- Pré-inscrições: pontuação, próximo passo sugerido e resposta escrita pela máquina.
- Venda: rascunho de proposta a partir da ficha do curso e da pré-inscrição.
- Marketing: textos, anúncios, calendário editorial e ligação às plataformas. A campanha já calcula o ROI.
- Modelo da ENA. Linguagem própria, as quatro tarefas (pré-inscrições, venda, marketing e blog) e a consulta à oferta real antes de responder. A proposta está em `docs/requisitos-funcionais-e-modelo-ai.md`. Não está ligado ao produto. Nada grava nem envia sozinho.

## Disponibilidade do formador

A fonte de verdade é o próprio formador, no calendário do GesForma (`/gesforma/formador/calendario`). Regista os horários CCP que já existiam: laboral, pós-laboral, sábado de manhã e sábado à tarde. Estar alocado a uma turma não lhe fecha o editor. A secretaria continua a poder ajustar os mesmos horários na ficha. O cronograma avisa quando a sessão não cabe nesses horários. O detalhe está em `docs/formador-disponibilidade.md`. Um calendário dia a dia, ou uma API de calendário partilhado, não faz parte disto.
