-- Financiada: pedidos com o percurso concluído que ficaram em «Não contactado» (um formando que volta noutra acção)
-- passam à fila «Na secretaria», como os novos.
UPDATE preinscricoes
   SET estado = 'Pré-inscrição', secretaria_em = COALESCE(secretaria_em, now()), ultima_actividade_em = now()
 WHERE regime = 'fin' AND percurso_concluido_em IS NOT NULL AND validada_em IS NULL
   AND estado IN ('Não contactado', '1º Contacto', '2º Contacto');
