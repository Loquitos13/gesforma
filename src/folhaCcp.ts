import type { ParametroAvaliacao } from "./avaliacaoCurso";
import {
  idGrelhaBloco,
  modulosElearning,
  type BlocoCcp,
  type EstruturaCcp,
  type IdInstrumentoCcp,
} from "./avaliacaoCcp";
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

type Pessoa = { id: number; nome: string };

type Ctx = {
  ccp: EstruturaCcp;
  topicos: Pick<TopicoPrograma, "id" | "titulo">[];
  formandos: Pessoa[];
  mapa: Map<string, number | null>;
  cursoNome?: string;
  turmaNome?: string;
  escalaMax: number;
};

const VAZIO: CelulaFolha = { tipo: "vazio" };

class Grelha {
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

function texto(valor: string, papel: PapelTexto, span?: number, formula?: string): CelulaFolha {
  const base = formula
    ? { tipo: "texto" as const, texto: valor, papel, formula }
    : { tipo: "texto" as const, texto: valor, papel };
  return span && span > 1 ? { ...base, span } : base;
}

function textoNota(n: number | null) {
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

function legendaEscala() {
  return ESCALA_QUALITATIVA_CCP.map(item => `${item.nivel} - ${item.texto}`).join("\n");
}

function celCalculo(n: number | null, formula?: string): CelulaFolha {
  return formula ? { tipo: "valor", texto: textoNota(n), papel: "calculo", formula } : { tipo: "valor", texto: textoNota(n), papel: "calculo" };
}

function celEscala(n: number | null, formula?: string): CelulaFolha {
  return formula ? { tipo: "valor", texto: textoEscalaCcp(n), papel: "escala", formula } : { tipo: "valor", texto: textoEscalaCcp(n), papel: "escala" };
}

function refFolha(nome: string, coluna: number, linha: number) {
  return `'${nome}'!${colunaLetra(coluna)}${linha + 1}`;
}

function refLocal(coluna: number, linha: number) {
  return `${colunaLetra(coluna)}${linha + 1}`;
}

function colunaDo(formandos: Pessoa[], f: Pessoa, inicio: number) {
  const i = formandos.indexOf(f);
  return inicio + (i < 0 ? 0 : i);
}

function arredondar(n: number | null) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n);
}

function formulaEscala(ref: string) {
  return ESCALA_QUALITATIVA_CCP.reduceRight(
    (resto, item) => `IF(ROUND(${ref},0)=${item.nivel},"${item.texto}"${resto ? `,${resto}` : ""})`,
    "",
  );
}

const FOLHA_INICIAL = "Simulação Pedagógica Inicial";
const FOLHA_ELEARNING = "Avaliação dos módulos elearning";
const FOLHA_SIM_FINAL = "Simulação Pedagógica Final";
const FOLHA_PROJETO = "Projeto de Intervenção";

function entrada(f: Pessoa, moduloId: string, parametroId: string): CelulaFolha {
  return { tipo: "entrada", formandoId: f.id, moduloId, parametroId };
}

