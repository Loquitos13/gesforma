# GesForma - protótipo ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada).

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** - núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** - núcleo DGERT + elegibilidade, IBAN, horas, relatório de execução

O menu **Dossiê TP** lista as turmas com a completude do dossiê e abre o DTP dessa turma.

**Inquéritos** (Gold e Financiada) permitem montar questionários de satisfação com texto, escolha múltipla, escala 1–5 e sim/não.

No cockpit da turma: plano de sessão completo (introdução / desenvolvimento / conclusão), **sumário por sessão** (conteúdos, atividades, assinatura do formador), folha de presenças, perfil do formador com documentos, e upload de certificados.

No separador **Documentos** (Gold / CCP):

- **PIP** - um ficheiro por formando. O estado passa a *Em falta*, *Parcial* ou *No dossiê* conforme os projetos carregados.
- **Simulação pedagógica inicial e final** - por aluno: um vídeo e uma folha de avaliação. A grelha usa os **parâmetros de avaliação do curso** (editáveis em Edição de Cursos), escala 1–5. Só fica no dossiê quando o vídeo e a grelha estão completos.

Cada **curso Gold** e cada **UFCD financiada** tem uma ficha própria (não um painel lateral): identidade visual, textos da página pública, parâmetros de avaliação quando aplicável, e publicação. A coluna da direita mostra a pré-visualização do que aparece em `ena.pt/cursos/…`. O progresso “Pronto para o site” indica o que ainda falta para publicar. Nas UFCD o código e a designação oficial do CNQ ficam separados do nome comercial.

A vista **Módulos** começa pelo filtro de curso: lista só os blocos desse curso e o botão **+ Novo módulo** está sempre disponível (no cabeçalho, no filtro e no estado vazio). A partir da ficha de um curso Gold, **Módulos** abre já filtrado.

Os botões **Novo curso**, **Nova turma**, **Novo módulo**, **Nova sessão** e equivalentes abrem um formulário. Quando é preciso escolher curso, turma, local, formador ou módulo, o campo é um **dropdown com pesquisa**. As listas da navegação usam a mesma barra de filtros: **curso** e **local** quando a tabela tem essas colunas (pré-inscrições, formandos, turmas, datas, conteúdos, DTP Gold, pagamentos); nas UFCD financiadas o filtro é por curso e não por polo (quase tudo em sala virtual); em catálogos (cursos, locais, áreas, blog) ficam só estado ou área temática.

Cada **turma** tem um **cronograma** (gerar a partir da data de início e do horário, ou editar sessão a sessão) e um toggle **Ativa / Inativa**. Só turmas ativas aparecem nas pré-inscrições Gold, na conversão de lead em formando, na mudança de turma de um formando e nas inscrições financiadas. Uma turma inativa mantém os formandos já inscritos, mas fecha novas entradas.

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43147](http://127.0.0.1:43147).
