# Requisitos funcionais e proposta de modelo de AI

Lista do que o GesForma já faz, escrita como requisitos, e uma proposta de modelo próprio para pré-inscrições, venda de formação, marketing e blog.

O GesForma é o backoffice da ENA. A unidade de gestão é a **turma**, não a "ação de formação". Há dois regimes, Gold (autofinanciada, CCP) e Financiada (UFCD), com Painel, CRM e Equipa separados. No interface, o pedido comercial chama-se **pré-inscrição**. O site `ena.pt` ainda não recebe publicação a partir daqui.

A secção 3 é uma proposta. Não está ligada ao produto.

## 1. Requisitos já cobertos

Cada requisito descreve comportamento que já existe.

### Acesso e perfis

- RF-01. A entrada é por email e palavra-passe, ou por Google e Microsoft, mas só se o email já for um utilizador activo.
- RF-02. Os perfis são Administração, Secretaria, Comercial Gold e Secretaria Financiada.
- RF-03. A Comercial Gold vê Gold e Gestão. A Secretaria Financiada vê Financiada e Gestão. Administração e Secretaria vêem os dois regimes. Só a Administração gere utilizadores.
- RF-04. Não se desactiva nem apaga o último administrador.

### Painel

- RF-05. Gold e Financiada têm painéis separados, calculados na API com os dados desse regime. Os filtros são período, curso, local, horário e pré-inscritos ou formandos. Receita, funil, desagregação e ranking seguem o mesmo filtro.
- RF-06. O painel mostra pré-inscritos, formandos, turmas e cursos activos, receita confirmada, receita do mês, ticket médio, pendentes, funil, métodos de pagamento, top cursos e origens ("como conheceram a ENA"). A receita por mês é um gráfico circular que segue os filtros: cada mês tem cor própria; o rato abre o mês, a receita e os cursos mais vendidos, com comparação ao mês passado ou ao ano passado; o clique fixa esse balão até ao X ou a outra fatia.
- RF-07. Sem API, o painel diz que está offline. Não inventa números.
- RF-08. As notificações sinalizam pagamentos pendentes, pré-inscrições por contactar, turmas lotadas ou vazias, documentos de elegibilidade em falta e DTP abaixo de 60%. A leitura fica gravada por utilizador, em Bloqueio, Aviso ou Info.

### CRM e pré-inscrições

- RF-09. O CRM de cada regime recebe pré-inscrições de três sítios: pré-inscrição pública (`/pre-inscricao`), pré-inscrição manual e bot WhatsApp. A pré-inscrição pública entra em Gold.
- RF-10. Criar uma pré-inscrição pede nome e telemóvel ou email. NIF e morada fiscal são opcionais até à etapa Pré-inscrição. A manual pode levar uma nota comercial no mesmo passo.
- RF-11. O funil é: Não contactado, 1.º Contacto, 2.º Contacto, Pago, Pré-inscrição, Formando, e Desistiu. O estado automático só avança. Pago, a etapa Pré-inscrição e Formando não recuam. Um formando não volta atrás: abre-se um pedido novo.
- RF-12. Ao entrar (manual, site ou WhatsApp) a plataforma enfileira o email de boas-vindas com a ligação única `/documentos/:token`. O estado passa a **1.º Contacto** só quando esse envio fica mesmo na fila. **Contactar** à mão faz o mesmo e regista a nota. Sem pagamento há 3 dias, ou 30 dias sem compra, passa a **2.º Contacto**.
- RF-13. A secretaria pode passar o pedido à etapa Pré-inscrição em qualquer etapa, excepto Formando e Desistiu. Essa passagem reenvia a ligação de documentos. Quando o último campo obrigatório é gravado (incluindo NIF de 9 dígitos e morada fiscal), a pré-inscrição passa sozinha à secretaria.
- RF-14. Só Administração ou Secretaria passam uma pré-inscrição Gold a Formando. Na Financiada, a Secretaria Financiada também pode, e a conversão cria o formando financiado.
- RF-15. A lista é paginada no servidor, com pesquisa, filtros, facetas, CSV até 2 000 linhas e acções em lote até 100 pré-inscrições (atribuir, etiqueta, adiar).
- RF-16. A vista Hoje junta por contactar, atrasados e follow-ups. O pipeline mostra até 80 cartões por etapa.
- RF-17. A ficha tem diário de contactos, notas (com modelos e nota fixa), campos extra, etiquetas e aviso de duplicados. Ligar e WhatsApp registam o contacto.
- RF-18. Cada pré-inscrição tem dono comercial, origem, campanha, curso, local, horário e regime.

