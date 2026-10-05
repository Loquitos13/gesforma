DELETE FROM contratos_comerciais
 WHERE cliente_nome = 'Clinica Teste Gold'
   AND curso = 'Excel do Básico ao Avançado';

DELETE FROM propostas_comerciais
 WHERE cliente_nome = 'Clinica Teste Gold'
   AND curso = 'Excel do Básico ao Avançado';

DELETE FROM users WHERE email = 'slot.formador.gold@ena.pt';
