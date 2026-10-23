// Aba Documentos do cockpit da turma: lista por grupo e resolução de cada documento.
import { useState, useRef, useEffect, useMemo } from "react";
import { itensPip, itensSimulacao, type CriterioAvaliacao, type ResolveDocTarget, type PipItem, type SimItem } from "../../../../partilhado/TurmaExtras";
import { ResolverDocumentoModal } from "../../../DocResolver";
import { type ProgramaDocumentos, type SessaoCronograma } from "../../../../partilhado/turmaModel";
import { finGruposDocumentosTurma, labelsSessoesFin } from "../../../../partilhado/finDossierUi";
import { type FormandoFin } from "../../../../partilhado/tiposFormando";
import { type TurmaDocumento } from "../../../../partilhado/api";
import { Card } from "./base";
import { gruposGold, listaDe, metaGrupo, type DocEstado, type DocItem, type GrupoDocs, type ItemDtp } from "./documentosDados";

export function cloneGrupos(src: GrupoDocs[]) {
  return src.map(g => ({ ...g, items: g.items.map(i => ({ ...i })) }));
}

export function DocumentosTurmaTab({ regime = "gold", curso, guardados, onSaveDoc, onSaveDtp, criterios, finCtx, dtpItems = [], formandos = [], sessoes = [] }: {
  regime?: "gold" | "fin";
  curso?: string;
  /** Itens do dossiê da turma (servidor): dão o estado e o detalhe dos documentos que lá existem. */
  dtpItems?: ItemDtp[];
  /** Marca o item no dossiê do servidor (PUT …/dtp/:itemId). */
  onSaveDtp?: (itemId: string, estado: DocEstado) => void;
  /** Nomes dos formandos desta turma. */
  formandos?: string[];
  /** Rótulos das sessões do cronograma desta turma. */
  sessoes?: string[];
  guardados: TurmaDocumento[];
  onSaveDoc: (doc: TurmaDocumento) => void;
  criterios?: CriterioAvaliacao[];
  finCtx?: {
    formandos: FormandoFin[];
    facts: { sessoes: { done: number; total: number }; planos: { done: number; total: number }; sumarios: { done: number; total: number }; presencas: { done: number; total: number } };
    cronograma: SessaoCronograma[];
    curso?: string;
    ufcdCod?: string;
    horas?: number;
    dtpPct?: number;
    programa?: ProgramaDocumentos | null;
  };
}) {
  const estadoCfg: Record<DocEstado, { dot: string; chip: string; label: string }> = {
    ok: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "No dossiê" },
    parcial: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-700 border-amber-200", label: "Parcial" },
    falta: { dot: "bg-red-400", chip: "bg-red-50 text-red-600 border-red-200", label: "Em falta" },
  };
  const seed = useMemo((): GrupoDocs[] => {
    if (regime !== "fin") return gruposGold(dtpItems);
    if (!finCtx) return [];
    const built = finGruposDocumentosTurma({
      formandos: finCtx.formandos,
      facts: { ...finCtx.facts, formandos: finCtx.formandos.length, certificados: { done: 0, total: finCtx.formandos.length } },
      cronograma: finCtx.cronograma,
      curso: finCtx.curso ?? curso,
      ufcdCod: finCtx.ufcdCod,
      horas: finCtx.horas,
      dtpPct: finCtx.dtpPct,
      programa: finCtx.programa,
    });
    return built.map(g => ({ ...metaGrupo(g.id, "fin"), items: g.items.map(it => ({ ...it, bloqueante: it.bloqueante })) }));
  }, [regime, finCtx, curso, dtpItems]);
  const dtpPorId = useMemo(() => new Map(dtpItems.map(i => [i.id, i])), [dtpItems]);
  const [resolver, setResolver] = useState<{ grupoId: string; label: string } | null>(null);
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;
  useEffect(() => { setResolver(null); }, [regime]);

  const grupos = useMemo(() => cloneGrupos(seed).map(g => ({
    ...g,
    items: g.items.map(item => {
      const saved = guardados.find(d => d.grupoId === g.id && d.label === item.label);
      // O que existe no dossiê do servidor mostra o estado de lá; turma_documentos só guarda a lista marcada.
      const dtp = item.dtpId ? dtpPorId.get(item.dtpId) : undefined;
      if (dtp) return { ...item, estado: dtp.estado, detalhe: dtp.detalhe || item.detalhe, payload: saved?.payload ?? undefined };
      if (!saved) return { ...item, payload: undefined };
      return { ...item, estado: saved.estado as DocEstado, detalhe: saved.detalhe || item.detalhe, payload: saved.payload ?? undefined };
    }),
  })), [seed, guardados, dtpPorId]);

  const nomesFormandos = regime === "fin"
    ? (finCtx?.formandos ?? []).map(f => `${f.nome} ${f.apelido}`)
    : formandos;
  const nomesSessoes = regime === "fin" ? labelsSessoesFin(finCtx?.cronograma ?? []) : sessoes;
  const cursoNome = curso;

  const aberto = resolver
    ? grupos.flatMap(g => g.items.filter(d => g.id === resolver.grupoId && d.label === resolver.label).map(d => ({ grupoId: g.id, grupo: g.id, doc: d })))[0]
    : undefined;

  function abrir(grupoId: string, doc: { label: string; detalhe: string; estado: DocEstado }) {
    setResolver({ grupoId, label: doc.label });
  }

  function targetFromDoc(grupoId: string, doc: DocItem): ResolveDocTarget {
    const isPip = doc.label === "PIP";
    const isSim = /simula/i.test(doc.label);
    if (isPip) {
      return {
        label: doc.label, detalhe: doc.detalhe, estado: doc.estado, kind: "pip",
        pipItems: itensPip(nomesFormandos, doc.payload as PipItem[] | undefined),
      };
    }
    if (isSim) {
      const lista = criterios ?? [];
      return {
        label: doc.label, detalhe: doc.detalhe, estado: doc.estado, kind: "simulacao",
        simItems: itensSimulacao(nomesFormandos, lista, doc.payload as SimItem[] | undefined),
        criterios: lista,
        curso: cursoNome ?? "",
      };
    }
    const lista = grupoId === "formandos" || grupoId === "sessoes";
    const nomes = grupoId === "sessoes" ? nomesSessoes : nomesFormandos;
    return {
      label: doc.label,
      detalhe: doc.detalhe,
      estado: doc.estado,
      kind: lista ? "lista" : "ficheiro",
      items: lista ? listaDe(nomes, doc.payload) : undefined,
    };
  }

  return (
    <div className="space-y-4">
      {grupos.map(g => {
        const ok = g.items.filter(d => d.estado === "ok").length;
        return (
          <Card key={g.id}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${g.color} rounded-t-xl`}>
              <div className="flex items-center gap-2"><span>{g.icon}</span><p className="text-sm font-semibold">{g.label}</p></div>
              <span className="text-xs font-bold">{ok}/{g.items.length} no dossiê</span>
            </div>
            <div className="divide-y divide-slate-50">
              {g.items.map(doc => {
                const cfg = estadoCfg[doc.estado];
                return (
                  <div key={doc.label} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-medium text-slate-800">{doc.label}</p>
                        {doc.bloqueante && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">bloqueante</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{doc.detalhe}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrir(g.id, doc)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${doc.estado === "ok" ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50" : regime === "gold" ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}>
                        {doc.estado === "ok" ? "Substituir" : "Resolver"}
                      </button>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.chip} whitespace-nowrap`}>{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <ResolverDocumentoModal
        open={!!aberto}
        onClose={() => setResolver(null)}
        accent={regime}
        target={aberto ? targetFromDoc(aberto.grupoId, aberto.doc) : null}
        onSave={next => {
          const ref = resolverRef.current;
          if (!ref) return;
          // Itens manuais do dossiê gravam-se lá; os automáticos continuam a sair dos dados.
          const dtpId = grupos.find(g => g.id === ref.grupoId)?.items.find(d => d.label === ref.label)?.dtpId;
          const dtp = dtpId ? dtpPorId.get(dtpId) : undefined;
          if (dtpId && dtp?.origem === "manual" && onSaveDtp) onSaveDtp(dtpId, next.estado);
          onSaveDoc({
            grupoId: ref.grupoId,
            label: ref.label,
            estado: next.estado,
            detalhe: next.detalhe,
            payload: next.payload ?? null,
          });
        }}
      />
    </div>
  );
}
