# Requisitos funcionais e proposta de modelo de AI

Lista do que o GesForma já faz, escrita como requisitos, e uma proposta de modelo próprio para leads, venda de formação, marketing e blog.

O GesForma é o backoffice da ENA. A unidade de gestão é a **turma**, não a "ação de formação". Há dois regimes, Gold (autofinanciada, CCP) e Financiada (UFCD), com Painel, CRM e Equipa separados. O site `ena.pt` ainda não recebe publicação a partir daqui.

## 1. Requisitos já cobertos

Cada requisito descreve comportamento que já existe.

### Acesso e perfis

- RF-01. A entrada é por email e palavra-passe, ou por Google e Microsoft, mas só se o email já for um utilizador activo.
- RF-02. Os perfis são Administração, Secretaria, Comercial Gold e Secretaria Financiada.
- RF-03. A Comercial Gold vê Gold e Gestão. A Secretaria Financiada vê Financiada e Gestão. Administração e Secretaria vêem os dois regimes. Só a Administração gere utilizadores.
- RF-04. Não se desactiva nem apaga o último administrador.

### Painel

- RF-05. Gold e Financiada têm painéis separados, calculados na API com os dados desse regime.
- RF-06. O painel mostra pré-inscritos, formandos, turmas e cursos activos, receita confirmada, receita do mês, ticket médio, pendentes, funil, métodos de pagamento, top cursos e origens ("como conheceram a ENA").
- RF-07. Sem API, o painel diz que está offline. Não inventa números.
- RF-08. As notificações sinalizam pagamentos pendentes, leads por contactar, turmas lotadas ou vazias, documentos de elegibilidade em falta e DTP abaixo de 60%. A leitura fica gravada por utilizador, em Bloqueio, Aviso ou Info.

### CRM e leads

- RF-09. O CRM de cada regime recebe leads de três sítios: pré-inscrição pública (`/pre-inscricao`), lead manual e bot WhatsApp. A pré-inscrição pública entra em Gold.
- RF-10. Criar uma lead pede nome e telemóvel ou email. NIF e morada fiscal são opcionais até à etapa Pré-inscrição.
- RF-11. O funil é: Não contactado, 1.º contacto, 2.º contacto, Pago, Pré-inscrição, Formando, e Desistiu. O funil só avança. Pago e Formando não recuam. Um formando não volta atrás: abre-se um pedido novo.
- RF-12. Na Pré-inscrição, quando o último campo obrigatório é gravado (incluindo NIF de 9 dígitos e morada fiscal), a lead passa sozinha à secretaria.
- RF-13. Só Administração ou Secretaria passam uma lead Gold a Formando. Na Financiada, a Secretaria Financiada também pode, e a conversão cria o formando financiado.
- RF-14. A lista é paginada no servidor, com pesquisa, filtros, facetas, CSV até 2 000 linhas e acções em lote até 100 leads (atribuir, etiqueta, adiar).
- RF-15. A vista Hoje junta por contactar, atrasados e follow-ups. O pipeline mostra até 80 cartões por etapa.
- RF-16. A ficha tem diário de contactos, notas (com modelos e nota fixa), campos extra, etiquetas e aviso de duplicados. Ligar e WhatsApp registam o contacto.
- RF-17. Cada lead tem dono comercial, origem, campanha, curso, local, horário e regime.

### Equipa e venda

- RF-18. A Equipa Gold lista comerciais. A Equipa Financiada lista a secretaria financiada.
- RF-19. A ficha da pessoa mostra estatísticas, propostas (estado e resposta do cliente), leads atribuídos e diário de contactos.
- RF-20. Uma proposta comercial fica ligada ao regime e ao comercial.

### Oferta pública e WhatsApp

- RF-21. A oferta pública são turmas Gold libertadas. Cada turma é um curso com local, horário e data de início.
- RF-22. A pré-inscrição pede nome, apelido, telemóvel, email, concelho, e depois curso, local, horário e data. Horário e data dependem do local.
- RF-23. O bot WhatsApp faz pré-inscrição e consulta de estado por número ou email. Não confirma pagamentos.
- RF-24. Sem token da Meta, o CRM tem um simulador de conversa. O token fica cifrado.

### Formação

