-- «Vagas a anunciar no site» a 0 deixava a turma bloqueada no site («Novas datas em breve») sem se ver porquê: vazio
-- ou 0 passam a querer dizer o mesmo (o site mostra as vagas livres da turma). Para fechar as vendas, «Liberada».
UPDATE turmas_gold SET vagas_anunciadas = NULL WHERE vagas_anunciadas = 0;
UPDATE turmas_fin SET vagas_anunciadas = NULL WHERE vagas_anunciadas = 0;
