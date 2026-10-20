// Aba Certificados do cockpit da turma: presenças, notas e emissão por formando.
// A assiduidade e a elegibilidade vêm do servidor (`/resultados`), a mesma regra que decide a emissão.
import { type CertificadoPreview } from "../../../ActionSurfaces";
import { EmptyHint } from "../../../../partilhado/SecretaryUX";
import { cursoECcp, formatNota } from "../../../avaliacaoCurso";
import { apiResultadosTurma, type ResultadoFormandoApi, type TurmaCertificado } from "../../../../partilhado/api";
import { toastError } from "../../../../partilhado/toastBus";
import { Card, Th, Td, I, ActBtn } from "./base";
import { useResultadosTurma } from "./dados";
import { hojeLisboa } from "../../../../partilhado/horaLisboa";

export function CertificadosTurmaTab({ formandos, certificados, onUpload, onView, onNota, curso, turma, regime, turmaId }: {
  formandos: { id: number; nome: string }[];
  certificados: Record<number, TurmaCertificado>;
  onUpload?: (id: number, nota?: number | null) => void;
  onView?: (c: CertificadoPreview) => void;
  onNota?: (id: number, patch: { nota?: number | null; elearning?: number | null }) => Promise<unknown> | void;
  curso?: string;
  turma?: string;
  regime: "gold" | "fin";
  turmaId: number;
}) {
  const ccp = cursoECcp(curso);
  const { resultados, erro, recarregar } = useResultadosTurma(regime, turmaId > 0 ? turmaId : undefined);
  const porId = new Map((resultados?.formandos ?? []).map(r => [r.id, r]));
  const unidade = resultados?.avaliacao.unidade ?? "valores";
  const minimo = resultados?.avaliacao.minimoAprovacao ?? 10;
  const assidMin = resultados?.formandos[0]?.assiduidadeMinima;
  const elearningMin = resultados?.regras.elearningMin ?? 50;
  const regra = `${assidMin != null ? `${assidMin}%` : "o mínimo"} de assiduidade e ${ccp ? `nota ≥ ${minimo}` : `aprovação (e-learning ≥ ${elearningMin} quando não há grelha)`}`;
  const rows = formandos.map(f => {
    const r: ResultadoFormandoApi | undefined = porId.get(f.id);
    const cert = certificados[f.id];
    return {
      id: f.id,
      nome: f.nome,
      r,
      presencas: r?.assiduidade.pct ?? null,
      minimoPresencas: r?.assiduidadeMinima ?? null,
      elearning: cert?.elearning ?? r?.elearning ?? null,
      nota: r?.nota ?? null,
      elegivel: Boolean(r?.elegivel),
      certificado: cert?.emitido ?? false,
      ficheiroId: cert?.ficheiroId ?? "",
      ficheiroUrl: cert?.ficheiroUrl ?? "",
    };
  });
  const externo = regime === "fin";

  function gravarNota(id: number, patch: { elearning: number | null }) {
    void Promise.resolve(onNota?.(id, patch)).finally(recarregar);
  }

  /** Confirma a elegibilidade no servidor antes de abrir o carregamento: um ficheiro recusado ficaria solto no Drive. */
  async function pedirUpload(c: typeof rows[number]) {
    try {
      const atual = (await apiResultadosTurma(regime, turmaId)).formandos.find(f => f.id === c.id);
      if (!atual?.elegivel) {
        toastError(new Error(`Sem condições para certificado: ${atual?.motivos.join(" ") || "formando sem resultados."}`));
        recarregar();
        return;
      }
      onUpload?.(c.id, ccp ? atual.nota : null);
    } catch (err) {
      toastError(err, "Não foi possível confirmar a elegibilidade.");
    }
  }

  function exportarSigo() {
    const linhas = ["Nome;Curso;Turma;Presenças %;Resultado e-learning;Elegível"];
    for (const c of rows) {
      const eleg = c.elegivel ? "Sim" : "Não";
      linhas.push([c.nome, curso ?? "", turma ?? "", c.presencas ?? "", c.elearning ?? "", eleg].map(v => String(v).split(";").join(",")).join(";"));
    }
    const blob = new Blob([`﻿${linhas.join("\n")}`], { type: "text/csv;charset=utf-8" });
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
          { l: "Elegíveis", v: rows.filter(c => c.elegivel).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { l: "Não elegíveis", v: resultados ? rows.filter(c => !c.elegivel).length : 0, color: "text-amber-600", bg: "bg-amber-50" },
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
                ? `O certificado legal obtém-se fora do GesForma. Carregue o PDF de cada formando elegível: ${regra}. A nota do Moodle, quando a grelha a pede, continua a lançar-se à mão.`
                : ccp
                ? `No CCP a nota é a da grelha de avaliação. Mínimo: ${regra}. A assiduidade conta as horas das folhas de presença.`
                : `Mínimo: ${regra}. O resultado de e-learning é o valor a lançar no SIGO. A assiduidade conta as horas das folhas de presença.`}
            </p>
            {erro != null && !resultados && <p role="alert" className="text-xs text-red-600 mt-1">Não foi possível calcular a elegibilidade. Tente recarregar.</p>}
          </div>
          {!ccp && (
            <button type="button" onClick={exportarSigo} disabled={!resultados} className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              Exportar para o SIGO
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>
              <Th>Formando</Th>
              <Th className="text-center">Assiduidade</Th>
              {!ccp && <Th className="text-center">E-learning / SIGO</Th>}
              <Th className="text-center">Nota final</Th>
              <Th className="text-center">Elegibilidade</Th>
              <Th className="text-center">Certificado</Th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => {
                const elegivel = c.elegivel;
                const motivos = c.r?.motivos.join(" ") ?? "";
                const okPresencas = c.presencas != null && c.minimoPresencas != null && c.presencas >= c.minimoPresencas;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="text-xs font-medium text-slate-800">{c.nome}</Td>
                    <Td className="text-center">
                      {c.presencas == null ? (
                        <span className="text-xs text-slate-400">{c.r ? "sem horas" : "—"}</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, c.presencas)}%`, backgroundColor: okPresencas ? "#10B981" : "#EF4444" }} /></div>
                          <span className={`text-xs font-bold ${okPresencas ? "text-emerald-600" : "text-red-600"}`}>{c.presencas}%</span>
                        </div>
                      )}
                    </Td>
                    {!ccp && (
                      <Td className="text-center">
                        <input
                          type="number" min={0} max={100} value={c.elearning ?? ""}
                          onChange={e => gravarNota(c.id, { elearning: e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) })}
                          placeholder="-"
                          aria-label={`Resultado de e-learning de ${c.nome}`}
                          className="w-16 px-2 py-1 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </Td>
                    )}
                    <Td className="text-center">
                      <span className={`text-xs font-bold ${c.r?.aprovado === false ? "text-red-600" : "text-slate-800"}`}>
                        {formatNota(c.nota, unidade)}
                      </span>
                    </Td>
                    <Td className="text-center">
                      {!c.r
                        ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Por calcular</span>
                        : <span title={motivos || undefined} className={`text-xs font-bold px-2.5 py-1 rounded-full ${elegivel ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{elegivel ? "Elegível" : "Não elegível"}</span>}
                    </Td>
                    <Td className="text-center">
                      {externo ? (
                        c.ficheiroId
                          ? <div className="flex items-center justify-center gap-1">
                              {c.ficheiroUrl
                                ? <a href={c.ficheiroUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 font-semibold">PDF carregado</a>
                                : <span className="text-xs text-emerald-600 font-semibold">PDF carregado</span>}
                              <button type="button" onClick={() => void pedirUpload(c)} disabled={!elegivel} title={elegivel ? undefined : motivos} className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Substituir</button>
                            </div>
                          : <button type="button" onClick={() => void pedirUpload(c)} disabled={!elegivel} title={elegivel ? "Carregar o certificado obtido fora do GesForma" : motivos || `Precisa de ${regra}`} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">Carregar certificado</button>
                      ) : c.certificado
                        ? <div className="flex items-center justify-center gap-1"><span className="text-xs text-emerald-600 font-semibold">Emitido</span><ActBtn icon={I.eye} label="Ver certificado emitido" color="gray" onClick={() => onView?.({ nome: c.nome, nota: c.nota ?? c.elearning ?? 0, curso, turma, data: hojeLisboa() })} /></div>
                        : <button onClick={() => void pedirUpload(c)} disabled={!elegivel} title={elegivel ? "Carregar certificado" : motivos || `Precisa de ${regra}`} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">Upload</button>}
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
