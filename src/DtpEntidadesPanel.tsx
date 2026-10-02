import { useEffect, useState } from "react";
import {
  apiCreateDtpEntidade,
  apiDeleteDtpEntidade,
  apiDtpEntidades,
  apiRenameDtpEntidade,
  type DtpEntidade,
} from "./api";
import { DtpModeloEditor } from "./DtpModeloEditor";

/** Entidades responsáveis e a estrutura de dossiê de cada uma, na vista Gold. */
export function DtpEntidadesPanel({ onEntidades }: { onEntidades?: (lista: DtpEntidade[]) => void }) {
  const [lista, setLista] = useState<DtpEntidade[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [aberta, setAberta] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [renomear, setRenomear] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState<number | null>(null);

  function publicar(next: DtpEntidade[]) {
    setLista(next);
    onEntidades?.(next);
  }

  useEffect(() => {
    let alive = true;
    apiDtpEntidades()
      .then(r => {
        if (!alive) return;
        publicar(r.entidades);
        setEstado("ready");
      })
      .catch(() => { if (alive) setEstado("offline"); });
    return () => { alive = false; };
  }, []);

  async function criar() {
    const texto = nome.trim();
    if (texto.length < 2) {
      setErro("O nome da entidade precisa de pelo menos 2 letras.");
      return;
    }
    setBusy(true);
    setErro("");
    try {
      const r = await apiCreateDtpEntidade(texto);
      publicar([...lista, r.entidade].sort((a, b) => a.nome.localeCompare(b.nome, "pt")));
      setNome("");
      setAberta(r.entidade.id);
      setRenomear(r.entidade.nome);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar a entidade.");
    } finally {
      setBusy(false);
    }
  }

  async function gravarNome(id: number) {
    const texto = renomear.trim();
    if (texto.length < 2) return;
    setBusy(true);
    setErro("");
    try {
      const r = await apiRenameDtpEntidade(id, texto);
      publicar(lista.map(e => e.id === id ? r.entidade : e).sort((a, b) => a.nome.localeCompare(b.nome, "pt")));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível renomear a entidade.");
    } finally {
      setBusy(false);
    }
  }

  async function apagar(id: number) {
    setBusy(true);
    setErro("");
    try {
      await apiDeleteDtpEntidade(id);
      publicar(lista.filter(e => e.id !== id));
      if (aberta === id) setAberta(null);
      setConfirmar(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível apagar a entidade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Entidades responsáveis</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Cada entidade tem a sua estrutura de dossiê. Na oferta do curso escolhe-se uma destas entidades. As turmas desse curso usam a estrutura e ficam marcadas com o nome.
        </p>
      </div>
      {estado === "loading" && <p className="text-xs text-slate-400">A ler entidades…</p>}
      {estado === "offline" && <p className="text-xs text-amber-700">Sem ligação à API: as entidades não se editam offline.</p>}
      {estado === "ready" && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {lista.length === 0 && (
            <li className="px-3 py-4 text-sm text-slate-500 text-center">Ainda não há entidades. Crie a primeira para definir uma estrutura de dossiê.</li>
          )}
          {lista.map(e => (
            <li key={e.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{e.nome}</p>
                <p className="text-[11px] text-slate-400">{e.documentos} documentos na estrutura</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{e.nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAberta(aberta === e.id ? null : e.id);
                    setRenomear(e.nome);
                    setConfirmar(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {aberta === e.id ? "Fechar" : "Estrutura"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={nome}
          placeholder="Nome da entidade responsável"
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void criar(); }}
        />
        <button type="button" disabled={busy} onClick={() => void criar()} className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white disabled:opacity-40">
          Adicionar entidade
        </button>
      </div>
      {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}
      {aberta != null && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
              value={renomear}
              onChange={e => setRenomear(e.target.value)}
            />
            <button type="button" disabled={busy} onClick={() => void gravarNome(aberta)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              Renomear
            </button>
            {confirmar === aberta ? (
              <button type="button" disabled={busy} onClick={() => void apagar(aberta)} className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white">
                Confirmar apagar
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmar(aberta)} className="px-3 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50">
                Apagar
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Apagar a entidade tira-a dos cursos que a usavam. A personalização de cada curso mantém-se.</p>
          <DtpModeloEditor key={aberta} accent="gold" entidadeId={aberta} />
        </div>
      )}
    </div>
  );
}
