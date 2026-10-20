-- O RLS de users (048) deixa cada utilizador alterar a própria linha (nome, palavra-passe, preferências),
-- o que incluía o perfil e o estado. Em produção a API liga-se como superutilizador e o RLS não se aplica;
-- um trigger aplica-se sempre.
-- O admin muda perfis e estados em Utilizadores, com a verificação do último admin na própria rota. Fora do admin (e do contexto 'system' de migrações, seed e tarefas):
--   * o perfil (role) nunca muda
--   * o estado (active) só muda em contas de formador ou formando, e nunca na própria conta
--   * só se criam contas de formador ou formando
-- O corpo não tem «;» no fim das linhas: o migrador divide o ficheiro por «;» seguido de mudança de linha.
CREATE OR REPLACE FUNCTION users_protege_perfil() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF app_role() IN ('admin', 'system') THEN RETURN NEW
  ; END IF
  ; IF TG_OP = 'INSERT' THEN
    IF NEW.role NOT IN ('formador', 'formando') THEN
      RAISE EXCEPTION 'só a administração cria contas com o perfil %', NEW.role USING ERRCODE = '42501'
    ; END IF
    ; RETURN NEW
  ; END IF
  ; IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'só a administração altera o perfil de um utilizador' USING ERRCODE = '42501'
  ; END IF
  ; IF NEW.active IS DISTINCT FROM OLD.active
     AND (OLD.id::text = app_user_id() OR OLD.role NOT IN ('formador', 'formando')) THEN
    RAISE EXCEPTION 'só a administração activa ou desactiva esta conta' USING ERRCODE = '42501'
  ; END IF
  ; RETURN NEW
; END
$$;

DROP TRIGGER IF EXISTS users_protege_perfil ON users;
CREATE TRIGGER users_protege_perfil BEFORE INSERT OR UPDATE OF role, active ON users
  FOR EACH ROW EXECUTE FUNCTION users_protege_perfil();
