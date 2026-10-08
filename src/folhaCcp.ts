import type { ParametroAvaliacao } from "./avaliacaoCurso";
import {
  idGrelhaBloco,
  modulosElearning,
  notaDeParametros,
  notaFinalCcp,
  notaInstrumentoCcp,
  type BlocoCcp,
  type EstruturaCcp,
  type IdInstrumentoCcp,
} from "./avaliacaoCcp";
import type { TopicoPrograma } from "./cursoPrograma";

export type PapelTexto = "titulo" | "meta" | "cabeca" | "nome" | "grupo" | "param" | "peso" | "codigo" | "formula";

export type LarguraColuna = "gutter" | "codigo" | "texto" | "grupo" | "param" | "peso" | "formando";

export type CelulaFolha =
  | { tipo: "vazio" }
  | { tipo: "ocupado" }
  | { tipo: "texto"; texto: string; papel: PapelTexto; span?: number }
  | { tipo: "entrada"; formandoId: number; moduloId: string; parametroId: string }
  | { tipo: "valor"; texto: string; papel: "calculo" | "escala" };

export type FolhaModelo = {
  id: string;
  titulo: string;
  larguras: LarguraColuna[];
  linhas: CelulaFolha[][];
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

function texto(valor: string, papel: PapelTexto, span?: number): CelulaFolha {
  return span && span > 1 ? { tipo: "texto", texto: valor, papel, span } : { tipo: "texto", texto: valor, papel };
}

function textoNota(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "";
  const r = Math.round(n * 100) / 100;
  const txt = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return txt.replace(".", ",");
}

export function textoEscalaCcp(nota: number | null) {
  if (nota == null || !Number.isFinite(nota)) return "";
  const n = Math.min(5, Math.max(1, Math.round(nota)));
  if (n <= 1) return "Aproveitamento Insuficiente";
  if (n === 2) return "Aproveitamento Satisfatório";
  if (n === 3) return "Aproveitamento Bom";
  if (n === 4) return "Aproveitamento Relevante";
  return "Aproveitamento Excelente";
}

function celCalculo(n: number | null): CelulaFolha {
  return { tipo: "valor", texto: textoNota(n), papel: "calculo" };
}

function celEscala(n: number | null): CelulaFolha {
  return { tipo: "valor", texto: textoEscalaCcp(n), papel: "escala" };
}

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
  let soma = 0;
  for (const p of params) {
    const n = ler(mapa, formandoId, moduloId, p.id);
    if (n == null) return null;
    soma += n;
  }
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

function colunasFormandos(g: Grelha, c0: number, formandos: Pessoa[], linhas: LinhaValor[]) {
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
    g.set(c0 + i, 7, texto(f.nome, "nome"));
    for (const linha of linhas) g.set(c0 + i, linha.r, linha.cel(f));
  });
  return n;
}

function cabecalhosComuns(g: Grelha, ctx: Ctx, titulo: string, spanTitulo: number) {
  g.largura(0, "gutter");
  g.set(1, 1, texto(titulo, "titulo", Math.max(2, spanTitulo)));
  g.set(1, 3, texto(linhaCurso(ctx.cursoNome), "meta", 2));
  g.set(1, 4, texto(linhaAcao(ctx.turmaNome), "meta", 2));
}

function pontuacaoBloco(
  bloco: BlocoCcp,
  mapa: Map<string, number | null>,
  formandoId: number,
  moduloId: string,
) {
  return notaDeParametros(bloco.parametros, bloco.pesosEquitativos, mapa, formandoId, moduloId);
}

export function montarFolhasCcp(ctx: Ctx): FolhaModelo[] {
  return [
    folhaSimulacao(ctx, "inicial"),
    folhaElearning(ctx),
    folhaSimulacao(ctx, "final"),
    folhaProjeto(ctx),
    folhaFinal(ctx),
  ];
}