### Documentos da pré-inscrição

- RF-19. A ligação pessoal pede um ficheiro de cada vez e marca com visto o que já está na ficha. No Gold os obrigatórios são cartão de cidadão, contrato e regulamento. Na Financiada são cartão de cidadão, habilitações, CV, IBAN e comprovativo de emprego. O comprovativo de pagamento é à parte.
- RF-20. Cada upload fica na ficha do CRM e, se a pessoa já for formando, no dossiê do formando. O documento volta a **pendente** e a observação anterior desaparece. A secretaria recebe um toast fixo nessa ficha.
- RF-21. O toast mantém-se até **Dispensar** ou até um documento dessa ficha ser validado. Validar um documento dispensa o aviso, mesmo que ainda haja outros por rever.
- RF-22. A secretaria **valida** ou **recusa** cada documento. A recusa exige uma observação. O cliente vê essa observação na ligação pessoal.
- RF-23. Com documentos recusados, **Alertar documentos incorrectos** envia um email com o botão **Corrigir documentos**. Nessa altura a ligação só aceita os tipos recusados. O novo upload volta a abrir o toast.
- RF-24. Quando todos os obrigatórios estão validados, a ligação fecha. Um upload fora do comprovativo responde que a ligação já foi encerrada.
- RF-25. Se a formação Gold ainda tiver preço por pagar e o comprovativo não estiver validado, a mesma ligação fica aberta só para esse comprovativo.
- RF-26. O email com a referência Multibanco dispara quando os obrigatórios estão todos carregados. Não espera pela validação da secretaria.

### Equipa e venda

- RF-27. A Equipa Gold lista comerciais. A Equipa Financiada lista a secretaria financiada.
- RF-28. A ficha da pessoa mostra estatísticas, propostas (estado e resposta do cliente), pré-inscrições atribuídas e diário de contactos.
- RF-29. Uma proposta comercial fica ligada ao regime e ao comercial.

### Oferta pública e WhatsApp

- RF-30. A oferta pública são turmas Gold libertadas. Cada turma é um curso com local, horário e data de início.
- RF-31. A pré-inscrição pede nome, apelido, telemóvel, email, concelho, e depois curso, local, horário e data. Horário e data dependem do local.
- RF-32. O bot WhatsApp faz pré-inscrição e consulta de estado por número ou email. Não confirma pagamentos. A pré-inscrição do bot segue o mesmo email de boas-vindas e a mesma regra de 1.º Contacto.
- RF-33. Sem token da Meta, o CRM tem um simulador de conversa. O token fica cifrado.

### Formação

