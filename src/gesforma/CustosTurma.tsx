import { useEffect, useMemo, useState } from "react";
import { horasDoFormador, type SessaoCronograma } from "../partilhado/turmaModel";
import { useFormadoresDoRegime } from "../partilhado/dados/comuns";
import { Cartao } from "../partilhado/ui";

function eur(v: number) {
  return `€ ${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const arred = (v: number) => Math.round(v * 100) / 100;

type TurmaCustos = {
  id: number;
  formador: string;
  formadores?: string[];
  horas: number;
  cronograma: SessaoCronograma[];
  valoresHoraFormador?: Record<string, number>;
  custoHoraSala?: number;
};

/**
 * Custos da turma na visão geral: horas de cada formador no cronograma × o valor por hora desta turma
 * (se ficar vazio, vale o custo por hora da ficha do formador), mais a sala alugada (só na Gold).
 */
export function CustosTurmaCard({
  turma,
  regime,
  canEdit,
  onValores,
  onSala,
}: {
  turma: TurmaCustos;
  regime: "gold" | "fin";
  canEdit: boolean;
  onValores: (valores: Record<string, number>) => void;
  onSala?: (valor: number) => void;
}) {
  const formadores = useFormadoresDoRegime(regime);
  const [sala, setSala] = useState(String(turma.custoHoraSala ?? 0));
  useEffect(() => { setSala(String(turma.custoHoraSala ?? 0)); }, [turma.custoHoraSala, turma.id]);
  const valores = useMemo(() => turma.valoresHoraFormador ?? {}, [turma.valoresHoraFormador]);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  useEffect(() => { setRascunho({}); }, [turma.id, valores]);

  const linhas = useMemo(() => {
    const nomes = new Set<string>();
    if (turma.formador.trim()) nomes.add(turma.formador.trim());
    for (const n of turma.formadores ?? []) if (n.trim()) nomes.add(n.trim());
    for (const s of turma.cronograma) for (const n of s.formadores ?? []) if (n.trim()) nomes.add(n.trim());
    return [...nomes].map(nome => {
      const horas = horasDoFormador(turma.cronograma, nome);
      const daFicha = formadores.find(f => f.nome.toLowerCase() === nome.toLowerCase())?.custoHora ?? 0;
      const proprio = typeof valores[nome] === "number" ? valores[nome] : null;
      const valorHora = proprio ?? daFicha;
      return { nome, horas, daFicha, proprio, valorHora, total: arred(horas * valorHora) };
    });
  }, [formadores, turma, valores]);

  const gravarValor = (nome: string) => {
    const texto = rascunho[nome];
    if (texto === undefined) return;
    const n = texto.trim() === "" ? null : Number(texto.replace(",", "."));
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setRascunho(r => { const c = { ...r }; delete c[nome]; return c; }); return; }
    const next = { ...valores };
    if (n === null) delete next[nome];
    else next[nome] = arred(n);
    if ((valores[nome] ?? null) === (next[nome] ?? null)) return;
    onValores(next);
  };

  const formadoresTotal = linhas.reduce((s, l) => s + l.total, 0);
  const custoSala = Number(sala) || 0;
  const salaTotal = onSala ? arred((turma.horas || 0) * custoSala) : 0;
  return (
    <Cartao titulo="Custos da turma">
      <p className="m-0 mb-3 text-xs text-tinta-suave">
        Valor por hora de cada formador nesta turma × as horas dele no cronograma. Vazio, vale o custo por hora da ficha do formador.
      </p>
      {linhas.length === 0 && <p className="m-0 text-xs text-tinta-suave">Ainda sem formador nesta turma.</p>}
      {linhas.length > 0 && (
        <div className="space-y-2">
          {linhas.map(l => (
            <div key={l.nome} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-tinta truncate font-medium">{l.nome}</span>
              <label className="col-start-1 sm:col-start-auto flex items-center gap-1.5">
                <span className="sr-only">Valor por hora de {l.nome} nesta turma (€)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  disabled={!canEdit}
                  placeholder={l.daFicha ? String(l.daFicha) : "€/h"}
                  value={rascunho[l.nome] ?? (l.proprio ?? "")}
                  onChange={e => setRascunho(r => ({ ...r, [l.nome]: e.target.value }))}
                  onBlur={() => gravarValor(l.nome)}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="num w-24 h-8 px-2 text-sm border border-linha-forte rounded-controlo bg-superficie text-tinta disabled:bg-fundo"
                />
                <span className="text-tinta-suave">€/h</span>
              </label>
              <span className="row-start-1 col-start-2 sm:row-start-auto sm:col-start-auto text-right text-tinta-suave whitespace-nowrap">
                {l.horas} h × {eur(l.valorHora)} = <span className="font-semibold text-tinta">{eur(l.total)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-linha pt-3">
        {onSala ? (
          <label className="text-[11px] font-semibold uppercase text-tinta-suave">
            Custo hora da sala (€)
            <input
              type="number"
              min={0}
              step="0.5"
              disabled={!canEdit}
              value={sala}
              onChange={e => setSala(e.target.value)}
              onBlur={() => onSala(Math.max(0, Number(sala) || 0))}
              className="num mt-1 block w-28 h-8 px-2 text-sm border border-linha-forte rounded-controlo bg-superficie text-tinta disabled:bg-fundo"
            />
          </label>
        ) : <span />}
        <div className="text-right text-xs text-tinta-suave">
          <p className="m-0">Formadores = <span className="font-semibold text-tinta">{eur(arred(formadoresTotal))}</span></p>
          {onSala && <p className="m-0 mt-0.5">Sala · {turma.horas || 0} h = <span className="font-semibold text-tinta">{eur(salaTotal)}</span></p>}
          <p className="m-0 mt-1 text-sm font-bold text-tinta">Total {eur(arred(formadoresTotal + salaTotal))}</p>
        </div>
      </div>
    </Cartao>
  );
}