function folhaSimulacao(ctx: Ctx, variante: "inicial" | "final"): FolhaModelo {
  const inicial = variante === "inicial";
  const instId: IdInstrumentoCcp = inicial ? "sim-inicial" : "sim-final";
  const qual = inicial ? "Inicial" : "Final";
  const cp1 = blocoDe(ctx.ccp, instId, "cp1");
  const cp2 = blocoDe(ctx.ccp, instId, "cp2");
  const cp3 = blocoDe(ctx.ccp, instId, "cp3");
  const inst = instrumento(ctx.ccp, instId);
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
  g.set(1, 13, texto("Escala Qualitativa", "formula", 2));

  const resumo: LinhaValor[] = [
    { r: 8, cel: f => celCalculo(notaCp(cp1, f)) },
    { r: 9, cel: f => celCalculo(notaCp(cp2, f)) },
    { r: 10, cel: f => celCalculo(notaCp(cp3, f)) },
    { r: 12, cel: f => celCalculo(inst ? notaInstrumentoCcp(inst, ctx.mapa, f.id, ctx.topicos) : null) },
    { r: 13, cel: f => celEscala(inst ? notaInstrumentoCcp(inst, ctx.mapa, f.id, ctx.topicos) : null) },
  ];
  const usados = colunasFormandos(g, 3, ctx.formandos, resumo);
  let c = 3 + usados + 1;
  g.largura(c - 1, "gutter");

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
  c = blocoPercentual(g, c, ctx, {
    titulo: `Ficha de Apreciação dos Recursos Didáticos aplicados na Simulação Pedagógica ${qual} - CP2`,
    grupos: [{ desde: 0, texto: "QUALIDADE DOS RECURSOS" }],
    bloco: cp2,
    moduloId: cp2 ? mod(cp2) : "",
    cabecaParam: "Parâmetros de avaliação",
    rotuloPontuacao: "Pontuação por formando - CP2 (Tradução do somatório percentual em classificação por níveis - escala CNQF)",
    escalaMax: ctx.escalaMax,
  });
  blocoCriterios(g, c, ctx, {
    titulo: `Apreciação do Desenvolvimento da Simulação Pedagógica ${qual} - CP3`,
    bloco: cp3,
    moduloId: cp3 ? mod(cp3) : "",
    rotuloPontuacao: `Pontuação por formando - CP3 (Somatório de pontos/Total de itens avaliados)`,
  });

  return {
    id: instId,
    titulo: `Simulação Pedagógica ${qual}`,
    larguras: g.larguras,
    linhas: g.linhas(),
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
    linhas.push({
      r: pontuacao,
      cel: f => celCalculo(pontuacaoBloco(opts.bloco as BlocoCcp, ctx.mapa, f.id, opts.moduloId)),
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
    linhas.push({
      r: soma,
      cel: f => celCalculo(somaCompleta(params, ctx.mapa, f.id, opts.moduloId)),
    });
    linhas.push({
      r: pontuacao,
      cel: f => celCalculo(pontuacaoBloco(opts.bloco as BlocoCcp, ctx.mapa, f.id, opts.moduloId)),
    });
  }
  colunasFormandos(g, c0 + 2, ctx.formandos, linhas);
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
  g.set(1, 12, texto("Escala Qualitativa", "formula", 2));

  const modOp2 = op2 ? idGrelhaBloco("elearning", op2.id) : "";
  const notaOp1 = (f: Pessoa) => (op1 && inst
    ? mediaModulos(op1, ctx.mapa, f.id, modulos)
    : null);
  const notaOp2 = (f: Pessoa) => (op2 ? pontuacaoBloco(op2, ctx.mapa, f.id, modOp2) : null);
  const resumo: LinhaValor[] = [
    { r: 8, cel: f => celCalculo(notaOp1(f)) },
    { r: 9, cel: f => celCalculo(notaOp2(f)) },
    { r: 11, cel: f => celCalculo(inst ? notaInstrumentoCcp(inst, ctx.mapa, f.id, ctx.topicos) : null) },
    { r: 12, cel: f => celEscala(inst ? notaInstrumentoCcp(inst, ctx.mapa, f.id, ctx.topicos) : null) },
  ];
  const usados = colunasFormandos(g, 3, ctx.formandos, resumo);
  let c = 3 + usados + 1;
  g.largura(c - 1, "gutter");

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
  c += 2;

  for (const mod of modulos) {
    g.set(c, 4, texto(`MÓDULO ${mod.numero}`, "titulo", Math.max(1, ctx.formandos.length)));
    const linhas: LinhaValor[] = params.map((p, i) => ({
      r: inicio + i,
      cel: (f: Pessoa) => entrada(f, mod.id, p.id),
    }));
    linhas.push({
      r: somaRow,
      cel: f => celCalculo(op1 ? somaCompleta(op1.parametros, ctx.mapa, f.id, mod.id) : null),
    });
    linhas.push({
      r: pontaRow,
      cel: f => celCalculo(op1 ? pontuacaoBloco(op1, ctx.mapa, f.id, mod.id) : null),
    });
    const largura = colunasFormandos(g, c, ctx.formandos, linhas);
    c += largura + 1;
    g.largura(c - 1, "gutter");
  }

  g.largura(c, "codigo");
  g.set(c + 1, 4, texto("Somatório Módulos", "titulo", Math.max(1, ctx.formandos.length)));
  modulos.forEach((mod, i) => {
    g.set(c, inicio + i, texto(`M${mod.numero}`, "codigo"));
  });
  const linhasSoma: LinhaValor[] = modulos.map((mod, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => celCalculo(op1 ? pontuacaoBloco(op1, ctx.mapa, f.id, mod.id) : null),
  }));
  linhasSoma.push({
    r: somaRow,
    cel: f => celCalculo(somaModulos(op1, ctx.mapa, f.id, modulos)),
  });
  linhasSoma.push({
    r: pontaRow,
    cel: f => celCalculo(op1 ? mediaModulos(op1, ctx.mapa, f.id, modulos) : null),
  });
  const larguraSoma = colunasFormandos(g, c + 1, ctx.formandos, linhasSoma);
  c += 1 + larguraSoma + 1;
  g.largura(c - 1, "gutter");

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
    linhas2.push({ r: soma2, cel: f => celCalculo(somaCompleta(params2, ctx.mapa, f.id, modOp2)) });
    linhas2.push({ r: ponta2, cel: f => celCalculo(pontuacaoBloco(op2, ctx.mapa, f.id, modOp2)) });
  }
  colunasFormandos(g, c + 2, ctx.formandos, linhas2);

  return {
    id: "elearning",
    titulo: "Módulos e-learning",
    larguras: g.larguras,
    linhas: g.linhas(),
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
    notas.push(n);
  }
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100;
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
    soma += n;
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
  g.set(1, pontuacao + 1, texto("Escala Qualitativa", "formula", 2));
  const linhas: LinhaValor[] = params.map((p, i) => ({
    r: inicio + i,
    cel: (f: Pessoa) => entrada(f, moduloId, p.id),
  }));
  if (bloco) {
    linhas.push({ r: pontuacao, cel: f => celCalculo(pontuacaoBloco(bloco, ctx.mapa, f.id, moduloId)) });
    linhas.push({ r: pontuacao + 1, cel: f => celEscala(pontuacaoBloco(bloco, ctx.mapa, f.id, moduloId)) });
  }
  colunasFormandos(g, 4, ctx.formandos, linhas);
  return { id: "projeto", titulo: "Projeto de Intervenção", larguras: g.larguras, linhas: g.linhas() };
}

