import type { ParametroAvaliacao } from "./avaliacaoCurso";
import { type BlocoCcp, type EstruturaCcp, type IdInstrumentoCcp } from "./avaliacaoCcp";
import { colunaLetra } from "./csvAvaliacao";
import type { TopicoPrograma } from "./cursoPrograma";

export type PapelTexto = "titulo" | "meta" | "cabeca" | "nome" | "grupo" | "param" | "peso" | "codigo" | "formula";

export type LarguraColuna = "gutter" | "codigo" | "texto" | "grupo" | "param" | "peso" | "formando";

export type CelulaFolha =
  | { tipo: "vazio" }
  | { tipo: "ocupado" }
  | { tipo: "texto"; texto: string; papel: PapelTexto; span?: number; formula?: string }
  | { tipo: "entrada"; formandoId: number; moduloId: string; parametroId: string }
  | { tipo: "valor"; texto: string; papel: "calculo" | "escala"; formula?: string };

export type TrechoColunas = { de: number; ate: number };

/** Um bloco da folha, para se ver de cada vez. As fórmulas continuam a ser as da folha inteira. */
export type FaixaBloco = {
  id: string;
  titulo: string;
  trechos: TrechoColunas[];
};

export type FolhaModelo = {
  id: string;
  titulo: string;
  larguras: LarguraColuna[];
  linhas: CelulaFolha[][];
  faixas: FaixaBloco[];
};

export type Pessoa = { id: number; nome: string };

export type Ctx = {
  ccp: EstruturaCcp;
  topicos: Pick<TopicoPrograma, "id" | "titulo">[];
  formandos: Pessoa[];
  mapa: Map<string, number | null>;
  cursoNome?: string;
  turmaNome?: string;
  escalaMax: number;
};

const VAZIO: CelulaFolha = { tipo: "vazio" };

export class Grelha {
  private celulas: CelulaFolha[][] = [];
  larguras: LarguraColuna[] = [];

  largura(c: number, tipo: LarguraColuna) {
    this.ensure(c, 0);
    this.larguras[c] = tipo;
  }

  set(c: number, r: number, cel: CelulaFolha) {
    this.ensure(c, r);
    this.celulas[r][c] = cel;
    if (cel.tipo === "texto" && cel.span && cel.span > 1) {
      for (let i = 1; i < cel.span; i++) {
        this.ensure(c + i, r);
        this.celulas[r][c + i] = { tipo: "ocupado" };
      }
    }
  }

  linhas(): CelulaFolha[][] {
    const w = this.larguras.length;
    return this.celulas.map(row => {
      const next = row.slice();
      while (next.length < w) next.push(VAZIO);
      return next;
    });
  }

  private ensure(c: number, r: number) {
    while (this.larguras.length <= c) this.larguras.push("formando");
    while (this.celulas.length <= r) this.celulas.push([]);
    for (const row of this.celulas) {
      while (row.length <= c) row.push(VAZIO);
    }
  }
}

export function texto(valor: string, papel: PapelTexto, span?: number, formula?: string): CelulaFolha {
  const base = formula
    ? { tipo: "texto" as const, texto: valor, papel, formula }
    : { tipo: "texto" as const, texto: valor, papel };
  return span && span > 1 ? { ...base, span } : base;
}

export function textoNota(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "";
  const r = Math.round(n * 100) / 100;
  const txt = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return txt.replace(".", ",");
}

export const ESCALA_QUALITATIVA_CCP = [
  { nivel: 1, texto: "Aproveitamento Insuficiente" },
  { nivel: 2, texto: "Aproveitamento Satisfatório" },
  { nivel: 3, texto: "Aproveitamento Bom" },
  { nivel: 4, texto: "Aproveitamento Relevante" },
  { nivel: 5, texto: "Aproveitamento Excelente" },
] as const;

export function textoEscalaCcp(nota: number | null) {
  if (nota == null || !Number.isFinite(nota)) return "";
  const n = Math.min(5, Math.max(1, Math.round(nota)));
  return ESCALA_QUALITATIVA_CCP.find(item => item.nivel === n)?.texto ?? "";
}

