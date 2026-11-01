// Duração dos planos de sessão (ficha do curso) e do tempo de cada momento (introdução, desenvolvimento, conclusão).
// O tempo dos momentos continua a gravar-se como texto («15 min», «2h30»), que é o que os PDF mostram.

/** «15 min», «3 h», «2h30», «1:30», «90» (minutos) → minutos; vazio ou ilegível → 0. */
export function minutosDeTempo(raw: unknown): number {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return 0;
  const hm = /^(\d+)(?:h|:)(\d{1,2})?(?:min|m)?$/.exec(s);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = /^(\d+)(?:min|m)?$/.exec(s);
  return m ? Number(m[1]) : 0;
}

/** Minutos → «15 min», «3h», «2h30» (0 → vazio). */
export function textoDeMinutos(min: number): string {
  const t = Math.max(0, Math.round(min));
  if (!t) return "";
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60), m = t % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Repartição habitual: introdução e conclusão com 10% cada (de 5 em 5 min, pelo menos 5), o resto no desenvolvimento. */
export function distribuirTempo(total: number) {
  if (total <= 0) return { introducao: 0, desenvolvimento: 0, conclusao: 0 };
  const ponta = Math.min(Math.floor(total / 3), Math.max(5, Math.round((total * 0.1) / 5) * 5));
  return { introducao: ponta, desenvolvimento: total - 2 * ponta, conclusao: ponta };
}

/** «HH:MM» + minutos → «HH:MM» (até 23:59). */
export function somarMinutos(hora: string, min: number) {
  const [h, m] = hora.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + Math.max(0, min));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
