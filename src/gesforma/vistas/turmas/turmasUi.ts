import type { FaseTurma, LinhaTurma } from "../../../partilhado/api/turmas";
import type { Tom } from "../../../partilhado/ui";

export const FASES: { id: FaseTurma | ""; rotulo: string; so?: "fin" }[] = [
  { id: "", rotulo: "Todas" },
  { id: "abrir", rotulo: "A abrir" },
  { id: "decorrer", rotulo: "A decorrer" },
  { id: "por_fechar", rotulo: "Por fechar" },
  { id: "fechada", rotulo: "Fechadas" },
  { id: "cancelada", rotulo: "Canceladas", so: "fin" },
];

export const FASE_ESTADO: Record<FaseTurma, { rotulo: string; tom: Tom }> = {
  abrir: { rotulo: "A abrir", tom: "info" },
  decorrer: { rotulo: "A decorrer", tom: "acao" },
  por_fechar: { rotulo: "Por fechar", tom: "aviso" },
  fechada: { rotulo: "Fechada", tom: "neutro" },
  cancelada: { rotulo: "Cancelada", tom: "perigo" },
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function diasAte(iso: string, hoje = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((d.getTime() - h.getTime()) / 86_400_000);
}

export type Alerta = { texto: string; tom: Tom };

/** Alertas de uma turma, todos calculados a partir dos números do servidor. */
export function alertasDaTurma(t: LinhaTurma, regime: "gold" | "fin", dtpPct?: number): Alerta[] {
  if (t.fase === "cancelada") return [];
  const out: Alerta[] = [];
  if (t.sumariosEmFalta > 0) out.push({ texto: `${plural(t.sumariosEmFalta, "sumário", "sumários")} por assinar`, tom: "perigo" });
  if (regime === "gold" && t.reservas > 0 && t.fase !== "fechada") {
    out.push({ texto: `${plural(t.reservas, "reserva", "reservas")} por inscrever`, tom: "aviso" });
  }
  if (t.docsEmFalta > 0 && t.fase !== "fechada") {
    out.push({ texto: `${plural(t.docsEmFalta, "documento", "documentos")} de formandos em falta`, tom: regime === "fin" ? "perigo" : "aviso" });
  }
  if (t.fase === "por_fechar") out.push({ texto: "Terminou: falta fechar a turma", tom: "aviso" });
  if (t.sessoes === 0 && t.fase !== "fechada") out.push({ texto: "Sem cronograma", tom: "aviso" });
  if (t.fase === "abrir") {
    const dias = diasAte(t.dataInicio);
    const ocupacao = t.capacidade > 0 ? (t.inscritos + t.reservas) / t.capacidade : 1;
    if (t.livres === 0) out.push({ texto: "Lotada", tom: "info" });
    else if (dias != null && dias <= 42 && ocupacao < 0.4) {
      out.push({ texto: `Poucas inscrições a ${dias <= 7 ? plural(Math.max(dias, 0), "dia", "dias") : plural(Math.round(dias / 7), "semana", "semanas")}`, tom: "aviso" });
    }
  }
  if ((t.fase === "por_fechar" || t.fase === "fechada") && dtpPct != null && dtpPct < 100) {
    out.push({ texto: `Dossiê TP a ${dtpPct} %`, tom: t.fase === "fechada" ? "aviso" : "neutro" });
  }
  return out;
}

/** Cor da barra de ocupação. */
export function tomOcupacao(ocupadas: number, capacidade: number): Tom {
  if (capacidade <= 0) return "neutro";
  const r = ocupadas / capacidade;
  return r >= 0.75 ? "sucesso" : r >= 0.4 ? "aviso" : "perigo";
}

/** Cor sólida de uma barra por tom (classes escritas por extenso para o Tailwind as gerar). */
export const BARRA: Record<Tom, string> = {
  sucesso: "bg-sucesso", aviso: "bg-aviso", perigo: "bg-perigo", info: "bg-ligacao", neutro: "bg-tinta-suave", acao: "bg-acao",
};
