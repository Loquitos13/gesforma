import { useEffect, useState } from "react";
import {
  apiDocsPreinscricao, apiDocsPreinscricaoApagarModelo, apiDocsPreinscricaoUpload, apiSaveDocsPreinscricao,
  type DocPreinscricaoCurso, type Regime,
} from "../partilhado/api";
import { toastError, toastOk } from "../partilhado/toastBus";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import { ESCOLARIDADES } from "../partilhado/escolaridade";
import { CAMPOS_GATILHO, NACIONALIDADES_GATILHO, resumoGatilho, temGatilho, type CampoGatilho, type GatilhoDoc } from "../partilhado/gatilhosDocs";

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700";

function ModeloDoc({
  accent, cursoId, doc, busy, onChange,
}: {
  accent: Regime;
  cursoId: number;
  doc: DocPreinscricaoCurso;
  busy: boolean;
  onChange: () => void;
}) {
  const [aEnviar, setAEnviar] = useState(false);
  async function enviar(file: File | null) {
    if (!file) return;
    setAEnviar(true);
    try {
      await apiDocsPreinscricaoUpload(accent, cursoId, doc.id, file);
      toastOk("Documento da secretaria gravado. Na pré-inscrição a pessoa tem de o ler até ao fim.");
      onChange();
    } catch (err) {
      toastError(err, "Não foi possível gravar o ficheiro.");
    } finally {
      setAEnviar(false);
    }
  }
  async function retirar() {
    setAEnviar(true);
    try {
      await apiDocsPreinscricaoApagarModelo(accent, cursoId, doc.id);
      toastOk("Ficheiro retirado. A pessoa volta a anexar o seu.");
      onChange();
    } catch (err) {
      toastError(err, "Não foi possível retirar o ficheiro.");
    } finally {
      setAEnviar(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-[11px] font-semibold text-slate-500">
        <span className="block">{doc.modelo ? doc.modelo : "Sem ficheiro · a pessoa anexa"}</span>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,application/pdf"
          disabled={busy || aEnviar}
          className="mt-1 block max-w-[14rem] text-[11px]"
          onChange={e => { void enviar(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        />
      </label>
      {doc.modelo && (
        <button type="button" disabled={busy || aEnviar} onClick={() => void retirar()} className="text-[11px] font-semibold text-slate-400 hover:text-red-600">
          Retirar
        </button>
      )}
    </div>
  );
}

const ROTULO_CAMPO: Record<CampoGatilho, string> = { escolaridade: "Escolaridade", nacionalidade: "Nacionalidade", local: "Local", horario: "Horário" };

/**
 * Gatilho de um documento: «Pedir sempre» ou «Pedir só se…» (escolaridade, nacionalidade, local, horário).
 * Dentro de cada dado basta um dos valores; entre dados, todos têm de bater. Cumprido, o documento é obrigatório.
 */
function GatilhoEditor({ valor, opcoes, busy, gold, onGravar }: {
  valor: GatilhoDoc | null | undefined;
  opcoes: Record<CampoGatilho, readonly string[]>;
  busy: boolean;
  gold: boolean;
  onGravar: (g: GatilhoDoc | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [g, setG] = useState<GatilhoDoc>(valor ?? {});
  useEffect(() => { if (!aberto) setG(valor ?? {}); }, [valor, aberto]);
  const campos = CAMPOS_GATILHO.filter(c => opcoes[c].length > 0);
  const alternar = (c: CampoGatilho, v: string) => setG(prev => {
    const atual = (prev[c] ?? []) as string[];
    return { ...prev, [c]: atual.includes(v) ? atual.filter(x => x !== v) : [...atual, v] };
  });
  const resumo = resumoGatilho(valor);
  return (
    <div className="w-full">
      <button type="button" disabled={busy} onClick={() => setAberto(a => !a)}
        className={`mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${resumo ? (gold ? "border-amber-300 bg-amber-50 text-amber-800" : "border-blue-300 bg-blue-50 text-blue-800") : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16l-6 8v5l-4 2v-7z" /></svg>
        {resumo || "Pedir sempre"}
      </button>
      {aberto && (
        <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="m-0 text-[11px] leading-relaxed text-slate-500">
            Escolha quem tem de enviar este documento. Em cada dado basta um dos valores marcados; com vários dados, todos têm de bater.
            Quem cumpre fica com o documento obrigatório; quem não cumpre não o vê.{gold ? "" : " Na Financiada só o local e o horário servem de gatilho."}
          </p>
          {campos.map(c => (
            <div key={c}>
              <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{ROTULO_CAMPO[c]}</p>
              <div className="flex flex-wrap gap-1.5">
                {opcoes[c].map(v => {
                  const ativo = ((g[c] ?? []) as string[]).includes(v);
                  return (
                    <button key={v} type="button" aria-pressed={ativo} onClick={() => alternar(c, v)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ativo ? (gold ? "border-amber-500 bg-amber-500 text-white" : "border-blue-600 bg-blue-600 text-white") : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => { onGravar(temGatilho(g) ? g : null); setAberto(false); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
              Gravar gatilho
            </button>
            {temGatilho(valor) && (
              <button type="button" disabled={busy} onClick={() => { onGravar(null); setAberto(false); }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Pedir sempre
              </button>
            )}
            <button type="button" onClick={() => setAberto(false)} className="px-2 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Todos os cursos têm a lista de documentos (também os de acesso direto). */
function pedePreinscricao(_regime: Regime, _tipo: string) {
  return true;
}

export function CursoDocumentos({ accent, cursoId, tipo = "" }: { accent: Regime; cursoId?: number; tipo?: string }) {
  const [docs, setDocs] = useState<DocPreinscricaoCurso[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [nome, setNome] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [busy, setBusy] = useState(false);
  const gold = accent === "gold";
  const btn = gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";
  const chk = gold ? "accent-amber-500" : "accent-blue-600";
  const aplica = pedePreinscricao(accent, tipo);
  const locais = useOpcoes("locais", { regime: accent });
  const horarios = useOpcoes("horarios", { regime: accent });
  // A escolaridade e a nacionalidade só vêm no formulário Gold.
  const opcoesGatilho: Record<CampoGatilho, readonly string[]> = {
    escolaridade: gold ? ESCOLARIDADES : [],
    nacionalidade: gold ? NACIONALIDADES_GATILHO : [],
    local: [...new Set(locais.opcoes.map(o => o.rotulo).filter(Boolean))],
    horario: [...new Set(horarios.opcoes.map(o => o.rotulo).filter(Boolean))],
  };

  function carregar() {
    if (cursoId == null || !aplica) { setEstado("ready"); return; }
    setEstado("loading");
    apiDocsPreinscricao(accent, cursoId)
      .then(r => { setDocs(r.docs); setEstado("ready"); })
      .catch(() => setEstado("offline"));
  }

  useEffect(() => { carregar(); }, [accent, cursoId, aplica]);

  async function guardar(next: DocPreinscricaoCurso[]) {
    if (cursoId == null) return;
    setBusy(true);
    try {
      await apiSaveDocsPreinscricao(accent, cursoId, {
        ocultos: next.filter(d => d.origem === "base" && !d.pedido).map(d => d.id),
        extra: next.filter(d => d.origem === "extra").map(d => ({ id: d.id.startsWith("novo-") ? undefined : d.id, label: d.label, required: d.required, gatilho: d.gatilho ?? null })),
        condicoes: Object.fromEntries(next.filter(d => d.origem === "base" && d.gatilho).map(d => [d.id, d.gatilho!])),
      });
      toastOk("Documentos da pré-inscrição gravados.");
      carregar();
    } catch (err) {
      toastError(err, "Não foi possível gravar. Se mudou o tipo comercial, grave primeiro a ficha do curso.");
    } finally {
      setBusy(false);
    }
  }

  function mudarGatilho(id: string, gatilho: GatilhoDoc | null) {
    const next = docs.map(x => (x.id === id ? { ...x, gatilho } : x));
    setDocs(next);
    void guardar(next);
  }

  function adicionar() {
    const label = nome.trim();
    if (label.length < 3) { toastError(new Error("Escreva o nome do documento.")); return; }
    const id = `novo-${Date.now()}`;
    const next = [...docs, { id, label, required: obrigatorio, pedido: true, origem: "extra" as const }];
    setDocs(next);
    setNome("");
    void guardar(next);
  }

  if (cursoId == null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Grave o curso primeiro</p>
        <p className="text-xs text-slate-500 mt-1">Os documentos da pré-inscrição ficam ligados ao curso.</p>
      </div>
    );
  }

  if (!aplica) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-800">Sem documentos na pré-inscrição</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Este curso é de acesso direto. A pessoa paga e entra no curso, por isso não há ficheiros para anexar nesta fase.
          A lista só aparece quando o tipo comercial é Pré-inscrição.
        </p>
      </div>
    );
  }

  if (estado === "loading") return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">A ler os documentos da pré-inscrição…</div>;
  if (estado === "offline") {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Sem ligação à API. Os documentos da pré-inscrição não se editam offline.</div>;
  }

  const base = docs.filter(d => d.origem === "base");
  const extra = docs.filter(d => d.origem === "extra");
  const dossie = docs.filter(d => d.origem === "dossie");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Documentos da pré-inscrição</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Esta lista é a que a ligação pessoal pede para iniciar o curso. O ficheiro da secretaria é opcional. Sem ficheiro, a pessoa anexa o seu. Com ficheiro, abre o documento completo e só continua depois de o ler até ao fim.
          </p>
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {base.map(d => (
            <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className={`w-4 h-4 ${chk}`}
                  checked={d.pedido}
                  disabled={busy}
                  onChange={e => {
                    const next = docs.map(x => x.id === d.id ? { ...x, pedido: e.target.checked } : x);
                    setDocs(next);
                    void guardar(next);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${d.pedido ? "text-slate-800" : "text-slate-400 line-through"}`}>{d.label}</p>
                </div>
                {(d.required || temGatilho(d.gatilho)) && d.pedido && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{temGatilho(d.gatilho) ? "obrigatório se" : "obrigatório"}</span>
                )}
              </div>
              {d.pedido && <ModeloDoc accent={accent} cursoId={cursoId} doc={d} busy={busy} onChange={carregar} />}
              {d.pedido && (
                <div className="sm:basis-full sm:pl-7">
                  <GatilhoEditor valor={d.gatilho} opcoes={opcoesGatilho} busy={busy} gold={gold} onGravar={g => mudarGatilho(d.id, g)} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {extra.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {extra.map(d => (
              <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{d.label}</p>
                  <p className="text-[11px] text-slate-400">{temGatilho(d.gatilho) ? "Obrigatório para quem cumpre o gatilho" : d.required ? "Obrigatório na pré-inscrição" : "Opcional na pré-inscrição"}</p>
                  {!d.id.startsWith("novo-") && <GatilhoEditor valor={d.gatilho} opcoes={opcoesGatilho} busy={busy} gold={gold} onGravar={g => mudarGatilho(d.id, g)} />}
                </div>
                {!d.id.startsWith("novo-") && <ModeloDoc accent={accent} cursoId={cursoId} doc={d} busy={busy} onChange={carregar} />}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const next = docs.filter(x => x.id !== d.id);
                    setDocs(next);
                    void guardar(next);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-red-600"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        {dossie.length > 0 && (
          <p className="text-xs text-slate-500">
            O dossiê deste curso também pede, por formando: {dossie.map(d => d.label).join(", ")}.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
          <label className="block text-xs font-semibold uppercase text-slate-500">Novo documento
            <input
              className={`${iCls} mt-1`}
              value={nome}
              placeholder="Ex. Comprovativo de residência"
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
            <input type="checkbox" className={`w-3.5 h-3.5 ${chk}`} checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} />
            Obrigatório
          </label>
        </div>
        <button type="button" disabled={busy || nome.trim().length < 3} onClick={adicionar} className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 ${btn}`}>
          {busy ? "A gravar…" : "Adicionar à pré-inscrição"}
        </button>
      </div>
    </div>
  );
}
