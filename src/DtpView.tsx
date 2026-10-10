import { useEffect, useMemo, useState } from "react";
import { apiDtpExport, apiRelatorioFinalTurma, apiRelatorioInqueritosTurma, type DtpEstado, type DtpItem, type DtpSnapshot } from "./api";
import { DTP_CATEGORIAS, dtpCategoriaDe, dtpPastaNome, dtpZipNome, type DtpCategoriaId } from "./dtpPasta";
import { TOPICOS_FIN } from "./dtpTopicosFin";
import { toastError, toastOk } from "./toastBus";
import { FileUploadModal } from "./TurmaExtras";

export type DtpRegime = "gold" | "fin";

export type DtpTurma = {
  codigo: string;
  id?: number;
  titulo: string;
  sub: string;
};

type Props = {
  regime: DtpRegime;
  turma?: DtpTurma;
  dtp: DtpSnapshot;
  estado?: "loading" | "ready" | "offline";
  onToggle?: (item: DtpItem, proximo: DtpEstado | "auto") => void;
  onAnexo?: (item: DtpItem, file: { id: string; name: string; openUrl: string }) => void;
  onActualizar?: () => void;
};

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

async function exportarPasta(regime: DtpRegime, turma: DtpTurma | undefined) {
  if (turma?.id == null) {
    toastError(new Error("Abra o dossiê a partir de uma turma para descarregar o ZIP com os PDFs."));
    return;
  }
  const codigo = (turma.codigo ?? "turma").trim();
  await apiDtpExport(regime, turma.id, dtpZipNome(regime, codigo));
}

