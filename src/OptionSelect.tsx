import { useState } from "react";
import { useListaOpcoes } from "./CatalogsContext";
import { AppModal, SearchSelect } from "./FormKit";
import { LISTAS_OPCOES, type ListaOpcoesId } from "./listaOpcoes";

export function OptionSelect({
  lista,
  value,
  onChange,
  allowEmpty,
  placeholder,
  empty,
  canAdd = true,
}: {
  lista: ListaOpcoesId;
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  empty?: string;
  canAdd?: boolean;
}) {
  const meta = LISTAS_OPCOES[lista];
  const { nomes, add } = useListaOpcoes(lista);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const options = nomes.map(v => ({ value: v }));

  async function guardar() {
    if (!nome.trim() || busy) return;
    setBusy(true);
    const saved = await add(nome);
    setBusy(false);
    if (saved) {
      onChange(saved);
      setNome("");
      setOpen(false);
    }
  }

  return (
    <>
      <SearchSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder ?? `Pesquisar ${meta.titulo.toLowerCase()}…`}
        empty={empty ?? "Nenhuma opção. Use + para criar."}
        allowEmpty={allowEmpty}
        onAdd={canAdd ? () => { setNome(""); setOpen(true); } : undefined}
        addLabel={`Nova opção em ${meta.titulo}`}
      />
      <AppModal
        open={open}
        onClose={() => { if (!busy) setOpen(false); }}
        title={`Nova opção · ${meta.titulo}`}
        sub="A opção fica no catálogo e passa a aparecer em todos os formulários desta lista."
        size="sm"
        footer={(
          <>
            <button type="button" onClick={() => setOpen(false)} disabled={busy}
              className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={() => void guardar()} disabled={!nome.trim() || busy}
              className="px-4 py-2 bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg hover:bg-amber-600">
              {busy ? "A guardar…" : "Guardar"}
            </button>
          </>
        )}
      >
        <div className="p-5 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome da opção</span>
            <input
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void guardar(); } }}
              placeholder="Ex.: Protocolo de Estágio"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
          <p className="text-xs text-slate-500">Não apague opções em uso nas fichas - pode desactivar mais tarde na vista Listas.</p>
        </div>
      </AppModal>
    </>
  );
}
