/** Sessões, documentos, certificados e notas da turma. */
import { many, one, type Consulta, type Regime } from "./sql.js";
import type { TxQuery } from "../db/pool.js";

export type SessaoLinha = { sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown };

export async function listarSessoes(c: Consulta, regime: Regime, turmaId: number) {
  return many<SessaoLinha>(
    c,
    "SELECT sessao_n, plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 ORDER BY sessao_n",
    [regime, turmaId],
  );
}

export async function lerSessao(c: Consulta, regime: Regime, turmaId: number, n: number) {
  return one<Omit<SessaoLinha, "sessao_n">>(
    c,
    "SELECT plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_n = $3",
    [regime, turmaId, n],
  );
}

/** Grava as partes enviadas (as que vêm a null mantêm-se). */
export async function gravarSessao(
  c: Consulta,
  regime: Regime,
  turmaId: number,
  n: number,
  partes: { plano?: unknown; sumario?: unknown; presencas?: unknown },
) {
  await one(
    c,
    `INSERT INTO turma_sessoes (regime, turma_id, sessao_n, plano, sumario, presencas)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, COALESCE($6::jsonb, '[]'::jsonb))
     ON CONFLICT (regime, turma_id, sessao_n) DO UPDATE SET
       plano = COALESCE($4::jsonb, turma_sessoes.plano),
       sumario = COALESCE($5::jsonb, turma_sessoes.sumario),
       presencas = COALESCE($6::jsonb, turma_sessoes.presencas),
       updated_at = now()
     RETURNING sessao_n`,
    [regime, turmaId, n, partes.plano ?? null, partes.sumario ?? null, partes.presencas ?? null],
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

/** Substitui a grelha inteira numa só transacção. */
export async function substituirNotas(
  tx: (fn: (q: TxQuery) => Promise<void>) => Promise<void>,
  regime: Regime,
  turmaId: number,
  notas: { formandoId: number; moduloId: string; parametroId: string; nota: number | null }[],
) {
  await tx(async q => {
    await q("DELETE FROM turma_avaliacoes WHERE regime = $1 AND turma_id = $2", [regime, turmaId]);
    for (const n of notas) {
      if (n.nota == null || !Number.isFinite(n.nota)) continue;
      await q(
        `INSERT INTO turma_avaliacoes (regime, turma_id, formando_id, modulo_id, parametro_id, nota)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [regime, turmaId, n.formandoId, n.moduloId || "", n.parametroId, n.nota],
      );
    }
  });
}

/** Sumários gravados (horas do formador). */
export async function sumariosDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ sessao_n: number; sumario: unknown }>(
    c,
    "SELECT sessao_n, sumario FROM turma_sessoes WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
}
