import { useEffect, useMemo, useState } from "react";
import { AppModal } from "./FormKit";
import type { FormandoTurma, Preinscricao } from "./ListsContext";
import {
  formatDiaMes,
  linhasTurmaInscricao,
  preinscricaoCasaComTurma,
  type OfertaTurmaRef,
  type TurmaGold,
  type TurmaInscricaoLinha,
} from "./turmaModel";

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

export function candidatosPreinscricaoTurma(
  leads: Preinscricao[],
  turma: OfertaTurmaRef,
  emailsInscritos: Iterable<string>,
) {
  const ocupados = new Set([...emailsInscritos].map(e => e.trim().toLowerCase()).filter(Boolean));
  return leads
    .filter(l => preinscricaoCasaComTurma(l, turma))
    .filter(l => !ocupados.has(l.email.trim().toLowerCase()))
    .slice()
    .sort((a, b) => b.inscrito.localeCompare(a.inscrito));
}

export function InscreverFormandoPanel({
  turma,
  leads,
  emailsInscritos,
  vagasLivres,
  accent = "gold",
  onInscreverLead,
  onInscreverManual,
  onCancel,
}: {
  turma: OfertaTurmaRef & { nome: string };
  leads: Preinscricao[];
  emailsInscritos: Iterable<string>;
  vagasLivres: number;
  accent?: "gold" | "fin";
  onInscreverLead: (lead: Preinscricao) => void | Promise<void>;
  onInscreverManual: (dados: { nome: string; email: string; telf: string }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [manual, setManual] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [busy, setBusy] = useState(false);
  const btn = accent === "gold"
    ? "bg-amber-500 hover:bg-amber-600"
    : "bg-blue-600 hover:bg-blue-700";

  const lista = useMemo(
    () => candidatosPreinscricaoTurma(leads, turma, emailsInscritos),
    [leads, turma, emailsInscritos],
  );
  const filtrada = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return lista;
    return lista.filter(l =>
      `${l.nome} ${l.apelido} ${l.email} ${l.telf} ${l.estado}`.toLowerCase().includes(n));
  }, [lista, q]);

  const semVagas = vagasLivres <= 0;

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-slate-500">
        Pré-inscrições em <span className="font-semibold text-slate-700">{turma.curso}</span>
        {" · "}{turma.local}{" · "}{turma.horario}.
        {semVagas ? " Sem vagas restantes." : ` ${Math.max(0, vagasLivres)} vaga${vagasLivres === 1 ? "" : "s"} restantes.`}
      </p>

      <input
        className={iCls}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Pesquisar nome, email ou telemóvel…"
      />

      {filtrada.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
          {lista.length === 0
            ? "Ninguém se pré-inscreveu para este curso, local e horário, ou já estão inscritos nesta turma."
            : "Nenhum resultado nesta pesquisa."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[min(52vh,420px)] overflow-y-auto">
          {filtrada.map(l => (
            <li key={l.id} className="flex items-start gap-3 px-3 py-2.5 bg-white hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{l.nome} {l.apelido}</p>
                <p className="text-xs text-slate-500 truncate">{l.email} · {l.telf}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{l.estado} · {l.inscrito}</p>
              </div>
              <button
                type="button"
                disabled={semVagas || busy}
                onClick={() => {
                  setBusy(true);
                  void Promise.resolve(onInscreverLead(l)).finally(() => setBusy(false));
                }}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${btn}`}
              >
                Inscrever
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setManual(v => !v)}
        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        {manual ? "Esconder inscrição avulsa" : "Inscrever alguém sem pré-inscrição"}
      </button>

      {manual && (
        <div className="space-y-3 pt-1">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</span>
            <input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</span>
            <input className={iCls} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Telemóvel</span>
            <input className={iCls} value={telf} onChange={e => setTelf(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={!nome.trim() || semVagas || busy}
            onClick={() => {
              setBusy(true);
              void Promise.resolve(onInscreverManual({ nome: nome.trim(), email: email.trim(), telf: telf.trim() }))
                .then(() => { setNome(""); setEmail(""); setTelf(""); })
                .finally(() => setBusy(false));
            }}
            className={`w-full py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 ${btn}`}
          >
            Inscrever avulso
          </button>
        </div>
      )}

      <button type="button" onClick={onCancel} className="w-full py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
        Fechar
      </button>
    </div>
  );
}

function resumoLead(lead: Pick<Preinscricao, "curso" | "local" | "horario" | "inicioCurso">) {
  return [lead.curso, lead.local, lead.horario, lead.inicioCurso && lead.inicioCurso !== "-" ? lead.inicioCurso : ""]
    .filter(Boolean)
    .join(" · ");
}

export function EscolherTurmaPicker({
  lead,
  turmas,
  valueId,
  onChange,
}: {
  lead: Pick<Preinscricao, "curso" | "local" | "horario" | "turmaId" | "inicioCurso">;
  turmas: TurmaGold[];
  valueId: number | null;
  onChange: (turma: TurmaGold) => void;
}) {
  const [q, setQ] = useState("");
  const linhas = useMemo(() => linhasTurmaInscricao(turmas, lead), [turmas, lead]);
  const filtradas = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return linhas;
    return linhas.filter(l =>
      `${l.turma.nome} ${l.turma.horario} ${l.turma.local} ${l.turma.dataInicio} ${l.motivo}`.toLowerCase().includes(n));
  }, [linhas, q]);
  const adequadas = filtradas.filter(l => l.grupo === "adequada");
  const outros = filtradas.filter(l => l.grupo === "outro");

  function bloco(titulo: string, rows: TurmaInscricaoLinha[], hint?: string) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
          {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
        <ul className="space-y-1">
          {rows.map(l => {
            const sel = valueId === l.turma.id;
            return (
              <li key={l.turma.id}>
                <button
                  type="button"
                  disabled={l.disabled}
                  onClick={() => onChange(l.turma)}
                  className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-colors ${
                    l.disabled
                      ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                      : sel
                        ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                        : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${l.disabled ? "text-slate-500" : "text-slate-800"}`}>{l.turma.nome}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {l.turma.local} · {l.turma.horario} · início {formatDiaMes(l.turma.dataInicio)}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 text-[11px] font-semibold ${l.disabled ? "text-slate-400" : "text-emerald-700"}`}>
                      {l.motivo}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full min-w-0">
      <input
        className={iCls}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Pesquisar turma, horário ou data…"
      />
      {bloco("Adequadas à pré-inscrição", adequadas, "Mesmo curso, local e horário. Escolha uma destas.")}
      {bloco("Outros horários no mesmo local", outros, "Ainda não começaram, mas o horário é outro. Ficam visíveis só para consulta.")}
      {filtradas.length === 0 && (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
          Não há turmas deste curso neste local para mostrar.
        </p>
      )}
    </div>
  );
}

export function EscolherTurmaModal({
  open,
  lead,
  turmas,
  onClose,
  onConfirm,
}: {
  open: boolean;
  lead: Preinscricao | null;
  turmas: TurmaGold[];
  onClose: () => void;
  onConfirm: (turma: TurmaGold) => void | Promise<void>;
}) {
  const [sel, setSel] = useState<TurmaGold | null>(null);
  useEffect(() => {
    if (!open || !lead) { setSel(null); return; }
    const first = linhasTurmaInscricao(turmas, lead).find(l => !l.disabled);
    setSel(first?.turma ?? null);
  }, [open, lead, turmas]);
  if (!lead) return null;
  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="2xl"
      title={`Inscrever ${lead.nome} ${lead.apelido}`}
      sub={resumoLead(lead)}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            disabled={!sel}
            onClick={() => { if (sel) void onConfirm(sel); }}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white"
          >
            Inscrever nesta turma
          </button>
        </>
      }
    >
      <div className="p-5">
        <EscolherTurmaPicker lead={lead} turmas={turmas} valueId={sel?.id ?? null} onChange={setSel} />
      </div>
    </AppModal>
  );
}

export function FormandosKanban({
  preinscritos,
  inscritos,
  onOpenLead,
  onOpenFormando,
  onPedirTurma,
}: {
  preinscritos: Preinscricao[];
  inscritos: FormandoTurma[];
  onOpenLead: (lead: Preinscricao) => void;
  onOpenFormando: (f: FormandoTurma) => void;
  onPedirTurma: (lead: Preinscricao) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<Preinscricao | null>(null);
  const cols = [
    { id: "pre", label: "Pré-inscrito", color: "border-violet-400 bg-violet-50", dot: "bg-violet-400", n: preinscritos.length },
    { id: "turma", label: "Inscrito em turma", color: "border-emerald-400 bg-emerald-50", dot: "bg-emerald-400", n: inscritos.length },
  ] as const;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
      {cols.map(col => (
        <div
          key={col.id}
            className={`flex-shrink-0 w-[min(100%,22rem)] sm:w-96 rounded-xl border-t-4 ${col.color} ${over === col.id ? "ring-2 ring-amber-400" : ""}`}
          onDragOver={e => { if (col.id === "turma") { e.preventDefault(); setOver(col.id); } }}
          onDragLeave={() => setOver(null)}
          onDrop={() => {
            if (col.id === "turma" && drag) onPedirTurma(drag);
            setDrag(null);
            setOver(null);
          }}
        >
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className="text-xs font-bold text-slate-700">{col.label}</span>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded-full">{col.n}</span>
          </div>
          {col.id === "pre" && (
            <p className="px-3 pb-2 text-[10px] text-violet-700">Arraste para «Inscrito em turma» ou escolha a turma no cartão.</p>
          )}
          <div className="px-2 pb-2 space-y-2 max-h-[min(70vh,640px)] overflow-y-auto">
            {col.id === "pre" && preinscritos.map(l => (
              <div
                key={l.id}
                draggable
                onDragStart={() => setDrag(l)}
                className="rounded-xl border border-slate-200 bg-white shadow-sm p-3"
              >
                <button type="button" onClick={() => onOpenLead(l)} className="w-full text-left">
                  <p className="text-xs font-bold text-slate-800">{l.nome} {l.apelido}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{l.email}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{resumoLead(l)}</p>
                  <p className="text-[10px] font-semibold text-violet-700 mt-1">{l.estado}</p>
                </button>
                <button
                  type="button"
                  onClick={() => onPedirTurma(l)}
                  className="mt-2 w-full py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Inscrever em turma
                </button>
              </div>
            ))}
            {col.id === "pre" && preinscritos.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">Sem pré-inscrições por colocar.</p>
            )}
            {col.id === "turma" && inscritos.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpenFormando(f)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white shadow-sm p-3 hover:border-emerald-300"
              >
                <p className="text-xs font-bold text-slate-800">{f.nome} {f.apelido}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{f.email}</p>
                <p className="text-[11px] font-semibold text-emerald-700 mt-1">{f.turma}</p>
                <p className="text-[11px] text-slate-400">{f.local} · {f.curso}</p>
              </button>
            ))}
            {col.id === "turma" && inscritos.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">Ainda sem formandos nesta lista.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
