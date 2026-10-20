// Regras de apresentação das pré-inscrições (etapa, próximo passo, documentos, contactos).
import type { Tom } from "../../../../partilhado/ui";
import type { Lead } from "../../../../partilhado/api/crm";
import { fmtDataCalendario, fmtDataLisboa, hojeLisboa } from "../../../../partilhado/horaLisboa";

/** Etapas do funil comercial, pela ordem do pipeline. São estados do processo, não dados. */
export const ETAPAS = ["Não contactado", "1º Contacto", "2º Contacto", "Pago", "Pré-inscrição", "Formando", "Desistiu"] as const;

export function rotuloEtapa(estado: string) {
  return estado.replace("1º", "1.º").replace("2º", "2.º");
}

export function tomEtapa(estado: string): Tom {
  switch (estado) {
    case "Não contactado": return "aviso";
    case "1º Contacto":
    case "2º Contacto": return "info";
    case "Pago": return "acao";
    case "Pré-inscrição": return "info";
    case "Formando": return "sucesso";
    default: return "neutro";
  }
}

/** Dígitos para wa.me (acrescenta 351 a números nacionais). */
export function telWhatsapp(telf: string) {
  const d = telf.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("351") ? d : `351${d}`;
}

export function nomeCompleto(l: Pick<Lead, "nome" | "apelido">) {
  return `${l.nome} ${l.apelido}`.trim();
}

export function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("") || "—";
}

/** "2026-10-13 14:05" (UTC sem fuso) → data e hora de Lisboa. */
export function quando(stamp: string) {
  if (!stamp) return "—";
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(stamp) ? `${stamp.slice(0, 16).replace(" ", "T")}:00Z` : stamp;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return stamp;
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
}

export function relativo(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return dias < 8 ? `há ${dias} d` : fmtDataLisboa(d);
}

/** Seguimento: atrasado, hoje ou data. */
export function seguimento(l: Pick<Lead, "proximoContacto" | "estado">, hoje: string): { texto: string; atrasado: boolean } {
  const p = l.proximoContacto;
  if (!p || ["Formando", "Desistiu"].includes(l.estado)) return { texto: "", atrasado: false };
  const dia = p.slice(0, 10);
  const data = fmtDataCalendario(dia);
  if (dia < hoje) return { texto: `Atrasado · ${data}`, atrasado: true };
  if (dia === hoje) return { texto: `Hoje${p.length > 10 ? ` · ${p.slice(11, 16)}` : ""}`, atrasado: false };
  return { texto: data, atrasado: false };
}

/** O que falta fazer a seguir, numa frase curta (lista e ficha). */
export function proximoPasso(l: Lead): { texto: string; tom: Tom } {
  if (l.estado === "Desistiu") return { texto: l.motivoDesistencia ? `Desistiu · ${l.motivoDesistencia}` : "Desistiu", tom: "neutro" };
  if (l.estado === "Formando") return { texto: "Inscrito na turma", tom: "sucesso" };
  if (l.validada) return { texto: l.regime === "gold" ? "Validada · inscrever na turma" : "Validada", tom: "sucesso" };
  if (l.estado === "Não contactado") return { texto: "Fazer o primeiro contacto", tom: "aviso" };
  if ((l.docsRecusados ?? 0) > 0) return { texto: "Aguarda correcção de documentos", tom: "perigo" };
  if (l.pagamentoPedido) return { texto: "Aguarda o comprovativo de pagamento", tom: "info" };
  if (l.percursoConcluido) return { texto: "Validar documentos", tom: "acao" };
  if ((l.docsEnviados ?? 0) > 0) return { texto: "A enviar documentos", tom: "info" };
  if (l.estado === "Pré-inscrição") return { texto: "Aguarda documentos na ligação pessoal", tom: "info" };
  return { texto: "Seguimento comercial", tom: "neutro" };
}

export function textoDocs(l: Lead) {
  const env = l.docsEnviados ?? 0;
  if (!env) return { texto: "Sem documentos", tom: "neutro" as Tom };
  const val = l.docsValidados ?? 0;
  const rec = l.docsRecusados ?? 0;
  if (rec) return { texto: `${rec} recusado${rec === 1 ? "" : "s"} · ${val}/${env} validados`, tom: "perigo" as Tom };
  if (val === env) return { texto: `${val} validado${val === 1 ? "" : "s"}`, tom: "sucesso" as Tom };
  return { texto: `${env - val} por validar · ${val}/${env}`, tom: "aviso" as Tom };
}

/** Quem pode colocar na turma (Formando) neste regime. */
export function eSecretaria(role: string, regime: "gold" | "fin") {
  return role === "admin" || role === "secretaria" || (regime === "fin" && role === "financiada");
}

/** Regras do funil (espelham o servidor; o servidor decide sempre). */
export function podeMudarEtapa(de: string, para: string, role: string, regime: "gold" | "fin"): string | null {
  if (de === para) return null;
  if (de === "Formando") return "Um formando não volta no funil. Crie um novo pedido se precisar.";
  if (para === "Desistiu") return null;
  if (para === "Formando" && !eSecretaria(role, regime)) return "Só a secretaria inscreve na turma (Formando).";
  if (para === "Pré-inscrição" && de === "Desistiu") return "Um pedido desistido não volta a pré-inscrição. Crie uma pré-inscrição nova.";
  return null;
}

/** Modelos rápidos de nota de contacto. */
export const MODELOS_NOTA = [
  { rotulo: "Não atendeu", texto: "Não atendeu. Nova tentativa combinada.", resultado: "Não atendeu" },
  { rotulo: "Caixa de correio", texto: "Caixa de correio. Pedi para devolver a chamada.", resultado: "Mailbox" },
  { rotulo: "Interessado", texto: "Interessado. Ficou de confirmar horário/local.", resultado: "Interessado" },
  { rotulo: "Ligar ao fim do dia", texto: "Pediu para ligar ao fim do dia.", resultado: "Atendeu" },
  { rotulo: "Aguarda empresa", texto: "Aguarda autorização da entidade empregadora.", resultado: "A pensar" },
];

export { hojeLisboa };
