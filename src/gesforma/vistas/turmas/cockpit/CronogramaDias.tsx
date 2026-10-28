// Cronograma da turma por dias (como no GesForma antigo): um cartão por dia, do primeiro ao último dia de aulas.
// Dias com sessão: Aula N, Editar, horas, presenças, volume, Folha de presenças e Plano de sessão; dias vazios: «+».
import { data as fmtData } from "../../../../partilhado/ui/formatos";
import { estadoPlano, ROTULO_ESTADO_PLANO, type PlanoSessaoData, type SessaoMeta, type SumarioSessaoData } from "../../../../partilhado/TurmaExtras";
import type { SessaoCronograma } from "../../../../partilhado/turmaModel";
import { cx, num } from "../../../../partilhado/ui";
import type { PresencaRow } from "../../../PedagogiaContext";

const DIAS = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];

const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

function maisUmDia(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function horasDaSessao(s: Pick<SessaoCronograma, "horaInicio" | "horaFim"> | undefined) {
  if (!s?.horaInicio || !s.horaFim) return 0;
  const m = (h: string) => { const [a, b] = h.split(":").map(Number); return (a || 0) * 60 + (b || 0); };
  return Math.max(0, m(s.horaFim) - m(s.horaInicio)) / 60;
}

/** Os dias a mostrar: do primeiro ao último dia com sessão (ou desde o início da turma), sem os domingos vazios. */
export function diasDoCronograma(sessoes: SessaoMeta[], inicio: string, limite = 400) {
  const datas = sessoes.map(s => s.dataIso ?? "").filter(Boolean).sort();
  const primeiro = [inicio, datas[0]].filter(Boolean).sort()[0] ?? "";
  const ultimo = datas[datas.length - 1] ?? (primeiro ? primeiro : "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiro)) return [];
  const comSessao = new Set(datas);
  const fim = ultimo >= primeiro ? ultimo : primeiro;
  const out: string[] = [];
  for (let d = primeiro; d <= fim && out.length < limite; d = maisUmDia(d)) {
    if (diaDaSemana(d) === 0 && !comSessao.has(d)) continue;
    out.push(d);
  }
  return out;
}

export function CronogramaDias({
  sessoes, cronograma, inicio, planos, presencas, sumarios, inscritos, podeCriar, podeEditarSessao,
  onNova, onEditar, onEliminar, onPresencas, onPlano,
}: {
  sessoes: SessaoMeta[];
  cronograma: SessaoCronograma[];
  inicio: string;
  planos: Record<number, PlanoSessaoData>;
  presencas: Record<number, PresencaRow[]>;
  sumarios: Record<number, SumarioSessaoData>;
  inscritos: number;
  podeCriar: boolean;
  podeEditarSessao: boolean;
  onNova: (dia: string) => void;
  onEditar: (s: SessaoCronograma) => void;
  onEliminar?: (s: SessaoCronograma) => void;
  onPresencas: (s: SessaoMeta) => void;
  onPlano: (s: SessaoMeta) => void;
}) {
  const porId = new Map(cronograma.map(c => [c.id, c]));
  const porDia = new Map<string, SessaoMeta[]>();
  for (const s of sessoes) {
    const d = s.dataIso ?? "";
    porDia.set(d, [...(porDia.get(d) ?? []), s]);
  }
  const dias = diasDoCronograma(sessoes, inicio);
  if (!dias.length) {
    return <p className="m-0 rounded-painel border border-linha bg-superficie p-6 text-sm text-tinta-suave">Sem sessões. Use «+ Sessão» ou a grelha de 45 minutos.</p>;
  }
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {dias.map(dia => {
        const doDia = porDia.get(dia) ?? [];
        return (
          <article key={dia} className={cx("rounded-painel border bg-superficie p-3.5 shadow-sm", doDia.length ? "border-linha" : "border-linha-suave")}>
            {doDia.length === 0 ? (
              <>
                <p className="m-0 text-[15px] font-semibold text-tinta">{DIAS[diaDaSemana(dia)]}</p>
                <p className="m-0 text-sm text-tinta-suave num">{fmtData(dia)}</p>
                {podeCriar && (
                  <button type="button" onClick={() => onNova(dia)} aria-label={`Nova sessão a ${fmtData(dia)}`}
                    className="mt-2.5 h-8 w-8 rounded-controlo bg-blue-100 text-lg font-bold text-blue-700 hover:bg-blue-200">+</button>
                )}
              </>
            ) : doDia.map((s, i) => {
              const c = s.id ? porId.get(s.id) : undefined;
              const horas = horasDaSessao(c);
              const folha = presencas[s.n];
              const presentes = folha ? folha.filter(p => p.presente).length : null;
              const plano = planos[s.n];
              const validada = Boolean(sumarios[s.n]?.presencasValidadas);
              return (
                <div key={s.n} className={cx(i > 0 && "mt-3 border-t border-linha-suave pt-3")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="m-0 text-xs text-tinta-suave">Aula {s.n}</p>
                    {podeEditarSessao && c && onEliminar && (
                      <button type="button" onClick={() => onEliminar(c)} aria-label={`Eliminar a aula ${s.n}`} title="Eliminar a sessão"
                        className="-mt-1 -mr-1 h-6 w-6 rounded text-sm font-bold text-red-600 hover:bg-red-50">×</button>
                    )}
                  </div>
                  {i === 0 && (
                    <>
                      <p className="m-0 text-[15px] font-semibold text-tinta">{DIAS[diaDaSemana(dia)]}</p>
                      <p className="m-0 text-sm text-tinta-suave num">{fmtData(dia)}</p>
                    </>
                  )}
                  <p className="m-0 mt-0.5 text-xs text-tinta-suave">{s.hora}{s.formador ? ` · ${s.formador}` : ""}</p>
                  {podeEditarSessao && c && (
                    <button type="button" onClick={() => onEditar(c)}
                      className="mt-2 rounded-controlo bg-blue-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-blue-800">Editar</button>
                  )}
                  <dl className="m-0 mt-2 space-y-0.5 text-[13px] text-tinta">
                    <div className="flex gap-1"><dt className="text-tinta-suave">Número de horas:</dt><dd className="m-0 num">{num(horas)}</dd></div>
                    <div className="flex gap-1"><dt className="text-tinta-suave">Presenças:</dt><dd className="m-0 num">{presentes == null ? `—/${inscritos}` : `${presentes}/${folha!.length}`}{validada ? " · validada" : ""}</dd></div>
                    <div className="flex gap-1"><dt className="text-tinta-suave">Volume:</dt><dd className="m-0 num">{presentes == null ? "—" : num(horas * presentes)}</dd></div>
                  </dl>
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <button type="button" onClick={() => onPresencas(s)}
                      className="rounded-controlo bg-emerald-700 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-800">Folha de presenças</button>
                    <button type="button" onClick={() => onPlano(s)}
                      className="rounded-controlo bg-blue-700 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-white hover:bg-blue-800">
                      Plano de sessão{plano ? <span className="ml-1 font-semibold normal-case opacity-80">· {ROTULO_ESTADO_PLANO[estadoPlano(plano)].texto}</span> : null}
                    </button>
                  </div>
                </div>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}
