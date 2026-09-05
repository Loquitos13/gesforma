import { useEffect, useMemo, useState } from "react";

type DtpRegime = "gold" | "fin";
type DtpFase = "antes" | "durante" | "depois";
type DtpEstado = "ok" | "parcial" | "falta";

type DtpDoc = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  detalhe: string;
  estado: DtpEstado;
};

type Props = {
  regime: DtpRegime;
  onBack: () => void;
  onPresencas?: () => void;
};

const fases: { id: DtpFase; label: string; hint: string }[] = [
  { id: "antes", label: "Antes da ação", hint: "Abre o DTP no dia em que a turma é aprovada." },
  { id: "durante", label: "Durante", hint: "O que só se recolhe em sala — não se reconstitui depois." },
  { id: "depois", label: "Fecho", hint: "Sem isto a ação não se encerra nem se emite certificado." },
];

function docsGold(): DtpDoc[] {
  return [
    { id: "id-acao", fase: "antes", label: "Identificação da ação", fonte: "DGERT · Portaria 851/2010", detalhe: "Designação, 90h CCP, b-learning, V.N.Gaia, Sábado manhã, 07/09–16/11/2026.", estado: "ok" },
    { id: "programa", fase: "antes", label: "Programa de formação", fonte: "DGERT · Portaria 851/2010 a)", detalhe: "Objetivos, conteúdos, metodologias, critérios de avaliação, carga horária, recursos e espaços.", estado: "ok" },
    { id: "regulamento", fase: "antes", label: "Regulamento de formação", fonte: "DGERT · Portaria 851/2010", detalhe: "Regulamento da ENA aceite pelos 10 formandos da turma.", estado: "ok" },
    { id: "divulgacao", fase: "antes", label: "Divulgação da ação", fonte: "DGERT · Portaria 851/2010 aa)", detalhe: "Campanha «Setembro 2023» · landing ena.pt/ccp · Facebook Ads.", estado: "ok" },
    { id: "fichas", fase: "antes", label: "Fichas de inscrição", fonte: "DGERT · Portaria 851/2010 f)", detalhe: "10 fichas · origem website e campanha.", estado: "ok" },
    { id: "contratos-f", fase: "antes", label: "Contratos de formação (formandos)", fonte: "DGERT · Portaria 851/2010 i)", detalhe: "8/10 assinados. Faltam Inês Caetano e Susana Santos.", estado: "parcial" },
    { id: "contrato-formador", fase: "antes", label: "Contrato do formador", fonte: "DGERT · Portaria 851/2010 i)", detalhe: "Isac Silva · contrato 2026/CCP-17.", estado: "ok" },
    { id: "cv-formador", fase: "antes", label: "CV do formador", fonte: "IEFP · Anexo 5 DTP", detalhe: "CV atualizado em 2026-04-12.", estado: "ok" },
    { id: "ccp-formador", fase: "antes", label: "CCP / CCPE do formador", fonte: "IEFP · Anexo 5 DTP", detalhe: "CCP n.º F-44821 · válido. Sem isto o DTP de um curso de formadores falha.", estado: "ok" },
    { id: "habil-formador", fase: "antes", label: "Qualificação de nível superior do formador", fonte: "IEFP · Anexo 5 DTP", detalhe: "Licenciatura em Ciências da Educação.", estado: "ok" },
    { id: "exp-formandos", fase: "antes", label: "Comprovativo de 5 anos de experiência (formandos)", fonte: "IEFP · Anexo 5 · acesso FPIF", detalhe: "Obrigatório no CCP. 7/10 com declaração; 3 em falta.", estado: "parcial" },
    { id: "rgpd", fase: "antes", label: "Autorizações RGPD / imagem / dados digitais", fonte: "IEFP · Anexo 5 · RGPD", detalhe: "Necessário em b-learning (gravação de sessões).", estado: "parcial" },
    { id: "recibos", fase: "antes", label: "Comprovativos de pagamento / recibos", fonte: "Gold · autofinanciada", detalhe: "8 pagos · 2 pendentes (€250). Específico do regime comercial.", estado: "parcial" },
    { id: "cronograma", fase: "antes", label: "Cronograma da ação", fonte: "DGERT / IEFP", detalhe: "12 sábados · 09h–13h + 4 síncronas online.", estado: "ok" },
    { id: "planos", fase: "antes", label: "Planos de sessão", fonte: "DGERT · Portaria 851/2010 j)", detalhe: "12/16 planos carregados.", estado: "parcial" },
    { id: "sumarios", fase: "durante", label: "Sumários assinados pelo formador", fonte: "DGERT · Portaria 851/2010 l)", detalhe: "3/16 sessões. Sem sumário a sessão não existiu para auditoria.", estado: "falta" },
    { id: "presencas", fase: "durante", label: "Folhas de presença (formandos + formador)", fonte: "DGERT · Portaria 851/2010 l)", detalhe: "Assinatura do formador por período (manhã). Gold também precisa disto.", estado: "parcial" },
    { id: "pip", fase: "durante", label: "Projeto de intervenção pedagógica (PIP)", fonte: "IEFP · Anexo 5 · FPIF", detalhe: "Exclusivo CCP. 0/10 projetos arquivados.", estado: "falta" },
    { id: "sim-ini", fase: "durante", label: "Simulação pedagógica inicial", fonte: "IEFP · Anexo 5 · FPIF", detalhe: "Grelhas de observação em falta.", estado: "falta" },
    { id: "sim-fim", fase: "durante", label: "Simulação pedagógica final", fonte: "IEFP · Anexo 5 · FPIF", detalhe: "Aguardar módulo final.", estado: "falta" },
    { id: "instrumentos", fase: "durante", label: "Instrumentos de avaliação (enunciados / grelhas)", fonte: "DGERT · Portaria 851/2010 m) n)", detalhe: "Classificação sem instrumento não é verificável.", estado: "falta" },
    { id: "ocorrencias", fase: "durante", label: "Registo de ocorrências", fonte: "DGERT · Portaria 851/2010 r)", detalhe: "Desistências, troca de formador, alteração de calendário — com data e motivo.", estado: "ok" },
    { id: "materiais", fase: "durante", label: "Materiais e textos de apoio", fonte: "DGERT · Portaria 851/2010", detalhe: "Manual CCP + slides módulos 1–3.", estado: "parcial" },
    { id: "pauta", fase: "depois", label: "Pauta / classificação final", fonte: "DGERT · Portaria 851/2010 o)", detalhe: "Ação ainda a decorrer.", estado: "falta" },
    { id: "satisfacao", fase: "depois", label: "Avaliação de satisfação dos formandos", fonte: "DGERT · Portaria 851/2010 q)", detalhe: "Questionário de reação no último dia.", estado: "falta" },
    { id: "aval-formador", fase: "depois", label: "Avaliação de desempenho do formador", fonte: "DGERT · Portaria 851/2010 p)", detalhe: "Coordenador pedagógico.", estado: "falta" },
    { id: "certificados", fase: "depois", label: "Comprovativo de entrega dos certificados", fonte: "DGERT · s) · NetForce / SIGO", detalhe: "CCP emitido no Portal NetForce após pauta.", estado: "falta" },
    { id: "relatorio", fase: "depois", label: "Relatório final de avaliação da ação", fonte: "DGERT · Portaria 851/2010 t)", detalhe: "Fecha o DTP. Sem relatório a ação não se arquiva.", estado: "falta" },
  ];
}

