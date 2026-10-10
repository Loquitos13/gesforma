export type Celula = { r: number; c: number };

export type PapelCelula = "nome" | "valor" | "media";

export type ParametroCsv = { label: string; peso: number };

export type BlocoCsv = {
  titulo: string;
  parametros: ParametroCsv[];
};

export type SegmentoGrelha =
  | { tipo: "coluna"; c: number }
  | { tipo: "participantes"; de: number; ate: number; quantidade: number };

export function limparGrelha(rows: string[][]) {
  const grelha = rows.map(linha => linha.map(celula => String(celula ?? "").trim()));
  while (grelha.length && grelha[grelha.length - 1].every(celula => celula === "")) grelha.pop();
  return grelha;
}

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
  while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
  return rows;
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

function texto(grid: string[][], r: number, c: number) {
  return (grid[r]?.[c] ?? "").replace(/\s+/g, " ").trim();
}

function larguraDe(grid: string[][]) {
  return grid.reduce((m, linha) => Math.max(m, linha.length), 0);
}

function pesoDe(raw: string) {
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return 1;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function linhaResumo(label: string) {
  const t = label.trim().toLowerCase();
  return t.startsWith("pontuação por formando")
    || t.startsWith("somatório")
    || t.startsWith("escala qualitativa")
    || /^af\s*=/.test(t)
    || t.includes("avaliação diagnóstica")
    || t.includes("avaliação sumativa")
    || t.includes("avaliação módulos")
    || t.startsWith("rubrica")
    || t.startsWith("data:");
}

/** Colunas de formandos: o cabeçalho "Participantes" e os nomes na linha seguinte. */
export function colunasParticipantes(grid: string[][]) {
  const cols = new Set<number>();
  for (let r = 0; r < grid.length; r++) {
    const linha = grid[r] ?? [];
    for (let c = 0; c < linha.length; c++) {
      if (texto(grid, r, c).toLowerCase() !== "participantes") continue;
      const nomes = grid[r + 1] ?? [];
      let k = c;
      while (k < nomes.length && (nomes[k] ?? "").trim()) {
        cols.add(k);
        k++;
      }
      if (k === c) cols.add(c);
    }
  }
  return cols;
}

export function segmentosGrelha(grid: string[][]): SegmentoGrelha[] {
  const partes = colunasParticipantes(grid);
  const largura = larguraDe(grid);
  const out: SegmentoGrelha[] = [];
  let c = 0;
  while (c < largura) {
    if (partes.has(c)) {
      const de = c;
      while (c < largura && partes.has(c)) c++;
      out.push({ tipo: "participantes", de, ate: c - 1, quantidade: c - de });
    } else {
      out.push({ tipo: "coluna", c });
      c++;
    }
  }
  return out;
}

type Factor = { codigo: string; peso: number };

function factoresFormula(raw: string): Factor[] {
  const t = raw.replace(/\s+/g, " ");
  const re = /(\d+(?:[.,]\d+)?)\s*[*x×]\s*([A-Za-z][A-Za-z0-9]*(?:\/[A-Za-z0-9]+)?)|([A-Za-z][A-Za-z0-9]*(?:\/[A-Za-z0-9]+)?)\s*[*x×]\s*(\d+(?:[.,]\d+)?)/gi;
  const out: Factor[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const peso = Number((m[1] || m[4] || "").replace(",", "."));
    const codigo = (m[2] || m[3] || "").toUpperCase();
    if (!codigo || !Number.isFinite(peso) || peso <= 0) continue;
    out.push({ codigo, peso });
  }
  return out;
}

function normalizarPesos(pesos: number[]) {
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (pesos.length && pesos.every(p => p > 0 && p <= 1) && Math.abs(soma - 1) < 0.02) {
    return pesos.map(p => Math.round(p * 1000) / 10);
  }
  return pesos;
}

function nomesAbaixo(grid: string[][], col: number, startRow: number) {
  const items: { r: number; label: string }[] = [];
  for (let r = startRow; r < grid.length; r++) {
    const label = texto(grid, r, col);
    if (!label) {
      if (items.length) break;
      continue;
    }
    if (linhaResumo(label) || label.toLowerCase() === "participantes") break;
    items.push({ r, label });
  }
  return items;
}

function formulaDoBloco(grid: string[][], col: number, depoisDaLinha: number) {
  const limite = Math.min(grid.length, depoisDaLinha + 6);
  for (let r = depoisDaLinha; r < limite; r++) {
    for (let c = Math.max(0, col - 1); c <= col + 1; c++) {
      const factores = factoresFormula(texto(grid, r, c));
      if (factores.length >= 2) return factores;
    }
  }
  return [] as Factor[];
}

function grupoNaLinha(grid: string[][], col: number, r: number, desde: number) {
  for (let i = r; i >= desde; i--) {
    const t = texto(grid, i, col);
    if (!t) continue;
    if (linhaResumo(t)) return "";
    if (/^(blocos|parâmetros de avaliação|critérios de análise)/i.test(t)) return "";
    if (/^\d+$/.test(t)) return "";
    return t;
  }
  return "";
}

function melhorTitulo(grid: string[][], nameCol: number, headerRow: number) {
  let melhor = "";
  let melhorScore = -1;
  const largura = larguraDe(grid);
  for (let i = 0; i <= headerRow; i++) {
    for (let j = Math.max(0, nameCol - 3); j <= Math.min(largura - 1, nameCol + 2); j++) {
      const t = texto(grid, i, j);
      if (t.length < 4) continue;
      let score = 0;
      if (/CP\d/.test(t)) score = 5;
      else if (/projeto de intervenção|avaliação final|elearning|e-learning|ficha de sistemat|simulação pedagógica/i.test(t)) score = 4;
      else if (/^módulo\s+\d+/i.test(t)) score = 3;
      else continue;
      score = score * 100 + i;
      if (score > melhorScore) {
        melhorScore = score;
        melhor = t;
      }
    }
  }
  return melhor;
}

function codigoOp(grid: string[][], col: number, headerRow: number) {
  const limite = Math.min(grid.length, headerRow + 24);
  for (let r = headerRow; r < limite; r++) {
    for (let c = Math.max(0, col - 1); c <= col; c++) {
      const m = texto(grid, r, c).match(/\b(OP\d)\b/);
      if (m) return m[1];
    }
  }
  return "";
}

function tituloCurto(bruto: string, header: string, op: string) {
  const raw = bruto || header;
  if (op === "OP1" && /módulo\s+\d+/i.test(raw)) return "OP1 · Parâmetros dos módulos (1 a 5)";
  const cp = raw.match(/CP\d/);
  if (cp) {
    if (/plano de sessão/i.test(raw)) return `${cp[0]} · Plano de sessão`;
    if (/recursos/i.test(raw)) return `${cp[0]} · Recursos didáticos`;
    if (/desenvolvimento/i.test(raw)) return `${cp[0]} · Desenvolvimento`;
    return cp[0];
  }
  if (/projeto de intervenção/i.test(raw)) return "AS/PI · Projeto de intervenção";
  if (/^avaliação final/i.test(raw)) return "Avaliação final";
  if (/ficha de sistematização/i.test(raw)) return "OP2 · Avaliações intermédias";
  if (/elearning|e-learning/i.test(raw)) return "AS/OP · Módulos elearning";
  if (/simulação pedagógica inicial/i.test(raw)) return "AD · Simulação inicial";
  if (/simulação pedagógica final/i.test(raw)) return "AS/CP · Simulação final";
  const mod = raw.match(/módulo\s+\d+/i);
  if (mod && /1 a 5/i.test(header)) return `${mod[0]} · Parâmetros (1 a 5)`;
  if (mod) return mod[0];
  if (/1 a 5/i.test(header)) return "Parâmetros (1 a 5)";
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length > 64 ? `${t.slice(0, 61)}...` : t || "Parâmetros";
}

function montarBloco(
  grid: string[][],
  nameCol: number,
  headerRow: number,
  header: string,
  participantes: Set<number>,
): BlocoCsv | null {
  if (participantes.has(nameCol)) return null;
  const start = headerRow + 1;
  const items = nomesAbaixo(grid, nameCol, start);
  if (!items.length) return null;

  const descCol = nameCol + 1;
  const descUtil = !participantes.has(descCol) && items.filter(item => texto(grid, item.r, descCol).length > 24).length >= Math.ceil(items.length / 2);
  const pesoCol = !participantes.has(nameCol + 1) && texto(grid, headerRow, nameCol + 1) === "%" ? nameCol + 1 : -1;
  const factores = formulaDoBloco(grid, nameCol, items[items.length - 1]!.r + 1);
  const usarFormula = factores.length === items.length;
  const pesosFormula = usarFormula ? normalizarPesos(factores.map(f => f.peso)) : [];

  const grupos = items.map(item => grupoNaLinha(grid, nameCol - 1, item.r, headerRow));
  const gruposVarios = new Set(grupos.filter(Boolean)).size > 1;

  const parametros = items.map((item, i) => {
    const descricao = descUtil ? texto(grid, item.r, descCol) : "";
    let label = item.label;
    if (usarFormula) {
      const codigo = factores[i]!.codigo;
      if (descricao) label = `${codigo} · ${descricao}`;
      else if (label.toUpperCase() !== codigo) label = codigo;
    } else if (gruposVarios && grupos[i] && !/^\d+\./.test(label)) {
      label = `${grupos[i]} · ${label}`;
    }
    const peso = usarFormula ? pesosFormula[i]! : pesoCol >= 0 ? pesoDe(texto(grid, item.r, pesoCol)) : 1;
    return { label, peso };
  });

  return {
    titulo: tituloCurto(melhorTitulo(grid, nameCol, headerRow), header, codigoOp(grid, nameCol, headerRow)),
    parametros,
  };
}

/** Blocos de parâmetros da folha. As colunas de participantes não entram. */
export function blocosDoCsv(grid: string[][]): BlocoCsv[] {
  const participantes = colunasParticipantes(grid);
  const usados = new Set<number>();
  const achados: { col: number; bloco: BlocoCsv }[] = [];

  for (let r = 0; r < grid.length; r++) {
    const linha = grid[r] ?? [];
    for (let c = 0; c < linha.length; c++) {
      const header = texto(grid, r, c);
      if (!header) continue;
      const criterios = /critérios de análise/i.test(header);
      const parametros = /parâmetros de avaliação/i.test(header);
      if (!criterios && !parametros) continue;
      const nameCol = criterios ? c + 1 : c;
      if (usados.has(nameCol) || participantes.has(nameCol)) continue;
      const bloco = montarBloco(grid, nameCol, r, header, participantes);
      if (!bloco) continue;
      usados.add(nameCol);
      achados.push({ col: nameCol, bloco });
    }
  }

  achados.sort((a, b) => a.col - b.col);
  return achados.map(a => a.bloco);
}

/** Lê parâmetros a partir da primeira célula de nome, da célula de valor ao lado e da célula de média. */
export function parametrosDoCsv(grid: string[][], nome: Celula, valor: Celula, media: Celula) {
  const participantes = colunasParticipantes(grid);
  if (participantes.has(nome.c) || participantes.has(valor.c) || participantes.has(media.c)) {
    return {
      erro: "Essa coluna é de participantes. Escolha o nome do parâmetro e o peso, não a nota de um formando.",
      parametros: [] as ParametroCsv[],
    };
  }
  if (nome.r === valor.r && nome.c === valor.c) {
    return { erro: "O nome e o valor têm de ser células diferentes.", parametros: [] as ParametroCsv[] };
  }
  const mesmaLinha = nome.r === valor.r;
  const mesmaColuna = nome.c === valor.c;
  if (!mesmaLinha && !mesmaColuna) {
    return { erro: "O nome e o valor têm de estar na mesma linha ou na mesma coluna.", parametros: [] as ParametroCsv[] };
  }
  const mediaTxt = texto(grid, media.r, media.c).toLowerCase();
  const out: ParametroCsv[] = [];
  if (mesmaLinha) {
    const saltarLinha = media.c === nome.c || media.c === valor.c ? media.r : -1;
    for (let r = nome.r; r < grid.length; r++) {
      if (r === saltarLinha) continue;
      if (participantes.has(nome.c)) break;
      const label = texto(grid, r, nome.c);
      if (!label) break;
      if (linhaResumo(label)) break;
      if (mediaTxt && label.toLowerCase() === mediaTxt) continue;
      out.push({ label, peso: pesoDe(texto(grid, r, valor.c)) });
    }
  } else {
    const largura = larguraDe(grid);
    const saltarColuna = media.r === nome.r || media.r === valor.r ? media.c : -1;
    for (let c = nome.c; c < largura; c++) {
      if (participantes.has(c)) break;
      if (c === saltarColuna) continue;
      const label = texto(grid, nome.r, c);
      if (!label) break;
      if (linhaResumo(label)) break;
      if (mediaTxt && label.toLowerCase() === mediaTxt) continue;
      out.push({ label, peso: pesoDe(texto(grid, valor.r, c)) });
    }
  }
  if (!out.length) return { erro: "Não há parâmetros nessas células.", parametros: out };
  return { erro: "", parametros: out };
}
