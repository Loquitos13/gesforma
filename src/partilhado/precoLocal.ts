// Preço de uma oferta Gold pela ficha do curso (Preço por local e horário): a regra mais específica ganha
// (local e horário › só local › só horário › o preço do curso). Partilhado pelo servidor e pelo site.

export type RegraPreco = { local: string; horario: string; preco: number };

export function normPreco(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function escolherPreco(base: number, local: string, horario: string, regras: RegraPreco[]) {
  const L = normPreco(local);
  const H = normPreco(horario);
  const lista = regras.filter(r => Number.isFinite(r.preco) && r.preco >= 0 && (normPreco(r.local) || normPreco(r.horario)));
  const ambos = lista.find(r => normPreco(r.local) === L && L !== "" && normPreco(r.horario) === H && H !== "");
  if (ambos) return ambos.preco;
  const soLocal = lista.find(r => normPreco(r.local) === L && L !== "" && normPreco(r.horario) === "");
  if (soLocal) return soLocal.preco;
  const soHorario = lista.find(r => normPreco(r.local) === "" && normPreco(r.horario) === H && H !== "");
  if (soHorario) return soHorario.preco;
  return base;
}

/** Preço num local, para qualquer horário: um valor, ou o mais baixo e se varia com o horário. */
export function precoDoLocal(base: number, local: string, regras: RegraPreco[]) {
  const L = normPreco(local);
  const precos = [escolherPreco(base, local, "", regras), ...regras.filter(r => L && normPreco(r.local) === L && normPreco(r.horario)).map(r => r.preco)]
    .filter(n => Number.isFinite(n) && n > 0);
  if (!precos.length) return null;
  const min = Math.min(...precos);
  return { min, varia: precos.some(p => p !== min) };
}
