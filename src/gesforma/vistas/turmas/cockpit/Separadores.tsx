import { type ExportTurmaInfo } from "../../../ActionSurfaces";
import { sumarioPreenchido, type PlanoSessaoData, type SessaoMeta, type SumarioSessaoData } from "../../../../partilhado/TurmaExtras";
import { SearchSelect } from "../../../../partilhado/FormKit";
import { imprimirFolhasPresencas } from "../../../../partilhado/presencasPrint";
import { sessaoFormadores, sessaoModulos } from "../../../../partilhado/turmaModel";
import { type PresencaRow } from "../../../PedagogiaContext";
import { type Separador as CockpitTab } from "../../../rotasGesforma";
import { estadoBadge, Card, NewBtn, Th, Td, I } from "./base";
export { type DocEstado, type DocItem } from "./documentosDados";
export { DocumentosTurmaTab, cloneGrupos } from "./Documentos";
export { CertificadosTurmaTab } from "./Certificados";

export function ModulosCell({ sessao }: { sessao: { modulo?: string; modulos?: string[] } }) {
  const list = sessaoModulos(sessao);
  if (!list.length) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex flex-col gap-0.5 min-w-[10rem] max-w-[16rem]">
      {list.map(m => (
        <span key={m} className="text-xs text-slate-700 leading-snug">{m}</span>
      ))}
    </div>
  );
}

export function FormadoresCell({
  sessao, onOpen,
}: {
  sessao: { formador?: string; formadores?: string[] };
  onOpen?: (nome: string) => void;
}) {
  const list = sessaoFormadores(sessao);
  if (!list.length) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex flex-col gap-0.5 min-w-[8rem] max-w-[14rem]">
      {list.map(nome => onOpen ? (
        <button key={nome} type="button" onClick={() => onOpen(nome)} className="text-left text-xs font-medium text-slate-700 hover:text-violet-700">
          {nome}
        </button>
      ) : (
        <span key={nome} className="text-xs font-medium text-slate-700">{nome}</span>
      ))}
    </div>
  );
}

export function sumarioLabel(s?: SumarioSessaoData) {
  if (s?.assinado && sumarioPreenchido(s)) return "Ver sumário";
  if (sumarioPreenchido(s)) return "Assinar sumário";
  return "+ Preencher sumário";
}

export function sumarioBtnCls(s: SumarioSessaoData | undefined, gold: boolean) {
  if (s?.assinado && sumarioPreenchido(s)) return "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
  return gold ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
}

