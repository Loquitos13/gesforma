import { pdfDeLinhas } from "./pdfTexto.js";

type Sessao = {
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  modalidade?: string;
  modulos?: string[];
  formadores?: string[];
  formador?: string;
};

type Plano = {
  objetivosGerais?: string;
  objetivosEspecificos?: string;
  momentos?: Record<string, { conteudo?: string; atividades?: string; metodos?: string; recursos?: string }>;
};

type Sumario = {
  conteudos?: string;
  atividades?: string;
  observacoes?: string;
  assinado?: boolean;
};

type Presenca = { nome?: string; presente?: boolean };

export type SessaoPedagogicaPdf = {
  n: number;
  plano: Plano | null;
  sumario: Sumario | null;
  presencas: Presenca[];
};

function asSessoes(v: unknown): Sessao[] {
  return Array.isArray(v) ? v.filter(x => x && typeof x === "object") as Sessao[] : [];
}

function lectiva(s: Sessao) {
  const m = s.modalidade ?? "presencial";
  return m === "presencial" || m === "sincrona";
}

function nomes(s: Sessao) {
  const lista = (s.formadores ?? []).map(x => x.trim()).filter(Boolean);
  if (lista.length) return lista.join(", ");
  return (s.formador ?? "").trim() || "por definir";
}

function modulos(s: Sessao) {
  return (s.modulos ?? []).filter(Boolean).join(", ") || "-";
}

function dataPt(iso?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function linhaSumario(sumario: Sumario | null) {
  if (!sumario?.conteudos?.trim()) return ["Sumario: ainda por preencher."];
  return [
    "Sumario da sessao",
    `  Conteudos: ${sumario.conteudos.trim()}`,
    sumario.atividades?.trim() ? `  Atividades: ${sumario.atividades.trim()}` : "",
    sumario.observacoes?.trim() ? `  Observacoes: ${sumario.observacoes.trim()}` : "",
    `  Assinado pelo formador: ${sumario.assinado ? "sim" : "nao"}`,
  ].filter(Boolean);
}

export function pdfsDoDossie(opts: {
  turma: string;
  curso: string;
  local?: string;
  horario?: string;
  cronograma: unknown;
  sessoes: SessaoPedagogicaPdf[];
  formandos: string[];
}) {
  const todas = asSessoes(opts.cronograma);
  const lectivas = todas.filter(lectiva);
  const cab = [
    "ENA · Escola de Negocios e Administracao",
    opts.turma,
    opts.curso,
    [opts.local, opts.horario].filter(Boolean).join(" · "),
    "",
  ].filter((x, i) => i < 4 || x !== "");

  const cronograma = pdfDeLinhas([
    ...cab,
    "Cronograma da turma",
    "",
    ...(todas.length ? todas.map((s, i) => {
      const tipo = s.modalidade ?? "presencial";
      return `${String(i + 1).padStart(2, "0")}  ${dataPt(s.data)}  ${s.horaInicio || "--:--"}-${s.horaFim || "--:--"}  ${tipo}  ${modulos(s)}  ${nomes(s)}`;
    }) : ["Ainda sem sessoes neste cronograma."]),
  ]);

  const folhasLinhas = [...cab, "Folhas de presenca", "O sumario da sessao vai nesta folha.", ""];
  if (!lectivas.length) folhasLinhas.push("Ainda sem sessoes lectivas.");
  lectivas.forEach((s, i) => {
    const ped = opts.sessoes.find(x => x.n === i + 1);
    folhasLinhas.push(`Sessao ${i + 1}  ${dataPt(s.data)}  ${s.horaInicio || ""}-${s.horaFim || ""}`);
    folhasLinhas.push(`Modulo: ${modulos(s)}`);
    folhasLinhas.push(`Formador: ${nomes(s)}`);
    folhasLinhas.push("");
    const lista = ped?.presencas?.length ? ped.presencas.map(p => p.nome || "").filter(Boolean) : opts.formandos;
    if (!lista.length) folhasLinhas.push("  Sem formandos inscritos.");
    lista.forEach((nome, n) => {
      const presente = ped?.presencas?.find(p => (p.nome || "") === nome);
      const marca = presente ? (presente.presente ? "presente" : "falta") : "por marcar";
      folhasLinhas.push(`  ${String(n + 1).padStart(2, "0")}  ${nome}  ${marca}`);
    });
    folhasLinhas.push("");
    folhasLinhas.push(...linhaSumario(ped?.sumario ?? null));
    folhasLinhas.push("");
  });

  const planosLinhas = [...cab, "Planos de sessao", ""];
  if (!lectivas.length) planosLinhas.push("Ainda sem sessoes lectivas.");
  lectivas.forEach((s, i) => {
    const plano = opts.sessoes.find(x => x.n === i + 1)?.plano;
    planosLinhas.push(`Sessao ${i + 1}  ${dataPt(s.data)}  ${s.horaInicio || ""}-${s.horaFim || ""}`);
    planosLinhas.push(`Modulo: ${modulos(s)}    Formador: ${nomes(s)}`);
    if (!plano?.objetivosGerais?.trim() && !plano?.objetivosEspecificos?.trim()) {
      planosLinhas.push("  Plano ainda por preencher.");
    } else {
      if (plano.objetivosGerais?.trim()) planosLinhas.push(`  Objetivos gerais: ${plano.objetivosGerais.trim()}`);
      if (plano.objetivosEspecificos?.trim()) planosLinhas.push(`  Objetivos especificos: ${plano.objetivosEspecificos.trim()}`);
      for (const [k, m] of Object.entries(plano.momentos ?? {})) {
        const texto = [m.conteudo, m.atividades, m.metodos, m.recursos].filter(Boolean).join(" · ");
        if (texto) planosLinhas.push(`  ${k}: ${texto}`);
      }
    }
    planosLinhas.push("");
  });

  return {
    cronograma,
    folhas: pdfDeLinhas(folhasLinhas),
    planos: pdfDeLinhas(planosLinhas),
  };
}