export function legendaEscala() {
  return ESCALA_QUALITATIVA_CCP.map(item => `${item.nivel} - ${item.texto}`).join("\n");
}

export function celCalculo(n: number | null, formula?: string): CelulaFolha {
  return formula ? { tipo: "valor", texto: textoNota(n), papel: "calculo", formula } : { tipo: "valor", texto: textoNota(n), papel: "calculo" };
}

export function celEscala(n: number | null, formula?: string): CelulaFolha {
  return formula ? { tipo: "valor", texto: textoEscalaCcp(n), papel: "escala", formula } : { tipo: "valor", texto: textoEscalaCcp(n), papel: "escala" };
}

export function refFolha(nome: string, coluna: number, linha: number) {
  return `'${nome}'!${colunaLetra(coluna)}${linha + 1}`;
}

export function refLocal(coluna: number, linha: number) {
  return `${colunaLetra(coluna)}${linha + 1}`;
}

export function colunaDo(formandos: Pessoa[], f: Pessoa, inicio: number) {
  const i = formandos.indexOf(f);
  return inicio + (i < 0 ? 0 : i);
}

export function arredondar(n: number | null) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n);
}

export function formulaEscala(ref: string) {
  return ESCALA_QUALITATIVA_CCP.reduceRight(
    (resto, item) => `IF(ROUND(${ref},0)=${item.nivel},"${item.texto}"${resto ? `,${resto}` : ""})`,
    "",
  );
}

export const FOLHA_INICIAL = "Simulação Pedagógica Inicial";
export const FOLHA_ELEARNING = "Avaliação dos módulos elearning";
export const FOLHA_SIM_FINAL = "Simulação Pedagógica Final";
export const FOLHA_PROJETO = "Projeto de Intervenção";

export function entrada(f: Pessoa, moduloId: string, parametroId: string): CelulaFolha {
  return { tipo: "entrada", formandoId: f.id, moduloId, parametroId };
}

