/**
 * Sessões, documentos, certificados e notas da turma.
 * Cada linha de `turma_sessoes` liga-se ao id estável da sessão do cronograma (`sessao_id`);
 * `sessao_n` é só a posição lectiva actual, recalculada por `renumerarSessoes` sempre que o cronograma muda.
 */
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";
import type { TxQuery } from "../db/pool.js";

export type SessaoLinha = { sessao_id: string | null; sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown };

/** Só as linhas ligadas a uma sessão que ainda está no cronograma (as órfãs ficam guardadas, fora daqui). */
export async function listarSessoes(c: Consulta, regime: Regime, turmaId: number) {
  return many<SessaoLinha>(
    c,
    `SELECT sessao_id, sessao_n, plano, sumario, presencas FROM turma_sessoes
      WHERE regime = $1 AND turma_id = $2 AND sessao_n IS NOT NULL ORDER BY sessao_n`,
    [regime, turmaId],
  );
}

export async function lerSessao(c: Consulta, regime: Regime, turmaId: number, sessaoId: string) {
  return one<Omit<SessaoLinha, "sessao_id" | "sessao_n">>(
    c,
    "SELECT plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_id = $3",
    [regime, turmaId, sessaoId],
  );
}

/** Sessões com dados que impedem removê-las do cronograma: sumário, presenças ou plano assinado. */
export async function sessoesComDados(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ sessao_id: string; sessao_n: number | null }>(
    c,
    `SELECT sessao_id, sessao_n FROM turma_sessoes
      WHERE regime = $1 AND turma_id = $2 AND sessao_id IS NOT NULL
        AND (sumario IS NOT NULL AND sumario <> 'null'::jsonb
          OR jsonb_typeof(presencas) = 'array' AND jsonb_array_length(presencas) > 0
          OR plano->>'assinado' = 'true')`,
    [regime, turmaId],
  );
}

/**
 * Recalcula `sessao_n` a partir do cronograma gravado: a posição de cada `sessao_id` entre as sessões lectivas
 * (presencial e síncrona, como `sessaoLectivaN`). Uma sessão que saiu do cronograma fica sem número.
 */
export async function renumerarSessoes(c: Consulta, regime: Regime, turmaId: number) {
  await many(
    c,
    `WITH lect AS (
       SELECT x.e->>'id' AS sid, row_number() OVER (ORDER BY x.o)::int AS n
         FROM ${tabelaRegime("turmas", regime)} t
         CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END)
              WITH ORDINALITY AS x(e, o)
        WHERE t.id = $2 AND jsonb_typeof(x.e) = 'object'
          AND coalesce(x.e->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
     )
     UPDATE turma_sessoes ts SET sessao_n = (SELECT min(lect.n) FROM lect WHERE lect.sid = ts.sessao_id)
      WHERE ts.regime = $1 AND ts.turma_id = $2 AND ts.sessao_id IS NOT NULL
      RETURNING ts.sessao_id`,
    [regime, turmaId],
  );
}

/** Grava as partes enviadas na sessão com este id (as que vêm a null mantêm-se); `n` é a posição actual. */
export async function gravarSessao(
  c: Consulta,
  regime: Regime,
  turmaId: number,
  sessao: { id: string; n: number },
  partes: { plano?: unknown; sumario?: unknown; presencas?: unknown },
) {
  await one(
    c,
    `INSERT INTO turma_sessoes (regime, turma_id, sessao_id, sessao_n, plano, sumario, presencas)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, COALESCE($7::jsonb, '[]'::jsonb))
     ON CONFLICT (regime, turma_id, sessao_id) DO UPDATE SET
       sessao_n = EXCLUDED.sessao_n,
       plano = COALESCE($5::jsonb, turma_sessoes.plano),
       sumario = COALESCE($6::jsonb, turma_sessoes.sumario),
       presencas = COALESCE($7::jsonb, turma_sessoes.presencas),
       updated_at = now()
     RETURNING sessao_id`,
    [regime, turmaId, sessao.id, sessao.n, partes.plano ?? null, partes.sumario ?? null, partes.presencas ?? null],
  );
}

export type DocumentoLinha = { grupo_id: string; label: string; estado: string; detalhe: string; payload: unknown };

export async function listarDocumentos(c: Consulta, regime: Regime, turmaId: number) {
  return many<DocumentoLinha>(
    c,
    "SELECT grupo_id, label, estado, detalhe, payload FROM turma_documentos WHERE regime = $1 AND turma_id = $2 ORDER BY grupo_id, label",
    [regime, turmaId],
  );
}

export async function gravarDocumento(
  c: Consulta,
  regime: Regime,
  turmaId: number,
  doc: { grupoId: string; label: string; estado: string; detalhe: string; payload?: unknown },
) {
  await one(
    c,
    `INSERT INTO turma_documentos (regime, turma_id, grupo_id, label, estado, detalhe, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (regime, turma_id, grupo_id, label) DO UPDATE SET
       estado = EXCLUDED.estado,
       detalhe = EXCLUDED.detalhe,
       payload = COALESCE(EXCLUDED.payload, turma_documentos.payload),
       updated_at = now()
     RETURNING turma_id`,
    [regime, turmaId, doc.grupoId, doc.label, doc.estado, doc.detalhe, doc.payload === undefined ? null : doc.payload],
  );
}

