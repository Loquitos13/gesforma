# Conteúdos pedagógicos por módulo

O separador **Conteúdos Moodle** na ficha do curso (`src/gesforma/ConteudosMoodle.tsx`) grava a estrutura em `conteudosMoodle` dentro do payload da ficha. Os tipos e a validação estão em `src/partilhado/conteudosPedagogicos.ts`.

## O que já funciona

- Seleccionar o módulo a partir do **Programa** (M1, M2, …).
- Introdução, objectivo do módulo, critério de conclusão, percurso sequencial e nota mínima nos quizzes.
- Sequência de **elementos**: vídeo, manual PDF, texto, flashcards, quiz (seis formatos), webinar, actividade, pacotes **SCORM** e **H5P** (referência ao ficheiro no Drive ou URL).
- Importar SCORM/H5P (ZIP ou `.h5p`) para o Drive da entidade; **Biblioteca multimédia** com ficheiros já registados no GesForma (`drive_files`).
- Quizzes na ficha: escolha única, escolha múltipla, resposta aberta, verdadeiro/falso, correspondência e ordenação de cartões.

Isto é **autoria e arquivo** na ficha. Não há player, nem registo de tentativas, nem ligação ao Moodle.

## Por fazer — estrutura SCORM / H5P (suporte completo)

Objectivo: o formando concluir o percurso no site (área do formando ou sala equivalente) com o mesmo rigor que num LMS: pacotes SCORM e H5P executados de ponta a ponta, progresso e notas gravados por formando e por turma, regras de conclusão do módulo aplicadas.

### SCORM

- **Importação e validação.** Descompactar o pacote, ler `imsmanifest.xml`, detectar SCORM 1.2 e SCORM 2004 (4.ª edição), recusar pacotes inválidos com mensagem clara na ficha.
- **Armazenamento.** Manter o pacote imutável (Drive ou blob versionado); na ficha guardar metadados: versão SCORM, identificador do SCO, título do manifesto, lista de ficheiros de lançamento.
- **Runtime.** Player em iframe ou sandbox com API SCORM (`LMSSetValue`, `LMSCommit`, … / `SetValue`, `Commit`, …), sessão por formando+elemento, persistência de `cmi.*` (localização, estado de conclusão, pontuação, tempo, suspend_data).
- **Conclusão e nota.** Mapear `cmi.completion_status` / `cmi.success_status` e `cmi.score.*` para o critério do módulo e para a avaliação do curso quando aplicável.
- **Sequência.** Respeitar o percurso sequencial obrigatório da ficha antes de desbloquear o SCO seguinte.

### H5P

- **Importação.** Aceitar `.h5p` (ZIP com `h5p.json` e bibliotecas); validar versão e dependências; opcionalmente extrair para armazenamento servido pelo GesForma (não só ligação ao ZIP bruto).
- **Runtime.** Integrar o player H5P (content types suportados pelo pacote importado: question sets, verdadeiro/falso, drag-and-drop, flashcards H5P, vídeo interactivo, etc.) com eventos `xAPI` ou callbacks de conclusão/pontuação.
- **Conclusão e nota.** Gravar resultado por formando; alimentar regras de conclusão do módulo e médias quando o elemento for avaliativo.

### Elementos nativos (não-SCORM)

- **Vídeo e PDF.** Reprodução inline; vídeo a partir de ficheiro, URL ou Drive; PDF em visualizador; tempo mínimo ou «marcar como visto» se a regra o exigir.
- **Flashcards e quizzes da ficha.** Render na área do formando; correcção automática nos tipos fechados; resposta aberta com rubrica ou correcção manual do formador; tentativas e nota mínima (%).
- **Webinar / actividade.** Estado «agendado / realizado»; ligação opcional a sessão da turma no cronograma.

### Progresso, regras e APIs

- Modelo de **progresso por formando** (elemento concluído, pontuação, timestamps, suspend_data SCORM) persistido em Postgres, não só no JSON da ficha.
- Aplicar **percurso sequencial** e **nota mínima nos quizzes** definidos no módulo.
- Endpoints autenticados para a área do formando ler o percurso publicado a partir da ficha + estado do formando; endpoints do backoffice para pré-visualização «como formando».
- **Biblioteca multimédia:** além dos ficheiros já enviados pelo GesForma, listagem coerente com pastas do Drive da entidade (vídeos, áudio, imagens, PDF, ZIP SCORM/H5P), com pesquisa e filtros por tipo MIME.

### Moodle e exportação

- Exportar ou sincronizar a estrutura para disciplinas Moodle (recursos, SCORM, H5P, questionário) — **opcional** e separado do runtime no site; hoje não existe.
- Ler notas reais do Moodle para a grelha de avaliação continua em `docs/todo.md` (ligação externa).

## Onde implementar (orientação)

| Camada | Ficheiros / área provável |
|--------|---------------------------|
| Tipos e parse da ficha | `src/partilhado/conteudosPedagogicos.ts` |
| Editor | `src/gesforma/ConteudosMoodle.tsx`, `ConteudosMoodleElemento.tsx` |
| Player formando | `src/site/AreaFormando.tsx` (sala / módulos) |
| API + persistência | `server/src/` (rotas área formando + tabelas de progresso) |
| Ficheiros SCORM/H5P | Drive existente + serviço estático ou proxy `/api/.../scorm/` |

## Referência cruzada

- Lista fechada de tarefas: `docs/todo.md` (secção **Conteúdos pedagógicos — SCORM / H5P**).
- Área do formando (Moodle / progresso): mesma lista, secção **Área do formando**.