- RF-34. Cursos Gold e UFCD financiadas têm ficha própria: identidade, oferta (tipo, categoria, modalidade, preço, horas, tags, vários locais), textos públicos, programa, avaliação, **Documentos**, **Dossiê TP** e publicação interna. O separador Documentos fica imediatamente antes do Dossiê TP. Na Oferta Gold, além do preço do curso, pode fixar-se um preço para um local, um horário, ou os dois. A pré-inscrição (site, WhatsApp ou manual) usa essa regra quando coincide; se houver local e horário ao mesmo tempo, essa regra ganha às que só têm um dos dois.
- RF-35. O regime da ficha vem da rota. Não se escolhe Gold ou Financiada dentro do formulário.
- RF-36. Guardar só cria o curso se a identidade e a oferta obrigatórias estiverem preenchidas.
- RF-37. A pré-visualização lista turmas libertadas (local, horário, data). O progresso "Pronto para o site" indica o que falta. No ecrã largo, a página do website recolhe-se para a direita e a edição ocupa a largura. O mesmo botão volta a abri-la. A publicação em `ena.pt` ainda não existe.
- RF-38. Módulos, conteúdos, datas, locais, horários (só Gold) e áreas temáticas são catálogos do regime.
- RF-39. Uma turma Gold tem cronograma em grelha, sessões arrastáveis, e o estado Libertada ou Não libertada. Só as libertadas aceitam novas entradas. Aplicar regras na Financiada cria sessões de 3 horas.
- RF-40. O cockpit da turma tem visão geral, cronograma, sessões (plano, sumário, presenças), avaliação, documentos, dossiê técnico-pedagógico e certificados. O separador Documentos da turma (PIP, simulações, listas da sessão) é outro ecrã que o da ficha do curso.
- RF-41. A avaliação segue a ficha do curso: escala, unidade, mínimo, pesos, e modo por módulo ou nota final. Os módulos vêm do separador Programa (o percurso). O texto público do programa é gerado a partir dessas unidades. Na ficha do curso dá para importar parâmetros de um CSV ou de um Excel (.xlsx). Num livro com vários separadores, escolhe-se a folha. A pré-visualização repete a folha como está no ficheiro: cores, tipo de letra, alinhamento, texto ao alto, uniões de células, larguras, a fórmula de cada célula e todas as colunas, incluindo as de participantes. Essas colunas não entram como parâmetros. A folha desliza na horizontal dentro da ficha, sem cortar a página. O importador propõe os blocos que encontra (nome, peso e média de cada ficha, por exemplo CP1, CP2, o projeto ou a avaliação final) e também deixa escolher à mão a célula do nome, a do peso e a da média (do módulo ou final, conforme o modo). Um parâmetro pode ficar marcado como nota do Moodle. Só um por curso, e entra na média com o peso dele. TO DO: ler essa nota no Moodle real da turma. Até essa ligação existir, a grelha aceita o valor à mão.
- RF-41a. O separador Certificados da turma mostra a coluna Nota final, calculada na grelha de avaliação.
- RF-41b. A avaliação do CCP não é uma lista única. O e-learning aplica-se a todos os módulos do programa excepto o 2 e o 9 (OP1 em cada um desses módulos, a meias com o OP2, que é uma grelha única). O módulo 2 é a simulação pedagógica inicial e o módulo 9 a final. Cada simulação vale (1×CP1 + 1×CP2 + 2×CP3) / 4. O projeto de intervenção é outra grelha. A nota final é 10% da simulação inicial, 30% do e-learning, 30% da simulação final e 30% do projeto. Os pesos editam-se na ficha. Na ficha, um Excel aplica de uma vez os blocos de todas as folhas: Módulo 2 (CP1, CP2, CP3), E-learning (OP1 e OP2), Módulo 9 (CP1, CP2, CP3) e projeto de intervenção. A folha Avaliação final não entra como parâmetros. Só atualiza os pesos, quando os traz. Na turma, as cinco folhas (Módulo 2, E-learning, Módulo 9, projeto de intervenção e avaliação final) repetem a estrutura da grelha oficial. Onde a folha diz Participantes, há uma coluna por formando. Editar esses valores recalcula médias, somatórios e a avaliação final.
- RF-42. No separador Documentos do curso anexa-se um ficheiro do curso, de um formando ou de um formador, associado a um requisito do dossiê (Antes, Durante ou Fecho). O visto na turma só fecha quando todas as partes responsáveis tiverem enviado: um ficheiro do curso vale para todas as turmas desse curso; no formando conta cada pessoa dessa turma; no formador conta o nome do formador atribuído. Se o mesmo requisito tiver vários âmbitos, todos têm de estar completos. O visto dos ficheiros do curso só sobe: não reabre um item que os dados da turma já marcaram como completo.
- RF-43. O dossiê lista requisitos em **Antes da turma**, **Durante** e **Fecho**. Os que existem nos dois regimes aparecem como **universais**. Gold acrescenta PIP, simulações, comprovativo de 5 anos e recibos. Financiada acrescenta elegibilidade (cartão de cidadão, habilitações, CV, IBAN, emprego), horas e relatório de execução.
- RF-44. Na financiada o dossiê é sempre o mesmo, qualquer que seja a UFCD. A lista fica travada: não há modelo por curso, não há extras e não há botão de gravar. No Gold, os documentos de norma ficam travados; o resto liga-se ou desliga-se, e extras já gravados ainda se editam. Não há formulário para acrescentar um documento novo nessa tab: o ficheiro novo entra pelo separador Documentos do curso.
- RF-45. A completude do dossiê calcula-se a partir dos dados (cronograma, planos, sumários, presenças, PIP, simulações, contratos, elegibilidade, certificados) e, por cima, dos ficheiros do curso. O resto valida-se à mão.
- RF-46. Exportar o dossiê gera um ZIP por categorias. Os ficheiros vão para o Google Drive da entidade. Sem Drive, em local o ficheiro pode ficar em disco; na Vercel o upload é recusado.
- RF-47. Formandos Gold existem na turma e avulso. Formandos financiados têm estado de elegibilidade e documentos. Dá para transferir de turma e apagar, com confirmação.
- RF-48. Formadores têm ficha, CCP, estado activo e os regimes em que leccionam. Quem marca os dois aparece nas duas listas. Na turma, o formador vê visão geral, sessões e avaliação. Não vê pagamentos, dossiê técnico-pedagógico, documentos, notas de acompanhamento nem histórico do formando. Não transfere, inscreve ou remove formandos, não muda o custo hora da sala e não muda o formador de uma sessão.
- RF-49. Inquéritos (texto, escolha múltipla, escala 1 a 5, sim ou não) têm pré-visualização, ligação pública `/inquerito/:token`, respostas gravadas e CSV.

