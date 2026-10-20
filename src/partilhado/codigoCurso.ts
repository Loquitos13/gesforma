/**
 * Código do curso da Financiada no Catálogo Nacional de Qualificações: uma UFCD (só dígitos, ex. «8995»)
 * ou uma UC (ex. «UC00277»). Guarda-se sem prefixo nas UFCD e com o «UC» nas UC.
 */

/** Normaliza o que se escreve: «ufcd 8995» → «8995», «uc 00277» → «UC00277». */
export function normalizarCodigoCurso(v: string) {
  const s = v.toUpperCase().replace(/\s+/g, "").replace(/^UFCD-?/, "");
  const uc = /^UC-?(\d*)$/.exec(s);
  if (uc) return `UC${uc[1]}`.slice(0, 20);
  return s.replace(/[^0-9A-Z]/g, "").slice(0, 20);
}

/** Preenchido depois de normalizado (UFCD só com dígitos, UC com o prefixo; outros códigos antigos ficam como estão). */
export function codigoCursoValido(v: string) {
  const c = normalizarCodigoCurso(v);
  return c !== "" && c !== "UC";
}

/** Para mostrar: «UFCD 8995» ou «UC00277». */
export function rotuloCodigoCurso(v: string | null | undefined) {
  const c = String(v ?? "").trim();
  if (!c) return "";
  return /^\d+$/.test(c) ? `UFCD ${c}` : c;
}
