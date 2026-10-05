SELECT setval('ops_id_seq', GREATEST(
  (SELECT last_value FROM ops_id_seq),
  (SELECT COALESCE(MAX(id), 0) FROM propostas_comerciais),
  (SELECT COALESCE(MAX(id), 0) FROM contratos_comerciais)
));
