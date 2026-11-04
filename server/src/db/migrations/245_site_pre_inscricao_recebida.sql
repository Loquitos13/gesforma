-- Mensagem do site depois da pré-inscrição (nota do Aguiar, 03-11): o texto antigo, se ficou gravado tal e qual, passa
-- ao novo (com o curso). No CCP há um texto próprio (inscRecebidoTextoCcp, em Sistema › Site).
UPDATE app_settings
   SET values = jsonb_set(values, '{inscRecebidoTexto}', to_jsonb('Parabéns! Registou com sucesso a sua pré-inscrição no curso {curso} da ENA. Acabou de receber, no seu e-mail {email}, as instruções para poder realizar a matrícula, anexando os documentos exigidos.'::text)), updated_at = now()
 WHERE id = 'site' AND values->>'inscRecebidoTexto' = 'A ENA agradece a sua pré-inscrição, que ficou associada a {email}. Iremos entrar em contacto consigo para a formalizar, num período máximo de 2 dias úteis.';
