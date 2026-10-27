// Folha de presenças de uma sessão: Presente / Ausente por formando, tipo de falta, tempo de ausência,
// componente teórica e prática (horas T / P) e a validação pela coordenação pedagógica.
import { useEffect, useState } from "react";
import { data as fmtDataUi } from "./ui/formatos";
import { imprimirFolhasPresencas } from "./presencasPrint";
import { I } from "./turmaIcones";
import { dataHoraAssinatura } from "./SessaoModais";
import { AssinaturaQualificada } from "./AssinaturaQualificada";

export type EstadoPresenca = "presente" | "falta_justificada" | "falta_injustificada" | "atraso";

/** Uma marcação: `estado` manda; sem ele (folhas antigas), `presente` decide entre presente e falta injustificada. */
export type LinhaPresenca = { id: number; nome: string; presente: boolean; estado?: EstadoPresenca; minutos?: number; justificacao?: string };

export type FolhaSessao = {
  teoricas?: number | null; praticas?: number | null; validadaPor?: string | null; validadaEm?: string | null;
  /** Assinatura digital do formador (nome da conta e hora do servidor). */
  assinadaPor?: string | null; assinadaEm?: string | null;
};

export function estadoDaLinha(l: Pick<LinhaPresenca, "presente" | "estado">): EstadoPresenca {
  return l.estado ?? (l.presente ? "presente" : "falta_injustificada");
}

/** Para gravar: presente com minutos em falta passa a «atraso» (presente, com tempo de ausência). */
function normalizar(l: LinhaPresenca): LinhaPresenca {
  const estado = estadoDaLinha(l);
  const ausente = estado === "falta_justificada" || estado === "falta_injustificada";
  const minutos = ausente ? undefined : Math.max(0, Math.round(l.minutos ?? 0)) || undefined;
  return {
    id: l.id, nome: l.nome,
    estado: ausente ? estado : minutos ? "atraso" : "presente",
    presente: !ausente,
    ...(minutos ? { minutos } : {}),
    ...(estado === "falta_justificada" && l.justificacao?.trim() ? { justificacao: l.justificacao.trim() } : {}),
  };
}

/** Horas da sessão a partir de «09h00 a 13h00» (para «tudo teórica» / «tudo prática»). */
function horasDaSessao(hora: string | undefined) {
  const m = /(\d{1,2})h(\d{2})\s*a\s*(\d{1,2})h(\d{2})/.exec(hora ?? "");
  if (!m) return null;
  const min = (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
  return min > 0 ? Math.round((min / 60) * 100) / 100 : null;
}

const numero = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, Math.min(24, n));
};