### Marketing, blog e comunicação

- RF-50. Campanhas (no Gold) têm nome, curso, canal, datas, custo, encarregado e notas. Inscrições, pagamentos, conversão, ticket, por contactar, desistências, origens e ROI calculam-se das pré-inscrições e dos pagamentos. Canais: Website, Facebook, Instagram, Google, Email, WhatsApp, Referência, Parceiro.
- RF-51. O blog tem posts (título, slug, data, estado, temática) e temáticas. Não tem corpo longo nem publicação no site.
- RF-52. Emails automáticos: uma regra é gatilho, template, curso e atraso, com pré-visualização em HTML e o botão do template (documentos, comprovativo ou secretaria). **Testar** envia ao destinatário de exemplo e não altera o estado de nenhuma pré-inscrição.
- RF-53. Gatilhos: nova pré-inscrição, pré-inscrição promovida, documentos submetidos, 1.º contacto registado, sem pagamento há 3 dias, pagamento confirmado, contacto após a venda (1 hora), 24 horas antes do início, formando concluído, 30 dias sem compra e sumário assinado. Regras antigas com o rótulo "Lead passou a pré-inscrito" disparam o mesmo evento que "Pré-inscrição promovida".
- RF-54. A taxa de abertura sai de um pixel. Sem SMTP o email fica no histórico. O envio real configura-se em Configurações, SMTP Brevo (login, chave cifrada, email dos automáticos e email de resposta). Variáveis de servidor, quando existem, mandam sobre o que está na app. O email de documentos incorrectos sai por este SMTP, com o botão para a ligação pessoal.

### Pagamentos e operação

- RF-55. Pagamentos registam referência Multibanco ou MB Way como pendente. O webhook do banco marca Pago, actualiza o formando Gold, passa a pré-inscrição a Pago e dispara o email de confirmação e o contacto após a venda.
- RF-56. Recibos certificados (Moloni) e o contrato Ifthenpay ou SIBS não estão ligados.
- RF-57. A pesquisa geral (nome, telemóvel, email ou id) abre a ficha ou a vista certa.
- RF-58. Listas de vocabulário (origem, contacto, pagamento, desistência, e outras) editam-se em Gestão e alimentam os formulários. O formulário público lê origens sem permitir criar opções.
- RF-59. Configurações abrem por cartão: Google, Microsoft, WhatsApp, chave do webhook, Drive e SMTP Brevo. Drive e as outras integrações editam-se na grelha; o resto abre um modal com Cancelar e Guardar.