function ler(mapa: Map<string, number | null>, formandoId: number, moduloId: string, parametroId: string) {
  const v = mapa.get(`${formandoId}|${moduloId}|${parametroId}`);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function somaCompleta(
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

function instrumento(ccp: EstruturaCcp, id: IdInstrumentoCcp) {
  return ccp.instrumentos.find(i => i.id === id);
}

function blocoDe(ccp: EstruturaCcp, inst: IdInstrumentoCcp, blocoId: string) {
  return instrumento(ccp, inst)?.blocos.find(b => b.id === blocoId);
}

function linhaCurso(nome?: string) {
  return `Curso: ${nome?.trim() || "Formação Pedagógica Inicial de Formadores"}`;
}

function linhaAcao(turma?: string) {
  const acao = turma?.trim() ? `${turma.trim()} - ` : "";
  return `AÇÃO N.º ${acao}Certificado de Autorização de Funcionamento n.º C1357008`;
}

function textoPeso(n: number) {
  return textoNota(n) || "1";
}

function formulaBlocos(rotulo: string, blocos: { codigo: string; peso: number }[], divisorFixo?: number) {
  const partes = blocos.map(b => `${textoNota(b.peso) || "0"}*${b.codigo}`).join(" + ");
  const divisor = divisorFixo ?? blocos.reduce((a, b) => a + (b.peso > 0 ? b.peso : 0), 0);
  return `${rotulo} = (${partes})/${textoNota(divisor) || "1"}`;
}

type LinhaValor = { r: number; cel: (f: Pessoa) => CelulaFolha };

function colunasFormandos(
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

function formulaSoma(coluna: number, inicio: number, quantidade: number) {
  if (!quantidade) return "SUM()";
  return `SUM(${refLocal(coluna, inicio)}:${refLocal(coluna, inicio + quantidade - 1)})`;
}

function formulaMedia(coluna: number, linhaSoma: number, quantidade: number) {
  return `ROUND(${refLocal(coluna, linhaSoma)}/${quantidade || 1},0)`;
}

function formulaPercentual(
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

function cabecalhosComuns(g: Grelha, ctx: Ctx, titulo: string, spanTitulo: number) {
  g.largura(0, "gutter");
  g.set(1, 1, texto(titulo, "titulo", Math.max(2, spanTitulo)));
  g.set(1, 3, texto(linhaCurso(ctx.cursoNome), "meta", 2));
  g.set(1, 4, texto(linhaAcao(ctx.turmaNome), "meta", 2));
}

function mediaPesada(notas: (number | null)[], pesos: number[]) {
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
function pontuacaoBloco(
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

export function montarFolhasCcp(ctx: Ctx): FolhaModelo[] {
  const inicial = folhaSimulacao(ctx, "inicial");
  const elearning = folhaElearning(ctx);
  const simulacaoFinal = folhaSimulacao(ctx, "final");
  const projeto = folhaProjeto(ctx);
  return [
    inicial,
    elearning,
    simulacaoFinal,
    projeto,
    folhaFinal(ctx, { inicial, elearning, simulacaoFinal, projeto }),
  ];
}

function notaCelula(folha: FolhaModelo, linha: number, coluna: number) {
  const cel = folha.linhas[linha]?.[coluna];
  if (!cel || cel.tipo !== "valor" || !cel.texto) return null;
  const n = Number(cel.texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function folhaSimulacao(ctx: Ctx, variante: "inicial" | "final"): FolhaModelo {
  const inicial = variante === "inicial";
  const instId: IdInstrumentoCcp = inicial ? "sim-inicial" : "sim-final";
  const qual = inicial ? "Inicial" : "Final";
  const cp1 = blocoDe(ctx.ccp, instId, "cp1");
  const cp2 = blocoDe(ctx.ccp, instId, "cp2");
  const cp3 = blocoDe(ctx.ccp, instId, "cp3");
  const g = new Grelha();
  const n = Math.max(ctx.formandos.length, 1);
  g.largura(1, "codigo");
  g.largura(2, "texto");
  cabecalhosComuns(g, ctx, `Simulação Pedagógica ${qual} - ${inicial ? "AD" : "AS/CP"}`, 2 + n);
  g.set(2, 3, texto(`Módulo: Simulação Pedagógica ${qual}`, "meta"));

  const mod = (bloco: BlocoCcp) => idGrelhaBloco(instId, bloco.id);
  const notaCp = (bloco: BlocoCcp | undefined, f: Pessoa) =>
    bloco ? pontuacaoBloco(bloco, ctx.mapa, f.id, mod(bloco)) : null;

  g.set(1, 7, texto("Parâmetros de avaliação", "cabeca"));
  g.set(1, 8, texto("A", "codigo"));
  g.set(2, 8, texto(`Pontuação obtida na avaliação do Plano de Sessão apresentado na Simulação Pedagógica ${qual}`, "param"));
  g.set(1, 9, texto("B", "codigo"));
  g.set(2, 9, texto(`Pontuação obtida na avaliação dos Recursos Didáticos apresentados na Simulação Pedagógica ${qual}`, "param"));
  g.set(1, 10, texto("C", "codigo"));
  g.set(2, 10, texto("Pontuação obtida no desempenho como formador, no domínio de desenvolvimento da formação", "param"));

  const pesosCp = [
    { codigo: "CP1", peso: cp1?.peso ?? 1 },
    { codigo: "CP2", peso: cp2?.peso ?? 1 },
    { codigo: "CP3", peso: cp3?.peso ?? 2 },
  ];
  const formulaCanon = inicial
    ? "Avaliação Diagnóstica (AD) = (1*CP1 + 1*CP2 + 2*CP3)/4"
    : "Avaliação Sumativa (AS) = (1*CP1 + 1*CP2 + 2*CP3)/4";
  const formula = pesosCp[0].peso === 1 && pesosCp[1].peso === 1 && pesosCp[2].peso === 2
    ? formulaCanon
    : formulaBlocos(inicial ? "Avaliação Diagnóstica (AD)" : "Avaliação Sumativa (AS)", pesosCp);
  g.set(1, 12, texto(formula, "formula", 2));
  g.set(1, 13, texto("Escala Qualitativa", "formula"));
  g.set(2, 13, texto(legendaEscala(), "meta"));

  const nForm = Math.max(ctx.formandos.length, 1);
  let cursor = 3 + nForm + 1;
  const cp1Notas = cursor + 3;
  const cp1Linha = 8 + (cp1?.parametros.length ?? 0) + 2;
  cursor = cp1Notas + nForm + 1;
  const cp2Notas = cursor + 3;
  const cp2Linha = 8 + (cp2?.parametros.length ?? 0) + 2;
  cursor = cp2Notas + nForm + 1;
  const cp3Notas = cursor + 2;
  const cp3Linha = 8 + (cp3?.parametros.length ?? 0) + 2;
  const origemCp = [
    { linha: cp1Linha, coluna: cp1Notas },
    { linha: cp2Linha, coluna: cp2Notas },
    { linha: cp3Linha, coluna: cp3Notas },
  ];

  const resumo: LinhaValor[] = [
    {
      r: 8,
      cel: f => {
        const i = Math.max(0, ctx.formandos.indexOf(f));
        return celCalculo(arredondar(notaCp(cp1, f)), refLocal(origemCp[0].coluna + i, origemCp[0].linha));
      },
    },
    {
      r: 9,
      cel: f => {
        const i = Math.max(0, ctx.formandos.indexOf(f));
        return celCalculo(arredondar(notaCp(cp2, f)), refLocal(origemCp[1].coluna + i, origemCp[1].linha));
      },
    },
    {
      r: 10,
      cel: f => {
        const i = Math.max(0, ctx.formandos.indexOf(f));
        return celCalculo(arredondar(notaCp(cp3, f)), refLocal(origemCp[2].coluna + i, origemCp[2].linha));
      },
    },
    {
      r: 12,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, 3);
        const partes = [notaCp(cp1, f), notaCp(cp2, f), notaCp(cp3, f)];
        const bruto = mediaPesada(partes, pesosCp.map(item => item.peso));
        const formula = `ROUND((${refLocal(col, 8)}+${refLocal(col, 9)}+${textoNota(cp3?.peso ?? 2) || "2"}*${refLocal(col, 10)})/${textoNota(pesosCp.reduce((a, b) => a + b.peso, 0)) || "4"},0)`;
        return celCalculo(arredondar(bruto), formula);
      },
    },
    {
      r: 13,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, 3);
        const partes = [notaCp(cp1, f), notaCp(cp2, f), notaCp(cp3, f)];
        const bruto = mediaPesada(partes, pesosCp.map(item => item.peso));
        return celEscala(arredondar(bruto), formulaEscala(refLocal(col, 12)));
      },
    },
  ];
  const copiaNome = inicial ? undefined : (coluna: number) => refFolha(FOLHA_INICIAL, coluna, 7);
  const usados = colunasFormandos(g, 3, ctx.formandos, resumo, copiaNome);
  let c = 3 + usados + 1;
  g.largura(c - 1, "gutter");
  const faixas: FaixaBloco[] = [
    { id: "resultado", titulo: "Resultado", trechos: [{ de: 1, ate: 3 + usados }] },
  ];

  const inicioCp1 = c;
  c = blocoPercentual(g, c, ctx, {
    titulo: `Ficha de Apreciação do Plano de Sessão da Simulação Pedagógica ${qual} - CP1`,
    grupos: [{ desde: 0, texto: "ESTRUTURA" }, { desde: 3, texto: "MATERIAIS DE APOIO" }],
    bloco: cp1,
    moduloId: cp1 ? mod(cp1) : "",
    cabecaParam: inicial
      ? "Parâmetros de avaliação"
      : "Parâmetros de avaliação (Preencher utilizando a escala de níveis de 1 a 5, consultando os Critérios para avaliação do Plano de Sessão)",
    rotuloPontuacao: "Pontuação por formando - CP1 (Tradução do somatório percentual em classificação por níveis - escala CNQF)",
    escalaMax: ctx.escalaMax,
  });
  faixas.push({ id: "cp1", titulo: "CP1", trechos: [{ de: inicioCp1, ate: c - 1 }] });
  const inicioCp2 = c;
  c = blocoPercentual(g, c, ctx, {
    titulo: `Ficha de Apreciação dos Recursos Didáticos aplicados na Simulação Pedagógica ${qual} - CP2`,
    grupos: [{ desde: 0, texto: "QUALIDADE DOS RECURSOS" }],
    bloco: cp2,
    moduloId: cp2 ? mod(cp2) : "",
    cabecaParam: "Parâmetros de avaliação",
    rotuloPontuacao: "Pontuação por formando - CP2 (Tradução do somatório percentual em classificação por níveis - escala CNQF)",
    escalaMax: ctx.escalaMax,
  });
  faixas.push({ id: "cp2", titulo: "CP2", trechos: [{ de: inicioCp2, ate: c - 1 }] });
  const inicioCp3 = c;
  const fimCp3 = blocoCriterios(g, c, ctx, {
    titulo: `Apreciação do Desenvolvimento da Simulação Pedagógica ${qual} - CP3`,
    bloco: cp3,
    moduloId: cp3 ? mod(cp3) : "",
    rotuloPontuacao: `Pontuação por formando - CP3 (Somatório de pontos/Total de itens avaliados)`,
  });
  faixas.push({ id: "cp3", titulo: "CP3", trechos: [{ de: inicioCp3, ate: fimCp3 }] });

  return {
    id: instId,
    titulo: inicial ? "Módulo 2" : "Módulo 9",
    larguras: g.larguras,
    linhas: g.linhas(),
    faixas,
  };
}

function blocoPercentual(
  g: Grelha,
  c0: number,
  ctx: Ctx,
  opts: {
    titulo: string;
    grupos: { desde: number; texto: string }[];
    bloco: BlocoCcp | undefined;
    moduloId: string;
    cabecaParam: string;
    rotuloPontuacao: string;
    escalaMax: number;
  },
) {
  const params = opts.bloco?.parametros ?? [];
  const n = Math.max(ctx.formandos.length, 1);
  g.largura(c0, "grupo");
  g.largura(c0 + 1, "param");
  g.largura(c0 + 2, "peso");
  g.set(c0, 4, texto(opts.titulo, "titulo", 3 + Math.min(n, 4)));
  g.set(c0, 7, texto("BLOCOS", "cabeca"));
  g.set(c0 + 1, 7, texto(opts.cabecaParam, "cabeca"));
  g.set(c0 + 2, 7, texto("%", "cabeca"));
  const inicio = 8;
  params.forEach((p, i) => {
    const grupo = opts.grupos.find(item => item.desde === i);
    if (grupo) g.set(c0, inicio + i, texto(grupo.texto, "grupo"));
    g.set(c0 + 1, inicio + i, texto(p.label, "param"));
    g.set(c0 + 2, inicio + i, texto(opts.bloco?.pesosEquitativos ? textoPeso(1) : textoPeso(p.peso), "peso"));
  });
  const pontuacao = inicio + params.length + 2;
  g.set(c0, pontuacao, texto(opts.rotuloPontuacao, "formula", 2));
  g.set(c0 + 2, pontuacao, texto(textoNota(opts.escalaMax) || "5", "peso"));
  const linhas: LinhaValor[] = params.map((p, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => entrada(f, opts.moduloId, p.id),
  }));
  if (opts.bloco) {
    const bloco = opts.bloco;
    linhas.push({
      r: pontuacao,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c0 + 3);
        return celCalculo(
          arredondar(pontuacaoBloco(bloco, ctx.mapa, f.id, opts.moduloId)),
          formulaPercentual(c0 + 2, col, inicio, params, bloco.pesosEquitativos),
        );
      },
    });
  }
  const usados = colunasFormandos(g, c0 + 3, ctx.formandos, linhas);
  const seguinte = c0 + 3 + usados + 1;
  g.largura(seguinte - 1, "gutter");
  return seguinte;
}

function blocoCriterios(
  g: Grelha,
  c0: number,
  ctx: Ctx,
  opts: { titulo: string; bloco: BlocoCcp | undefined; moduloId: string; rotuloPontuacao: string },
) {
  const params = opts.bloco?.parametros ?? [];
  const n = Math.max(ctx.formandos.length, 1);
  g.largura(c0, "codigo");
  g.largura(c0 + 1, "param");
  g.set(c0, 4, texto(opts.titulo, "titulo", 2 + Math.min(n, 4)));
  g.set(c0, 7, texto("CRITÉRIOS DE ANÁLISE (pontuação de 1 a 5)", "cabeca", 2));
  const inicio = 8;
  params.forEach((p, i) => {
    g.set(c0, inicio + i, texto(String(i + 1), "codigo"));
    g.set(c0 + 1, inicio + i, texto(p.label, "param"));
  });
  const soma = inicio + params.length + 1;
  const pontuacao = soma + 1;
  g.set(c0, soma, texto("Somatório de pontos", "formula", 2));
  g.set(c0, pontuacao, texto(opts.rotuloPontuacao, "formula", 2));
  const linhas: LinhaValor[] = params.map((p, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => entrada(f, opts.moduloId, p.id),
  }));
  if (opts.bloco) {
    const bloco = opts.bloco;
    linhas.push({
      r: soma,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c0 + 2);
        return celCalculo(somaCompleta(params, ctx.mapa, f.id, opts.moduloId), formulaSoma(col, inicio, params.length));
      },
    });
    linhas.push({
      r: pontuacao,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c0 + 2);
        return celCalculo(
          arredondar(pontuacaoBloco(bloco, ctx.mapa, f.id, opts.moduloId)),
          formulaMedia(col, soma, params.length),
        );
      },
    });
  }
  const usados = colunasFormandos(g, c0 + 2, ctx.formandos, linhas);
  return c0 + 2 + usados;
}

