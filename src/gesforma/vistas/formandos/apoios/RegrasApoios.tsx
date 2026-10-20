import { useEffect, useMemo, useState } from "react";
import {
  apiGravarRegrasApoios, apiRegrasApoios, type ModoApoio, type RegraApoio, type RegraGuardada, type TipoApoio,
} from "../../../../partilhado/api/apoios";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { numeroPt } from "../../../../partilhado/ui/formatos";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import {
  Aviso, Botao, Cartao, Caixa, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado, Interruptor, Selecao, eur,
} from "../../../../partilhado/ui";
import { MODO_APOIO } from "./comum";
import { INVALIDAR_APOIOS } from "./dialogos";

type Linha = { tipo: TipoApoio; ativo: boolean; modo: ModoApoio; valor: string; minHorasDia: string; tetoMensal: string; assiduidadeMinima: string; requerIban: boolean; notas: string };

const MODO_SUGERIDO: Record<TipoApoio, ModoApoio> = { bolsa: "hora", alimentacao: "dia", transporte: "dia", acolhimento: "mes", alojamento: "mes" };

/** Âmbito codificado num só valor: "g" (geral), "f:<financiador>" ou "t:<turmaId>". */
function ambitoDe(v: string): { financiador: string; turmaId: number | null } {
  if (v.startsWith("t:")) return { financiador: "", turmaId: Number(v.slice(2)) };
  if (v.startsWith("f:")) return { financiador: v.slice(2), turmaId: null };
  return { financiador: "", turmaId: null };
}

function daRegra(tipo: TipoApoio, r?: RegraApoio): Linha {
  return {
    tipo,
    ativo: r?.ativo ?? false,
    modo: r?.modo ?? MODO_SUGERIDO[tipo],
    valor: r ? String(r.valor) : "",
    minHorasDia: r ? String(r.minHorasDia || "") : "",
    tetoMensal: r?.tetoMensal != null ? String(r.tetoMensal) : "",
    assiduidadeMinima: r?.assiduidadeMinima != null ? String(r.assiduidadeMinima) : "",
    requerIban: r?.requerIban ?? true,
    notas: r?.notas ?? "",
  };
}

const numero = (s: string) => numeroPt(s);
const opcional = (s: string) => (s.trim() === "" ? null : numero(s));

/**
 * Regras dos apoios da Financiada. Valem em cascata: a regra da turma ganha à do financiador,
 * que ganha à regra geral. Um âmbito sem regras herda do seguinte.
 */
