import type { SessaoCronograma } from "./turmaModel";
import { sessaoFormadores } from "./turmaModel";

export function staffPodeDossie(role: string) {
  return role === "admin" || role === "secretaria" || role === "financiada";
}

export function staffEditaValidado(role: string) {
  return role === "admin" || role === "secretaria" || role === "financiada";
}

export function nomesDoUtilizador(
  user: { name: string; email: string; role: string },
  formadores: { nome: string; email: string }[],
) {
  const email = user.email.trim().toLowerCase();
  const nome = user.name.trim().toLowerCase();
  const hits = formadores.filter(f =>
    (email && f.email.trim().toLowerCase() === email) || f.nome.trim().toLowerCase() === nome,
  );
  const nomes = new Set(hits.map(f => f.nome.trim()).filter(Boolean));
  if (!nomes.size && user.role === "formador" && user.name.trim()) nomes.add(user.name.trim());
  return nomes;
}

export function formadorNaSessao(nomes: Set<string>, sessao: { formadores?: string[]; formador?: string }) {
  const lista = sessaoFormadores(sessao);
  if (!lista.length) return false;
  for (const n of lista) {
    if (nomes.has(n)) return true;
    const low = n.toLowerCase();
    for (const meu of nomes) {
      if (meu.toLowerCase() === low) return true;
    }
  }
  return false;
}

export function podeMexerDocumento(opts: {
  role: string;
  nomes: Set<string>;
  sessao: { formadores?: string[]; formador?: string };
  validado: boolean;
}) {
  if (staffEditaValidado(opts.role)) return true;
  if (opts.role !== "formador") return !opts.validado;
  if (!formadorNaSessao(opts.nomes, opts.sessao)) return false;
  return !opts.validado;
}

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutoSeguinte(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  if (!Number.isFinite(h)) return hora || "00:01";
  const total = h * 60 + (Number.isFinite(m) ? m : 0) + 1;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function faixa(inicio: string, fim: string): [number, number] | null {
  const s = minutos(inicio);
  const e = minutos(fim);
  if (s == null || e == null) return null;
  if (e <= s) return [s, 24 * 60];
  return [s, e];
}

export function horariosSobrepoem(a0: string, a1: string, b0: string, b1: string) {
  const a = faixa(a0, a1);
  const b = faixa(b0, b1);
  if (!a || !b) return false;
  return a[0] < b[1] && b[0] < a[1];
}

export function horaMais(hora: string, horas: number) {
  const [h, m] = hora.split(":").map(Number);
  if (!Number.isFinite(h)) return hora || "00:00";
  const total = h * 60 + (Number.isFinite(m) ? m : 0) + Math.round(horas * 60);
  const limitado = Math.min(24 * 60 - 1, Math.max(0, total));
  return `${String(Math.floor(limitado / 60)).padStart(2, "0")}:${String(limitado % 60).padStart(2, "0")}`;
}

export function formadorIndisponivel(
  nome: string,
  data: string,
  inicio: string,
  fim: string,
  turmas: { cronograma: SessaoCronograma[] }[],
  excepto?: { id?: string; cronograma?: SessaoCronograma[] },
) {
  if (!data || !inicio || !fim) return false;
  for (const t of turmas) {
    for (const s of t.cronograma) {
      if (excepto?.id && s.id === excepto.id && (!excepto.cronograma || t.cronograma === excepto.cronograma)) continue;
      if (s.data !== data) continue;
      if ((s.modalidade ?? "presencial") === "auto") continue;
      if (!sessaoFormadores(s).some(f => f.toLowerCase() === nome.toLowerCase())) continue;
      if (horariosSobrepoem(inicio, fim, s.horaInicio, s.horaFim)) return true;
    }
  }
  return false;
}
