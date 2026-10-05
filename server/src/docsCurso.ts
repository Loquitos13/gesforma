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
  const modelo = await db.query<{ extra: unknown; excluidos: unknown; incluidos: unknown }>(
    "SELECT extra, excluidos, incluidos FROM curso_dtp_modelos WHERE regime = $1 AND curso_id = $2",
    [regime, cursoId],
  );
  const cursoModelo = parseDtpModelo(modelo.rows[0]);
  let composto = cursoModelo;
  if (regime === "gold") {
    const entidade = await db.query<{ excluidos: unknown; extra: unknown }>(
      `SELECT e.excluidos, e.extra
         FROM cursos_gold c
         JOIN dtp_entidades e ON e.id = c.entidade_responsavel_id
        WHERE c.id = $1`,
      [cursoId],
    );
    composto = comporModelo(parseDtpModelo(entidade.rows[0] ?? DTP_MODELO_VAZIO), cursoModelo);
  }
  const excluidos = new Set(composto.excluidos);
  const kept = base.filter(d => !excluidos.has(d.id));
  const seen = new Set(kept.map(d => d.id));
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
