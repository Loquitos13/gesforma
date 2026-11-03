-- Drive: em «02_TURMAS_ATIVAS», as turmas de cada regime ficam na sua pasta («Gold», «Financiada»); cada formando tem
-- todos os documentos (e o comprovativo de pagamento) na sua pasta dentro da turma («<n.º> - <nome>»).
-- A tarefa noturna da Drive (/v1/cron/drive) muda as pastas das turmas e os ficheiros antigos aos poucos.
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS drive_no_regime boolean NOT NULL DEFAULT false;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS drive_no_regime boolean NOT NULL DEFAULT false;
ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS drive_pasta_id text NOT NULL DEFAULT '';
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS drive_pasta_id text NOT NULL DEFAULT '';
ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS drive_docs_arrumados boolean NOT NULL DEFAULT false;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS drive_docs_arrumados boolean NOT NULL DEFAULT false;

-- O caminho mostrado dos ficheiros que já estão nas pastas das turmas passa a ter a pasta do regime.
UPDATE drive_files
   SET folder_path = '02_TURMAS_ATIVAS / ' || CASE WHEN regime = 'fin' THEN 'Financiada' ELSE 'Gold' END || ' / ' || substr(folder_path, 20)
 WHERE left(folder_path, 19) = '02_TURMAS_ATIVAS / ' AND regime IN ('gold', 'fin')
   AND left(folder_path, 24) <> '02_TURMAS_ATIVAS / Gold ' AND left(folder_path, 30) <> '02_TURMAS_ATIVAS / Financiada ';
