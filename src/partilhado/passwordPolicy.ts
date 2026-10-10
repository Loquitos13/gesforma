const MIN = 10;

function sortear(chars: string) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return chars[buf[0]! % chars.length] ?? chars[0] ?? "a";
}

function baralhar(chars: string[]) {
  const out = [...chars];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0]! % (i + 1);
    const a = out[i] ?? "";
    out[i] = out[j] ?? "";
    out[j] = a;
  }
  return out.join("");
}

export function errosPalavraPasse(password: string) {
  const erros: string[] = [];
  if (password.length < MIN) erros.push(`pelo menos ${MIN} caracteres`);
  if (!/[a-z]/.test(password)) erros.push("uma minúscula");
  if (!/[A-Z]/.test(password)) erros.push("uma maiúscula");
  if (!/[0-9]/.test(password)) erros.push("um algarismo");
  if (!/[^A-Za-z0-9]/.test(password)) erros.push("um símbolo");
  return erros;
}

export function palavraPasseValida(password: string) {
  return errosPalavraPasse(password).length === 0;
}

export function mensagemPalavraPasse(password: string) {
  const erros = errosPalavraPasse(password);
  if (!erros.length) return "";
  return `A palavra-passe tem de incluir ${erros.join(", ")}.`;
}

/** Palavra-passe aleatória que cumpre as regras da plataforma. */
export function gerarPalavraPasse() {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digit = "23456789";
  const symbol = "!@#$%*?";
  const todos = lower + upper + digit + symbol;
  const base = [sortear(lower), sortear(upper), sortear(digit), sortear(symbol)];
  while (base.length < 12) base.push(sortear(todos));
  return baralhar(base);
}
