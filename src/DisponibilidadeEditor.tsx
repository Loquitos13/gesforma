import { SLOTS_CCP, SLOTS_TODOS, type SlotId } from "./disponibilidade";

export function DisponibilidadeEditor({
  value,
  onChange,
  locked,
  nota,
}: {
  value: string[] | undefined;
  onChange?: (next: SlotId[]) => void;
  locked?: boolean;
  nota?: string;
}) {
  const activos = new Set(value ?? SLOTS_TODOS);
  function toggle(id: SlotId) {
    if (locked || !onChange) return;
    const next = activos.has(id) ? [...activos].filter(x => x !== id) : [...activos, id];
    onChange(SLOTS_TODOS.filter(s => next.includes(s)));
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SLOTS_CCP.map(slot => {
          const on = activos.has(slot.id);
          return (
            <button
              key={slot.id}
              type="button"
              disabled={locked}
              onClick={() => toggle(slot.id)}
              className={`text-left px-3 py-2 rounded-lg border text-xs ${
                on ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-white text-slate-500"
              } ${locked ? "cursor-default" : "hover:border-amber-400"}`}
            >
              <span className="font-semibold">{slot.label}</span>
              <span className="block text-[11px] mt-0.5">{slot.dias} · {slot.horas}</span>
            </button>
          );
        })}
      </div>
      {nota && <p className="text-[11px] text-slate-500">{nota}</p>}
    </div>
  );
}
