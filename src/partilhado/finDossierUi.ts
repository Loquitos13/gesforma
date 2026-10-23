import { docsFinCompletos } from "./dossierDocs";
import type { FormandoFin } from "./tiposFormando";
import type { PedagogiaSnapshot } from "./api";
import { formatSessaoLabel, isSessaoLectiva, type ProgramaDocumentos, type SessaoCronograma } from "./turmaModel";
import { rotuloCodigoCurso } from "./codigoCurso";

export type DocEstado = "ok" | "parcial" | "falta";

export type FinDocItem = {
  label: string;
  detalhe: string;
  estado: DocEstado;
  bloqueante?: boolean;
  /** Item do dossiê (servidor) que dá o estado deste documento. */
  dtpId?: string;
};

export type FinDocGrupo = {
  id: string;
  label: string;
  color: string;
  items: FinDocItem[];
};

function st(done: number, total: number): DocEstado {
  if (total <= 0) return "falta";
  if (done >= total) return "ok";
  if (done > 0) return "parcial";
  return "falta";
}

function contarDoc(formandos: FormandoFin[], key: string) {
  const done = formandos.filter(f => {
    const v = (f as Record<string, unknown>)[key];
    if (v && typeof v === "object" && "ok" in (v as object)) return Boolean((v as { ok?: boolean }).ok);
    return false;
  }).length;
  return { done, total: formandos.length };
}