/** Dossiê da turma - vive dentro do cockpit, não como “ação de formação”. */
export function DtpPanel({ regime, turma, dtp, estado = "ready", onToggle, onAnexo, onActualizar }: Props) {
  const isGold = regime === "gold";
  const codigo = turma?.codigo ?? (isGold ? "turma" : "UFCD");
  const [categoria, setCategoria] = useState<DtpCategoriaId | "todas">("todas");
  const [topico, setTopico] = useState<number | "todas">("todas");
  const [exportando, setExportando] = useState(false);
  const [aGerar, setAGerar] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<DtpItem | null>(null);

  useEffect(() => { setCategoria("todas"); setTopico("todas"); }, [regime, codigo]);

  const items = dtp.items;
  const visiveis = useMemo(() => {
    if (!isGold) {
      return topico === "todas" ? items : items.filter(d => d.topico === topico);
    }
    const list = categoria === "todas" ? items : items.filter(d => dtpCategoriaDe(d) === categoria);
    const faseOrdem = { antes: 0, durante: 1, depois: 2 };
    const ordem = Object.fromEntries(DTP_CATEGORIAS.map((c, i) => [c.id, i]));
    return [...list].sort((a, b) => (faseOrdem[a.fase] - faseOrdem[b.fase]) || ((ordem[dtpCategoriaDe(a)] ?? 0) - (ordem[dtpCategoriaDe(b)] ?? 0)));
  }, [items, categoria, isGold, topico]);

  async function gerar(qual: "final" | "inqueritos") {
    if (turma?.id == null) return;
    setAGerar(qual);
    try {
      if (qual === "final") await apiRelatorioFinalTurma(turma.id);
      else await apiRelatorioInqueritosTurma(turma.id);
      toastOk(qual === "final" ? "Relatório final da ação gerado." : "Relatório pós-formação desta turma gerado.");
      onActualizar?.();
    } catch (err) {
      toastError(err, "Não foi possível gerar o relatório.");
    } finally {
      setAGerar(null);
    }
  }

  if (estado === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-400">A ler o dossiê da turma…</p>
      </div>
    );
  }
  if (estado === "offline") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm font-semibold text-amber-800">Sem ligação ao dossiê desta turma</p>
        <p className="text-xs text-amber-700 mt-1">A API não respondeu. O DTP não se edita offline para não perder registos.</p>
      </div>
    );
  }

  const { pct, ok, parcial, falta, total } = dtp;
  const podeEncerrar = falta === 0 && parcial === 0;
  const bloqueantes = items.filter(i => i.bloqueante && i.estado !== "ok");
  const bar = isGold
    ? (pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444")
    : (pct >= 80 ? "#10B981" : pct >= 50 ? "#2563EB" : "#EF4444");
  const bloqueio = bloqueantes.length
    ? `Bloqueado por ${bloqueantes.length} ${bloqueantes.length === 1 ? "documento obrigatório" : "documentos obrigatórios"}: ${bloqueantes.slice(0, 3).map(i => i.label).join(", ")}.`
    : "Faltam documentos para fechar o dossiê desta turma.";
  const catActiva = isGold ? DTP_CATEGORIAS.find(c => c.id === categoria) : TOPICOS_FIN.find(t => t.n === topico);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dossiê técnico-pedagógico da turma</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              Código interno <span className="font-mono text-amber-700">{codigo}</span>
              {turma?.id != null && <span className="text-slate-400 font-normal"> · #{turma.id}</span>}
              {dtp.entidade && (
                <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{dtp.entidade}</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{ok} no dossiê · {parcial} parciais · {falta} em falta · {total} documentos</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{pct}%</span>
            <button
              type="button"
              disabled={exportando}
              onClick={() => {
                setExportando(true);
                void exportarPasta(regime, turma)
                  .then(() => toastOk(`ZIP ${dtpPastaNome(regime, codigo)} descarregado.`))
                  .catch(err => toastError(err, "Não foi possível exportar o ZIP do DTP."))
                  .finally(() => setExportando(false));
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-50 ${isGold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {exportando ? "A gerar ZIP…" : `Descarregar ${dtpPastaNome(regime, codigo)}`}
            </button>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bar }} />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Pasta no Drive e no ZIP: <span className="font-semibold text-slate-600">{dtpPastaNome(regime, codigo)}</span>
          {isGold
            ? ` · ${DTP_CATEGORIAS.map(c => c.pasta.replace(/^\d+-/, "")).join(" · ")}.`
            : " · 14 tópicos, do enquadramento ao impacto pós-formação."}
          {" "}Arquivar 10 anos (IEFP) ou o prazo do programa - o mais longo.
        </p>
      </div>

      <div className={`rounded-xl border p-4 ${podeEncerrar ? "bg-emerald-50 border-emerald-200" : isGold ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <p className={`text-sm font-bold ${podeEncerrar ? "text-emerald-800" : isGold ? "text-amber-800" : "text-blue-800"}`}>
          {podeEncerrar ? "DTP completo - turma pronta a arquivar e a certificar." : bloqueio}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          {isGold
            ? "Núcleo DGERT + extras CCP (PIP, simulações, 5 anos de experiência) + recibos."
            : "Na financiada cada tópico traz os documentos da ação. O relatório final gera-se no tópico 8. O relatório pós-formação do tópico 14 é só desta turma."}
        </p>
      </div>

      <div className={`grid gap-3 ${isGold ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
        {(isGold ? DTP_CATEGORIAS.map(c => ({ id: c.id, label: c.label, hint: c.hint, n: 0 })) : TOPICOS_FIN.map(t => ({ id: String(t.n), label: `${t.n}. ${t.label}`, hint: t.hint, n: t.n }))).map(c => {
          const subset = isGold ? items.filter(d => dtpCategoriaDe(d) === c.id) : items.filter(d => d.topico === c.n);
          const done = subset.filter(d => d.estado === "ok").length;
          const activo = isGold ? categoria === c.id : topico === c.n;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (isGold) setCategoria(prev => (prev === c.id ? "todas" : c.id as DtpCategoriaId));
                else setTopico(prev => (prev === c.n ? "todas" : c.n));
              }}
              className={`text-left rounded-xl border p-3 transition-colors ${activo ? (isGold ? "border-amber-400 bg-amber-50" : "border-blue-400 bg-blue-50") : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <p className="text-xs font-bold text-slate-700">{c.label}</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{done}/{subset.length}</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{c.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {(isGold ? categoria : topico) === "todas" ? "Documentos desta turma" : catActiva?.label}
            </p>
            <p className="text-xs text-slate-400">
              Os itens marcados <span className="font-semibold">automático</span> saem dos dados reais da turma (sessões, presenças, documentos dos formandos). Nos restantes, clique no estado para validar.
              {isGold
                ? " O que veio do percurso de inscrição fica submetido até a secretaria validar."
                : " Cada tópico é o da ação financiada. O relatório final e o das respostas saem só dos dados desta turma."}
            </p>
          </div>
          <button type="button" onClick={() => { setCategoria("todas"); setTopico("todas"); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap">Ver tudo</button>
        </div>
        <div className="divide-y divide-slate-100">
          {visiveis.map((doc, idx) => {
            const faseLabel = doc.fase === "antes" ? "Antes" : doc.fase === "durante" ? "Durante" : "Fecho";
            const topicoDoc = TOPICOS_FIN.find(t => t.n === doc.topico);
            const faseNova = isGold
              ? idx === 0 || visiveis[idx - 1]?.fase !== doc.fase
              : idx === 0 || visiveis[idx - 1]?.topico !== doc.topico;
            const s = estadoStyle[doc.estado];
            const cat = isGold ? DTP_CATEGORIAS.find(c => c.id === dtpCategoriaDe(doc)) : null;
            return (
              <div key={doc.id}>
              {faseNova && (
                <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100">{isGold ? faseLabel : `${topicoDoc?.n ?? ""}. ${topicoDoc?.label ?? "Tópico"}`}</p>
              )}
              <div className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${s.row}`}>
                <button
                  onClick={() => onToggle?.(doc, cycle(doc.estado))}
                  title={doc.origem === "auto" ? "Sai dos dados da turma. Clique para forçar outro estado." : "Marcar estado"}
                  className={`self-start sm:self-center text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${s.badge}`}
                >
                  {s.label}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{doc.label}</p>
                    {isGold && categoria === "todas" && cat && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">{cat.label}</span>
                    )}
                    {doc.bloqueante && doc.estado !== "ok" && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">bloqueante</span>
                    )}
                    {doc.origem === "auto" && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">automático</span>
                    )}
                    {isGold && (doc.percurso?.submetidos ?? 0) > 0 && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                        {doc.percurso?.submetidos} submetido{(doc.percurso?.submetidos ?? 0) === 1 ? "" : "s"}
                      </span>
                    )}
                    {isGold && (doc.percurso?.validados ?? 0) > 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                        {doc.percurso?.validados} validado{(doc.percurso?.validados ?? 0) === 1 ? "" : "s"}
                      </span>
                    )}
                    {isGold && (doc.percurso?.recusados ?? 0) > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                        {doc.percurso?.recusados} recusado{(doc.percurso?.recusados ?? 0) === 1 ? "" : "s"}
                      </span>
                    )}
                    {doc.extra && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${isGold ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>curso</span>
                    )}
                    {doc.universal && (
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">universal</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.detalhe}</p>
                  {doc.anexo?.url && (
                    <a href={doc.anexo.url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 mt-1 inline-block">
                      {doc.anexo.fileName || "Abrir no Drive"}
                    </a>
                  )}
                  {doc.origem === "manual" && onToggle && (
                    <button type="button" onClick={() => onToggle(doc, "auto")} className="block text-[11px] font-semibold text-slate-400 hover:text-slate-600 mt-1">
                      Voltar ao estado automático
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  {!isGold && (doc.id === "relatorio" || doc.id === "relatorio-pos") && turma?.id != null && (
                    <button
                      type="button"
                      disabled={aGerar != null}
                      onClick={() => void gerar(doc.id === "relatorio" ? "final" : "inqueritos")}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap bg-blue-600 text-white border-blue-700 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {aGerar === (doc.id === "relatorio" ? "final" : "inqueritos")
                        ? "A gerar…"
                        : doc.id === "relatorio" ? "Gerar relatório final" : "Gerar relatório pós-formação"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadFor(doc)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${isGold ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}
                  >
                    {doc.anexo?.fileName ? "Substituir ficheiro" : "Anexar no Drive"}
                  </button>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-right sm:max-w-[180px]">{doc.fonte}</p>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>
      <FileUploadModal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title={`Anexar: ${uploadFor?.label ?? ""}`}
        accent={regime}
        context={{
          kind: "dtp",
          regime,
          turma: turma?.codigo ?? String(turma?.id ?? ""),
          label: uploadFor?.label,
          itemId: uploadFor?.id,
        }}
        onConfirm={file => {
          if (uploadFor) onAnexo?.(uploadFor, { id: file.id, name: file.name, openUrl: file.openUrl });
        }}
      />
    </div>
  );
}