function docsFin(): DtpDoc[] {
  return [
    { id: "id-acao", fase: "antes", label: "Identificação da ação", fonte: "DGERT · Portaria 851/2010", detalhe: "UFCD 3564 · Primeiros Socorros · 25h · e-learning · Sala Virtual.", estado: "ok" },
    { id: "ufcd", fase: "antes", label: "Referencial / código UFCD", fonte: "Financiada · Catálogo SNQ", detalhe: "UFCD 3564 · 25 horas. Obrigatório no financiado; no Gold comercial pode não existir.", estado: "ok" },
    { id: "programa", fase: "antes", label: "Programa de formação", fonte: "DGERT · Portaria 851/2010 a)", detalhe: "Objetivos, conteúdos, metodologias, avaliação, recursos e espaços.", estado: "ok" },
    { id: "regulamento", fase: "antes", label: "Regulamento de formação", fonte: "DGERT · Portaria 851/2010", detalhe: "Regulamento ENA + regras do programa financiador.", estado: "ok" },
    { id: "enquadramento", fase: "antes", label: "Enquadramento / documentação do financiador", fonte: "Programa de financiamento", detalhe: "Candidatura, despacho ou regras da tipologia. Específico da Financiada.", estado: "parcial" },
    { id: "instalacoes", fase: "antes", label: "Locais, recursos e infraestruturas", fonte: "Despacho 5756/2020 h)", detalhe: "Sala virtual Moodle · plataforma síncrona · kit primeiros socorros.", estado: "ok" },
    { id: "divulgacao", fase: "antes", label: "Divulgação da ação", fonte: "DGERT · Portaria 851/2010 aa)", detalhe: "Newsletter + site ena.pt/financiada.", estado: "ok" },
    { id: "fichas", fase: "antes", label: "Fichas de inscrição e requisitos de acesso", fonte: "DGERT · f) · programa", detalhe: "4 inscritos. Elegibilidade ainda incompleta.", estado: "parcial" },
    { id: "cc", fase: "antes", label: "Cartão de cidadão (dossier formando)", fonte: "Financiada · elegibilidade", detalhe: "3/4. Mariana Sousa Pereira em falta.", estado: "parcial" },
    { id: "ch", fase: "antes", label: "Certificado de habilitações", fonte: "Financiada · elegibilidade", detalhe: "1/4 validado.", estado: "falta" },
    { id: "cv-formando", fase: "antes", label: "Curriculum vitae do formando", fonte: "Financiada · elegibilidade", detalhe: "1/4 validado.", estado: "falta" },
    { id: "iban", fase: "antes", label: "IBAN / comprovativo de NIB", fonte: "Financiada · processamento", detalhe: "2/4. Sem IBAN não há pagamento de apoios.", estado: "parcial" },
    { id: "emprego", fase: "antes", label: "Comprovativo de situação perante o emprego", fonte: "Financiada · IEFP / tipologia", detalhe: "Declaração de desemprego ou contrato. 1/4.", estado: "falta" },
    { id: "contratos-f", fase: "antes", label: "Contratos de formação (formandos)", fonte: "DGERT · Portaria 851/2010 i)", detalhe: "2/4 assinados. Turma bloqueada até dossier completo.", estado: "parcial" },
    { id: "contrato-formador", fase: "antes", label: "Contrato do formador", fonte: "DGERT · Portaria 851/2010 i)", detalhe: "Neuza Gomes.", estado: "ok" },
    { id: "cv-formador", fase: "antes", label: "CV do formador", fonte: "DGERT / IEFP", detalhe: "Arquivado.", estado: "ok" },
    { id: "ccp-formador", fase: "antes", label: "CCP / CCPE do formador", fonte: "DGERT · requisitos do formador", detalhe: "CCP válido · Neuza Gomes.", estado: "ok" },
    { id: "rgpd", fase: "antes", label: "Autorizações RGPD / dados digitais", fonte: "RGPD · e-learning", detalhe: "4/4 aceites no momento da inscrição.", estado: "ok" },
    { id: "cronograma", fase: "antes", label: "Cronograma / plano semanal", fonte: "Despacho 5756/2020 g)", detalhe: "5 sessões síncronas + trabalho assíncrono (25h).", estado: "ok" },
    { id: "planos", fase: "antes", label: "Planos de sessão", fonte: "DGERT · Portaria 851/2010 j)", detalhe: "5 planos carregados.", estado: "ok" },
    { id: "sumarios", fase: "durante", label: "Sumários (presencial, síncrona e assíncrona)", fonte: "Despacho 5756/2020 e) f)", detalhe: "Em e-learning o sumário assíncrono também conta. 2/5.", estado: "parcial" },
    { id: "presencas", fase: "durante", label: "Presenças por sessão + participação online", fonte: "DGERT l) · Despacho 5756/2020 e) f)", detalhe: "Grelha da turma · assiduidade em % e em horas da UFCD.", estado: "parcial" },
    { id: "horas", fase: "durante", label: "Mapa de assiduidade em horas (carga UFCD)", fonte: "Financiada · execução", detalhe: "25h de referência. % de sessões não chega — o financiador pede horas.", estado: "falta" },
    { id: "instrumentos", fase: "durante", label: "Instrumentos de avaliação + enunciados", fonte: "DGERT · Portaria 851/2010 m) n)", detalhe: "Teste diagnóstico por carregar.", estado: "falta" },
    { id: "ocorrencias", fase: "durante", label: "Registo de ocorrências", fonte: "DGERT · Portaria 851/2010 r)", detalhe: "Sem ocorrências registadas.", estado: "ok" },
    { id: "materiais", fase: "durante", label: "Manuais e textos de apoio", fonte: "Despacho 5756/2020 o)", detalhe: "Manual UFCD 3564 na plataforma.", estado: "ok" },
    { id: "pauta", fase: "depois", label: "Pauta, classificações e ata de avaliação", fonte: "Despacho 5756/2020 k)", detalhe: "Ação a montar / a decorrer.", estado: "falta" },
    { id: "satisfacao", fase: "depois", label: "Avaliação de reação (formandos, formador, coordenador)", fonte: "Despacho 5756/2020 l)", detalhe: "Questionários no fecho.", estado: "falta" },
    { id: "certificados", fase: "depois", label: "Certificados / registo SIGO", fonte: "DGERT · s) · SNQ", detalhe: "UFCD certificada via SIGO após pauta e assiduidade.", estado: "falta" },
    { id: "execucao", fase: "depois", label: "Relatório de execução da ação", fonte: "Financiada · Despacho 5756/2020 j)", detalhe: "Horas, formandos, desistências, execução financeira. Específico do financiado.", estado: "falta" },
    { id: "relatorio", fase: "depois", label: "Relatório final de avaliação da ação", fonte: "DGERT · Portaria 851/2010 t)", detalhe: "Fecha o DTP pedagógico.", estado: "falta" },
  ];
}

