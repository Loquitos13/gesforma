import { SLOTS_CCP, SLOTS_TODOS, type SlotId } from "./disponibilidade";

const DIAS = [
  { id: "seg", label: "Segunda", slots: ["laboral", "pos-laboral"] as SlotId[] },
  { id: "ter", label: "Terça", slots: ["laboral", "pos-laboral"] as SlotId[] },
  { id: "qua", label: "Quarta", slots: ["laboral", "pos-laboral"] as SlotId[] },
  { id: "qui", label: "Quinta", slots: ["laboral", "pos-laboral"] as SlotId[] },
  { id: "sex", label: "Sexta", slots: ["laboral", "pos-laboral"] as SlotId[] },
  { id: "sab", label: "Sábado", slots: ["sabado-manha", "sabado-tarde"] as SlotId[] },
];

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {DIAS.map(dia => (
          <div key={dia.id} className="rounded-lg border border-slate-200 bg-white p-2 space-y-1">
            <p className="text-[11px] font-semibold text-slate-500">{dia.label}</p>
            {dia.slots.map(id => {
              const slot = SLOTS_CCP.find(s => s.id === id);
              if (!slot) return null;
              const on = activos.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(id)}
                  className={`w-full text-left px-2 py-1.5 rounded-md border text-[11px] ${
                    on ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 text-slate-400"
                  } ${locked ? "cursor-default" : "hover:border-amber-400"}`}
                >
                  <span className="block font-semibold">{slot.label.replace("Sábado ", "")}</span>
                  <span className="block">{slot.horas}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">Os dias úteis partilham laboral e pós-laboral. O sábado tem manhã e tarde.</p>
      {nota && <p className="text-[11px] text-slate-500">{nota}</p>}
    </div>
  );
}