export function RegrasApoios({ podeEditar, turmaInicial }: { podeEditar: boolean; turmaInicial?: number }) {
  const { dados, erro, recarregar } = useRecurso("apoios:regras", apiRegrasApoios);
  const [ambito, setAmbito] = useState(turmaInicial ? `t:${turmaInicial}` : "g");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [apagar, setApagar] = useState(false);

  const doAmbito = useMemo(() => {
    const a = ambitoDe(ambito);
    return (dados?.regras ?? []).filter(r => (a.turmaId ? r.turmaId === a.turmaId : r.turmaId == null && r.financiador === a.financiador));
  }, [dados, ambito]);

  useEffect(() => {
    if (!dados) return;
    setLinhas(dados.tipos.map(t => daRegra(t.id, doAmbito.find(r => r.tipo === t.id))));
  }, [dados, doAmbito]);

  const gravar = useAccao((regras: RegraApoio[]) => {
    const a = ambitoDe(ambito);
    return apiGravarRegrasApoios(a.financiador, a.turmaId, regras);
  }, { invalidar: INVALIDAR_APOIOS, ok: "Regras dos apoios guardadas." });

  if (erro != null && !dados) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Cartao><Esqueleto linhas={6} /></Cartao>;

  const opcoesAmbito = [
    { valor: "g", rotulo: "Regra geral (todas as turmas)" },
    ...dados.financiadores.map(f => ({ valor: `f:${f}`, rotulo: `Financiador · ${f}` })),
    ...dados.turmas.map(t => ({ valor: `t:${t.id}`, rotulo: `Turma · ${t.nome}${t.financiador ? ` (${t.financiador})` : ""}` })),
  ];
  const rotulos = Object.fromEntries(dados.tipos.map(t => [t.id, t.rotulo])) as Record<TipoApoio, string>;
  const herdadas = herancaPara(ambito, dados.regras, dados.turmas, rotulos, new Set(doAmbito.map(r => r.tipo)));
  const mudar = (i: number, p: Partial<Linha>) => setLinhas(ls => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const invalidas = linhas.filter(l => l.ativo && (!(numero(l.valor) >= 0) || l.valor.trim() === ""));

  function paraGravar(): RegraApoio[] {
    // Só se guardam os tipos ligados ou com valor: um tipo desligado sem valor fica a herdar.
    return linhas.filter(l => l.ativo || l.valor.trim() !== "").map(l => ({
      tipo: l.tipo,
      ativo: l.ativo,
      modo: l.modo,
      valor: numero(l.valor) || 0,
      minHorasDia: l.modo === "dia" ? numero(l.minHorasDia) || 0 : 0,
      tetoMensal: opcional(l.tetoMensal),
      assiduidadeMinima: opcional(l.assiduidadeMinima),
      requerIban: l.requerIban,
      notas: l.notas.trim(),
    }));
  }

  return (
    <Cartao
      titulo="Apoios aos formandos"
      subtitulo="Bolsa, alimentação, transporte, acolhimento e alojamento. Os valores calculam-se a partir das folhas de presença."
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[13px] font-medium text-tinta max-w-md">
          Âmbito
          <Selecao value={ambito} onChange={e => setAmbito(e.target.value)} opcoes={opcoesAmbito} />
        </label>
        <p className="m-0 text-xs text-tinta-suave">
          A regra da turma ganha à do financiador, que ganha à regra geral. Um tipo sem regra neste âmbito usa a do âmbito seguinte
          {herdadas.length ? `: ${herdadas.join(" · ")}` : "."}
        </p>

        <div className="flex flex-col gap-3">
          {linhas.map((l, i) => {
            const rotulo = dados.tipos.find(t => t.id === l.tipo)?.rotulo ?? l.tipo;
            return (
              <fieldset key={l.tipo} className="m-0 border border-linha rounded-controlo px-4 py-3" disabled={!podeEditar}>
                <legend className="sr-only">{rotulo}</legend>
                <div className="flex items-center gap-3 flex-wrap">
                  <Interruptor ligado={l.ativo} onMudar={v => mudar(i, { ativo: v })} rotulo={`${rotulo} ativo`} desativado={!podeEditar} />
                  <p className="m-0 flex-1 min-w-[160px] text-sm font-semibold text-tinta">{rotulo}</p>
                  {doAmbito.some(r => r.tipo === l.tipo) ? <Estado tom="info">Definida aqui</Estado> : <Estado tom="neutro">Herda</Estado>}
                </div>
                {l.ativo && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
                      Como se calcula
                      <Selecao value={l.modo} onChange={e => mudar(i, { modo: e.target.value as ModoApoio })}
                        opcoes={(Object.keys(MODO_APOIO) as ModoApoio[]).map(m => ({ valor: m, rotulo: MODO_APOIO[m].rotulo }))} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
                      Valor ({MODO_APOIO[l.modo].unidade})
                      <Entrada inputMode="decimal" value={l.valor} onChange={e => mudar(i, { valor: e.target.value })} aria-invalid={invalidas.includes(l)} />
                    </label>
                    {l.modo === "dia" && (
                      <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
                        Mínimo de horas no dia
                        <Entrada inputMode="decimal" value={l.minHorasDia} placeholder="0" onChange={e => mudar(i, { minHorasDia: e.target.value })} />
                      </label>
                    )}
                    <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
                      Teto mensal (€)
                      <Entrada inputMode="decimal" value={l.tetoMensal} placeholder="Sem teto" onChange={e => mudar(i, { tetoMensal: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
                      Assiduidade mínima no mês (%)
                      <Entrada inputMode="decimal" value={l.assiduidadeMinima} placeholder="Sem mínimo" onChange={e => mudar(i, { assiduidadeMinima: e.target.value })} />
                    </label>
                    <div className="sm:col-span-2 lg:col-span-3 flex items-end">
                      <Caixa rotulo="Só paga com IBAN do formando registado" checked={l.requerIban} onChange={e => mudar(i, { requerIban: e.target.checked })} />
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave sm:col-span-2 lg:col-span-4">
                      Notas (ex.: regulamento ou aviso de abertura)
                      <Entrada value={l.notas} maxLength={500} onChange={e => mudar(i, { notas: e.target.value })} />
                    </label>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>

        {invalidas.length > 0 && <Aviso tom="aviso">Indique o valor de: {invalidas.map(l => dados.tipos.find(t => t.id === l.tipo)?.rotulo).join(", ")}.</Aviso>}
        {podeEditar && (
          <div className="flex gap-2 flex-wrap justify-end">
            {doAmbito.length > 0 && <Botao variante="fantasma" onClick={() => setApagar(true)}>Apagar regras deste âmbito</Botao>}
            <Botao variante="primario" disabled={invalidas.length > 0} aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(paraGravar())}>Guardar regras</Botao>
          </div>
        )}
      </div>
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo="Apagar regras deste âmbito"
        descricao="As turmas deste âmbito passam a usar as regras do âmbito seguinte (financiador ou geral). Os apoios já registados não mudam."
        onConfirmar={async () => { await gravar.correr([]); }}
      />
    </Cartao>
  );
}

/** Texto das regras herdadas que valem para o âmbito escolhido (para mostrar ao utilizador). */
function herancaPara(
  ambito: string,
  regras: RegraGuardada[],
  turmas: { id: number; financiador: string }[],
  rotulos: Record<TipoApoio, string>,
  definidosAqui: Set<TipoApoio>,
) {
  const a = ambitoDe(ambito);
  const financiador = a.turmaId ? turmas.find(t => t.id === a.turmaId)?.financiador ?? "" : a.financiador;
  if (!a.turmaId && !a.financiador) return [];
  const fontes = [
    ...(a.turmaId && financiador ? regras.filter(r => r.turmaId == null && r.financiador === financiador) : []),
    ...regras.filter(r => r.turmaId == null && !r.financiador),
  ];
  const vistos = new Set<string>(definidosAqui);
  return fontes.filter(r => r.ativo && !vistos.has(r.tipo) && vistos.add(r.tipo)).map(r => `${rotulos[r.tipo]} ${eur(r.valor, true)} (${r.financiador || "geral"})`);
}
