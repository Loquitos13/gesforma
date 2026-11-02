-- Um pagamento confirmado passa a dar um só email: a regra «Contacto após a venda» (que saía junto com
-- «Pagamento confirmado») fica desligada. O modelo fica, para quem o quiser usar noutra regra.
UPDATE email_rules SET ativo = false WHERE trigger_key = 'sale.followup';
