# Por fazer

Esta é a lista fechada do que ainda falta. Os outros documentos descrevem o que já funciona e apontam para aqui.

## Entrada por perfil

O login tem de deixar a pessoa na área do perfil com que entrou. A regra vale para a palavra-passe e para o Google e a Microsoft. A sessão só muda de endereço depois de a credencial estar aceite.

Hoje a conta vive em `users.role`. Os valores gravados são `admin`, `secretaria`, `comercial`, `financiada` e `formador` (`server/src/db/migrations/038_formador_crm_drive.sql`). Não existe o perfil `formando`. Quem entra em `/entrar` cai no GesForma: o formador em `/gesforma/formador/turmas`, a secretaria financiada (`financiada`) em `/gesforma/financiada`, e os restantes em `/gesforma/gold`.

| Perfil | Role | Destino depois do login |
| --- | --- | --- |
| Formando | `formando` (ainda não existe) | Área do formando |
| Formador | `formador` | Área de formador no GesForma, `/gesforma/formador/turmas` |
| Administrador | `admin` | GesForma |
| Comercial | `comercial` | GesForma, linha Gold |
| Secretaria | `secretaria` | GesForma |
| Secretaria financiada | `financiada` | GesForma, linha Financiada |

O formando não entra no GesForma. O formador não entra nos painéis de administrador, comercial ou secretaria. Administrador, comercial e secretaria não entram na área do formando.

Se a pessoa abriu um endereço que o perfil dela já pode ver, esse endereço mantém-se. Um endereço de outro perfil manda-a para a área dela. Dentro do GesForma, o que cada perfil vê no menu fica como está: o comercial só na linha Gold, a secretaria financiada só na linha Financiada, o formador só nas vistas `formador-turmas`, `formador-calendario`, `formador-perfil` e no cockpit das turmas que lhe estão atribuídas. O administrador e a secretaria continuam a ver as duas linhas.

O perfil `formando` entra no `CHECK` de `users.role` quando a área do formando existir. Até lá, uma conta com esse papel não se cria e o login não a pode deixar no GesForma.

## Área do formando

A área do formando ainda não está feita. O ecrã constrói-se a partir do Figma dessa área. O que a pessoa tem hoje é a ligação pessoal `/documentos/:token` e o inquérito `/inquerito/:token`. Nenhuma das duas é a área autenticada.

Enquanto o ecrã do Figma não existir, o destino do login de um formando fica por ligar. Não se usa o GesForma como substituto.

No cabeçalho da página inicial, `navFormando` («Área de formando») e `navEntrar` («Iniciar Sessão») estão sempre visíveis e os dois abrem `/entrar` (`src/site/SiteLanding.tsx`). «Área de formando» sai do cabeçalho para quem não está autenticado. Só aparece quando o formando tem sessão, e nesse caso substitui o botão de iniciar sessão. Quem não é formando continua a ver o botão de login.

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