const GRUPOS_OP1 = [
  { desde: 0, texto: "Testes de avaliação" },
  { desde: 3, texto: "Fóruns" },
];

const GRUPOS_OP2 = [
  { desde: 0, texto: "SISTEMAS DE FORMAÇÃO PROFISSIONAL (MF1/MF2)" },
  { desde: 2, texto: "TECNOLOGIAS NA FORMAÇÃO (MF6/MF7)" },
  { desde: 5, texto: "CONCEBER E AVALIAR (MF5/MF8)" },
  { desde: 8, texto: "COMUNICAR E INTERAGIR (MF3/MF4)" },
];

function folhaElearning(ctx: Ctx): FolhaModelo {
  const inst = instrumento(ctx.ccp, "elearning");
  const op1 = inst?.blocos.find(b => b.ambito === "por-modulo");
  const op2 = inst?.blocos.find(b => b.id === "op2") ?? inst?.blocos.find(b => b.ambito === "uma-vez");
  const modulos = modulosElearning(ctx.topicos);
  const g = new Grelha();
  const n = Math.max(ctx.formandos.length, 1);
  g.largura(1, "codigo");
  g.largura(2, "texto");
  cabecalhosComuns(g, ctx, "Avaliação sumativa - Módulos elearning - AS/OP", 2 + n);
  g.set(1, 7, texto("Parâmetros de avaliação", "cabeca"));
  g.set(1, 8, texto("A", "codigo"));
  g.set(2, 8, texto("Pontuação obtida na avaliação dos módulos elearning (OP1)", "param"));
  g.set(1, 9, texto("B", "codigo"));
  g.set(2, 9, texto("Pontuação obtida na avaliação Intermédia (OP2)", "param"));
  const pesos = [
    { codigo: "OP1", peso: op1?.peso ?? 1 },
    { codigo: "OP2", peso: op2?.peso ?? 1 },
  ];
  const formula = pesos[0].peso === 1 && pesos[1].peso === 1
    ? "Avaliação Módulos (OP) = (1*OP1 + 1*OP2)/2"
    : formulaBlocos("Avaliação Módulos (OP)", pesos);
  g.set(1, 11, texto(formula, "formula", 2));
  g.set(1, 12, texto("Escala Qualitativa", "formula"));
  g.set(2, 12, texto(legendaEscala(), "meta"));

  const modOp2 = op2 ? idGrelhaBloco("elearning", op2.id) : "";
  const notaOp1 = (f: Pessoa) => (op1 ? mediaModulos(op1, ctx.mapa, f.id, modulos) : null);
  const notaOp2 = (f: Pessoa) => (op2 ? pontuacaoBloco(op2, ctx.mapa, f.id, modOp2) : null);
  const nEl = Math.max(ctx.formandos.length, 1);
  const paramsOp1 = op1?.parametros ?? [];
  const inicioOp = 8;
  const pontaOp = inicioOp + Math.max(paramsOp1.length, modulos.length, 1) + 2;
  let previsto = 3 + nEl + 1 + 2;
  const colsModulo = modulos.map(() => {
    const coluna = previsto;
    previsto += nEl + 1;
    return coluna;
  });
  const colMedia = previsto + 1;
  previsto += 1 + nEl + 1;
  const colOp2 = previsto + 2;
  const pontaOp2 = inicioOp + (op2?.parametros.length ?? 0) + 2;
  const resumo: LinhaValor[] = [
    {
      r: 8,
      cel: f => {
        const i = Math.max(0, ctx.formandos.indexOf(f));
        return celCalculo(notaOp1(f), modulos.length ? refLocal(colMedia + i, pontaOp) : "");
      },
    },
    {
      r: 9,
      cel: f => {
        const i = Math.max(0, ctx.formandos.indexOf(f));
        return celCalculo(arredondar(notaOp2(f)), op2 ? refLocal(colOp2 + i, pontaOp2) : "");
      },
    },
    {
      r: 11,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, 3);
        const partesOp = [notaOp1(f), arredondar(notaOp2(f))];
        const bruto = mediaPesada(partesOp, pesos.map(item => item.peso));
        const divisor = textoNota(pesos.reduce((a, b) => a + b.peso, 0)) || "2";
        const termo = (peso: number, linha: number) => (peso === 1 ? refLocal(col, linha) : `${textoNota(peso) || "0"}*${refLocal(col, linha)}`);
        const formula = `ROUND((${termo(pesos[0].peso, 8)}+${termo(pesos[1].peso, 9)})/${divisor},0)`;
        return celCalculo(arredondar(bruto), formula);
      },
    },
    {
      r: 12,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, 3);
        const partesOp = [notaOp1(f), arredondar(notaOp2(f))];
        const bruto = mediaPesada(partesOp, pesos.map(item => item.peso));
        return celEscala(arredondar(bruto), formulaEscala(refLocal(col, 11)));
      },
    },
  ];
  const usados = colunasFormandos(g, 3, ctx.formandos, resumo, coluna => refFolha(FOLHA_INICIAL, coluna, 7));
  let c = 3 + usados + 1;
  g.largura(c - 1, "gutter");
  const faixas: FaixaBloco[] = [
    { id: "resultado", titulo: "Resultado", trechos: [{ de: 1, ate: 3 + usados }] },
  ];

  const params = op1?.parametros ?? [];
  const inicio = 8;
  const fimCorpo = inicio + Math.max(params.length, modulos.length, 1);
  const somaRow = fimCorpo + 1;
  const pontaRow = somaRow + 1;
  g.largura(c, "grupo");
  g.largura(c + 1, "param");
  g.set(c + 1, 7, texto("Parâmetros de avaliação (de 1 a 5)", "cabeca"));
  params.forEach((p, i) => {
    const grupo = GRUPOS_OP1.find(item => item.desde === i);
    if (grupo) g.set(c, inicio + i, texto(grupo.texto, "grupo"));
    g.set(c + 1, inicio + i, texto(p.label, "param"));
  });
  g.set(c + 1, somaRow, texto("Somatório de pontos", "formula"));
  g.set(c + 1, pontaRow, texto("Pontuação por formando - OP1 (Somatório de pontos/Total de itens avaliados)", "formula"));
  if (!modulos.length) {
    g.set(c, inicio, texto("O programa ainda não tem módulos de e-learning. O 2.º e o 9.º são as simulações.", "meta", 2));
  }
  const rotulosOp1 = c;
  c += 2;

  for (const mod of modulos) {
    const inicioModulo = c;
    g.set(c, 4, texto(`MÓDULO ${mod.numero}`, "titulo", Math.max(1, ctx.formandos.length)));
    const linhas: LinhaValor[] = params.map((p, i) => ({
      r: inicio + i,
      cel: (f: Pessoa) => entrada(f, mod.id, p.id),
    }));
    linhas.push({
      r: somaRow,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c);
        return celCalculo(
          op1 ? somaCompleta(op1.parametros, ctx.mapa, f.id, mod.id) : null,
          formulaSoma(col, inicio, params.length),
        );
      },
    });
    linhas.push({
      r: pontaRow,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c);
        return celCalculo(
          op1 ? arredondar(pontuacaoBloco(op1, ctx.mapa, f.id, mod.id)) : null,
          formulaMedia(col, somaRow, params.length),
        );
      },
    });
    const largura = colunasFormandos(g, c, ctx.formandos, linhas, coluna => `$${colunaLetra(3 + coluna - c)}$$8`);
    faixas.push({
      id: `m${mod.numero}`,
      titulo: `M${mod.numero}`,
      trechos: [{ de: rotulosOp1, ate: rotulosOp1 + 2 }, { de: inicioModulo, ate: inicioModulo + largura }],
    });
    c += largura + 1;
    g.largura(c - 1, "gutter");
  }

  const inicioSoma = c;
  g.largura(c, "codigo");
  g.set(c + 1, 4, texto("Somatório Módulos", "titulo", Math.max(1, ctx.formandos.length)));
  modulos.forEach((mod, i) => {
    g.set(c, inicio + i, texto(`M${mod.numero}`, "codigo"));
  });
  const linhasSoma: LinhaValor[] = modulos.map((mod, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => {
      const indice = Math.max(0, ctx.formandos.indexOf(f));
      const origem = colsModulo[i] + indice;
      return celCalculo(
        op1 ? arredondar(pontuacaoBloco(op1, ctx.mapa, f.id, mod.id)) : null,
        refLocal(origem, pontaRow),
      );
    },
  }));
  linhasSoma.push({
    r: somaRow,
    cel: f => {
      const col = colunaDo(ctx.formandos, f, c + 1);
      return celCalculo(
        somaModulos(op1, ctx.mapa, f.id, modulos),
        formulaSoma(col, inicio, modulos.length),
      );
    },
  });
  linhasSoma.push({
    r: pontaRow,
    cel: f => {
      const col = colunaDo(ctx.formandos, f, c + 1);
      return celCalculo(
        op1 ? mediaModulos(op1, ctx.mapa, f.id, modulos) : null,
        formulaMedia(col, somaRow, modulos.length),
      );
    },
  });
  const larguraSoma = colunasFormandos(g, c + 1, ctx.formandos, linhasSoma, coluna => `$${colunaLetra(3 + coluna - (c + 1))}$$8`);
  faixas.push({ id: "soma", titulo: "Somatório", trechos: [{ de: inicioSoma, ate: inicioSoma + 1 + larguraSoma }] });
  c += 1 + larguraSoma + 1;
  g.largura(c - 1, "gutter");
  const inicioOp2 = c;

  const params2 = op2?.parametros ?? [];
  const soma2 = inicio + params2.length + 1;
  const ponta2 = soma2 + 1;
  g.largura(c, "grupo");
  g.largura(c + 1, "param");
  g.set(c, 4, texto("Ficha de sistematização dos participantes nas avaliações intermédias - OP2", "titulo", 2 + Math.min(n, 4)));
  g.set(c, 7, texto("BLOCOS", "cabeca"));
  g.set(c + 1, 7, texto("Parâmetros de avaliação (de 1 a 5)", "cabeca"));
  params2.forEach((p, i) => {
    const grupo = GRUPOS_OP2.find(item => item.desde === i);
    if (grupo) g.set(c, inicio + i, texto(grupo.texto, "grupo"));
    g.set(c + 1, inicio + i, texto(p.label, "param"));
  });
  g.set(c, soma2, texto("Somatório de pontos", "formula", 2));
  g.set(c, ponta2, texto("Pontuação por formando - OP2 (Somatório de pontos/Total de itens avaliados)", "formula", 2));
  const linhas2: LinhaValor[] = params2.map((p, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => entrada(f, modOp2, p.id),
  }));
  if (op2) {
    linhas2.push({
      r: soma2,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c + 2);
        return celCalculo(somaCompleta(params2, ctx.mapa, f.id, modOp2), formulaSoma(col, inicio, params2.length));
      },
    });
    linhas2.push({
      r: ponta2,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, c + 2);
        return celCalculo(
          arredondar(pontuacaoBloco(op2, ctx.mapa, f.id, modOp2)),
          formulaMedia(col, soma2, params2.length),
        );
      },
    });
  }
  const larguraOp2 = colunasFormandos(g, c + 2, ctx.formandos, linhas2, coluna => `$${colunaLetra(3 + coluna - (c + 2))}$$8`);
  faixas.push({ id: "op2", titulo: "OP2", trechos: [{ de: inicioOp2, ate: inicioOp2 + 2 + larguraOp2 }] });

  return {
    id: "elearning",
    titulo: "E-learning",
    larguras: g.larguras,
    linhas: g.linhas(),
    faixas,
  };
}