## 2. Funcionalidades, em mapa curto

| Área | Já existe | Ainda não |
| --- | --- | --- |
| Pré-inscrições | Captação, funil, dono, diário, lote, duplicados, WhatsApp, ligação de documentos, validação e correcção | Pontuação, próximo passo sugerido, resposta escrita pela máquina |
| Venda | Propostas na Equipa, passagem a Pago e a Formando | Rascunho de proposta a partir da ficha do curso e da pré-inscrição |
| Marketing | Campanha com custo, canal e ROI real | Textos, anúncios, calendário editorial, ligação às plataformas |
| Blog | Título, slug, data, estado, temática | Corpo, SEO, revisão, publicação em `ena.pt` |
| Oferta | Ficha do curso, documentos do curso e turmas libertadas | Site público alimentado pelo GesForma |
| Avaliação | Grelha por parâmetros, módulos do programa, importação CSV e nota final. No CCP: e-learning (excepto módulos 2 e 9), simulações desses módulos, projeto e nota final ponderada | TO DO: ler a nota do Moodle real. Até lá o valor lança-se à mão |
| Dossiê | Fases antes, durante e fecho, requisitos universais, dossiê financiado único, visto fechado pelos ficheiros do curso | Publicação do dossiê fora do GesForma |

## 3. Proposta: modelo ENA, de raiz e personalizado

"De raiz" aqui quer dizer um modelo **da ENA**: pesos próprios, tarefas próprias, e respostas presas à oferta real. Não é um chat genérico com um texto de instruções por cima.

Não proponho treinar um modelo fundacional do zero, só com os dados da escola. Esse corpus não chega para a língua, e o custo não se paga. O modelo personalizado faz-se em três peças, todas da ENA no fim do treino.

### Peça A. Linguagem da ENA

Parte-se de um modelo aberto e pequeno, capaz de português (ordem das centenas de milhões de parâmetros, não de um modelo de fronteira). Faz-se pré-treino continuado no corpus da escola:

- fichas de curso, programas, critérios de avaliação
- templates e histórico de emails (sem dados de pagamento)
- notas do CRM e respostas de propostas, já anonimizadas
- respostas de inquéritos
- posts e temáticas do blog, quando houver corpo

Os pesos resultantes ficam da ENA. Um modelo iniciado ao acaso, sem esta base aberta, escreveria pior do que um comercial e não vale o treino.

### Peça B. Quatro cabeças de tarefa

O mesmo modelo, afinado com exemplos supervisionados, e depois com o que a equipa aceita ou rejeita.

1. **Pré-inscrições.** Dada a pré-inscrição e a oferta, devolve: prioridade (quem contactar hoje), próximo estado provável, campos em falta, regime certo (Gold ou Financiada), e um rascunho curto de chamada, WhatsApp ou email. Não muda o funil sozinho e não valida documentos.
2. **Venda de formação.** Dada a pré-inscrição e a ficha do curso, devolve um rascunho de proposta: o que inclui, horário e local só se a turma estiver libertada, preço só se estiver na ficha, e uma resposta a uma objecção escrita pelo comercial. A proposta continua a gravar-se na Equipa, com estado e resposta do cliente.
3. **Marketing.** Dado curso, canal, datas e o que a campanha já converteu, devolve ângulos e textos (assunto, parágrafo, chamada para a pré-inscrição). Não cria anúncios nas plataformas nem gasta orçamento. O ROI continua a ser o cálculo que já existe.
4. **Blog.** Dado o programa do curso e a temática, devolve título, slug, entrada e corpo em rascunho. O post fica em estado de rascunho. Não publica em `ena.pt`.

### Peça C. Oferta real, não memória do modelo