const estadoStyle: Record<DtpEstado, { badge: string; row: string; label: string }> = {
  ok: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", row: "border-emerald-100 bg-white", label: "No dossiê" },
  parcial: { badge: "bg-amber-50 text-amber-700 border-amber-200", row: "border-amber-100 bg-amber-50/40", label: "Parcial" },
  falta: { badge: "bg-red-50 text-red-600 border-red-200", row: "border-red-100 bg-red-50/50", label: "Em falta" },
};

function cycle(estado: DtpEstado): DtpEstado {
  if (estado === "falta") return "parcial";
  if (estado === "parcial") return "ok";
  return "falta";
}

export function DtpView({ regime, onBack, onPresencas }: Props) {
  const isGold = regime === "gold";
  const [fase, setFase] = useState<DtpFase | "todas">("todas");
  const [items, setItems] = useState<DtpDoc[]>(() => (isGold ? docsGold() : docsFin()));

  useEffect(() => {
    setFase("todas");
    setItems(isGold ? docsGold() : docsFin());
  }, [isGold]);

  const meta = isGold
    ? {
        codigo: "VNG-SM-07/09",
        titulo: "Formação de Formadores — CCP",
        sub: "Gold / autofinanciada · 90h · b-learning · V.N.Gaia",
        arquivo: "Arquivar até setembro 2036 · 10 anos (IEFP, formação pedagógica)",
        accent: "amber",
        bloqueio: "Não emitir CCP enquanto PIP, simulações e sumários estiverem em falta.",
      }
    : {
        codigo: "UFCD 3564",
        titulo: "Primeiros Socorros",
        sub: "Financiada · 25h · e-learning · Sala Virtual",
        arquivo: "Arquivar até setembro 2036 · prazo do programa ou 5–10 anos (o mais longo)",
        bloqueio: "A turma não arranca: dossiers de elegibilidade incompletos (CH, CV, emprego).",
        accent: "blue",
      };

  const visiveis = useMemo(
    () => (fase === "todas" ? items : items.filter((d) => d.fase === fase)),
    [items, fase],
  );

  const total = items.length;
  const ok = items.filter((d) => d.estado === "ok").length;
  const parcial = items.filter((d) => d.estado === "parcial").length;
  const falta = items.filter((d) => d.estado === "falta").length;
  const pct = Math.round(((ok + parcial * 0.5) / total) * 100);
  const podeEncerrar = falta === 0 && parcial === 0;

  function toggle(id: string) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, estado: cycle(d.estado) } : d)));
  }

  const bar = isGold ? (pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444") : (pct >= 80 ? "#10B981" : pct >= 50 ? "#2563EB" : "#EF4444");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={onBack} className={`hover:underline ${isGold ? "hover:text-amber-600" : "hover:text-blue-600"}`}>
          {isGold ? "Turmas Gold" : "Turmas Financiadas"}
        </button>
        <span>›</span>
        <span className="font-semibold text-slate-700">Dossiê técnico-pedagógico</span>
      </div>

      <div className={`rounded-2xl p-5 text-white ${isGold ? "bg-gradient-to-br from-[#0F172A] to-[#1E293B]" : "bg-gradient-to-br from-[#1E3A8A] to-[#1E293B]"}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isGold ? "bg-amber-500" : "bg-blue-500"}`}>{meta.codigo}</span>
              <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/10">DTP por ação</span>
              <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/10">{isGold ? "Modelo Gold" : "Modelo Financiada"}</span>
            </div>
            <p className="text-lg font-bold">{meta.titulo}</p>
            <p className="text-xs text-slate-300 mt-1">{meta.sub}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {onPresencas && (
              <button onClick={onPresencas} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors">
                Folha de presenças
              </button>
            )}
            <button className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${isGold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-500 hover:bg-blue-600"}`}>
              Exportar pasta DTP
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">{ok} no dossiê · {parcial} parciais · {falta} em falta · {total} documentos</span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5">
            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bar }} />
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3">{meta.arquivo}</p>
      </div>

      <div className={`rounded-xl border p-4 flex gap-3 ${podeEncerrar ? "bg-emerald-50 border-emerald-200" : isGold ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${podeEncerrar ? "bg-emerald-100 text-emerald-700" : isGold ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
          {podeEncerrar ? "✓" : "!"}
        </div>
        <div>
          <p className={`text-sm font-bold ${podeEncerrar ? "text-emerald-800" : isGold ? "text-amber-800" : "text-blue-800"}`}>
            {podeEncerrar ? "DTP completo — ação pronta a arquivar e a certificar." : meta.bloqueio}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {isGold
              ? "Núcleo DGERT comum + extras CCP (PIP, simulações, 5 anos de experiência) + recibos do regime comercial."
              : "Núcleo DGERT comum + extras de financiamento (UFCD, elegibilidade, IBAN, execução, horas)."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {fases.map((f) => {
          const subset = items.filter((d) => d.fase === f.id);
          const done = subset.filter((d) => d.estado === "ok").length;
          return (
            <button
              key={f.id}
              onClick={() => setFase((prev) => (prev === f.id ? "todas" : f.id))}
              className={`text-left rounded-xl border p-3 transition-colors ${fase === f.id ? (isGold ? "border-amber-400 bg-amber-50" : "border-blue-400 bg-blue-50") : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <p className="text-xs font-bold text-slate-700">{f.label}</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{done}/{subset.length}</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{f.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {fase === "todas" ? "Todos os documentos desta ação" : fases.find((f) => f.id === fase)?.label}
            </p>
            <p className="text-xs text-slate-400">Clica no estado para simular validação. Fonte legal à direita.</p>
          </div>
          <button onClick={() => setFase("todas")} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Ver tudo
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {visiveis.map((doc) => {
            const s = estadoStyle[doc.estado];
            return (
              <div key={doc.id} className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${s.row}`}>
                <button
                  onClick={() => toggle(doc.id)}
                  className={`self-start sm:self-center text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${s.badge}`}
                >
                  {s.label}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{doc.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.detalhe}</p>
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-right sm:max-w-[180px]">{doc.fonte}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
