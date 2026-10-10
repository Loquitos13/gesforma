# Site público

O site da ENA vive no mesmo projecto que o GesForma. A página inicial está em `/`. O backoffice está em `/entrar`. Quem edita os textos da página inicial e do rodapé é o administrador, em **Sistema → Site**.

Os cursos, os preços, as turmas e as listas da inscrição saem da base de dados. Os textos de apresentação saem de `app_settings`, com o id `site`. Enquanto o administrador não grava nada, o site usa o texto de omissão que está em `src/siteConteudo.ts`.

O ano do copyright é o ano corrente. Não se grava. Em 2026 o rodapé mostra © 2026.

## Rotas públicas

- `/` página inicial.
- `/formacao` catálogo de todos os cursos publicados.
- `/formacao/:slug` ficha pública de um curso.
- `/pre-inscricao` formulário completo de pré-inscrição.
- `/documentos/:token` ligação pessoal para anexar documentos. O ficheiro segue para o Google Drive.
- `/cronograma/:regime/:turmaId` cronograma publicado de uma turma.
- `/inquerito/:token` resposta ao inquérito de satisfação.
- `/entrar` login do GesForma.

## O que já sai da base de dados

A oferta pública vem de `GET /v1/public/catalogo`. Cada curso publicado traz título, área, modalidade, duração, preço, descrição, imagens da ficha, programa e tipo de inscrição (Acesso direto ou Pré-inscrição). Os destaques da página inicial são os mais vendidos. O preço mostrado é o da ficha ou o da turma libertada. Não há preço inventado. Um curso com estado Inactivo (também Inativo, Inativa ou Inactiva) não entra nesta lista: fica fora do catálogo, dos destaques, dos cartões automáticos do hero e da ficha pública. Na ficha do curso, junto ao banner, a miniatura pede um recorte na proporção 2:3 do cartão de `/formacao`. O que fica dentro da moldura é a imagem gravada.

As turmas que o visitante pode escolher são as turmas Gold libertadas: curso, local, horário e data de início. A API é `GET /v1/public/oferta`.

Concelhos, origens e formas de pagamento vêm de **Gestão → Listas de opções** (`catalog_items`, `kind = lista_opcoes`). O site lê `GET /v1/public/opcoes?lista=concelhos|origens|metodos_pagamento`. Se a lista ainda estiver vazia, o formulário diz que a secretaria ainda não a definiu. Um método de pagamento que não esteja nessa lista é recusado em `POST /v1/public/preinscricoes`.

No modal do site, a pré-inscrição pede os mesmos dados que `/pre-inscricao`: nome, apelido, telemóvel, email, concelho, origem e, quando há turma libertada, local, horário e data. Num curso de acesso direto, a forma de pagamento é o passo seguinte. A ENA envia a referência e o banco confirma. Esse passo não cobra um cartão.

No CRM, o concelho do lead usa a mesma lista de concelhos.

## Textos que o administrador edita

**Sistema → Site** grava em `PUT /v1/settings/site`. Só o perfil Administração pode gravar. O site lê `GET /v1/public/site`.

Cada bloco do ecrã tem uma pré-visualização do rascunho dessa secção da página inicial. O administrador vê o resultado sem sair do GesForma. O botão «Ver o site» continua a abrir a página pública, que só muda depois de gravar.

O ecrã está dividido em:

- Cabeçalho. Título do separador, as duas linhas da marca e os textos de Formação, Empresas, área de formando e iniciar sessão.
- Destaque. Título, texto, botão e fotografia de fundo. Os dois cartões editam-se na mesma secção.
- Oferta formativa. Antetítulo, título e texto da pesquisa. A grelha de cursos vem das fichas.
- Apresentação. Fotografia, nota em destaque (por omissão `4,8/5`), texto e os quatro pilares.
- Empresas. Antetítulo, título, texto e botão.
- Rodapé. Sigla, texto, email, telefone, horário, ligações úteis e lema. O ano do © não é um campo.

Uma fotografia é um endereço `https://…` ou um caminho do próprio site, por exemplo `/imagens/…`. Um endereço vazio esconde a imagem. Um endereço que não seja http, https ou um caminho interno também não é mostrado.

Apagar o texto de um campo e gravar esconde esse texto. Se o administrador ainda não gravou o ecrã, mantém-se o texto de omissão.

## Cartões do destaque

O hero tem dois cartões, o da esquerda e o da direita. Em **Sistema → Site**, cada um pode ficar em automático, apontar a um curso publicado ou representar um regime (Gold ou Financiada).

Em automático, a esquerda é a formação de formadores com CCP e a direita é a primeira formação financiada que tenha miniatura. O botão abre o modal de inscrição.

Num curso, o título, o preço, a área e a miniatura continuam a sair da ficha. Dá para mudar o texto do botão e o destino.

Num regime, dá para editar o título, a descrição e a miniatura. A miniatura carrega-se como ficheiro (JPG, PNG, WebP ou GIF, até 8 MB) ou cola-se um endereço. O ficheiro fica em `curso_imagens`, com um identificador reservado, e o site lê-o em `/api/v1/public/imagens/:token`. Também dá para mudar o texto do botão e o destino.

O destino aceita as duas formas. Um caminho do próprio site, por exemplo `/formacao/excel-do-basico-ao-avancado` ou `/formacao?linha=gold`, sobrevive a uma mudança de domínio. Um endereço externo escreve-se completo, `https://…`. Vazio abre a ficha do curso ou o catálogo dessa linha. Um valor que não seja caminho nem http(s) é ignorado.

## TO DO

Isto ainda não está ligado ao que o administrador insere. Fica de fora do ecrã Site até ser feito.

- Assistente Eva. O nome, as frases e os objectivos («Competências digitais», «Gestão e liderança», «Saúde e segurança») estão escritos no código, em `src/SiteLanding.tsx`. Os cursos que a Eva mostra já vêm da oferta.
- Blog. O backoffice já tem Posts e Temáticas, em Gestão. O site público não os lista nem abre um artigo.
- Fotografias de fundo. No destaque e na apresentação cola-se um endereço. Não há carregamento de ficheiro, ao contrário da miniatura de um regime no hero e da imagem da ficha de curso.
- Nota de satisfação. O `4,8/5` é um texto editável. Não é a média dos inquéritos gravados.
- Menu. Dá para mudar o texto de Formação e de Empresas. Não dá para acrescentar outra ligação.
- Contactos do rodapé. O email e o telefone que aparecem no site não alteram o SMTP Brevo nem os emails automáticos. Esses continuam em Configurações.
