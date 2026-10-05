import type { Db } from "./db/pool.js";
import { comporModelo, DTP_MODELO_VAZIO, parseDtpModelo } from "./dtpModel.js";

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

export type DocExtraPreinscricao = { id: string; label: string; required: boolean };

export type DocsPreinscricaoCfg = {
  ocultos: string[];
  extra: DocExtraPreinscricao[];
};

const CFG_VAZIA: DocsPreinscricaoCfg = { ocultos: [], extra: [] };

export function cursoPedeDocsPreinscricao(regime: "gold" | "fin", tipo: string) {
  if (regime === "fin") return true;
  const t = tipo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return t.includes("pre-inscr") || t.includes("preinscr");
}

export function docsBase(regime: "gold" | "fin"): DocPedido[] {
  return (regime === "fin" ? FIN : GOLD).map(d => ({ ...d }));
}

function parseCfg(raw: unknown): DocsPreinscricaoCfg {
  if (!raw) return CFG_VAZIA;
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!v || typeof v !== "object") return CFG_VAZIA;
  const row = v as { ocultos?: unknown; extra?: unknown };
  const ocultos = Array.isArray(row.ocultos) ? row.ocultos.map(String) : [];
  const extra = Array.isArray(row.extra)
    ? row.extra.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const x = item as { id?: unknown; label?: unknown; required?: unknown };
      const id = String(x.id ?? "").trim();
      const label = String(x.label ?? "").trim();
      if (!id || !label) return [];
      return [{ id, label, required: Boolean(x.required) }];
    })
    : [];
  return { ocultos, extra };
}

export async function lerDocsPreinscricao(db: Db, regime: "gold" | "fin", cursoId: number): Promise<DocsPreinscricaoCfg> {
  const table = regime === "fin" ? "cursos_fin" : "cursos_gold";
  const row = await db.query<{ docs_preinscricao: unknown }>(
    `SELECT docs_preinscricao FROM ${table} WHERE id = $1`,
    [cursoId],
  );
  return parseCfg(row.rows[0]?.docs_preinscricao);
}

export async function gravarDocsPreinscricao(db: Db, regime: "gold" | "fin", cursoId: number, cfg: DocsPreinscricaoCfg) {
  const table = regime === "fin" ? "cursos_fin" : "cursos_gold";
  await db.query(
    `UPDATE ${table} SET docs_preinscricao = $2::jsonb WHERE id = $1`,
    [cursoId, cfg],
  );
}

export async function docsDoCurso(db: Db, curso: string, regime: "gold" | "fin"): Promise<DocPedido[]> {
  const base = docsBase(regime);
  const cursoRow = regime === "fin"
    ? await db.query<{ id: number; tipo: string }>(
      "SELECT id, ''::text AS tipo FROM cursos_fin WHERE lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1)) LIMIT 1",
      [curso],
    )
    : await db.query<{ id: number; tipo: string }>(
      "SELECT id, tipo FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1",
      [curso],
    );
  const found = cursoRow.rows[0];
  if (!found) return regime === "fin" ? base : [];
  if (!cursoPedeDocsPreinscricao(regime, String(found.tipo ?? ""))) return [];
  const cfg = await lerDocsPreinscricao(db, regime, found.id);
  const ocultos = new Set(cfg.ocultos);
  const kept = base.filter(d => !ocultos.has(d.id));
  const seen = new Set(kept.map(d => d.id));
  for (const extra of cfg.extra) {
    if (seen.has(extra.id)) continue;
    seen.add(extra.id);
    kept.push({ id: extra.id, label: extra.label, required: extra.required });
  }
  const modelo = await db.query<{ extra: unknown; excluidos: unknown; incluidos: unknown }>(
    "SELECT extra, excluidos, incluidos FROM curso_dtp_modelos WHERE regime = $1 AND curso_id = $2",
    [regime, found.id],
  );
  const cursoModelo = parseDtpModelo(modelo.rows[0]);
  let composto = cursoModelo;
  if (regime === "gold") {
    const entidade = await db.query<{ excluidos: unknown; extra: unknown }>(
      `SELECT e.excluidos, e.extra
         FROM cursos_gold c
         JOIN dtp_entidades e ON e.id = c.entidade_responsavel_id
        WHERE c.id = $1`,
      [found.id],
    );
    composto = comporModelo(parseDtpModelo(entidade.rows[0] ?? DTP_MODELO_VAZIO), cursoModelo);
  }
  for (const extra of composto.extra) {
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

/** Texto vazio quando a secretaria já pode validar a pré-inscrição inteira. */
export function faltaValidarPreinscricao(input: {
  validada: boolean;
  concluido: boolean;
  turma: { livres: number } | null;
  pedidos: DocPedido[];
  ficheiros: { tipo: string; estado?: string }[];
  precisaPagamento: boolean;
}) {
  if (input.validada) return "A pré-inscrição já foi validada.";
  if (!input.concluido) return "A pessoa ainda não concluiu o percurso na ligação pessoal.";
  if (!input.turma) return "Ainda não há cronograma escolhido.";
  if (input.turma.livres <= 0) return "A turma escolhida está cheia.";
  const by = new Map(input.ficheiros.map(f => [f.tipo, f.estado || "pendente"]));
  const faltam = input.pedidos.filter(d => d.required && by.get(d.id) !== "validado").map(d => d.label);
  if (input.precisaPagamento && by.get("comprovativo") !== "validado") faltam.push("Comprovativo de pagamento");
  if (faltam.length) return `Falta validar: ${faltam.join(", ")}.`;
  return "";
}
