-- Recibo emitido não muda: número, ano, pagamento e os dados gravados na emissão (valor, pagador, linhas)
-- ficam fixos na base, seja qual for o caminho que tente alterá-los. Só a Drive e o envio por email se actualizam.
CREATE OR REPLACE FUNCTION recibos_imutaveis() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.numero IS DISTINCT FROM OLD.numero OR NEW.ano IS DISTINCT FROM OLD.ano OR NEW.pagamento_id IS DISTINCT FROM OLD.pagamento_id OR (OLD.dados ? 'numero' AND NEW.dados IS DISTINCT FROM OLD.dados) THEN RAISE EXCEPTION 'recibo % já emitido: os dados não mudam', OLD.id USING ERRCODE = 'check_violation'; END IF; RETURN NEW; END $$;

DROP TRIGGER IF EXISTS recibos_imutaveis ON recibos;
CREATE TRIGGER recibos_imutaveis BEFORE UPDATE ON recibos FOR EACH ROW EXECUTE FUNCTION recibos_imutaveis();
