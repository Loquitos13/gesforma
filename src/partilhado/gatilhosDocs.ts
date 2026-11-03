/**
 * Gatilhos dos documentos da pré-inscrição (ficha do curso › Documentos): um documento pode ser pedido «sempre» ou
 * «só se» a pessoa tiver uma das escolaridades, nacionalidades, locais ou horários escolhidos (dentro de cada dado
 * basta um dos valores; entre dados, todos têm de bater). Com o gatilho cumprido o documento é obrigatório.
 * Sem o dado na pré-inscrição (pedidos antigos), o documento aparece como opcional. Partilhado com o servidor.
 */
import { ESCOLARIDADES } from "./escolaridade.js";

export const NACIONALIDADES_GATILHO = ["Portuguesa", "Estrangeira"] as const;
export type NacionalidadeGatilho = typeof NACIONALIDADES_GATILHO[number];

export type GatilhoDoc = {
  escolaridade?: string[];
  nacionalidade?: NacionalidadeGatilho[];
  local?: string[];
  horario?: string[];
};

/** O que se sabe da pessoa (as colunas da pré-inscrição com o mesmo nome). */
export type DadosGatilho = { escolaridade?: unknown; nacionalidade?: unknown; local?: unknown; horario?: unknown };

export const CAMPOS_GATILHO = ["escolaridade", "nacionalidade", "local", "horario"] as const;
export type CampoGatilho = typeof CAMPOS_GATILHO[number];

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const lista = (v: unknown, max = 30) => (Array.isArray(v) ? [...new Set(v.map(x => String(x ?? "").trim().slice(0, 120)).filter(Boolean))].slice(0, max) : []);

export const temGatilho = (g?: GatilhoDoc | null) => Boolean(g && CAMPOS_GATILHO.some(c => (g[c]?.length ?? 0) > 0));

/** Limpa um gatilho vindo de fora (só valores conhecidos na escolaridade e na nacionalidade). */
export function limparGatilho(raw: unknown): GatilhoDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const g: GatilhoDoc = {
    escolaridade: lista(r.escolaridade).filter(v => (ESCOLARIDADES as readonly string[]).includes(v)),
    nacionalidade: lista(r.nacionalidade).filter((v): v is NacionalidadeGatilho => (NACIONALIDADES_GATILHO as readonly string[]).includes(v)),
    local: lista(r.local),
    horario: lista(r.horario),
  };
  for (const c of CAMPOS_GATILHO) if (!g[c]?.length) delete g[c];
  return temGatilho(g) ? g : null;
}

/** Nacionalidade da pessoa no formato do gatilho («Portugal»/«Portuguesa» → Portuguesa; outro país → Estrangeira). */
function nacionalidadeDe(v: unknown): NacionalidadeGatilho | "" {
  const n = norm(v).replace(/^\d+\s*-\s*/, "");
  if (!n) return "";
  return n === "portugal" || n.startsWith("portugues") ? "Portuguesa" : "Estrangeira";
}

/**
 * «pede»: a pessoa cumpre o gatilho (documento obrigatório); «talvez»: falta algum dado e nada contradiz (opcional);
 * «nao»: algum dado não bate (o documento não se pede).
 */
export function avaliarGatilho(g: GatilhoDoc, p: DadosGatilho): "pede" | "talvez" | "nao" {
  let falta = false;
  for (const campo of CAMPOS_GATILHO) {
    const valores = g[campo];
    if (!valores?.length) continue;
    const dado = campo === "nacionalidade" ? nacionalidadeDe(p.nacionalidade) : norm(p[campo]);
    if (!dado) { falta = true; continue; }
    const alvo = campo === "nacionalidade" ? (valores as string[]) : valores.map(norm);
    if (!alvo.includes(dado)) return "nao";
  }
  return falta ? "talvez" : "pede";
}

/** Resumo para o ecrã: «Só se: 12.º ano · Lisboa». */
export function resumoGatilho(g?: GatilhoDoc | null) {
  if (!temGatilho(g)) return "";
  return `Só se: ${CAMPOS_GATILHO.flatMap(c => g![c]?.length ? [g![c]!.join(" ou ")] : []).join(" · ")}`;
}