function Segmento<T extends string>({ valor, opcoes, onChange, desactivado, rotulo }: {
  valor: T; opcoes: { v: T; l: string; cls: string }[]; onChange: (v: T) => void; desactivado?: boolean; rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex overflow-hidden rounded-lg border border-slate-200">
      {opcoes.map(o => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} disabled={desactivado} onClick={() => onChange(o.v)}
          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${valor === o.v ? o.cls : "bg-white text-slate-500 hover:bg-slate-50"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function PresencasSessaoModal({
  open, onClose, sessao, formandos, folha, validada = false, onSave, onValidar, podeValidar = false, soLeitura, onAssinar, qualificada,
  turmaNome, cursoNome, onImprimir,
}: {
  open: boolean; onClose: () => void;
  sessao?: { n: number; data: string; hora: string; modulo?: string; formador?: string; id?: string };
  formandos?: LinhaPresenca[];
  folha?: FolhaSessao | null;
  /** A coordenação já validou: o formador só consulta. */
  validada?: boolean;
  onSave?: (rows: LinhaPresenca[], folha: { teoricas: number | null; praticas: number | null }) => void;
  /** Coordenação: valida (ou reabre) a folha, gravando ao mesmo tempo o que estiver alterado. */
  onValidar?: (validar: boolean, rows: LinhaPresenca[], folha: { teoricas: number | null; praticas: number | null }) => void;
  podeValidar?: boolean;
  /** Financiada: assinatura qualificada (CC/CMD) do PDF da folha (depois de gravada). */
  qualificada?: { turmaId: number; sessaoId?: string };
  /** Formador: grava e assina digitalmente a folha. */
  onAssinar?: (rows: LinhaPresenca[], folha: { teoricas: number | null; praticas: number | null }) => void;
  /** Motivo para abrir só em consulta. */
  soLeitura?: string;
  turmaNome?: string;
  cursoNome?: string;
  /** Folha própria do regime (Financiada: PDF do modelo da candidatura); sem ela, a folha impressa pelo browser. */
  onImprimir?: () => void;
}) {
  const seed = () => (formandos ?? []).map(f => ({ ...f, estado: estadoDaLinha(f) === "atraso" ? "presente" as const : estadoDaLinha(f) }));
  const [linhas, setLinhas] = useState<LinhaPresenca[]>(seed);
  const [t, setT] = useState("");
  const [p, setP] = useState("");
  useEffect(() => {
    if (!open) return;
    setLinhas(seed());
    setT(folha?.teoricas != null ? String(folha.teoricas) : "");
    setP(folha?.praticas != null ? String(folha.praticas) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessao?.n]);
  if (!open) return null;

  const bloqueada = Boolean(soLeitura);
  const mudar = (id: number, patch: Partial<LinhaPresenca>) => setLinhas(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const finais = linhas.map(normalizar);
  const presentes = finais.filter(l => l.presente).length;
  const justificadas = finais.filter(l => l.estado === "falta_justificada").length;
  const injustificadas = finais.filter(l => l.estado === "falta_injustificada").length;
  const pct = finais.length ? Math.round((presentes / finais.length) * 100) : 0;
  const horas = horasDaSessao(sessao?.hora);
  const componente = { teoricas: numero(t), praticas: numero(p) };
  const somaTP = (componente.teoricas ?? 0) + (componente.praticas ?? 0);
  const avisoTP = horas != null && (componente.teoricas != null || componente.praticas != null) && Math.abs(somaTP - horas) > 0.01
    ? `T + P = ${somaTP} h, mas a sessão tem ${horas} h.` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-label={`Folha de presenças da sessão ${sessao?.n ?? ""}`} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Folha de Presenças - Sessão {sessao?.n}</p>
            <p className="text-xs text-slate-400">{sessao?.data ? fmtDataUi(sessao.data) : ""} · {sessao?.hora}</p>
          </div>
          <div className="flex items-center gap-2">
            {validada
              ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700" title={folha?.validadaPor ? `Validada por ${folha.validadaPor}${folha.validadaEm ? ` em ${fmtDataUi(folha.validadaEm.slice(0, 10))}` : ""}` : undefined}>
                  ✓ Validada{folha?.validadaPor ? ` · ${folha.validadaPor}` : ""}
                </span>
              : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Por validar</span>}
            <button onClick={onClose} aria-label="Fechar" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
          </div>
        </div>

        {soLeitura && <p className="m-0 px-5 py-2 text-xs bg-slate-50 border-b border-slate-100 text-slate-600">{soLeitura}</p>}
        <p className={`m-0 px-5 py-2 text-xs border-b border-slate-100 ${folha?.assinadaPor ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {folha?.assinadaPor && folha.assinadaEm
            ? <>✍ Assinada digitalmente pelo formador <strong>{folha.assinadaPor}</strong> em {dataHoraAssinatura(folha.assinadaEm)}.</>
            : "Por assinar pelo formador."}
        </p>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              <strong className="text-emerald-700">{presentes} presentes</strong> · {injustificadas} faltas injustificadas · {justificadas} faltas justificadas
            </span>
            <div className="flex items-center gap-2">
              <div className="w-28 bg-slate-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? "#10B981" : pct >= 75 ? "#F59E0B" : "#EF4444" }} />
              </div>
              <span className={`text-xs font-bold ${pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
              {!bloqueada && (
                <button type="button" onClick={() => setLinhas(prev => prev.map(x => ({ ...x, presente: true, estado: "presente", minutos: undefined })))}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">Todos presentes</button>
              )}
            </div>
          </div>
          <fieldset className="flex flex-wrap items-end gap-3 border-0 p-0 m-0">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Componente da sessão{horas != null ? ` (${horas} h)` : ""}</legend>
            <label className="text-xs text-slate-600">Teórica (T), horas
              <input inputMode="decimal" value={t} disabled={bloqueada} onChange={e => setT(e.target.value)} placeholder="0"
                className="mt-1 block w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100" />
            </label>
            <label className="text-xs text-slate-600">Prática (P), horas
              <input inputMode="decimal" value={p} disabled={bloqueada} onChange={e => setP(e.target.value)} placeholder="0"
                className="mt-1 block w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100" />
            </label>
            {horas != null && !bloqueada && (
              <div className="flex gap-1.5 pb-0.5">
                <button type="button" onClick={() => { setT(String(horas)); setP("0"); }} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">Toda teórica</button>
                <button type="button" onClick={() => { setT("0"); setP(String(horas)); }} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">Toda prática</button>
              </div>
            )}
            {avisoTP && <p className="m-0 w-full text-xs text-amber-700">{avisoTP}</p>}
          </fieldset>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 m-0 p-0 list-none">
          {linhas.map(l => {
            const estado = estadoDaLinha(l);
            const ausente = estado === "falta_justificada" || estado === "falta_injustificada";
            return (
              <li key={l.id} className={`px-5 py-3 ${ausente ? "bg-red-50/40" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 min-w-[10rem] text-sm text-slate-700">{l.nome}</span>
                  <Segmento rotulo={`Presença de ${l.nome}`} desactivado={bloqueada} valor={ausente ? "ausente" : "presente"}
                    onChange={v => mudar(l.id, v === "presente"
                      ? { presente: true, estado: "presente" }
                      : { presente: false, estado: estado === "falta_justificada" ? "falta_justificada" : "falta_injustificada", minutos: undefined })}
                    opcoes={[
                      { v: "presente", l: "Presente", cls: "bg-emerald-600 text-white" },
                      { v: "ausente", l: "Ausente", cls: "bg-red-600 text-white" },
                    ]} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  {ausente ? (
                    <>
                      <Segmento rotulo={`Tipo de falta de ${l.nome}`} desactivado={bloqueada} valor={estado}
                        onChange={v => mudar(l.id, { estado: v })}
                        opcoes={[
                          { v: "falta_injustificada", l: "Falta injustificada", cls: "bg-red-100 text-red-700" },
                          { v: "falta_justificada", l: "Falta justificada", cls: "bg-amber-100 text-amber-800" },
                        ]} />
                      {estado === "falta_justificada" && (
                        <input value={l.justificacao ?? ""} maxLength={400} disabled={bloqueada} placeholder="Motivo (opcional)" aria-label={`Motivo da falta de ${l.nome}`}
                          onChange={e => mudar(l.id, { justificacao: e.target.value })}
                          className="flex-1 min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100" />
                      )}
                    </>
                  ) : (
                    <label className="flex items-center gap-2">
                      Tempo de ausência
                      <input type="number" min={0} max={600} step={5} value={l.minutos ?? ""} disabled={bloqueada} placeholder="0"
                        onChange={e => mudar(l.id, { minutos: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100" />
                      min <span className="text-slate-400">(atraso ou saída antecipada)</span>
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {qualificada && sessao && (formandos ?? []).some(f => f.estado) && (
          <div className="px-5 py-3 border-t border-slate-100">
            <AssinaturaQualificada turmaId={qualificada.turmaId} n={sessao.n} sessaoId={qualificada.sessaoId ?? sessao.id} doc="folha" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">{bloqueada ? "Fechar" : "Cancelar"}</button>
          <button type="button"
            onClick={() => onImprimir ? onImprimir() : imprimirFolhasPresencas({
              turma: turmaNome || "Turma", curso: cursoNome || "", formandos: finais,
              sessoes: [{ n: sessao?.n ?? 0, data: sessao?.data ?? "", hora: sessao?.hora ?? "", modulo: sessao?.modulo, formador: sessao?.formador }],
            })}
            className="flex-1 py-2 border border-slate-200 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50">
            Imprimir folha
          </button>
          {!bloqueada && (
            <button onClick={() => { onSave?.(finais, componente); onClose(); }} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${onAssinar ? "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>Guardar presenças</button>
          )}
          {!bloqueada && onAssinar && (
            <button onClick={() => { onAssinar(finais, componente); onClose(); }} title="Grava e assina digitalmente a folha (fica o seu nome e a hora)"
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg">Guardar e assinar</button>
          )}
          {podeValidar && onValidar && (
            validada
              ? <button onClick={() => { onValidar(false, finais, componente); onClose(); }} title="O formador volta a poder alterar a folha"
                  className="flex-1 py-2 border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-800 rounded-lg hover:bg-amber-100">Reabrir</button>
              : <button onClick={() => { onValidar(true, finais, componente); onClose(); }} title="Grava e valida: o formador deixa de poder alterar"
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg">Validar presenças</button>
          )}
        </div>
      </div>
    </div>
  );
}
