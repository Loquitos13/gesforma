# GesForma - protótipo ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada).

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

A vista **Módulos** começa pelo filtro de curso: lista só os blocos desse curso e o botão **+ Novo módulo** está sempre disponível (no cabeçalho, no filtro e no estado vazio). A partir da ficha de um curso Gold, **Módulos** abre já filtrado.

Gold e Financiada têm cada uma o menu **Formadores**: ficha (contacto, CCP, NIF, especialidade), estado Ativo/Inactivo e os regimes em que lecciona. Quem marca os dois regimes aparece nas duas listas. Criar ou editar um formador actualiza os dropdowns do cronograma e das turmas.

No **Painel**, o bloco **Como conheceram a ENA** mostra a origem dos formandos (website, referência, redes, IEFP) a partir da pergunta da ficha de inscrição.

Em **Configurações**, cada cartão abre um **modal centrado** só com essa secção (Cancelar / Guardar). Não há gaveta lateral nem lista de separadores à esquerda.

Os formulários de criar e editar (pré-inscrição, turma, formando, sessão, etc.) abrem em **modal ao centro**, não numa gaveta que desliza da direita.

Em **Emails automáticos**, a nova regra pede gatilho, template, curso e atraso, com **preview do email** ao lado. O olho nas regras e nos templates abre o mesmo preview.

Os botões **Novo curso**, **Nova turma**, **Novo módulo**, **Nova sessão** e equivalentes abrem um formulário. Quando é preciso escolher curso, turma, local, formador ou módulo, o campo é um **dropdown com pesquisa**. As listas da navegação usam a mesma barra de filtros: **curso** e **local** quando a tabela tem essas colunas (pré-inscrições, formandos, turmas, datas, conteúdos, DTP Gold, pagamentos); nas UFCD financiadas o filtro é por curso e não por polo (quase tudo em sala virtual); em catálogos (cursos, locais, áreas, blog) ficam só estado ou área temática.

Cada **turma** tem um **cronograma** e um toggle **Ativa / Inativa**. No cockpit, o separador Cronograma mostra o plano de sessões: resumo (sessões, horas, próxima, período), linha do tempo agrupada por mês e edição sessão a sessão. Cada sessão escolhe **um ou mais módulos** do curso e **um ou mais formadores** em dropdowns com pesquisa. A Visão Geral lista todos os formadores atribuídos às sessões (com o número de sessões de cada um). A tabela de Sessões mostra essa coluna. Regenerar pede confirmação porque substitui o plano atual. Só turmas ativas aparecem nas pré-inscrições Gold, na conversão de lead em formando, na mudança de turma de um formando e nas inscrições financiadas. Uma turma inativa mantém os formandos já inscritos, mas fecha novas entradas.

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43147](http://127.0.0.1:43147).