- RF-25. Cursos Gold e UFCD financiadas têm ficha própria: identidade, oferta (tipo, categoria, modalidade, preço, horas, tags, vários locais), textos públicos, programa, avaliação e publicação interna.
- RF-26. O regime da ficha vem da rota. Não se escolhe Gold ou Financiada dentro do formulário.
- RF-27. Guardar só cria o curso se a identidade e a oferta obrigatórias estiverem preenchidas.
- RF-28. A pré-visualização lista turmas libertadas (local, horário, data). O progresso "Pronto para o site" indica o que falta. A publicação em `ena.pt` ainda não existe.
- RF-29. Módulos, conteúdos, datas, locais, horários (só Gold) e áreas temáticas são catálogos do regime.
- RF-30. Uma turma Gold tem cronograma em grelha, sessões arrastáveis, e o estado Libertada ou Não libertada. Só as libertadas aceitam novas entradas.
- RF-31. O cockpit da turma tem visão geral, cronograma, sessões (plano, sumário, presenças), avaliação, documentos, dossiê técnico-pedagógico e certificados.
- RF-32. A avaliação segue a ficha do curso: escala, unidade, mínimo, pesos, e modo por módulo ou nota final.
- RF-33. O dossiê vive na turma. Gold acrescenta PIP, simulações, comprovativo de 5 anos e recibos. Financiada acrescenta elegibilidade (cartão de cidadão, habilitações, CV, IBAN, emprego), horas e relatório de execução.
- RF-34. A estrutura do dossiê configura-se por curso. Documentos de norma não se removem. O resto liga-se por âmbito: turma, formando ou formador.
- RF-35. A completude do dossiê calcula-se a partir dos dados (cronograma, planos, sumários, presenças, PIP, simulações, contratos, elegibilidade, certificados). O resto valida-se à mão.
- RF-36. Exportar o dossiê gera um ZIP por categorias. Os ficheiros vão para o Google Drive da entidade.
- RF-37. Formandos Gold existem na turma e avulso. Formandos financiados têm estado de elegibilidade e documentos. Dá para transferir de turma e apagar, com confirmação.
- RF-38. Formadores têm ficha, CCP, estado activo e os regimes em que leccionam. Quem marca os dois aparece nas duas listas.
- RF-39. Inquéritos (texto, escolha múltipla, escala 1 a 5, sim ou não) têm pré-visualização, ligação pública `/inquerito/:token`, respostas gravadas e CSV.

### Marketing, blog e comunicação

- RF-40. Campanhas (no Gold) têm nome, curso, canal, datas, custo, encarregado e notas. Inscrições, pagamentos, conversão, ticket, por contactar, desistências, origens e ROI calculam-se das pré-inscrições e dos pagamentos. Canais: Website, Facebook, Instagram, Google, Email, WhatsApp, Referência, Parceiro.
- RF-41. O blog tem posts (título, slug, data, estado, temática) e temáticas. Não tem corpo longo nem publicação no site.
- RF-42. Emails automáticos: uma regra é gatilho, template, curso e atraso, com pré-visualização. Gatilhos actuais: nova pré-inscrição, sem pagamento há 3 dias, pagamento confirmado, contacto após a venda (1 hora), 24 horas antes do início, certificado ao concluir, reengajamento aos 30 dias.
- RF-43. A taxa de abertura sai de um pixel. Sem SMTP o email fica no histórico.

### Pagamentos e operação

- RF-44. Pagamentos registam referência Multibanco ou MB Way como pendente. O webhook do banco marca Pago, actualiza o formando Gold, passa o lead a Pago e dispara o email de confirmação.
- RF-45. Recibos certificados (Moloni) e o contrato Ifthenpay ou SIBS não estão ligados.
- RF-46. A pesquisa geral (nome, telemóvel, email ou id) abre a ficha ou a vista certa.
- RF-47. Listas de vocabulário (origem, contacto, pagamento, desistência, e outras) editam-se em Gestão e alimentam os formulários. O formulário público lê origens sem permitir criar opções.
- RF-48. Configurações abrem por cartão: Google, Microsoft, WhatsApp, chave do webhook, Drive.

## 2. Funcionalidades, em mapa curto

| Área | Já existe | Ainda não |
| --- | --- | --- |
| Leads | Captação, funil, dono, diário, lote, duplicados, WhatsApp | Pontuação, próximo passo sugerido, resposta escrita pela máquina |
| Venda | Propostas na Equipa, passagem a Pago e a Formando | Rascunho de proposta a partir da ficha do curso e do lead |
| Marketing | Campanha com custo, canal e ROI real | Textos, anúncios, calendário editorial, ligação às plataformas |
| Blog | Título, slug, data, estado, temática | Corpo, SEO, revisão, publicação em `ena.pt` |
| Oferta | Ficha do curso e turmas libertadas | Site público alimentado pelo GesForma |

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

