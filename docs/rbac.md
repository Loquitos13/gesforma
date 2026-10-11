# RBAC e entrada por perfil

O login tem de deixar a pessoa na área do perfil com que entrou. A regra vale para a palavra-passe e para o Google e a Microsoft. A sessão só muda de endereço depois de a credencial estar aceite.

Hoje a conta vive em `users.role`. Os valores gravados são `admin`, `secretaria`, `comercial`, `financiada` e `formador` (`server/src/db/migrations/038_formador_crm_drive.sql`). Não existe o perfil `formando`. Quem entra em `/entrar` cai no GesForma: o formador em `/gesforma/formador/turmas`, a secretaria financiada (`financiada`) em `/gesforma/financiada`, e os restantes em `/gesforma/gold`.

## Para onde vai cada perfil

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

## O que ainda falta

### Área do formando, segundo o Figma

A área do formando ainda não está feita. O ecrã constrói-se a partir do Figma dessa área. O que a pessoa tem hoje é a ligação pessoal `/documentos/:token` e o inquérito `/inquerito/:token`. Nenhuma das duas é a área autenticada.

Enquanto o ecrã do Figma não existir, o destino do login de um formando fica por ligar. Não se usa o GesForma como substituto.

### Dividir o backend como o site e o GesForma

O ecrã já está separado: `src/site` é o site público, `src/gesforma` é o backoffice, `src/partilhado` é o que os dois usam. O backend continua numa só árvore, `server/src`. As rotas públicas (`/v1/public/…`) e as rotas do GesForma estão misturadas nos mesmos módulos, por exemplo `app.ts`, `opsRoutes.ts`, `pedagogiaRoutes.ts` e `catalogRoutes.ts`.

A divisão segue as mesmas três pastas:

- Site. O que só o site público chama: catálogo, oferta, textos públicos, pré-inscrição, ligação de documentos, inquérito, cronograma publicado e listas que o formulário lê.
- GesForma. O que só o backoffice chama: CRM, turmas, pedagogia, utilizadores, gravação do site, emails, pagamentos da secretaria, dossiê, painel e conta do formador.
- Partilhado. Só o que os dois lados chamam, a lógica comum e a API parcial que os dois usam. A sessão, o cálculo de preço e os bytes das imagens do curso são deste grupo: o site mostra a imagem e o GesForma grava-a. Um endpoint que só um dos lados usa não fica aqui.

### Cabeçalho da página inicial

No cabeçalho, `navFormando` («Área de formando») e `navEntrar` («Iniciar Sessão») estão sempre visíveis e os dois abrem `/entrar` (`src/site/SiteLanding.tsx`).

«Área de formando» sai do cabeçalho para quem não está autenticado. Só aparece quando o formando tem sessão, e nesse caso substitui o botão de iniciar sessão. Quem não é formando continua a ver o botão de login.
