-- Serviços para empresas (Gestão › Empresas / Business): cada um tem cartão na página Empresas e página própria
-- em /empresas/<slug>. O site só mostra os ativos, pela ordem. Começa com os serviços que o site já mostrava.
CREATE TABLE IF NOT EXISTS servicos (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO servicos (slug, ordem, dados) VALUES
  ('formacao-a-medida', 10, '{"titulo": "Formação à medida", "etiqueta": "", "texto": "Programas desenhados para os objetivos e o ritmo da sua equipa.", "pontos": "Diagnóstico de necessidades\nConteúdos à medida\nPresencial, online ou misto", "detalhe": "", "rotulo": "Pedir proposta", "ligacao": "#contactos", "imagem": "", "imagens": [], "video": "", "logos": []}'::jsonb),
  ('formacao-certificada', 20, '{"titulo": "Formação certificada", "etiqueta": "", "texto": "Cursos certificados pela DGERT, com certificado para cada colaborador.", "pontos": "Entidade certificada DGERT\nCertificados no SIGO\nFormadores certificados", "detalhe": "", "rotulo": "Pedir proposta", "ligacao": "#contactos", "imagem": "", "imagens": [], "video": "", "logos": []}'::jsonb),
  ('gestao-da-formacao-obrigatoria', 30, '{"titulo": "Gestão da formação obrigatória", "etiqueta": "", "texto": "Tratamos das 40 horas anuais de formação a que os colaboradores têm direito.", "pontos": "Plano anual de formação\nRelatório Único\nDossiê técnico-pedagógico", "detalhe": "", "rotulo": "Pedir proposta", "ligacao": "#contactos", "imagem": "", "imagens": [], "video": "", "logos": []}'::jsonb),
  ('conteudos-multimedia', 40, '{"titulo": "Conteúdos multimédia", "etiqueta": "", "texto": "Desenvolvemos conteúdos multimédia (vídeo) e áudio (podcasts) personalizados para cursos com necessidades específicas.\nPersonalizamos plataformas colaborativas (Moodle e outras) para formação síncrona e assíncrona.", "pontos": "", "detalhe": "", "rotulo": "Pedir proposta", "ligacao": "#contactos", "imagem": "", "imagens": [], "video": "", "logos": []}'::jsonb),
  ('certificacao-dgert-de-entidades-formadoras', 50, '{"titulo": "Certificação DGERT de entidades formadoras", "etiqueta": "", "texto": "Elaboramos o dossiê de certificação de entidades formadoras ou academias de formação pela DGERT.", "pontos": "", "detalhe": "", "rotulo": "Pedir proposta", "ligacao": "#contactos", "imagem": "", "imagens": [], "video": "", "logos": []}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