function mediaModulos(
  bloco: BlocoCcp,
  mapa: Map<string, number | null>,
  formandoId: number,
  modulos: { id: string }[],
) {
  if (!modulos.length) return null;
  const notas: number[] = [];
  for (const mod of modulos) {
    const n = pontuacaoBloco(bloco, mapa, formandoId, mod.id);
    if (n == null) return null;
    notas.push(Math.round(n));
  }
  return Math.round(notas.reduce((a, b) => a + b, 0) / notas.length);
}

function somaModulos(
  bloco: BlocoCcp | undefined,
  mapa: Map<string, number | null>,
  formandoId: number,
  modulos: { id: string }[],
) {
  if (!bloco || !modulos.length) return null;
  let soma = 0;
  for (const mod of modulos) {
    const n = pontuacaoBloco(bloco, mapa, formandoId, mod.id);
    if (n == null) return null;
    soma += Math.round(n);
  }
  return Math.round(soma * 100) / 100;
}

function folhaProjeto(ctx: Ctx): FolhaModelo {
  const bloco = blocoDe(ctx.ccp, "projeto", "as-pi") ?? instrumento(ctx.ccp, "projeto")?.blocos[0];
  const g = new Grelha();
  const n = Math.max(ctx.formandos.length, 1);
  g.largura(0, "gutter");
  g.largura(1, "grupo");
  g.largura(2, "param");
  g.largura(3, "peso");
  g.set(1, 1, texto("Projeto de Intervenção - AS/PI", "titulo", 3 + n));
  g.set(1, 3, texto(linhaCurso(ctx.cursoNome), "meta", 3));
  g.set(1, 4, texto(linhaAcao(ctx.turmaNome), "meta", 3));
  g.set(1, 7, texto("BLOCOS", "cabeca"));
  g.set(2, 7, texto("Parâmetros de avaliação", "cabeca"));
  g.set(3, 7, texto("%", "cabeca"));
  const params = bloco?.parametros ?? [];
  const inicio = 8;
  const moduloId = bloco ? idGrelhaBloco("projeto", bloco.id) : "";
  params.forEach((p, i) => {
    if (i === 0) g.set(1, inicio, texto("QUALIDADE DOS PROJETOS", "grupo"));
    g.set(2, inicio + i, texto(p.label, "param"));
    g.set(3, inicio + i, texto(bloco?.pesosEquitativos ? textoPeso(1) : textoPeso(p.peso), "peso"));
  });
  const pontuacao = inicio + params.length + 2;
  g.set(1, pontuacao, texto("Pontuação por formando - AS/PI (Tradução do somatório percentual em classificação por níveis - escala CNQF)", "formula", 2));
  g.set(3, pontuacao, texto(textoNota(ctx.escalaMax) || "5", "peso"));
  g.set(1, pontuacao + 1, texto("Escala Qualitativa", "formula"));
  g.set(2, pontuacao + 1, texto(legendaEscala(), "meta"));
  const linhas: LinhaValor[] = params.map((p, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => entrada(f, moduloId, p.id),
  }));
  if (bloco) {
    linhas.push({
      r: pontuacao,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, 4);
        const bruto = pontuacaoBloco(bloco, ctx.mapa, f.id, moduloId);
        const termos = params.map((_, i) => `$${colunaLetra(3)}$${8 + i + 1}*${refLocal(col, 8 + i)}`);
        const somaPesos = params.reduce((a, p) => a + (p.peso > 0 ? p.peso : 0), 0);
        const formula = bloco.pesosEquitativos || somaPesos <= 0
          ? `ROUND((${params.map((_, i) => refLocal(col, 8 + i)).join("+")})/${params.length || 1},0)`
          : `ROUND((${termos.join("+")})/${textoNota(somaPesos) || "100"},0)`;
        return celCalculo(arredondar(bruto), formula);
      },
    });
    linhas.push({
      r: pontuacao + 1,
      cel: f => {
        const col = colunaDo(ctx.formandos, f, 4);
        return celEscala(arredondar(pontuacaoBloco(bloco, ctx.mapa, f.id, moduloId)), formulaEscala(refLocal(col, pontuacao)));
      },
    });
  }
  colunasFormandos(g, 4, ctx.formandos, linhas, coluna => refFolha(FOLHA_SIM_FINAL, coluna - 1, 7));
  return { id: "projeto", titulo: "Projeto de intervenção", larguras: g.larguras, linhas: g.linhas(), faixas: [] };
}

