// Continuação de folhaCcpDocumento.ts (partido para ficar abaixo das 500 linhas).
import { idGrelhaBloco, modulosElearning, type BlocoCcp, type EstruturaCcp, type IdInstrumentoCcp } from "./avaliacaoCcp";
import { colunaLetra } from "./csvAvaliacao";
import { CelulaFolha, FaixaBloco, FolhaModelo, Pessoa, Ctx, Grelha, texto, textoNota, legendaEscala, celCalculo, celEscala, refFolha, refLocal, colunaDo, arredondar, formulaEscala, FOLHA_INICIAL, FOLHA_ELEARNING, FOLHA_SIM_FINAL, FOLHA_PROJETO, entrada, somaCompleta, instrumento, blocoDe, linhaCurso, linhaAcao, textoPeso, formulaBlocos, LinhaValor, colunasFormandos, formulaSoma, formulaMedia, cabecalhosComuns, mediaPesada, pontuacaoBloco } from "./folhaCcp";
import { notaCelula, folhaSimulacao, GRUPOS_OP1, GRUPOS_OP2 } from "./folhaCcpDocumento";

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
