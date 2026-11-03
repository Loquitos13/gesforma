-- WhatsApp: o pop-up do assistente do site («Falar com um operador no WhatsApp») usa o contacto geral da ENA
-- (+351 962 215 550). Os contactos de cada local (Edição de cursos › Locais e fichas dos cursos) ficam como estão.
UPDATE app_settings SET values = values || '{"evaWhatsapp": "351962215550"}'::jsonb, updated_at = now()
 WHERE id = 'site' AND jsonb_typeof(values) = 'object';
