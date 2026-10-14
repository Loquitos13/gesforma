// Peças da vista geral do Dossiê TP: célula de secção, barra de %, legenda e painel da turma.
import type { EstadoSeccao, Regime, SeccaoDtp, TurmaDtp } from "../../../partilhado/api/dtp";
import { Botao, Cartao, Estado, PainelLateral, Vazio, cx, type Tom } from "../../../partilhado/ui";

const ESTADOS: Record<EstadoSeccao, { rotulo: string; classe: string; tom: Tom }> = {
  completo: { rotulo: "Completo", classe: "bg-sucesso-suave text-sucesso border-sucesso/30", tom: "sucesso" },
  parcial: { rotulo: "Parcial", classe: "bg-aviso-suave text-aviso border-aviso/30", tom: "aviso" },
  falta: { rotulo: "Em falta", classe: "bg-fundo text-tinta-suave border-linha", tom: "neutro" },
  bloqueante: { rotulo: "Bloqueante", classe: "bg-perigo-suave text-perigo border-perigo/30", tom: "perigo" },
  na: { rotulo: "Não se aplica", classe: "bg-transparent text-tinta-suave/60 border-dashed border-linha", tom: "neutro" },
};

export function CelulaSeccao({ celula, rotulo }: { celula?: { estado: EstadoSeccao; ok: number; total: number }; rotulo: string }) {
  if (!celula) return null;
  const e = ESTADOS[celula.estado];
  const texto = celula.estado === "na" ? "—" : `${celula.ok}/${celula.total}`;
  return (
    <span
      title={`${rotulo}: ${e.rotulo}${celula.total ? ` (${celula.ok} de ${celula.total})` : ""}`}
      className={cx("inline-flex min-w-[2.75rem] justify-center rounded-controlo border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", e.classe)}
    >
      {texto}
      <span className="sr-only"> · {e.rotulo}</span>
    </span>
  );
}

export function BarraPct({ pct }: { pct: number }) {
  const cor = pct >= 100 ? "bg-sucesso" : pct >= 60 ? "bg-aviso" : "bg-perigo";
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-linha overflow-hidden">
        <span className={cx("block h-full rounded-full", cor)} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </span>
      <span className="w-10 text-right font-semibold tabular-nums">{pct} %</span>
    </span>
  );
}

export function LegendaDtp({ seccoes, regime }: { seccoes: SeccaoDtp[]; regime: Regime }) {
  return (
    <Cartao className="text-xs text-tinta-suave">
      <div className="flex flex-wrap gap-3">
        {(Object.keys(ESTADOS) as EstadoSeccao[]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cx("inline-block h-3 w-5 rounded border", ESTADOS[k].classe)} aria-hidden="true" />{ESTADOS[k].rotulo}
          </span>
        ))}
      </div>
      <ol className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {seccoes.map((s, i) => (
          <li key={s.id}><span className="font-semibold text-tinta tabular-nums">{regime === "fin" ? s.id : String(i + 1).padStart(2, "0")}</span> {s.label}</li>
        ))}
      </ol>
    </Cartao>
  );
}

export function PainelTurmaDtp({ turma, seccoes, aExportar, onFechar, onAbrir, onExportar }: {
  turma: TurmaDtp | null;
  seccoes: SeccaoDtp[];
  aExportar: boolean;
  onFechar: () => void;
  onAbrir: (id: number) => void;
  onExportar: (t: TurmaDtp) => void;
}) {
  const porSeccao = seccoes
    .map(s => ({ seccao: s, itens: (turma?.emFalta ?? []).filter(i => i.seccao === s.id) }))
    .filter(g => g.itens.length);
  return (
    <PainelLateral
      aberto={Boolean(turma)}
      onFechar={onFechar}
      titulo={turma?.nome ?? ""}
      subtitulo={turma ? `${turma.curso} · ${turma.pct} % completo · ${turma.ok} no dossiê, ${turma.parcial} parciais, ${turma.falta} em falta` : undefined}
      rodape={turma ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" aCarregar={aExportar} onClick={() => onExportar(turma)}>Exportar ZIP</Botao>
          <Botao variante="primario" onClick={() => onAbrir(turma.id)}>Abrir dossiê da turma</Botao>
        </div>
      ) : undefined}
    >
      {turma && (
        porSeccao.length === 0 ? (
          <Vazio compacto titulo="Dossiê completo." descricao="Todos os documentos desta turma estão no dossiê." />
        ) : (
          <div className="space-y-5">
            {turma.bloqueantes > 0 && (
              <p className="rounded-controlo bg-perigo-suave px-3 py-2 text-sm text-perigo">
                {turma.bloqueantes === 1 ? "1 documento bloqueia" : `${turma.bloqueantes} documentos bloqueiam`} a emissão de certificados ou o fecho da turma.
              </p>
            )}
            {porSeccao.map(g => (
              <section key={g.seccao.id} aria-label={g.seccao.label}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">{g.seccao.pasta}</h3>
                <ul className="mt-2 divide-y divide-linha rounded-controlo border border-linha">
                  {g.itens.map(i => (
                    <li key={i.id} className="flex items-start gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-tinta">{i.label}</span>
                        {i.detalhe && <span className="block text-xs text-tinta-suave">{i.detalhe}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Estado tom={i.bloqueante ? "perigo" : i.estado === "parcial" ? "aviso" : "neutro"}>
                          {i.bloqueante ? "Bloqueante" : i.estado === "parcial" ? "Parcial" : "Em falta"}
                        </Estado>
                        <Botao tamanho="sm" variante="ligacao" onClick={() => onAbrir(turma.id)}>Resolver</Botao>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      )}
    </PainelLateral>
  );
}