function folhaFinal(
  ctx: Ctx,
  origem: { inicial: FolhaModelo; elearning: FolhaModelo; simulacaoFinal: FolhaModelo; projeto: FolhaModelo },
): FolhaModelo {
  const g = new Grelha();
  const n = Math.max(ctx.formandos.length, 1);
  g.largura(0, "gutter");
  g.largura(1, "codigo");
  g.largura(2, "texto");
  g.set(1, 1, texto("Avaliação Final", "titulo", 2 + n));
  g.set(1, 3, texto(linhaCurso(ctx.cursoNome), "meta", 2));
  g.set(1, 4, texto(linhaAcao(ctx.turmaNome), "meta", 2));
  g.set(1, 7, texto("Parâmetros de avaliação", "cabeca", 2));
  const linhasFixas: { r: number; codigo: string; desc: string; inst?: IdInstrumentoCcp }[] = [
    { r: 8, codigo: "AD", desc: "Pontuação obtida na Simulação Pedagógica Inicial", inst: "sim-inicial" },
    { r: 9, codigo: "AS/OP", desc: "Pontuação obtida na aferição do grau de domínio dos objetivos [OP]", inst: "elearning" },
    { r: 10, codigo: "AS/CP", desc: "Pontuação obtida na Simulação Pedagógica Final", inst: "sim-final" },
    { r: 11, codigo: "AS/PI", desc: "Pontuação obtida na aferição do Projeto de Intervenção Pedagógica", inst: "projeto" },
  ];
  for (const linha of linhasFixas) {
    g.set(1, linha.r, texto(linha.codigo, "codigo"));
    g.set(2, linha.r, texto(linha.desc, "param"));
  }
  g.set(1, 13, texto(formulaFinal(ctx.ccp), "formula", 2));
  g.set(1, 14, texto("Escala Qualitativa", "formula"));
  g.set(2, 14, texto(legendaEscala(), "meta"));
  g.set(2, 21, texto("Rubrica do coordenador da ação: _________________________", "meta"));
  g.set(2, 23, texto("Data: _____________________", "meta"));

  const blocoPi = blocoDe(ctx.ccp, "projeto", "as-pi") ?? instrumento(ctx.ccp, "projeto")?.blocos[0];
  const linhaPi = 8 + (blocoPi?.parametros.length ?? 0) + 2;
  const peso = (id: IdInstrumentoCcp) => instrumento(ctx.ccp, id)?.pesoFinal ?? 0;
  const pesos = {
    ad: peso("sim-inicial"),
    op: peso("elearning"),
    cp: peso("sim-final"),
    pi: peso("projeto"),
  };
  const coef = (n: number) => String(Math.round((n / 100) * 1000) / 1000);
  const fontes: { r: number; linha: number; coluna: number; nome: string; peso: number; folha: FolhaModelo }[] = [
    { r: 8, linha: 12, coluna: 3, nome: FOLHA_INICIAL, peso: pesos.ad, folha: origem.inicial },
    { r: 9, linha: 11, coluna: 3, nome: FOLHA_ELEARNING, peso: pesos.op, folha: origem.elearning },
    { r: 10, linha: 12, coluna: 3, nome: FOLHA_SIM_FINAL, peso: pesos.cp, folha: origem.simulacaoFinal },
    { r: 11, linha: linhaPi, coluna: 4, nome: FOLHA_PROJETO, peso: pesos.pi, folha: origem.projeto },
  ];
  const linhas: LinhaValor[] = fontes.map(fonte => ({
    r: fonte.r,
    cel: (f: Pessoa) => {
      const i = Math.max(0, ctx.formandos.indexOf(f));
      return celCalculo(
        notaCelula(fonte.folha, fonte.linha, fonte.coluna + i),
        refFolha(fonte.nome, fonte.coluna + i, fonte.linha),
      );
    },
  }));
  linhas.push({
    r: 13,
    cel: f => {
      const i = Math.max(0, ctx.formandos.indexOf(f));
      const letra = colunaLetra(3 + i);
      const notas = fontes.map(fonte => ({
        peso: fonte.peso,
        nota: notaCelula(fonte.folha, fonte.linha, fonte.coluna + i),
      }));
      const soma = notas.reduce((a, item) => a + (item.peso > 0 ? item.peso : 0), 0);
      const completa = notas.every(item => item.peso <= 0 || item.nota != null);
      let af: number | null = null;
      if (completa && soma > 0) {
        const acc = notas.reduce((a, item) => a + (item.nota ?? 0) * (item.peso > 0 ? item.peso : 0), 0) / soma;
        af = Math.round(acc);
      }
      const formula = `ROUND(${coef(pesos.ad)}*${letra}9+${coef(pesos.op)}*${letra}10+${coef(pesos.cp)}*${letra}11+${coef(pesos.pi)}*${letra}12,0)`;
      return celCalculo(af, formula);
    },
  });
  linhas.push({
    r: 14,
    cel: f => {
      const i = Math.max(0, ctx.formandos.indexOf(f));
      const letra = colunaLetra(3 + i);
      const notas = fontes.map(fonte => ({
        peso: fonte.peso,
        nota: notaCelula(fonte.folha, fonte.linha, fonte.coluna + i),
      }));
      const soma = notas.reduce((a, item) => a + (item.peso > 0 ? item.peso : 0), 0);
      const completa = notas.every(item => item.peso <= 0 || item.nota != null);
      let af: number | null = null;
      if (completa && soma > 0) {
        af = Math.round(notas.reduce((a, item) => a + (item.nota ?? 0) * (item.peso > 0 ? item.peso : 0), 0) / soma);
      }
      return celEscala(af, formulaEscala(`${letra}14`));
    },
  });
  colunasFormandos(g, 3, ctx.formandos, linhas, coluna => refFolha(FOLHA_SIM_FINAL, coluna, 7));
  return { id: "final", titulo: "Avaliação final", larguras: g.larguras, linhas: g.linhas(), faixas: [] };
}

function formulaFinal(ccp: EstruturaCcp) {
  const peso = (id: IdInstrumentoCcp) => instrumento(ccp, id)?.pesoFinal ?? 0;
  const ad = peso("sim-inicial");
  const op = peso("elearning");
  const cp = peso("sim-final");
  const pi = peso("projeto");
  if (ad === 10 && op === 30 && cp === 30 && pi === 30) {
    return "AF = [(AD x 0,10) + (0,3 x AS/OP) + (0,3 x AS/CP) + (0,3 x AS/PI)]";
  }
  const frac = (n: number) => textoNota(Math.round(n) / 100);
  return `AF = [(AD x ${frac(ad)}) + (${frac(op)} x AS/OP) + (${frac(cp)} x AS/CP) + (${frac(pi)} x AS/PI)]`;
}

export function celulaEntrada(cel: CelulaFolha): cel is Extract<CelulaFolha, { tipo: "entrada" }> {
  return cel.tipo === "entrada";
}
