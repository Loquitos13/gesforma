import type { Db } from "./db/pool.js";

export type DocPedido = { id: string; label: string; required: boolean };

const GOLD: DocPedido[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "contrato", label: "Contrato de formação", required: true },
  { id: "regulamento", label: "Regulamento de formação aceite", required: true },
  { id: "pip", label: "PIP - Projeto de Intervenção Pedagógica", required: false },
  { id: "exp", label: "Comprovativo de 5 anos de experiência", required: false },
];

const FIN: DocPedido[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "ch", label: "Certificado de habilitações", required: true },
  { id: "cu", label: "Curriculum vitae", required: true },
  { id: "ci", label: "IBAN / comprovativo de NIB", required: true },
  { id: "ce", label: "Comprovativo de situação perante o emprego", required: true },
];

export const COMPROVATIVO: DocPedido = {
  id: "comprovativo",
  label: "Comprovativo de pagamento",
  required: false,
};

function parseExtra(raw: unknown): { id: string; label: string; ambito?: string; bloqueante?: boolean }[] {
  if (!raw) return [];
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(v) ? v as { id: string; label: string; ambito?: string; bloqueante?: boolean }[] : [];
}

function parseExcluidos(raw: unknown): string[] {
  if (!raw) return [];
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(v) ? v.map(String) : [];
}

export async function docsDoCurso(db: Db, curso: string, regime: "gold" | "fin"): Promise<DocPedido[]> {
  const base = (regime === "fin" ? FIN : GOLD).map(d => ({ ...d }));
  const cursoRow = regime === "fin"
    ? await db.query<{ id: number }>(
      "SELECT id FROM cursos_fin WHERE lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1)) LIMIT 1",
      [curso],
    )
    : await db.query<{ id: number }>(
      "SELECT id FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1",
      [curso],
    );
  const cursoId = cursoRow.rows[0]?.id;
  if (!cursoId) return base;
  const modelo = await db.query<{ extra: unknown; excluidos: unknown }>(
    "SELECT extra, excluidos FROM curso_dtp_modelos WHERE regime = $1 AND curso_id = $2",
    [regime, cursoId],
  );
  const excluidos = new Set(parseExcluidos(modelo.rows[0]?.excluidos));
  const kept = base.filter(d => !excluidos.has(d.id));
  const seen = new Set(kept.map(d => d.id));
  for (const extra of parseExtra(modelo.rows[0]?.extra)) {
    if (extra.ambito !== "formando" || !extra.id || seen.has(extra.id)) continue;
    seen.add(extra.id);
    kept.push({ id: extra.id, label: extra.label || extra.id, required: Boolean(extra.bloqueante) });
  }
  return kept;
}

export function docsCompletos(pedidos: DocPedido[], tiposEntregues: string[]) {
  const got = new Set(tiposEntregues);
  const emFalta = pedidos.filter(d => d.required && !got.has(d.id));
  return { ok: emFalta.length === 0, emFalta };
}