1. **Leads.** Dado o lead e a oferta, devolve: prioridade (quem contactar hoje), próximo estado provável, campos em falta, regime certo (Gold ou Financiada), e um rascunho curto de chamada, WhatsApp ou email. Não muda o funil sozinho.
2. **Venda de formação.** Dado o lead e a ficha do curso, devolve um rascunho de proposta: o que inclui, horário e local só se a turma estiver libertada, preço só se estiver na ficha, e uma resposta a uma objecção escrita pelo comercial. A proposta continua a gravar-se na Equipa, com estado e resposta do cliente.
3. **Marketing.** Dado curso, canal, datas e o que a campanha já converteu, devolve ângulos e textos (assunto, parágrafo, chamada para a pré-inscrição). Não cria anúncios nas plataformas nem gasta orçamento. O ROI continua a ser o cálculo que já existe.
4. **Blog.** Dado o programa do curso e a temática, devolve título, slug, lead e corpo em rascunho. O post fica em estado de rascunho. Não publica em `ena.pt`.

### Peça C. Oferta real, não memória do modelo

Antes de responder sobre um curso, o modelo consulta a base: ficha, preço, horas, locais, e turmas libertadas (local, horário, data). Se não houver turma libertada, diz isso. Não inventa vaga, data, preço nem certificação.

Isto é o que separa o modelo de um texto bonito e falso. A cabeça de linguagem escreve. A consulta à base limita o que pode ser afirmado.

### Regras de uso

- Nada sai sozinho. O rascunho cai na ficha do lead, na proposta, no template de email ou no post. Uma pessoa grava ou envia.
- Gold e Financiada não se misturam. Na Financiada o modelo fala de elegibilidade e de documentos, não de "fecho de venda" como no Gold.
- Não entram nos pesos: cartão de cidadão, IBAN, NIF, referências de pagamento, palavras-passe. As notas usam-se anonimizadas.
- O comercial ou a secretaria corrigem o rascunho. Essa correcção volta a entrar no afinamento. É assim que o modelo fica personalizado ao longo do tempo, em vez de ficar parado no primeiro treino.

### Dados que já dão para começar

| Tarefa | Sinal que já está na base | O que ainda falta recolher |
| --- | --- | --- |
| Leads | Estado final do funil, origem, campanha, tempo até ao contacto, notas | Marcar se o rascunho foi usado, editado ou deitado fora |
| Venda | Propostas, estado, resposta do cliente, pagamento e passagem a Formando | Pares lead e proposta boa, escritos pela equipa |
| Marketing | Canal, custo, curso, inscrições, pagos, aberturas de email | Textos que a equipa considere bons, por canal |
| Blog | Título, slug, temática, programa do curso | Corpo dos posts. Hoje o blog quase não tem texto |

Sem o corpo do blog e sem um conjunto de propostas boas, as cabeças de marketing e blog começam fracas. A de leads pode começar mais cedo, porque o funil já tem o desfecho (Pago, Formando, Desistiu).

### Ordem de construção

1. Conjunto de avaliação fechado: leads antigos, com o desfecho já conhecido, e uma lista de perguntas sobre a oferta em que a resposta certa está na base.
2. Índice da oferta (fichas e turmas libertadas), para nenhuma resposta citar um curso que não existe.
3. Pré-treino continuado no corpus da ENA.
4. Afinação das quatro cabeças, primeiro leads e venda, depois marketing e blog.
5. Segunda afinação com o que a equipa aceita ou reescreve.
6. Ligação ao GesForma só como rascunho, atrás do mesmo perfil que já vê aquele ecrã.

### Como saber se serve

- Leads: mais contactos no próprio dia, sem piorar a taxa que chega a Pago ou Formando. A prioridade tem de bater certo com o que a vista Hoje já considera atrasado.
- Venda: a proposta não pode afirmar preço, data ou local que não estejam na ficha ou na turma libertada. Mede-se a taxa de erro factual, e só depois o tempo que o comercial poupa.
- Marketing: o texto tem de apontar para a pré-inscrição de um curso real. Não se mede pelo "soar bem".
- Blog: um editor aceita o rascunho com poucas emendas, e o texto não contradiz o programa do curso.

Se a taxa de erro factual na oferta não estiver perto de zero, o modelo não entra no CRM. Um texto de venda errado custa mais do que não ter modelo.

## 4. O que esta proposta não inclui

- Publicar sozinho em `ena.pt`. A ficha e o blog continuam no GesForma até existir essa ligação.
- Comprar anúncios, ligar Meta Ads ou Google Ads, ou substituir o cálculo de ROI das campanhas.
- Recibos Moloni, Ifthenpay ou SIBS.
- Área do formando.
- Enviar WhatsApp, email ou proposta sem uma pessoa carregar em gravar ou enviar.