function folhaFinal(ctx: Ctx): FolhaModelo {
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
  g.set(1, 14, texto("Escala Qualitativa", "formula", 2));
  g.set(2, 21, texto("Rubrica do coordenador da ação: _________________________", "meta"));
  g.set(2, 23, texto("Data: _____________________", "meta"));

  const notaInst = (id: IdInstrumentoCcp | undefined, f: Pessoa) => {
    if (!id) return null;
    const inst = instrumento(ctx.ccp, id);
    return inst ? notaInstrumentoCcp(inst, ctx.mapa, f.id, ctx.topicos) : null;
  };
  const linhas: LinhaValor[] = linhasFixas.map(linha => ({
    r: linha.r,
    cel: (f: Pessoa) => celCalculo(notaInst(linha.inst, f)),
  }));
  linhas.push({ r: 13, cel: f => celCalculo(notaFinalCcp(ctx.ccp, ctx.mapa, f.id, ctx.topicos)) });
  linhas.push({ r: 14, cel: f => celEscala(notaFinalCcp(ctx.ccp, ctx.mapa, f.id, ctx.topicos)) });
  colunasFormandos(g, 3, ctx.formandos, linhas);
  return { id: "final", titulo: "Avaliação Final", larguras: g.larguras, linhas: g.linhas() };
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
