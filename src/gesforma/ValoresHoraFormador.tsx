export function ValoresHoraFormador({
  formadores,
  value,
  onChange,
  base,
}: {
  formadores: string[];
  value: Record<string, number | "">;
  onChange: (next: Record<string, number>) => void;
  base?: { nome: string; valorHora: string }[];
}) {
  const nomes = [...new Set(formadores.map(n => n.trim()).filter(Boolean))];
  if (!nomes.length) {
    return <p className="text-xs text-slate-400">Escolha os formadores para indicar o valor por hora desta turma.</p>;
  }
  return (
    <div className="space-y-2">
      {nomes.map(nome => {
        const sugerido = base?.find(b => b.nome.toLowerCase() === nome.toLowerCase())?.valorHora;
        return (
          <label key={nome} className="grid grid-cols-[1fr_7rem] gap-2 items-center">
            <span className="text-sm text-slate-700 truncate">{nome}</span>
            <input
              type="number"
              min={0}
              step="0.5"
              placeholder={sugerido ? String(sugerido) : "€/h"}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              value={value[nome] ?? ""}
              onChange={e => {
                const n = e.target.value === "" ? undefined : Number(e.target.value);
                const next = { ...value };
                if (n == null || Number.isNaN(n)) delete next[nome];
                else next[nome] = n;
                const limpo: Record<string, number> = {};
                for (const [k, v] of Object.entries(next)) {
                  if (typeof v === "number" && Number.isFinite(v)) limpo[k] = v;
                }
                onChange(limpo);
              }}
            />
          </label>
        );
      })}
      <p className="text-[11px] text-slate-400">Valor interno desta turma. Se ficar vazio, usa-se o valor base do curso, quando existir.</p>
    </div>
  );
}
