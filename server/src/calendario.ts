/**
 * Calendário (GesForma › Calendário, «O meu calendário» do formador e a área do formando): as sessões de formação
 * das turmas, com turma, curso, módulo e horário; para quem gere turmas também o início, a data limite da matrícula
 * e o fim de cada turma; para a administração ainda os contactos marcados no CRM. Quem vê o quê decide a rota.
 */
import type { Db } from "./db/pool.js";

export type TipoEvento = "sessao" | "inicio" | "matricula" | "fim" | "contacto";
export type EventoCalendario = {
  id: string;
  tipo: TipoEvento;
  regime: "gold" | "fin";
  data: string;
  inicio: string;
  fim: string;
  titulo: string;
  turma: string;
  turmaId: number | null;
  curso: string;
  modulos: string[];
  formadores: string[];
  local: string;
  modalidade: string;
  leadId?: number;
};

export type FiltroCalendario = {
  de: string;
  ate: string;
  regimes: ("gold" | "fin")[];
  /** Início, data limite da matrícula e fim de cada turma. */
  datasTurma?: boolean;
  /** Contactos marcados nas pré-inscrições (próximo contacto). */
  contactos?: boolean;
  /** Só as sessões deste formador (nome, sem maiúsculas). */
  formador?: string;
  /** Só estas turmas (área do formando). */
  turmas?: { regime: "gold" | "fin"; id: number }[];
};

const MODALIDADE_COM_HORAS = new Set(["presencial", "sincrona", "avaliacao"]);
const lista = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x ?? "").trim()).filter(Boolean) : []);

export async function eventosCalendario(db: Db, f: FiltroCalendario): Promise<EventoCalendario[]> {
  const out: EventoCalendario[] = [];
  for (const regime of f.regimes) {
    const tabela = regime === "fin" ? "turmas_fin" : "turmas_gold";
    const ids = f.turmas?.filter(t => t.regime === regime).map(t => t.id);
    if (f.turmas && !ids?.length) continue;
    const rows = (await db.query<{ id: number; nome: string; curso: string; local: string; formador: string | null; data_inicio: string | null; val: Record<string, unknown> | null }>(
      `SELECT t.id, t.nome, COALESCE(t.curso, '') AS curso, COALESCE(t.local, '') AS local, t.formador,
              left(COALESCE(t.data_inicio::text, ''), 10) AS data_inicio, s.val
         FROM ${tabela} t
         LEFT JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END) s(val)
           ON left(COALESCE(s.val->>'data', ''), 10) BETWEEN $1 AND $2
        WHERE ($3::int[] IS NULL OR t.id = ANY($3::int[]))`,
      [f.de, f.ate, ids ?? null])).rows;
    const vistas = new Set<number>();
    for (const r of rows) {
      const base = { regime, turma: String(r.nome ?? ""), turmaId: Number(r.id), curso: String(r.curso ?? ""), local: String(r.local ?? "") };
      // Início da turma (uma vez por turma).
      if (f.datasTurma && !vistas.has(r.id) && r.data_inicio && r.data_inicio >= f.de && r.data_inicio <= f.ate) {
        out.push({ ...base, id: `inicio:${regime}:${r.id}`, tipo: "inicio", data: r.data_inicio, inicio: "", fim: "", titulo: `Início · ${base.turma}`, modulos: [], formadores: [], modalidade: "" });
      }
      vistas.add(r.id);
      const s = r.val;
      if (!s) continue;
      const data = String(s.data ?? "").slice(0, 10);
      const modalidade = String(s.modalidade ?? "presencial");
      const id = String(s.id ?? "");
      if (id === "fim-cronograma") {
        if (f.datasTurma) out.push({ ...base, id: `fim:${regime}:${r.id}`, tipo: "fim", data, inicio: "", fim: "", titulo: `Fim · ${base.turma}`, modulos: [], formadores: [], modalidade: "" });
        continue;
      }
      if (modalidade === "matricula") {
        if (f.datasTurma) out.push({ ...base, id: `matricula:${regime}:${r.id}:${data}`, tipo: "matricula", data, inicio: "", fim: "", titulo: `Data limite da matrícula · ${base.turma}`, modulos: [], formadores: [], modalidade });
        continue;
      }
      if (!MODALIDADE_COM_HORAS.has(modalidade)) continue;
      const modulos = lista(s.modulos).length ? lista(s.modulos) : lista([s.modulo]);
      const formadores = lista(s.formadores).length ? lista(s.formadores) : lista([s.formador ?? r.formador]);
      if (f.formador && !formadores.some(n => n.toLowerCase() === f.formador)) continue;
      out.push({
        ...base, id: `sessao:${regime}:${r.id}:${id || data + String(s.horaInicio ?? "")}`, tipo: "sessao", data,
        inicio: String(s.horaInicio ?? ""), fim: String(s.horaFim ?? ""),
        titulo: modulos.length ? modulos.join(" · ") : modalidade === "avaliacao" ? "Avaliação" : "Sessão",
        modulos, formadores, modalidade,
      });
    }
  }
  if (f.contactos) {
    const leads = (await db.query<{ id: number; nome: string; apelido: string; curso: string; regime: string; proximo_contacto: string }>(
      `SELECT id, nome, apelido, COALESCE(curso, '') AS curso, COALESCE(regime, 'gold') AS regime, proximo_contacto FROM preinscricoes
        WHERE proximo_contacto <> '' AND left(proximo_contacto, 10) BETWEEN $1 AND $2 AND estado NOT IN ('Formando', 'Desistiu')
          AND COALESCE(regime, 'gold') = ANY($3::text[])`, [f.de, f.ate, `{${f.regimes.join(",")}}`])).rows;
    for (const l of leads) {
      const hora = /\d{2}:\d{2}/.exec(l.proximo_contacto.slice(10))?.[0] ?? "";
      out.push({
        id: `contacto:${l.id}`, tipo: "contacto", regime: l.regime === "fin" ? "fin" : "gold", data: l.proximo_contacto.slice(0, 10), inicio: hora, fim: "",
        titulo: `Contacto · ${`${l.nome ?? ""} ${l.apelido ?? ""}`.trim()}`, turma: "", turmaId: null, curso: l.curso, modulos: [], formadores: [], local: "",
        modalidade: "", leadId: Number(l.id),
      });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || (a.inicio || "99").localeCompare(b.inicio || "99") || a.turma.localeCompare(b.turma));
}