function ler(mapa: Map<string, number | null>, formandoId: number, moduloId: string, parametroId: string) {
  const v = mapa.get(`${formandoId}|${moduloId}|${parametroId}`);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function somaCompleta(
  params: ParametroAvaliacao[],
  mapa: Map<string, number | null>,
  formandoId: number,
  moduloId: string,
) {
  if (!params.length) return null;
  const valores = params.map(p => ler(mapa, formandoId, moduloId, p.id));
  if (valores.every(v => v == null)) return null;
  let soma = 0;
  for (const n of valores) soma += n ?? 0;
  return Math.round(soma * 100) / 100;
}

export function instrumento(ccp: EstruturaCcp, id: IdInstrumentoCcp) {
  return ccp.instrumentos.find(i => i.id === id);
}

export function blocoDe(ccp: EstruturaCcp, inst: IdInstrumentoCcp, blocoId: string) {
  return instrumento(ccp, inst)?.blocos.find(b => b.id === blocoId);
}

export function linhaCurso(nome?: string) {
  return `Curso: ${nome?.trim() || "Formação Pedagógica Inicial de Formadores"}`;
}

export function linhaAcao(turma?: string) {
  const acao = turma?.trim() ? `${turma.trim()} - ` : "";
  return `AÇÃO N.º ${acao}Certificado de Autorização de Funcionamento n.º C1357008`;
}

export function textoPeso(n: number) {
  return textoNota(n) || "1";
}

export function formulaBlocos(rotulo: string, blocos: { codigo: string; peso: number }[], divisorFixo?: number) {
  const partes = blocos.map(b => `${textoNota(b.peso) || "0"}*${b.codigo}`).join(" + ");
  const divisor = divisorFixo ?? blocos.reduce((a, b) => a + (b.peso > 0 ? b.peso : 0), 0);
  return `${rotulo} = (${partes})/${textoNota(divisor) || "1"}`;
}

export type LinhaValor = { r: number; cel: (f: Pessoa) => CelulaFolha };

export function colunasFormandos(
  g: Grelha,
  c0: number,
  formandos: Pessoa[],
  linhas: LinhaValor[],
  nomeFormula?: (coluna: number) => string,
) {
  const n = formandos.length;
  if (!n) {
    g.largura(c0, "formando");
    g.set(c0, 6, texto("Participantes", "cabeca"));
    g.set(c0, 7, texto("Sem formandos", "nome"));
    return 1;
  }
  formandos.forEach((_, i) => g.largura(c0 + i, "formando"));
  g.set(c0, 6, texto("Participantes", "cabeca", n));
  formandos.forEach((f, i) => {
    g.set(c0 + i, 7, texto(f.nome, "nome", undefined, nomeFormula?.(c0 + i)));
    for (const linha of linhas) g.set(c0 + i, linha.r, linha.cel(f));
  });
  return n;
}

export function formulaSoma(coluna: number, inicio: number, quantidade: number) {
  if (!quantidade) return "SUM()";
  return `SUM(${refLocal(coluna, inicio)}:${refLocal(coluna, inicio + quantidade - 1)})`;
}

export function formulaMedia(coluna: number, linhaSoma: number, quantidade: number) {
  return `ROUND(${refLocal(coluna, linhaSoma)}/${quantidade || 1},0)`;
}

export function formulaPercentual(
  colunaPeso: number,
  colunaNota: number,
  inicio: number,
  params: { peso: number }[],
  equitativo: boolean,
) {
  if (!params.length) return "ROUND(0,0)";
  if (equitativo) return `ROUND(${formulaSoma(colunaNota, inicio, params.length)}/${params.length},0)`;
  const termos = params.map((_, i) => `$${colunaLetra(colunaPeso)}$${inicio + i + 1}*${refLocal(colunaNota, inicio + i)}`);
  const soma = params.reduce((a, p) => a + (p.peso > 0 ? p.peso : 0), 0);
  return `ROUND((${termos.join("+")})/${textoNota(soma) || "100"},0)`;
}

export function cabecalhosComuns(g: Grelha, ctx: Ctx, titulo: string, spanTitulo: number) {
  g.largura(0, "gutter");
  g.set(1, 1, texto(titulo, "titulo", Math.max(2, spanTitulo)));
  g.set(1, 3, texto(linhaCurso(ctx.cursoNome), "meta", 2));
  g.set(1, 4, texto(linhaAcao(ctx.turmaNome), "meta", 2));
}

export function mediaPesada(notas: (number | null)[], pesos: number[]) {
  if (notas.some(n => n == null)) return null;
  let somaPesos = 0;
  let acc = 0;
  notas.forEach((n, i) => {
    const peso = pesos[i] ?? 0;
    somaPesos += peso;
    acc += (n ?? 0) * peso;
  });
  if (somaPesos <= 0) return null;
  return Math.round(acc / somaPesos);
}

function lerNotaFolha(mapa: Map<string, number | null>, formandoId: number, moduloId: string, parametroId: string) {
  const v = mapa.get(`${formandoId}|${moduloId}|${parametroId}`);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Como o Excel: célula vazia vale 0. Sem nenhuma nota, a fórmula fica em branco. */
export function pontuacaoBloco(
  bloco: BlocoCcp,
  mapa: Map<string, number | null>,
  formandoId: number,
  moduloId: string,
) {
  if (!bloco.parametros.length) return null;
  const valores = bloco.parametros.map(p => lerNotaFolha(mapa, formandoId, moduloId, p.id));
  if (valores.every(v => v == null)) return null;
  const nums = valores.map(v => v ?? 0);
  if (bloco.pesosEquitativos) return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  const soma = bloco.parametros.reduce((a, p) => a + (p.peso > 0 ? p.peso : 0), 0);
  if (soma <= 0) return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  const acc = bloco.parametros.reduce((a, p, i) => a + (p.peso > 0 ? p.peso : 0) * nums[i], 0);
  return Math.round(acc / soma);
}
