-- WhatsApp: um só contacto geral da ENA (+351 962 215 550), no assistente do site e em todos os locais.
-- Os locais (Edição de cursos › Locais) passam todos a ter o número geral.
UPDATE catalog_items SET payload = jsonb_set(payload, '{whatsapp}', '"962215550"'::jsonb), updated_at = now()
 WHERE kind = 'locais' AND jsonb_typeof(payload) = 'object';

-- A ficha de cada curso deixa de ter WhatsApp próprio por local: vale o do local (o geral).
UPDATE curso_fichas SET payload = jsonb_set(payload, '{contactosLocais}', (
    SELECT COALESCE(jsonb_object_agg(e.k, CASE WHEN jsonb_typeof(e.v) = 'object' THEN e.v - 'whatsapp' ELSE e.v END), '{}'::jsonb)
      FROM jsonb_each(payload->'contactosLocais') AS e(k, v))), updated_at = now()
 WHERE jsonb_typeof(payload->'contactosLocais') = 'object';

-- Assistente do site («Falar com um operador no WhatsApp»).
UPDATE app_settings SET values = values || '{"evaWhatsapp": "351962215550"}'::jsonb, updated_at = now()
 WHERE id = 'site' AND jsonb_typeof(values) = 'object';
