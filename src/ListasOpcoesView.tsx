import { useEffect, useMemo, useState } from "react";
import { useCatalogList, useListaOpcoes, type ListaOpcao } from "./CatalogsContext";
import { AppModal } from "./FormKit";
import { LISTAS_OPCOES, LISTA_OPCOES_IDS, type ListaOpcoesId } from "./listaOpcoes";
import { ConfirmDangerModal, EmptyHint } from "./SecretaryUX";

export function ListasOpcoesView() {
  const [rows, setRows] = useCatalogList<ListaOpcao>("lista_opcoes", "gold", []);
  const [lista, setLista] = useState<ListaOpcoesId>("origens");
  const { add } = useListaOpcoes(lista);
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [apagar, setApagar] = useState<ListaOpcao | null>(null);
  const meta = LISTAS_OPCOES[lista];
  const daLista = useMemo(
    () => rows.filter(r => r.lista === lista && String(r.nome ?? "").toLowerCase().includes(q.toLowerCase())),
    [rows, lista, q],
  );

  useEffect(() => { setQ(""); }, [lista]);

  async function guardar() {
    setBusy(true);
    await add(nome);
    setBusy(false);
    setNome("");
    setNovo(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Catálogo</p>
          <h1 className="text-xl font-bold text-slate-800">Listas de opções</h1>
          <p className="text-sm text-slate-500 mt-1">Origens, meios, pagamentos e tipos. O «+» nos dropdowns grava aqui.</p>
        </div>
        <button type="button" onClick={() => { setNome(""); setNovo(true); }}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">+ Nova opção</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {LISTA_OPCOES_IDS.map(id => (
          <button key={id} type="button" onClick={() => setLista(id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${lista === id ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {LISTAS_OPCOES[id].titulo}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Filtrar ${meta.titulo.toLowerCase()}…`}
            className="w-full sm:w-72 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        {daLista.length === 0 ? (
          <div className="p-6"><EmptyHint text={`Ainda não há opções em «${meta.titulo}».`} /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {daLista.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <p className="text-sm text-slate-800">{r.nome}</p>
                <button type="button" onClick={() => setApagar(r)} className="text-xs font-semibold text-red-600 hover:text-red-800">Eliminar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AppModal
        open={novo}
        onClose={() => { if (!busy) setNovo(false); }}
        title={`Nova opção · ${meta.titulo}`}
        size="sm"
        footer={(
          <>
            <button type="button" onClick={() => setNovo(false)} className="px-4 py-2 border border-slate-200 text-sm rounded-lg">Cancelar</button>
            <button type="button" disabled={!nome.trim() || busy} onClick={() => void guardar()}
              className="px-4 py-2 bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </>
        )}
      >
        <div className="p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Nome</span>
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void guardar(); } }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </label>
        </div>
      </AppModal>
      <ConfirmDangerModal
        open={!!apagar}
        onClose={() => setApagar(null)}
        title="Eliminar opção"
        body={apagar ? `Remover «${apagar.nome}» de ${meta.titulo}? Fichas que já usam este valor continuam a mostrá-lo.` : ""}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (apagar) setRows(xs => xs.filter(x => x.id !== apagar.id));
          setApagar(null);
        }}
      />
    </div>
  );
}
