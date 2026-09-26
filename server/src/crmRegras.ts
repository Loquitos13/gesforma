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

export const CRM_FECHADOS = ["Formando", "Desistiu"] as const;

export const MOTIVOS_DESISTENCIA = [
  "Preço",
  "Horário",
  "Local",
  "Sem vagas",
  "Concorrência",
  "Silêncio",
  "Não elegível",
  "Outro",
] as const;

export const RESULTADOS_CONTACTO = [
  "Atendeu",
  "Não atendeu",
  "Mailbox",
  "Interessado",
  "A pensar",
  "Recusou",
] as const;

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

export function estadoPodeEntregar(estado: string) {
  return estado === "Pré-inscrição";
}

export function podeArrastar(de: string, para: string, opts: { role: string; secretariaEm?: string | null; motivo?: string }) {
  if (de === para) return { ok: true as const };
  if (de === "Formando") return { ok: false as const, erro: "Um formando não volta no funil. Crie um novo pedido se precisar." };
  if (para === "Desistiu") return { ok: true as const };
  if (para === "Formando") {
    if (opts.role !== "admin" && opts.role !== "secretaria") {
      return { ok: false as const, erro: "Só a secretaria inscreve na turma (Formando)." };
    }
    if (!opts.secretariaEm) {
      return { ok: false as const, erro: "A pré-inscrição ainda não foi entregue à secretaria." };
    }
    return { ok: true as const };
  }
  if (para === "Pré-inscrição" && !["2º Contacto", "Pago", "Pré-inscrição"].includes(de)) {
    return { ok: false as const, erro: "Passe primeiro a 2.º contacto ou Pago, depois complete a pré-inscrição." };
  }
  return { ok: true as const };
}
