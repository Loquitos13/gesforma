// Plano e sumário de sessão: tipos, valores vazios e os modais de edição/assinatura.
import { useEffect, useMemo, useState } from "react";
import { I } from "./turmaIcones";

export type MomentoKey = "introducao" | "desenvolvimento" | "conclusao";
export type MomentoField = { conteudo: string; atividades: string; metodos: string; avaliacao: string; recursos: string; materiais: string; tempo: string };
export type PlanoSessaoData = { objetivosGerais: string; objetivosEspecificos: string; momentos: Record<MomentoKey, MomentoField>; assinado?: boolean };
export type SessaoMeta = { n: number; id?: string; data: string; dataIso?: string; hora: string; formador: string; formadores?: string[]; estado: string; plano: boolean; modulo: string; modulos?: string[]; duracao: string; iniciadaEm?: string; fechadaEm?: string };

function formadoresDaSessao(s: SessaoMeta) {
  if (s.formadores?.length) return s.formadores.map(f => f.trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

function formadoresDaSessaoLabel(s: SessaoMeta) {
  return formadoresDaSessao(s).join(" · ");
}

export const emptyMomento: MomentoField = { conteudo: "", atividades: "", metodos: "", avaliacao: "", recursos: "", materiais: "", tempo: "" };

const momentoLabels: Record<MomentoKey, string> = {
  introducao: "Introdução",
  desenvolvimento: "Desenvolvimento",
  conclusao: "Conclusão",
};
const campoLabels: (keyof MomentoField)[] = ["conteudo", "atividades", "metodos", "avaliacao", "recursos", "materiais", "tempo"];
const campoNames: Record<keyof MomentoField, string> = {
  conteudo: "Conteúdo Programático",
  atividades: "Atividades",
  metodos: "Métodos / Técnicas Pedagógicas",
  avaliacao: "Avaliação",
  recursos: "Recursos Didáticos",
  materiais: "Materiais e Equipamentos",
  tempo: "Tempo",
};

export function emptyPlano(): PlanoSessaoData {
  return { objetivosGerais: "", objetivosEspecificos: "", momentos: { introducao: { ...emptyMomento }, desenvolvimento: { ...emptyMomento }, conclusao: { ...emptyMomento } } };
}

/** Plano gravado antes de um campo existir (ex.: «Tempo»): os campos em falta ficam vazios. */
export function normalizarPlano(p: PlanoSessaoData): PlanoSessaoData {
  const m = (p.momentos ?? {}) as Partial<Record<MomentoKey, Partial<MomentoField>>>;
  const momento = (k: MomentoKey) => Object.fromEntries(campoLabels.map(c => [c, String(m[k]?.[c] ?? "")])) as MomentoField;
  return {
    ...p,
    objetivosGerais: String(p.objetivosGerais ?? ""),
    objetivosEspecificos: String(p.objetivosEspecificos ?? ""),
    momentos: { introducao: momento("introducao"), desenvolvimento: momento("desenvolvimento"), conclusao: momento("conclusao") },
  };
}

export type SumarioSessaoData = {
  conteudos: string;
  atividades: string;
  observacoes: string;
  assinado: boolean;
  assinadoEm?: string;
  presencasValidadas?: boolean;
};

export function emptySumario(): SumarioSessaoData {
  return { conteudos: "", atividades: "", observacoes: "", assinado: false };
}

export function sumarioPreenchido(s?: SumarioSessaoData) {
  return !!s && s.conteudos.trim().length > 0;
}

export function PlanoSessaoModal({ open, onClose, sessao, plano: planoGravado, onSave, soLeitura, onPdf }: {
  open: boolean; onClose: () => void;
  sessao?: SessaoMeta;
  plano: PlanoSessaoData;
  onSave: (data: PlanoSessaoData) => void;
  /** PDF do plano gravado (Financiada: modelo da candidatura). */
  onPdf?: () => void;
  /** Motivo para mostrar o plano sem o deixar editar (ex.: plano definido na ficha do curso). */
  soLeitura?: string;
}) {
  const plano = useMemo(() => normalizarPlano(planoGravado), [planoGravado]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanoSessaoData>(plano);
  useEffect(() => { setDraft(plano); setEditing(false); }, [open, plano]);

  if (!open || !sessao) return null;
  const hasContent = plano.objetivosGerais.trim() !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-slate-800">Plano de Sessão - Sessão {sessao.n}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sessao.data} · {sessao.hora} · {formadoresDaSessaoLabel(sessao) || "Formador por definir"}</p>
          </div>
          <div className="flex items-center gap-2">
            {onPdf && !editing && (
              <button onClick={onPdf} title="Plano de sessão em PDF, com o que está gravado"
                className="text-xs font-semibold px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">PDF</button>
            )}
            {soLeitura
              ? <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">{soLeitura}</span>
              : !editing
              ? <button onClick={() => { setDraft(plano); setEditing(true); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                  {I.edit} Editar
                </button>
              : <>
                  <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
                  <button onClick={() => { onSave(draft); setEditing(false); }}
                    className="text-xs font-semibold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Guardar</button>
                </>}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: sessao.modulos && sessao.modulos.length > 1 ? "Módulos" : "Módulo", v: sessao.modulos?.length ? sessao.modulos.join(" · ") : sessao.modulo },
              { l: "Duração", v: sessao.duracao },
              { l: formadoresDaSessao(sessao).length > 1 ? "Formadores" : "Formador/a", v: formadoresDaSessaoLabel(sessao) || "-" },
              { l: "Data", v: sessao.data },
            ].map(f => (
              <div key={f.l} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">{f.l}</p>
                <p className="text-xs font-bold text-slate-800 leading-snug">{f.v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["objetivosGerais", "objetivosEspecificos"] as const).map(field => (
              <div key={field} className="space-y-1.5">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {field === "objetivosGerais" ? "Objetivos Gerais" : "Objetivos Específicos"}
                </p>
                {editing
                  ? <textarea value={draft[field]} onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))} rows={3}
                      className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-amber-400 resize-none leading-relaxed" />
                  : <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 leading-relaxed min-h-[64px]">
                      {plano[field] || <span className="text-slate-400 italic">Não preenchido</span>}
                    </div>}
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Plano da Sessão</p>
            {editing ? (
              <div className="space-y-4">
                {(Object.keys(momentoLabels) as MomentoKey[]).map(momento => (
                  <div key={momento} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-800 text-white">
                      <p className="text-xs font-bold uppercase tracking-wider">{momentoLabels[momento]}</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {campoLabels.map(campo => (
                        <div key={campo} className="grid grid-cols-3 gap-0">
                          <div className="px-3 py-2.5 bg-slate-50 border-r border-slate-100 flex items-start">
                            <p className="text-xs font-semibold text-slate-600">{campoNames[campo]}</p>
                          </div>
                          <div className="col-span-2 px-3 py-2">
                            {campo === "tempo"
                              ? <input value={draft.momentos[momento][campo]} maxLength={120} placeholder="Ex.: 30 min"
                                  aria-label={`${momentoLabels[momento]}: ${campoNames[campo]}`}
                                  onChange={e => setDraft(prev => ({ ...prev, momentos: { ...prev.momentos, [momento]: { ...prev.momentos[momento], [campo]: e.target.value } } }))}
                                  className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-amber-400" />
                              : <textarea value={draft.momentos[momento][campo]}
                                  aria-label={`${momentoLabels[momento]}: ${campoNames[campo]}`}
                                  onChange={e => setDraft(prev => ({ ...prev, momentos: { ...prev.momentos, [momento]: { ...prev.momentos[momento], [campo]: e.target.value } } }))}
                                  rows={2} className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-amber-400 resize-none" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs min-w-[820px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider w-[16%]">Momento</th>
                      {campoLabels.map(c => (
                        <th key={c} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">{campoNames[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(Object.keys(momentoLabels) as MomentoKey[]).map((momento, mi) => (
                      <tr key={momento} className={mi % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-3 py-3 font-bold text-slate-700 align-top whitespace-nowrap">{momentoLabels[momento]}</td>
                        {campoLabels.map(campo => (
                          <td key={campo} className="px-3 py-3 text-slate-600 align-top leading-relaxed">
                            {hasContent ? (plano.momentos[momento][campo] || <span className="text-slate-300">-</span>) : <span className="text-slate-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SumarioSessaoModal({ open, onClose, sessao, sumario, accent = "gold", onSave }: {
  open: boolean; onClose: () => void;
  sessao?: SessaoMeta;
  sumario: SumarioSessaoData;
  accent?: "gold" | "fin";
  onSave: (data: SumarioSessaoData) => void;
}) {
  const gold = accent === "gold";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SumarioSessaoData>(sumario);
  useEffect(() => {
    setDraft(sumario);
    setEditing(!sumarioPreenchido(sumario));
  }, [open, sumario]);

  if (!open || !sessao) return null;
  const filled = sumarioPreenchido(sumario);

  function guardar(assinar?: boolean) {
    const next: SumarioSessaoData = {
      ...draft,
      assinado: assinar ? true : draft.assinado,
      assinadoEm: assinar ? sessao!.data.replace(/^[^,]+,\s*/, "") : draft.assinadoEm,
    };
    onSave(next);
    setEditing(false);
  }

  const fields: { key: keyof Pick<SumarioSessaoData, "conteudos" | "atividades" | "observacoes">; label: string; hint: string }[] = [
    { key: "conteudos", label: "Conteúdos leccionados", hint: "O que foi efectivamente tratado nesta sessão." },
    { key: "atividades", label: "Atividades realizadas", hint: "Exercícios, demonstrações, trabalhos de grupo." },
    { key: "observacoes", label: "Observações e ocorrências", hint: "Atrasos, desistências, material em falta - ou deixe em branco." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Sumário - Sessão {sessao.n}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sessao.data} · {sessao.hora} · {formadoresDaSessaoLabel(sessao) || "Formador por definir"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 border ${gold ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${gold ? "text-amber-600" : "text-blue-600"}`}>{sessao.modulos && sessao.modulos.length > 1 ? "Módulos" : "Módulo"}</p>
              <p className="text-xs font-bold text-slate-800 leading-snug">{sessao.modulos?.length ? sessao.modulos.join(" · ") : sessao.modulo}</p>
            </div>
            <div className={`rounded-xl p-3 border ${gold ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${gold ? "text-amber-600" : "text-blue-600"}`}>Duração</p>
              <p className="text-xs font-bold text-slate-800">{sessao.duracao}</p>
            </div>
          </div>
          {fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{f.label}</p>
              {editing
                ? <textarea value={draft[f.key]} onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))} rows={f.key === "observacoes" ? 2 : 3}
                    placeholder={f.hint}
                    className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed" />
                : <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 leading-relaxed min-h-[56px]">
                    {sumario[f.key] || <span className="text-slate-400 italic">Não preenchido</span>}
                  </div>}
            </div>
          ))}
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${sumario.assinado ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${sumario.assinado ? "bg-emerald-500" : "bg-slate-300"}`}>
              {sumario.assinado ? "✓" : ""}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-700">
                {sumario.assinado ? `Assinado por ${formadoresDaSessaoLabel(sessao) || "formador"}` : "Por assinar pelo formador"}
              </p>
              {sumario.assinadoEm && <p className="text-xs text-slate-400">{sumario.assinadoEm}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-400">Sem sumário assinado a sessão não existiu para auditoria do DTP.</p>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button disabled={!draft.conteudos.trim()} onClick={() => guardar(false)}
                className="flex-1 py-2 border border-slate-200 text-sm text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40">Guardar rascunho</button>
              <button disabled={!draft.conteudos.trim()} onClick={() => guardar(true)}
                className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-40 ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                Guardar e assinar
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
              <button onClick={() => { setDraft(sumario); setEditing(true); }}
                className="flex-1 py-2 border border-slate-200 text-sm text-slate-700 rounded-lg hover:bg-slate-50">
                {filled ? "Editar" : "Preencher"}
              </button>
              {filled && !sumario.assinado && (
                <button onClick={() => guardar(true)}
                  className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                  Assinar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
