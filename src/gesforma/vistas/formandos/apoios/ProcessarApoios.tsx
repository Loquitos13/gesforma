import { useEffect, useState } from "react";
import {
  apiApoiosTurma, apiEstadoApoiosTurma, apiProcessarApoios, type PreviaFormando, type ResultadoProcessar,
} from "../../../../partilhado/api/apoios";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { toastError } from "../../../../partilhado/toastBus";
import {
  Aviso, Botao, ErroCarregar, Esqueleto, Estado, PainelLateral, Selecao, Separadores, Vazio, eur, num,
} from "../../../../partilhado/ui";
import { ESTADO_APOIO, exportarApoios, mesAtual, nomeMes } from "./comum";
import { INVALIDAR_APOIOS, MarcarPago } from "./dialogos";

type Passo = "rever" | "registos";

/**
 * Apoios de uma turma da Financiada num mês: rever o cálculo antes de registar,
 * depois aprovar, marcar como pago (em lote) e exportar para as transferências.
 */
export function ProcessarApoios({ turma, aberto, onFechar }: {
  turma: { id: number; nome: string } | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const turmaId = turma?.id ?? 0;
  const [mes, setMes] = useState(mesAtual());
  const [passo, setPasso] = useState<Passo>("rever");
  const [previa, setPrevia] = useState<ResultadoProcessar | null>(null);
  const [erroPrevia, setErroPrevia] = useState<unknown>(null);
  const [aCalcular, setACalcular] = useState(false);
  const [pagar, setPagar] = useState(false);
  const [aExportar, setAExportar] = useState(false);
  const info = useRecurso(aberto && turmaId ? `apoios:turma:${turmaId}:${mes}` : null, s => apiApoiosTurma(turmaId, mes, s));

  // Ao abrir, escolhe o mês mais recente já decorrido com sessões.
  const meses = info.dados?.meses ?? [];
  useEffect(() => {
    if (!aberto) { setPrevia(null); setPasso("rever"); }
  }, [aberto]);
  useEffect(() => {
    if (!aberto || !meses.length || meses.includes(mes)) return;
    setMes(meses.find(m => m <= mesAtual()) ?? meses[meses.length - 1]!);
  }, [aberto, meses, mes]);

  async function calcular() {
    setACalcular(true);
    setErroPrevia(null);
    try {
      setPrevia(await apiProcessarApoios(turmaId, mes, false));
    } catch (e) {
      setErroPrevia(e);
      setPrevia(null);
    } finally {
      setACalcular(false);
    }
  }
  useEffect(() => { if (aberto && turmaId && passo === "rever") void calcular(); }, [aberto, turmaId, mes, passo]); // eslint-disable-line react-hooks/exhaustive-deps

  const registar = useAccao(() => apiProcessarApoios(turmaId, mes, true), {
    invalidar: INVALIDAR_APOIOS,
    ok: r => r.contagem ? `Registados: ${r.contagem.criado} novo(s), ${r.contagem.atualizado} recalculado(s).` : "Apoios registados.",
  });
  const aprovar = useAccao(() => apiEstadoApoiosTurma(turmaId, { mes, de: "calculado", para: "aprovado" }), {
    invalidar: INVALIDAR_APOIOS, ok: r => `${r.alterados} apoio(s) aprovado(s).`,
  });

  const registos = info.dados?.registos ?? [];
  const totais = info.dados?.totais ?? {};
  const totalPrevia = previa?.formandos.reduce((s, f) => s + f.total, 0) ?? 0;
  const semIban = previa?.formandos.filter(f => f.linhas.some(l => l.bloqueadoIban)).length ?? 0;

  async function exportar() {
    setAExportar(true);
    try { await exportarApoios(turmaId, mes); } catch (e) { toastError(e, "Não foi possível exportar."); } finally { setAExportar(false); }
  }

  const rodape = passo === "rever" ? (
    <>
      <Botao variante="fantasma" onClick={onFechar}>Fechar</Botao>
      <Botao
        variante="primario"
        disabled={!previa || totalPrevia <= 0}
        aCarregar={registar.aCorrer}
        onClick={async () => { if (await registar.correr()) setPasso("registos"); }}
      >
        Registar apoios de {nomeMes(mes)}
      </Botao>
    </>
  ) : (
    <>
      <Botao variante="fantasma" onClick={onFechar}>Fechar</Botao>
      <Botao disabled={!registos.length} aCarregar={aExportar} onClick={() => void exportar()}>Exportar Excel</Botao>
      {(totais.calculado?.n ?? 0) > 0 && <Botao variante="primario" aCarregar={aprovar.aCorrer} onClick={() => void aprovar.correr()}>Aprovar {totais.calculado!.n}</Botao>}
      {(totais.aprovado?.n ?? 0) > 0 && <Botao variante="primario" onClick={() => setPagar(true)}>Marcar {totais.aprovado!.n} como pagos</Botao>}
    </>
  );

  return (
    <PainelLateral
      aberto={aberto}
      onFechar={onFechar}
      largura={720}
      titulo="Apoios da turma"
      subtitulo={turma?.nome}
      rodape={rodape}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-tinta">
            Mês
            <Selecao value={mes} onChange={e => setMes(e.target.value)} opcoes={(meses.length ? meses : [mes]).map(m => ({ valor: m, rotulo: nomeMes(m) }))} />
          </label>
          <Separadores<Passo>
            rotulo="Passos"
            ativo={passo}
            onMudar={setPasso}
            estilo="pilula"
            itens={[{ id: "rever", rotulo: "Rever cálculo" }, { id: "registos", rotulo: `Registados (${registos.length})` }]}
          />
        </div>

        {passo === "rever" && (
          aCalcular && !previa ? <Esqueleto linhas={6} altura="h-6" />
            : erroPrevia ? <ErroCarregar erro={erroPrevia} onTentar={() => void calcular()} />
              : previa && <Revisao previa={previa} total={totalPrevia} semIban={semIban} />
        )}

        {passo === "registos" && (
          info.erro != null && !info.dados ? <ErroCarregar erro={info.erro} onTentar={info.recarregar} />
            : !info.dados ? <Esqueleto linhas={6} altura="h-6" />
              : registos.length === 0 ? <Vazio compacto titulo={`Sem apoios registados em ${nomeMes(mes)}.`} descricao="Reveja o cálculo e registe." />
                : (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(ESTADO_APOIO) as (keyof typeof ESTADO_APOIO)[]).filter(e => totais[e]).map(e => (
                        <Estado key={e} tom={ESTADO_APOIO[e].tom}>{ESTADO_APOIO[e].rotulo}: {totais[e]!.n} · {eur(totais[e]!.valor, true)}</Estado>
                      ))}
                    </div>
                    <div className="overflow-x-auto border border-linha rounded-controlo">
                      <table className="w-full text-sm num">
                        <thead className="bg-fundo text-xs text-tinta-suave">
                          <tr><th className="text-left px-3 py-2 font-semibold">Formando</th><th className="text-left px-3 py-2 font-semibold">Apoio</th><th className="text-right px-3 py-2 font-semibold">Valor</th><th className="text-left px-3 py-2 font-semibold">Estado</th></tr>
                        </thead>
                        <tbody className="divide-y divide-linha-suave">
                          {registos.map(r => (
                            <tr key={r.id}>
                              <td className="px-3 py-2">{r.formando}</td>
                              <td className="px-3 py-2">{r.rotulo}</td>
                              <td className="px-3 py-2 text-right">{eur(r.valor, true)}</td>
                              <td className="px-3 py-2"><Estado tom={ESTADO_APOIO[r.estado].tom}>{ESTADO_APOIO[r.estado].rotulo}</Estado></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="m-0 text-xs text-tinta-suave">Ajustes e anulações fazem-se na ficha de cada formando, separador Apoios. A exportação inclui o IBAN completo e fica registada.</p>
                  </div>
                )
        )}
      </div>
      <MarcarPago
        aberto={pagar}
        onFechar={() => setPagar(false)}
        titulo={`Pagar apoios de ${nomeMes(mes)}`}
        descricao={totais.aprovado ? `${totais.aprovado.n} apoio(s) aprovados · ${eur(totais.aprovado.valor, true)}` : undefined}
        onConfirmar={async (pagoEm, referencia) => {
          try {
            const r = await apiEstadoApoiosTurma(turmaId, { mes, de: "aprovado", para: "pago", pagoEm, referencia });
            for (const p of INVALIDAR_APOIOS) invalidar(p);
            info.recarregar();
            return r;
          } catch (e) {
            toastError(e, "Não foi possível marcar como pagos.");
            return undefined;
          }
        }}
      />
    </PainelLateral>
  );
}

function Revisao({ previa, total, semIban }: { previa: ResultadoProcessar; total: number; semIban: number }) {
  if (!previa.formandos.length) return <Vazio compacto titulo="Sem formandos na turma." />;
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-tinta-suave">
        Cálculo a partir das folhas de presença de {nomeMes(previa.mes)}. Total a registar: <strong className="text-tinta num">{eur(total, true)}</strong>.
        Apoios já aprovados ou pagos não mudam.
      </p>
      {semIban > 0 && (
        <Aviso tom="aviso" titulo={`${semIban} formando(s) sem IBAN`}>
          Os apoios que exigem IBAN não são registados para estes formandos. Indique o IBAN na ficha e volte a processar o mês.
        </Aviso>
      )}
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {previa.formandos.map(f => <LinhaRevisao key={f.formandoId} f={f} />)}
      </ul>
    </div>
  );
}

function LinhaRevisao({ f }: { f: PreviaFormando }) {
  return (
    <li className="border border-linha rounded-controlo px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="m-0 flex-1 min-w-0 text-sm font-medium text-tinta">{f.nome}</p>
        <span className="text-xs text-tinta-suave num">{num(f.horasPresente)} h · {f.assiduidade == null ? "sem folhas" : `${num(f.assiduidade)} %`}</span>
        {!f.temIban && <Estado tom="perigo">Sem IBAN</Estado>}
        <span className="num font-semibold text-tinta w-24 text-right">{eur(f.total, true)}</span>
      </div>
      <ul className="m-0 mt-1.5 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
        {f.linhas.map(l => (
          <li key={l.tipo} title={l.exclusao || undefined}>
            {l.rotulo}: <span className={l.bloqueadoIban || l.exclusao ? "line-through" : "text-tinta"}>{eur(l.valor, true)}</span>
            {l.aplicadoTeto && " (teto)"}
            {l.estadoAtual && l.estadoAtual !== "calculado" && ` · já ${ESTADO_APOIO[l.estadoAtual].rotulo.toLowerCase()}`}
          </li>
        ))}
      </ul>
    </li>
  );
}
