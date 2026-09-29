export const CRM_ESTADOS = [
  "Não contactado",
  "1º Contacto",
  "2º Contacto",
  "Pago",
  "Pré-inscrição",
  "Formando",
  "Desistiu",
] as const;

export type CrmEstado = (typeof CRM_ESTADOS)[number];

export const CRM_KANBAN = [
  "Não contactado",
  "1º Contacto",
  "2º Contacto",
  "Pago",
  "Pré-inscrição",
  "Formando",
] as const;

export const CRM_COLS: { id: CrmEstado; label: string; color: string; dot: string }[] = [
  { id: "Não contactado", label: "Não contactado", color: "border-amber-400 bg-amber-50", dot: "bg-amber-400" },
  { id: "1º Contacto", label: "1.º Contacto", color: "border-blue-400 bg-blue-50", dot: "bg-blue-400" },
  { id: "2º Contacto", label: "2.º Contacto", color: "border-indigo-400 bg-indigo-50", dot: "bg-indigo-400" },
  { id: "Pago", label: "Pago", color: "border-teal-400 bg-teal-50", dot: "bg-teal-400" },
  { id: "Pré-inscrição", label: "Pré-inscrição", color: "border-violet-400 bg-violet-50", dot: "bg-violet-400" },
  { id: "Formando", label: "Formando", color: "border-emerald-400 bg-emerald-50", dot: "bg-emerald-400" },
  { id: "Desistiu", label: "Desistiu", color: "border-slate-300 bg-slate-50", dot: "bg-slate-400" },
];

export const MOTIVOS_DESISTENCIA = [
  "Preço", "Horário", "Local", "Sem vagas", "Concorrência", "Silêncio", "Não elegível", "Outro",
] as const;

export const RESULTADOS_CONTACTO = [
  "Atendeu", "Não atendeu", "Mailbox", "Interessado", "A pensar", "Recusou",
] as const;

export const MODELOS_NOTA = [
  { label: "Não atendeu", texto: "Não atendeu. Nova tentativa combinada.", resultado: "Não atendeu" },
  { label: "Mailbox", texto: "Caixa de correio. Pedi para devolver a chamada.", resultado: "Mailbox" },
  { label: "Interessado", texto: "Interessado. Ficou de confirmar horário/local.", resultado: "Interessado" },
  { label: "Pediu à noite", texto: "Pediu para ligar ao fim do dia.", resultado: "Atendeu" },
  { label: "MB Way enviado", texto: "Enviei pedido MB Way. Aguardo confirmação do banco.", resultado: "Interessado" },
  { label: "Aguarda empresa", texto: "Aguarda autorização da entidade empregadora.", resultado: "A pensar" },
];

export type LeadCamposSecretaria = {
  nome?: string;
  apelido?: string;
  telf?: string;
  email?: string;
  concelho?: string;
  curso?: string;
  local?: string;
  horario?: string;
  inicioCurso?: string;
  nif?: string;
  moradaFiscal?: string;
};

export const CAMPOS_SECRETARIA: { key: keyof LeadCamposSecretaria; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "apelido", label: "Apelido" },
  { key: "telf", label: "Telemóvel" },
  { key: "email", label: "Email" },
  { key: "concelho", label: "Concelho" },
  { key: "curso", label: "Curso" },
  { key: "local", label: "Local" },
  { key: "horario", label: "Horário" },
  { key: "inicioCurso", label: "Data de início" },
  { key: "nif", label: "NIF" },
  { key: "moradaFiscal", label: "Morada fiscal" },
];

function filled(v: unknown) {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-";
}

export function camposEmFalta(lead: LeadCamposSecretaria) {
  return CAMPOS_SECRETARIA.filter(c => {
    const v = lead[c.key];
    if (c.key === "nif") return !/^\d{9}$/.test(String(v ?? "").replace(/\s/g, ""));
    if (c.key === "moradaFiscal") return String(v ?? "").trim().length < 8;
    return !filled(v);
  });
}

export function estadoFechado(estado: string) {
  return estado === "Formando" || estado === "Desistiu";
}

export function estadoPodeEntregar(estado: string) {
  return estado === "Pré-inscrição";
}

export function slaSeguimento(proximo: string | undefined, hoje: string, estado: string) {
  if (!proximo || estado === "Formando" || estado === "Desistiu" || estado === "Pré-inscrição") return { late: false, label: proximo || "-" };
  const dia = proximo.slice(0, 10);
  if (dia < hoje) return { late: true, label: `atrasado · ${fmtRelativo(dia)}` };
  if (dia === hoje) return { late: false, label: `hoje · ${proximo.slice(11, 16) || "09:00"}` };
  return { late: false, label: proximo };
}

export function podeArrastar(de: string, para: string, opts: { role: string; secretariaEm?: string | null; regime?: "gold" | "fin" }) {
  if (de === para) return { ok: true as const };
  if (de === "Formando") return { ok: false as const, erro: "Um formando não volta no funil. Crie um novo pedido se precisar." };
  if (para === "Desistiu") return { ok: true as const };
  if (para === "Formando") {
    const secretaria = opts.role === "admin" || opts.role === "secretaria" || (opts.role === "financiada" && opts.regime === "fin");
    if (!secretaria) {
      return { ok: false as const, erro: "Só a secretaria inscreve na turma (Formando)." };
    }
    return { ok: true as const };
  }
  if (para === "Pré-inscrição" && !["2º Contacto", "Pago", "Pré-inscrição"].includes(de)) {
    return { ok: false as const, erro: "Passe primeiro a 2.º contacto ou Pago, depois complete a pré-inscrição." };
  }
  return { ok: true as const };
}

export function isSecretariaRole(role: string, regime: "gold" | "fin" = "gold") {
  if (role === "admin" || role === "secretaria") return true;
  return regime === "fin" && role === "financiada";
}

export function badgeEstadoCls(estado: string) {
  const m: Record<string, string> = {
    "1º Contacto": "bg-blue-50 text-blue-700 border-blue-200",
    "2º Contacto": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Não contactado": "bg-amber-50 text-amber-700 border-amber-200",
    Pago: "bg-teal-50 text-teal-700 border-teal-200",
    "Pré-inscrição": "bg-violet-50 text-violet-800 border-violet-200",
    Formando: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Desistiu: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return m[estado] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

export function fmtRelativo(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  if (dias < 8) return `há ${dias} d`;
  return d.toLocaleDateString("pt-PT");
}
