// Aba Certificados do cockpit da turma: presenças, notas e emissão por formando.
import { useState, useEffect, useMemo } from "react";
import { type CertificadoPreview } from "../../../ActionSurfaces";
import { EmptyHint } from "../../../../partilhado/SecretaryUX";
import { useProgramaDoCurso } from "../../../cursoPrograma";
import { cursoECcp, formatNota, mapaNotas, notaFinalFormando, useAvaliacaoCurso, type NotaAvaliacao } from "../../../avaliacaoCurso";
import { apiTurmaAvaliacao, type TurmaCertificado } from "../../../../partilhado/api";
import { type PresencaRow } from "../../../PedagogiaContext";
import { Card, Th, Td, I, ActBtn } from "./base";

export function CertificadosTurmaTab({ formandos, certificados, presencas, sessoesRegistadas, onUpload, onView, onNota, curso, turma, regime, turmaId }: {
  formandos: { id: number; nome: string }[];
  certificados: Record<number, TurmaCertificado>;
  presencas: Record<number, PresencaRow[]>;
  sessoesRegistadas: number;
  onUpload?: (id: number, nota?: number | null) => void;
  onView?: (c: CertificadoPreview) => void;
  onNota?: (id: number, patch: { nota?: number | null; elearning?: number | null }) => void;
  curso?: string;
  turma?: string;
  regime: "gold" | "fin";
  turmaId: number;
}) {
  const ccp = cursoECcp(curso);
  const cfg = useAvaliacaoCurso(regime, curso);
  const programa = useProgramaDoCurso(regime, curso);
  const [notasAval, setNotasAval] = useState<NotaAvaliacao[]>([]);
  useEffect(() => {
    if (turmaId <= 0) return;
    let alive = true;
    apiTurmaAvaliacao(regime, turmaId)
      .then(r => { if (alive) setNotasAval(r.notas); })
      .catch(() => { if (alive) setNotasAval([]); });
    return () => { alive = false; };
  }, [regime, turmaId]);
  const mapa = useMemo(() => mapaNotas(notasAval), [notasAval]);
  const momentos = cfg.momentos?.map(m => m.id) ?? [];
  const modulos = cfg.modo === "modulos" ? (momentos.length ? momentos : programa.topicos.map(t => t.id)) : [];
  const folhas = Object.values(presencas);
  const rows = formandos.map(f => {
    const marcadas = folhas.filter(rows => rows.some(r => r.id === f.id));
    const presentes = marcadas.filter(rows => rows.find(r => r.id === f.id)?.presente).length;
    const cert = certificados[f.id];
    const notaCcp = ccp ? notaFinalFormando(cfg, mapa, f.id, modulos, programa.topicos) : null;
    return {
      id: f.id,
      nome: f.nome,
      presencas: marcadas.length ? Math.round((presentes / marcadas.length) * 100) : null,
      folhas: marcadas.length,
      elearning: cert?.elearning ?? null,
      nota: ccp ? notaCcp : (cert?.nota ?? null),
      notaFinal: notaFinalFormando(cfg, mapa, f.id, modulos, programa.topicos),
      certificado: cert?.emitido ?? false,
      ficheiroId: cert?.ficheiroId ?? "",
      ficheiroUrl: cert?.ficheiroUrl ?? "",
      ficheiroNome: cert?.ficheiroNome ?? "",
    };
  });
  const minimo = cfg.minimoAprovacao || 10;
  const externo = regime === "fin";
  const elegivelRow = (c: typeof rows[number]) => {
    if (c.presencas == null || c.presencas < 75) return false;
    if (ccp) return c.nota != null && c.nota >= minimo;
    return c.elearning != null && c.elearning >= 50;
  };
  function exportarSigo() {
    const linhas = ["Nome;Curso;Turma;Presenças %;Resultado e-learning;Elegível"];
    for (const c of rows) {
      const eleg = elegivelRow(c) ? "Sim" : "Não";
      linhas.push([c.nome, curso ?? "", turma ?? "", c.presencas ?? "", c.elearning ?? "", eleg].map(v => String(v).split(";").join(",")).join(";"));
    }
    const blob = new Blob([`\uFEFF${linhas.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const nome = (turma || curso || "turma").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
    a.href = URL.createObjectURL(blob);
    a.download = `sigo-${nome || "turma"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  if (formandos.length === 0) {
    return (
      <Card>
        <EmptyHint text="Sem formandos inscritos nesta turma, não há certificados a emitir." />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Elegíveis", v: rows.filter(elegivelRow).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { l: "Sem dados suficientes", v: rows.filter(c => c.presencas == null || (ccp ? c.nota == null : c.elearning == null)).length, color: "text-amber-600", bg: "bg-amber-50" },
          { l: externo ? "Certificados carregados" : "Certificados emitidos", v: rows.filter(c => externo ? Boolean(c.ficheiroId) : c.certificado).length, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(s => (
          <Card key={s.l} className={`p-4 ${s.bg}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{s.l}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.v}</p>
          </Card>
        ))}
      </div>
      <Card>
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-700">Elegibilidade por formando</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {externo
                ? `O certificado legal obtém-se fora do GesForma. Carregue o PDF de cada formando elegível com aproveitamento: 75% de presenças e ${ccp ? `nota ≥ ${minimo}` : "resultado de e-learning ≥ 50"}. A nota do Moodle, quando a grelha a pede, continua a lançar-se à mão.`
                : ccp
                ? `No CCP a nota é a média da grelha de avaliação (simulação inicial e final). Mínimo: 75% de presenças e nota ≥ ${minimo}. As presenças vêm das ${sessoesRegistadas} folhas já registadas.`
                : `Mínimo: 75% de presenças e resultado de e-learning ≥ 50. Esse resultado é o valor a lançar no SIGO. As presenças vêm das ${sessoesRegistadas} folhas já registadas.`}
            </p>
          </div>
          {!ccp && (
            <button type="button" onClick={exportarSigo} className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              Exportar para o SIGO
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>
              <Th>Formando</Th>
              <Th className="text-center">Presenças</Th>
              {ccp ? <Th className="text-center">Nota da avaliação</Th> : <Th className="text-center">E-learning / SIGO</Th>}
              <Th className="text-center">Nota final</Th>
              <Th className="text-center">Elegibilidade</Th>
              <Th className="text-center">Certificado</Th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => {
                const elegivel = elegivelRow(c);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="text-xs font-medium text-slate-800">{c.nome}</Td>
                    <Td className="text-center">
                      {c.presencas == null ? (
                        <span className="text-xs text-slate-400">sem folhas</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${c.presencas}%`, backgroundColor: c.presencas >= 75 ? "#10B981" : "#EF4444" }} /></div>
                          <span className={`text-xs font-bold ${c.presencas >= 75 ? "text-emerald-600" : "text-red-600"}`}>{c.presencas}%</span>
                        </div>
                      )}
                    </Td>
                    <Td className="text-center">
                      {ccp ? (
                        <span className={`text-xs font-bold ${c.nota != null && c.nota < minimo ? "text-red-600" : "text-slate-800"}`}>{c.nota == null ? "—" : c.nota}</span>
                      ) : (
                        <input
                          type="number" min={0} max={100} value={c.elearning ?? ""}
                          onChange={e => onNota?.(c.id, { elearning: e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) })}
                          placeholder="-"
                          aria-label={`Resultado de e-learning de ${c.nome}`}
                          className="w-16 px-2 py-1 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      )}
                    </Td>
                    <Td className="text-center">
                      <span className={`text-xs font-bold ${c.notaFinal != null && c.notaFinal < minimo ? "text-red-600" : "text-slate-800"}`}>
                        {formatNota(c.notaFinal, cfg.unidade)}
                      </span>
                    </Td>
                    <Td className="text-center">
                      {(ccp ? c.nota == null : c.elearning == null) || c.presencas == null
                        ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Por avaliar</span>
                        : <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${elegivel ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{elegivel ? "Elegível" : "Não elegível"}</span>}
                    </Td>
                    <Td className="text-center">
                      {externo ? (
                        c.ficheiroId
                          ? <div className="flex items-center justify-center gap-1">
                              {c.ficheiroUrl
                                ? <a href={c.ficheiroUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 font-semibold">PDF carregado</a>
                                : <span className="text-xs text-emerald-600 font-semibold">PDF carregado</span>}
                              <button type="button" onClick={() => onUpload?.(c.id, ccp ? c.nota : null)} className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg">Substituir</button>
                            </div>
                          : <button type="button" onClick={() => onUpload?.(c.id, ccp ? c.nota : null)} disabled={!elegivel} title={elegivel ? "Carregar o certificado obtido fora do GesForma" : ccp ? `Precisa de 75% de presenças e nota ≥ ${minimo}` : "Precisa de 75% de presenças e resultado de e-learning ≥ 50"} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">Carregar certificado</button>
                      ) : c.certificado
                        ? <div className="flex items-center justify-center gap-1"><span className="text-xs text-emerald-600 font-semibold">Emitido</span><ActBtn icon={I.eye} label="Ver certificado emitido" color="gray" onClick={() => onView?.({ nome: c.nome, nota: c.nota ?? c.elearning ?? 0, curso, turma, data: new Date().toISOString().slice(0, 10) })} /></div>
                        : <button onClick={() => onUpload?.(c.id, ccp ? c.nota : null)} disabled={!elegivel} title={elegivel ? "Carregar certificado" : ccp ? `Precisa de 75% de presenças e nota ≥ ${minimo}` : "Precisa de 75% de presenças e resultado de e-learning ≥ 50"} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">Upload</button>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