/** Grupos do dossiê turma financiada calculados a partir da turma real (não seed estático). */
export function finGruposDocumentosTurma(input: {
  formandos: FormandoFin[];
  facts: PedagogiaSnapshot["dtp"]["facts"];
  cronograma: SessaoCronograma[];
  curso?: string;
  ufcdCod?: string;
  horas?: number;
  dtpPct?: number;
  programa?: ProgramaDocumentos | null;
}): FinDocGrupo[] {
  const { formandos, facts, cronograma, curso, ufcdCod, horas, dtpPct, programa } = input;
  const totalF = formandos.length;
  const prontos = formandos.filter(f => docsFinCompletos(f)).length;
  // Planos, sumários e presenças só existem nas sessões lectivas (presencial e síncrona).
  const sessoes = cronograma.filter(isSessaoLectiva).length;
  const cc = contarDoc(formandos, "cc");
  const ch = contarDoc(formandos, "ch");
  const cu = contarDoc(formandos, "cu");
  const ci = contarDoc(formandos, "ci");
  const ce = contarDoc(formandos, "ce");
  const contr = contarDoc(formandos, "contrato");
  const relatorioOk = (dtpPct ?? 0) >= 95;

  return [
    {
      id: "turma",
      label: "Documentos da turma",
      color: "bg-blue-50 border-blue-200 text-blue-800",
      items: [
        {
          label: "Programa de formação UFCD",
          detalhe: ufcdCod ? `${rotuloCodigoCurso(ufcdCod)} · ${curso ?? "—"} · ${horas ?? "—"}h` : (curso ?? "Curso"),
          estado: curso ? "ok" : "falta",
          dtpId: "programa",
        },
        { label: "Regulamento de formação", detalhe: "Regulamento ENA e regras do financiador. Ainda não registado nesta turma.", estado: "falta", dtpId: "regulamento" },
        {
          label: "Cronograma da turma",
          detalhe: `${sessoes} sessões planeadas${sessoes ? "" : " · falta cronograma"}`,
          estado: st(facts.sessoes.total > 0 ? facts.sessoes.total : sessoes, Math.max(sessoes, 1)),
          dtpId: "cronograma",
        },
        {
          label: "Enquadramento do financiador",
          detalhe: programa?.nome
            ? `Programa «${programa.nome}» ${programa.origem === "turma" ? "(escolhido na turma)" : programa.origem === "curso" ? "(o da ficha do curso)" : "(o primeiro activo: escolha-o no curso ou na turma)"} · sai na ficha de inscrição e na folha de presenças.`
            : "Sem programa: crie-o em Edição de cursos › Programas e escolha-o no curso ou na turma.",
          estado: programa?.nome && programa.origem !== "primeiro" ? "ok" : "falta",
        },
        {
          label: "Relatório de execução",
          detalhe: relatorioOk ? "DTP pronto para fecho." : `DTP a ${dtpPct ?? 0}% · falta concluir dossiê`,
          estado: relatorioOk ? "ok" : "falta",
          bloqueante: true,
          dtpId: "relatorio",
        },
      ],
    },
    {
      id: "sessoes",
      label: "Documentos das sessões",
      color: "bg-slate-50 border-slate-200 text-slate-700",
      items: [
        {
          label: "Planos de sessão",
          detalhe: `${facts.planos.done}/${facts.planos.total || sessoes} planos`,
          estado: st(facts.planos.done, facts.planos.total || sessoes),
          bloqueante: true,
          dtpId: "planos",
        },
        {
          label: "Sumários assinados",
          detalhe: `${facts.sumarios.done}/${facts.sumarios.total || sessoes} sumários`,
          estado: st(facts.sumarios.done, facts.sumarios.total || sessoes),
        },
        {
          label: "Folhas de presença",
          detalhe: `${facts.presencas.done}/${facts.presencas.total || sessoes} sessões com presenças validadas`,
          estado: st(facts.presencas.done, facts.presencas.total || sessoes),
          dtpId: "presencas",
        },
        {
          label: "Mapa de assiduidade em horas",
          detalhe: facts.presencas.done > 0 ? "Calculado a partir das presenças registadas." : "Obrigatório no regime financiado.",
          estado: facts.presencas.done >= Math.max(1, Math.floor(sessoes * 0.8)) && sessoes > 0 ? "ok" : facts.presencas.done > 0 ? "parcial" : "falta",
          bloqueante: true,
        },
      ],
    },
    {
      id: "formandos",
      label: "Documentos dos formandos",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      items: [
        { label: "Elegibilidade (8 documentos)", detalhe: `${prontos}/${totalF} com dossier completo`, estado: st(prontos, totalF), bloqueante: true },
        { label: "Contratos de formação", detalhe: `${contr.done}/${contr.total} validados`, estado: st(contr.done, contr.total) },
        { label: "Cartão de cidadão", detalhe: `${cc.done}/${cc.total}`, estado: st(cc.done, cc.total), dtpId: "cc" },
        { label: "Certificado de habilitações", detalhe: `${ch.done}/${ch.total}`, estado: st(ch.done, ch.total), dtpId: "ch" },
        { label: "Curriculum vitae", detalhe: `${cu.done}/${cu.total}`, estado: st(cu.done, cu.total), dtpId: "cv-formando" },
        { label: "IBAN", detalhe: `${ci.done}/${ci.total} · sem IBAN não há apoios`, estado: st(ci.done, ci.total), bloqueante: ci.total > 0 && ci.done < ci.total, dtpId: "iban" },
        { label: "Comprovativo de emprego", detalhe: `${ce.done}/${ce.total}`, estado: st(ce.done, ce.total), dtpId: "entidade-patronal" },
      ],
    },
    {
      id: "formadores",
      label: "Documentos dos formadores",
      color: "bg-violet-50 border-violet-200 text-violet-800",
      items: [
        // O estado vem do dossiê (documentos na ficha de cada formador da turma).
        { label: "CCP / CCPE do formador", detalhe: "Carregar na ficha do formador.", estado: "falta", dtpId: "ccp-formador" },
        { label: "CV do formador", detalhe: "Carregar na ficha do formador.", estado: "falta", dtpId: "cv-formador" },
        { label: "Contrato do formador", detalhe: "Contrato do formador desta ação.", estado: "falta", dtpId: "contrato-formador" },
      ],
    },
  ];
}

export function labelsSessoesFin(cronograma: SessaoCronograma[]) {
  if (!cronograma.length) return ["Ainda sem sessões no cronograma"];
  return cronograma.map((s, i) => `Sessão ${i + 1} · ${formatSessaoLabel(s.data)}`);
}
