-- Um perfil personalizado tem sempre pelo menos um perfil marcado (a API já o exige; a base também).
-- NOT VALID: vale para o que se grava daqui em diante e não impede o arranque se já houver uma linha antiga assim.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_personalizado_perfis_check;
ALTER TABLE users ADD CONSTRAINT users_personalizado_perfis_check
  CHECK (role <> 'personalizado' OR cardinality(perfis) > 0) NOT VALID;