export function SessoesTurmaTab({
  accent, turmaNome, cursoNome, sessoes, planos, presencas, sumarios, formandos, onNovaSessao, onPlano, onSumario, onPresencas, onOpenFormador,
  podeEditar, podeCriar = true, formadorOpcoes, onFormador,
}: {
  accent: "gold" | "fin";
  turmaNome: string;
  cursoNome: string;
  sessoes: SessaoMeta[];
  planos: Record<number, PlanoSessaoData>;
  presencas: Record<number, PresencaRow[]>;
  sumarios: Record<number, SumarioSessaoData>;
  formandos: { id: number; nome: string }[];
  onNovaSessao: () => void;
  onPlano: (s: SessaoMeta) => void;
  onSumario: (s: SessaoMeta) => void;
  onPresencas: (s: SessaoMeta) => void;
  onOpenFormador?: (nome: string) => void;
  podeEditar?: (s: SessaoMeta, doc: "plano" | "sumario" | "presencas") => boolean;
  podeOperar?: (s: SessaoMeta) => boolean;
  podeCriar?: boolean;
  formadorOpcoes?: { value: string }[];
  onFormador?: (s: SessaoMeta, nome: string) => void;
}) {
  const gold = accent === "gold";
  const numCls = gold ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";
  const planoTodo = gold ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
  function imprimirFolha(s?: SessaoMeta) {
    imprimirFolhasPresencas({
      turma: turmaNome,
      curso: cursoNome,
      formandos,
      sessoes: s
        ? [{ n: s.n, data: s.data, hora: s.hora, modulo: s.modulos?.join(" · ") || s.modulo, formador: s.formador }]
        : sessoes.map(x => ({ n: x.n, data: x.data, hora: x.hora, modulo: x.modulos?.join(" · ") || x.modulo, formador: x.formador })),
    });
  }
  return (
    <Card>
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-slate-700">Sessões - {turmaNome}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={formandos.length === 0}
            title={formandos.length ? "Folha gerada com todos os inscritos, mesmo antes da sessão" : "Inscreva formandos para gerar a folha"}
            onClick={() => imprimirFolha()}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Imprimir folhas
          </button>
          {podeCriar && <NewBtn accent={accent} label="+ Nova Sessão" onClick={onNovaSessao} />}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Nº</Th><Th>Data / Hora</Th><Th>Módulo</Th><Th>Formadores</Th>
              <Th>Plano de Sessão</Th><Th>Sumário</Th><Th>Presenças</Th><Th>Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessoes.map(s => {
              const sum = sumarios[s.n];
              const temPlano = Boolean(planos[s.n]);
              const folha = presencas[s.n];
              const edita = (doc: "plano" | "sumario" | "presencas") => podeEditar ? podeEditar(s, doc) : true;
              return (
                <tr key={s.n} className="hover:bg-slate-50">
                  <Td><span className={`w-7 h-7 rounded-full ${numCls} text-xs font-bold flex items-center justify-center`}>{s.n}</span></Td>
                  <Td>
                    <p className="text-xs font-medium text-slate-800 whitespace-nowrap">{s.data}</p>
                    <p className="text-xs text-slate-400">{s.hora}</p>
                  </Td>
                  <Td><ModulosCell sessao={s} /></Td>
                  <Td>
                    <FormadoresCell sessao={s} onOpen={onOpenFormador} />
                    {onFormador && formadorOpcoes && (
                      <div className="mt-1 min-w-[10rem]">
                        <SearchSelect
                          value={s.formadores?.[0] || s.formador || ""}
                          onChange={v => onFormador(s, v)}
                          options={formadorOpcoes}
                          placeholder="Formador da sessão…"
                          allowEmpty
                        />
                      </div>
                    )}
                  </Td>
                  <Td>
                    <button type="button" disabled={!edita("plano")} title={edita("plano") ? "" : "Sem permissão nesta sessão"} onClick={() => onPlano(s)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap disabled:opacity-40 ${temPlano ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" : planoTodo}`}>
                      {temPlano ? "Ver plano" : "+ Preencher plano"}
                    </button>
                  </Td>
                  <Td>
                    <button type="button" disabled={!edita("sumario")} title={edita("sumario") ? "" : "Sem permissão nesta sessão"} onClick={() => onSumario(s)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap disabled:opacity-40 ${sumarioBtnCls(sum, gold)}`}>
                      {sumarioLabel(sum)}
                    </button>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 items-start">
                      <button
                        type="button"
                        disabled={formandos.length === 0}
                        title="Folha gerada pela plataforma, disponível antes da sessão"
                        onClick={() => imprimirFolha(s)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                      >
                        Imprimir folha
                      </button>
                      <button
                        type="button"
                        disabled={!edita("presencas")}
                        onClick={() => onPresencas(s)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap disabled:opacity-40 ${
                          folha
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                            : "text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100"
                        }`}
                      >
                        {folha
                          ? `${folha.filter(p => p.presente).length}/${folha.length} presentes`
                          : "Marcar presenças"}
                      </button>
                    </div>
                  </Td>
                  <Td>{estadoBadge(s.estado)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sessoes.length === 0 && (
        <p className="px-4 py-8 text-center text-xs text-slate-400">Ainda não há sessões. Gere o cronograma ou adicione a primeira sessão.</p>
      )}
    </Card>
  );
}

export function TurmaTabBar({ tab, onChange, accent = "gold", dtpPct, dossie = true, so }: { tab: CockpitTab; onChange: (t: CockpitTab) => void; accent?: "gold" | "fin"; dtpPct: number; dossie?: boolean; so?: CockpitTab[] }) {
  const active = accent === "gold" ? "border-amber-500 text-amber-600" : "border-blue-600 text-blue-600";
  const chip = accent === "gold" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";
  const todas: { id: CockpitTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Visão Geral", icon: I.school },
    { id: "cronograma", label: "Cronograma", icon: I.calendar },
    { id: "sessoes", label: "Sessões", icon: I.calendar },
    { id: "avaliacao", label: "Avaliação", icon: I.clipboard },
    { id: "documentos", label: "Documentos", icon: I.file },
    ...(dossie ? [{ id: "dtp" as const, label: "Dossiê TP", icon: I.folder }] : []),
    { id: "certificados", label: "Certificados", icon: I.doc },
  ];
  const tabs = so ? todas.filter(t => so.includes(t.id)) : todas;
  return (
    <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto scrollbar-hide">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 whitespace-nowrap ${tab === t.id ? active : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          {t.icon} {t.label}
          {t.id === "dtp" && <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${chip}`}>{dtpPct}%</span>}
        </button>
      ))}
    </div>
  );
}

export function exportPayload(
  base: { nome: string; curso: string; local: string; formandos: number; accent: "gold" | "fin"; turmaId: number },
  lista: { nome: string; email: string; telf: string; estado: string }[],
  sessoes: SessaoMeta[],
  ped: { sumarios: Record<number, SumarioSessaoData>; presencas: Record<number, PresencaRow[]>; dtp: { items: { label: string; estado: string; detalhe: string }[] } },
): ExportTurmaInfo {
  return {
    ...base,
    regime: base.accent,
    lista,
    sessoes: sessoes.map(x => ({
      n: x.n,
      data: x.data,
      hora: x.hora,
      modulo: x.modulo,
      formador: x.formador,
      sumario: Boolean(ped.sumarios[x.n]?.assinado),
      presencas: ped.presencas[x.n]?.length ?? 0,
    })),
    dtp: ped.dtp.items.map(d => ({ label: d.label, estado: d.estado, detalhe: d.detalhe })),
  };
}
