-- A execução física e as despesas ficam na pasta da turma, nunca na do dossiê: os ficheiros actuais passam a ter o
-- seu próprio tipo («reembolso»), fora das regras do dossiê. O cron diário da Drive move-os (e aos recibos que
-- ainda estejam dentro de um dossiê) para a pasta da turma (driveFicheiros.ts › arrumarNaPastaDaTurma).
UPDATE drive_files SET kind = 'reembolso'
 WHERE id IN (SELECT drive_file_id FROM reembolso_ficheiros) AND kind = 'dtp';
