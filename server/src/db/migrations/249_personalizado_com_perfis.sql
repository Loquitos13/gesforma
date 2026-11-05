-- Um perfil personalizado tem sempre pelo menos um perfil marcado (a API já o exige; a base também).
UPDATE users SET active = false WHERE role = 'personalizado' AND cardinality(perfis) = 0;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_personalizado_perfis_check;
ALTER TABLE users ADD CONSTRAINT users_personalizado_perfis_check
  CHECK (role <> 'personalizado' OR cardinality(perfis) > 0);
