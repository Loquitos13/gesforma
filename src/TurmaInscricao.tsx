import { useMemo, useState } from "react";
import type { Preinscricao } from "./ListsContext";
import { preinscricaoCasaComTurma, type OfertaTurmaRef } from "./turmaModel";

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
  onInscreverLead: (lead: Preinscricao) => void;
  onInscreverManual: (dados: { nome: string; email: string; telf: string }) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [manual, setManual] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
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
        {semVagas ? " Não há vagas." : ` ${Math.max(0, vagasLivres)} vaga${vagasLivres === 1 ? "" : "s"}.`}
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
            ? "Ninguém se pré-inscreveu para este curso, local e horário — ou já estão inscritos nesta turma."
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
                disabled={semVagas}
                onClick={() => onInscreverLead(l)}
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
            disabled={!nome.trim() || semVagas}
            onClick={() => {
              onInscreverManual({ nome: nome.trim(), email: email.trim(), telf: telf.trim() });
              setNome(""); setEmail(""); setTelf("");
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
