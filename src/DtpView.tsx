import { useEffect, useMemo, useState } from "react";
import { apiDtpExport, type DtpEstado, type DtpItem, type DtpSnapshot } from "./api";
import { dtpPastaNome, dtpZipNome } from "./dtpPasta";
import { toastError, toastOk } from "./toastBus";
import { FileUploadModal } from "./TurmaExtras";

export type DtpRegime = "gold" | "fin";
type DtpFase = "antes" | "durante" | "depois";

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
};

const fases: { id: DtpFase; label: string; hint: string }[] = [
  { id: "antes", label: "Antes da turma", hint: "Abre o dossiê no dia em que a turma é aprovada." },
  { id: "durante", label: "Durante", hint: "O que só se recolhe em sala - não se reconstitui depois." },
  { id: "depois", label: "Fecho", hint: "Sem isto a turma não se encerra nem se emite certificado." },
];

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
export function DtpPanel({ regime, turma, dtp, estado = "ready", onToggle, onAnexo }: Props) {
  const isGold = regime === "gold";
  const codigo = turma?.codigo ?? (isGold ? "turma" : "UFCD");
  const [fase, setFase] = useState<DtpFase | "todas">("todas");
  const [exportando, setExportando] = useState(false);
  const [uploadFor, setUploadFor] = useState<DtpItem | null>(null);

  useEffect(() => { setFase("todas"); }, [regime, codigo]);

  const items = dtp.items;
  const visiveis = useMemo(
    () => (fase === "todas" ? items : items.filter(d => d.fase === fase)),
    [items, fase],
  );

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dossiê técnico-pedagógico da turma</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              Código interno <span className="font-mono text-amber-700">{codigo}</span>
              {turma?.id != null && <span className="text-slate-400 font-normal"> · #{turma.id}</span>}
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
          {" · "}01-Antes · 02-Durante · 03-Fecho · 04-Formandos · 05-Formador. Arquivar 10 anos (IEFP) ou o prazo do programa - o mais longo.
        </p>
      </div>

      <div className={`rounded-xl border p-4 ${podeEncerrar ? "bg-emerald-50 border-emerald-200" : isGold ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <p className={`text-sm font-bold ${podeEncerrar ? "text-emerald-800" : isGold ? "text-amber-800" : "text-blue-800"}`}>
          {podeEncerrar ? "DTP completo - turma pronta a arquivar e a certificar." : bloqueio}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          {isGold
            ? "Núcleo DGERT + extras CCP (PIP, simulações, 5 anos de experiência) + recibos."
            : "Núcleo DGERT + extras de financiamento (UFCD, elegibilidade, IBAN, horas, execução)."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {fases.map(f => {
          const subset = items.filter(d => d.fase === f.id);
          const done = subset.filter(d => d.estado === "ok").length;
          return (
            <button
              key={f.id}
              onClick={() => { setFase(prev => (prev === f.id ? "todas" : f.id)); }}
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
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {fase === "todas" ? "Documentos desta turma" : fases.find(f => f.id === fase)?.label}
            </p>
            <p className="text-xs text-slate-400">
              Os itens marcados <span className="font-semibold">automático</span> saem dos dados reais da turma (sessões, presenças, documentos dos formandos). Nos restantes, clique no estado para validar. A lista vem da estrutura definida na ficha do curso.
            </p>
          </div>
          <button onClick={() => setFase("todas")} className="text-xs font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap">Ver tudo</button>
        </div>
        <div className="divide-y divide-slate-100">
          {visiveis.map(doc => {
            const s = estadoStyle[doc.estado];
            return (
              <div key={doc.id} className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${s.row}`}>
                <button
                  onClick={() => onToggle?.(doc, doc.origem === "auto" ? cycle(doc.estado) : cycle(doc.estado))}
                  title={doc.origem === "auto" ? "Sai dos dados da turma. Clique para forçar outro estado." : "Marcar estado"}
                  className={`self-start sm:self-center text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${s.badge}`}
                >
                  {s.label}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{doc.label}</p>
                    {doc.bloqueante && doc.estado !== "ok" && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">bloqueante</span>
                    )}
                    {doc.origem === "auto" && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">automático</span>
                    )}
                    {doc.extra && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${isGold ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>curso</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.detalhe}</p>
                  {doc.anexo?.url && (
                    <a href={doc.anexo.url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 mt-1 inline-block">
                      {doc.anexo.fileName || "Abrir no Drive"}
                    </a>
                  )}
                  {doc.origem === "manual" && onToggle && (
                    <button type="button" onClick={() => onToggle(doc, "auto")} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 mt-1">
                      Voltar ao estado automático
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
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
          fase: uploadFor?.fase,
        }}
        onConfirm={file => {
          if (uploadFor) onAnexo?.(uploadFor, { id: file.id, name: file.name, openUrl: file.openUrl });
        }}
      />
    </div>
  );
}
