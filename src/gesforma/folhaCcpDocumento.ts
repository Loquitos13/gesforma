// Continuação de folhaCcp.ts (partido para ficar abaixo das 500 linhas).
import { idGrelhaBloco, type BlocoCcp, type IdInstrumentoCcp } from "./avaliacaoCcp";

import { FaixaBloco, FolhaModelo, Pessoa, Ctx, Grelha, texto, textoNota, legendaEscala, celCalculo, celEscala, refFolha, refLocal, colunaDo, arredondar, formulaEscala, FOLHA_INICIAL, entrada, somaCompleta, blocoDe, textoPeso, formulaBlocos, LinhaValor, colunasFormandos, formulaSoma, formulaMedia, formulaPercentual, cabecalhosComuns, mediaPesada, pontuacaoBloco } from "./folhaCcp";

export function notaCelula(folha: FolhaModelo, linha: number, coluna: number) {
  const cel = folha.linhas[linha]?.[coluna];
  if (!cel || cel.tipo !== "valor" || !cel.texto) return null;
  const n = Number(cel.texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function folhaSimulacao(ctx: Ctx, variante: "inicial" | "final"): FolhaModelo {
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

export const GRUPOS_OP1 = [
  { desde: 0, texto: "Testes de avaliação" },
  { desde: 3, texto: "Fóruns" },
];

export const GRUPOS_OP2 = [
  { desde: 0, texto: "SISTEMAS DE FORMAÇÃO PROFISSIONAL (MF1/MF2)" },
  { desde: 2, texto: "TECNOLOGIAS NA FORMAÇÃO (MF6/MF7)" },
  { desde: 5, texto: "CONCEBER E AVALIAR (MF5/MF8)" },
  { desde: 8, texto: "COMUNICAR E INTERAGIR (MF3/MF4)" },
];
