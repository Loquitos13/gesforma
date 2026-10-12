# Integração Moodle ↔ GesForma ↔ Área do formando

Documento de referência para o trabalho **por fazer** (não implementado nesta fase). O runtime nativo SCORM/H5P no GesForma continua descrito em `docs/conteudos-pedagogicos.md`.

## Princípio

A **formação financiada** é gestão do **departamento pedagógico** (coordenadores, formadores, turmas UFCD, dossiê TP). O rótulo «Financiada» no GesForma não move esta responsabilidade para um módulo administrativo isolado: CRM, turmas, documentos, sessões e fecho de ação são pedagógicos. O perfil `financiada` reflecte essa função.

O Moodle é a plataforma de aprendizagem quando a modalidade o exige; o GesForma continua a ser o sistema de registo, elegibilidade, presenças, avaliação agregada e dossiê.

## GesForma (backoffice)

### Conteúdos

- Criar, editar e eliminar actividades Moodle a partir da ficha do curso (**Conteúdos Moodle**), com sincronização bidireccional (ou API unidireccional com fila de erros).
- Mapear módulos UFCD ↔ secções Moodle.
- Publicar/despublicar recursos e reordenar a sequência pedagógica sem duplicar manualmente no Moodle.

### Notas e progresso

- Importar **notas** e **estado de conclusão** por formando e actividade (gradebook + completion).
- Mostrar no cockpit da turma (Gold e Financiada) progresso real por formando, não só sessões datadas no cronograma.
- Alimentar a pauta do dossiê e critérios de certificação com dados Moodle quando definido na ficha.

### Utilizadores e inscrições

- Criar conta Moodle no **Acesso directo** e após validação de pré-inscrição quando o curso o exige.
- Inscrever/desinscrever na disciplina da turma; suspender acesso em desistência.
- Ligar `users` / `formandos_*` a `moodle_user_id`.

### Configuração

- URL do Moodle, token de webservice (ou OAuth), id da categoria por entidade/regime.
- Teste de ligação em **Configurações**; registo de erros visível ao administrador.

## Área do formando (`/area-formando`)

- Botão **Continuar formação** abre a sala Moodle (SSO ou login único) ou embed quando seguro.
- Mostrar progresso importado do Moodle por curso/turma.
- Notificações quando há actividade nova ou prazo de módulo (opcional, via eventos Moodle).

## API / backend (esboço)

- Cliente Moodle (`core_webservice` / REST): utilizadores, inscrições, cursos, módulos, grades, completion.
- Tabelas sugeridas: `moodle_links` (turma/regime ↔ course id), `moodle_activity_map`, fila `moodle_sync_jobs`.
- Webhooks ou cron para reconciliar notas e conclusões.

## Fora de âmbito inicial

- Substituir o editor pedagógico nativo (SCORM/H5P/quizzes no site) — complementa o Moodle, não o substitui de imediato.
- Duplicar todo o gradebook no GesForma — importar agregados e detalhe sob demanda.

Ver checklist fechada em `docs/todo.md` (secção Moodle).