Antes de responder sobre um curso, o modelo consulta a base: ficha, preço, horas, locais, e turmas libertadas (local, horário, data). Se não houver turma libertada, diz isso. Não inventa vaga, data, preço nem certificação.

Isto é o que separa o modelo de um texto bonito e falso. A cabeça de linguagem escreve. A consulta à base limita o que pode ser afirmado.

### Regras de uso

- Nada sai sozinho. O rascunho cai na ficha da pré-inscrição, na proposta, no template de email ou no post. Uma pessoa grava ou envia.
- Gold e Financiada não se misturam. Na Financiada o modelo fala de elegibilidade e de documentos, não de "fecho de venda" como no Gold.
- Não entram nos pesos: cartão de cidadão, IBAN, NIF, referências de pagamento, palavras-passe, observações de documentos recusados. As notas usam-se anonimizadas.
- O comercial ou a secretaria corrigem o rascunho. Essa correcção volta a entrar no afinamento. É assim que o modelo fica personalizado ao longo do tempo, em vez de ficar parado no primeiro treino.

### Dados que já dão para começar

| Tarefa | Sinal que já está na base | O que ainda falta recolher |
| --- | --- | --- |
| Pré-inscrições | Estado final do funil, origem, campanha, tempo até ao contacto, notas, documentos validados ou recusados | Marcar se o rascunho foi usado, editado ou deitado fora |
| Venda | Propostas, estado, resposta do cliente, pagamento e passagem a Formando | Pares pré-inscrição e proposta boa, escritos pela equipa |
| Marketing | Canal, custo, curso, inscrições, pagos, aberturas de email | Textos que a equipa considere bons, por canal |
| Blog | Título, slug, temática, programa do curso | Corpo dos posts. Hoje o blog quase não tem texto |

Sem o corpo do blog e sem um conjunto de propostas boas, as cabeças de marketing e blog começam fracas. A de pré-inscrições pode começar mais cedo, porque o funil já tem o desfecho (Pago, Formando, Desistiu).

### Ordem de construção

1. Conjunto de avaliação fechado: pré-inscrições antigas, com o desfecho já conhecido, e uma lista de perguntas sobre a oferta em que a resposta certa está na base.
2. Índice da oferta (fichas e turmas libertadas), para nenhuma resposta citar um curso que não existe.
3. Pré-treino continuado no corpus da ENA.
4. Afinação das quatro cabeças, primeiro pré-inscrições e venda, depois marketing e blog.
5. Segunda afinação com o que a equipa aceita ou reescreve.
6. Ligação ao GesForma só como rascunho, atrás do mesmo perfil que já vê aquele ecrã.

### Como saber se serve

- Pré-inscrições: mais contactos no próprio dia, sem piorar a taxa que chega a Pago ou Formando. A prioridade tem de bater certo com o que a vista Hoje já considera atrasado.
- Venda: a proposta não pode afirmar preço, data ou local que não estejam na ficha ou na turma libertada. Mede-se a taxa de erro factual, e só depois o tempo que o comercial poupa.
- Marketing: o texto tem de apontar para a pré-inscrição de um curso real. Não se mede pelo "soar bem".
- Blog: um editor aceita o rascunho com poucas emendas, e o texto não contradiz o programa do curso.

Se a taxa de erro factual na oferta não estiver perto de zero, o modelo não entra no CRM. Um texto de venda errado custa mais do que não ter modelo.

## 4. O que esta proposta não inclui

- Publicar sozinho em `ena.pt`. A ficha e o blog continuam no GesForma até existir essa ligação.
- Comprar anúncios, ligar Meta Ads ou Google Ads, ou substituir o cálculo de ROI das campanhas.
- Recibos Moloni, Ifthenpay ou SIBS.
- Área do formando. O que existe para a pessoa é a ligação pessoal de documentos e o inquérito público.
- Enviar WhatsApp, email ou proposta sem uma pessoa carregar em gravar ou enviar.
- Validar documentos ou fechar a ligação pessoal. Isso continua a ser trabalho da secretaria.
