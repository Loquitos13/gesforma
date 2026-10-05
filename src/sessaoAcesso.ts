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

export function horariosSobrepoem(a0: string, a1: string, b0: string, b1: string) {
  const as = minutos(a0);
  const ae = minutos(a1);
  const bs = minutos(b0);
  const be = minutos(b1);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

export function formadorIndisponivel(
  nome: string,
  data: string,
  inicio: string,
  fim: string,
  turmas: { cronograma: SessaoCronograma[] }[],
  exceptoId?: string,
) {
  if (!data || !inicio || !fim) return false;
  for (const t of turmas) {
    for (const s of t.cronograma) {
      if (exceptoId && s.id === exceptoId) continue;
      if (s.data !== data) continue;
      if ((s.modalidade ?? "presencial") === "auto") continue;
      if (!sessaoFormadores(s).some(f => f.toLowerCase() === nome.toLowerCase())) continue;
      if (horariosSobrepoem(inicio, fim, s.horaInicio, s.horaFim)) return true;
    }
  }
  return false;
}
