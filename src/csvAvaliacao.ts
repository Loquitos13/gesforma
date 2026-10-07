export type Celula = { r: number; c: number };

export type PapelCelula = "nome" | "valor" | "media";

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const primeira = src.split("\n").find(l => l.trim()) ?? "";
  const delim = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? "";
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delim) { row.push(cur.trim()); cur = ""; continue; }
    if (ch === "\n") { row.push(cur.trim()); rows.push(row); row = []; cur = ""; continue; }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c !== ""));
}

export function colunaLetra(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function refCelula(c: Celula) {
  return `${colunaLetra(c.c)}${c.r + 1}`;
}

function pesoDe(raw: string) {
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return 1;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function texto(grid: string[][], r: number, c: number) {
  return (grid[r]?.[c] ?? "").trim();
}

/** Lê parâmetros a partir da primeira célula de nome, da célula de valor ao lado e da célula de média. */
export function parametrosDoCsv(grid: string[][], nome: Celula, valor: Celula, media: Celula) {
  if (nome.r === valor.r && nome.c === valor.c) {
    return { erro: "O nome e o valor têm de ser células diferentes.", parametros: [] as { label: string; peso: number }[] };
  }
  const mesmaLinha = nome.r === valor.r;
  const mesmaColuna = nome.c === valor.c;
  if (!mesmaLinha && !mesmaColuna) {
    return { erro: "O nome e o valor têm de estar na mesma linha ou na mesma coluna.", parametros: [] as { label: string; peso: number }[] };
  }
  const mediaTxt = texto(grid, media.r, media.c).toLowerCase();
  const out: { label: string; peso: number }[] = [];
  if (mesmaLinha) {
    const saltarLinha = media.c === nome.c || media.c === valor.c ? media.r : -1;
    for (let r = nome.r; r < grid.length; r++) {
      if (r === saltarLinha) continue;
      const label = texto(grid, r, nome.c);
      if (!label) break;
      if (mediaTxt && label.toLowerCase() === mediaTxt) continue;
      out.push({ label, peso: pesoDe(texto(grid, r, valor.c)) });
    }
  } else {
    const largura = grid.reduce((m, linha) => Math.max(m, linha.length), 0);
    const saltarColuna = media.r === nome.r || media.r === valor.r ? media.c : -1;
    for (let c = nome.c; c < largura; c++) {
      if (c === saltarColuna) continue;
      const label = texto(grid, nome.r, c);
      if (!label) break;
      if (mediaTxt && label.toLowerCase() === mediaTxt) continue;
      out.push({ label, peso: pesoDe(texto(grid, valor.r, c)) });
    }
  }
  if (!out.length) return { erro: "Não há parâmetros nessas células.", parametros: out };
  return { erro: "", parametros: out };
}