export type CertificadoLinha = {
  formando_id: number; emitido: boolean; nota: unknown; elearning: unknown;
  ficheiro_id: string; ficheiro_nome: string; ficheiro_url: string;
};

export async function listarCertificados(c: Consulta, regime: Regime, turmaId: number) {
  return many<CertificadoLinha>(
    c,
    `SELECT formando_id, emitido, nota, elearning,
            COALESCE(ficheiro_id, '') AS ficheiro_id,
            COALESCE(ficheiro_nome, '') AS ficheiro_nome,
            COALESCE(ficheiro_url, '') AS ficheiro_url
       FROM turma_certificados WHERE regime = $1 AND turma_id = $2`,
    [regime, turmaId],
  );
}

/** Nota e e-learning antes da elegibilidade (sem emitir). */
export async function gravarNotaCertificado(c: Consulta, regime: Regime, turmaId: number, formandoId: number, nota: number | null, elearning: number | null) {
  await one(
    c,
    `INSERT INTO turma_certificados (regime, turma_id, formando_id, emitido, nota, elearning)
     VALUES ($1, $2, $3, false, $4, $5)
     ON CONFLICT (regime, turma_id, formando_id) DO UPDATE SET
       nota = COALESCE($4, turma_certificados.nota), elearning = COALESCE($5, turma_certificados.elearning), updated_at = now()
     RETURNING formando_id`,
    [regime, turmaId, formandoId, nota, elearning],
  );
}

export async function gravarCertificado(
  c: Consulta,
  regime: Regime,
  turmaId: number,
  formandoId: number,
  v: { emitido: boolean | null; nota: number | null; elearning: number | null; ficheiroId: string; ficheiroNome: string; ficheiroUrl: string },
) {
  await one(
    c,
    `INSERT INTO turma_certificados (regime, turma_id, formando_id, emitido, nota, elearning, emitido_em, ficheiro_id, ficheiro_nome, ficheiro_url)
     VALUES ($1, $2, $3, COALESCE($4, false), $5, $6, CASE WHEN $4 = true THEN now() ELSE NULL END, COALESCE($7, ''), COALESCE($8, ''), COALESCE($9, ''))
     ON CONFLICT (regime, turma_id, formando_id) DO UPDATE SET
       emitido = COALESCE($4, turma_certificados.emitido),
       nota = COALESCE($5, turma_certificados.nota),
       elearning = COALESCE($6, turma_certificados.elearning),
       emitido_em = CASE WHEN $4 = true THEN now() ELSE turma_certificados.emitido_em END,
       ficheiro_id = CASE WHEN $7 <> '' THEN $7 ELSE turma_certificados.ficheiro_id END,
       ficheiro_nome = CASE WHEN $8 <> '' THEN $8 ELSE turma_certificados.ficheiro_nome END,
       ficheiro_url = CASE WHEN $9 <> '' THEN $9 ELSE turma_certificados.ficheiro_url END,
       updated_at = now()
     RETURNING formando_id`,
    [regime, turmaId, formandoId, v.emitido, v.nota, v.elearning, v.ficheiroId, v.ficheiroNome, v.ficheiroUrl],
  );
}

export async function listarNotas(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ formando_id: number; modulo_id: string; parametro_id: string; nota: unknown }>(
    c,
    "SELECT formando_id, modulo_id, parametro_id, nota FROM turma_avaliacoes WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
}

/** Grava só as células enviadas: com nota insere ou actualiza; a null apaga essa célula. As outras ficam. */
export async function gravarNotas(
  tx: (fn: (q: TxQuery) => Promise<void>) => Promise<void>,
  regime: Regime,
  turmaId: number,
  notas: { formandoId: number; moduloId: string; parametroId: string; nota: number | null }[],
) {
  await tx(async q => {
    for (const n of notas) {
      const chave = [regime, turmaId, n.formandoId, n.moduloId || "", n.parametroId];
      if (n.nota == null || !Number.isFinite(n.nota)) {
        await q(
          `DELETE FROM turma_avaliacoes
            WHERE regime = $1 AND turma_id = $2 AND formando_id = $3 AND modulo_id = $4 AND parametro_id = $5`,
          chave,
        );
        continue;
      }
      await q(
        `INSERT INTO turma_avaliacoes (regime, turma_id, formando_id, modulo_id, parametro_id, nota)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (regime, turma_id, formando_id, modulo_id, parametro_id) DO UPDATE SET nota = EXCLUDED.nota, updated_at = now()`,
        [...chave, n.nota],
      );
    }
  });
}

/** Sumários gravados (horas do formador). */
export async function sumariosDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ sessao_n: number; sumario: unknown }>(
    c,
    "SELECT sessao_n, sumario FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_n IS NOT NULL",
    [regime, turmaId],
  );
}
