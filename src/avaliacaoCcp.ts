import type { ParametroAvaliacao } from "./avaliacaoCurso";
import { blocosDoCsv, type BlocoCsv } from "./csvAvaliacao";
import type { TopicoPrograma } from "./cursoPrograma";

export type IdInstrumentoCcp = "elearning" | "sim-inicial" | "sim-final" | "projeto";

export type BlocoCcp = {
  id: string;
  titulo: string;
  /** Peso deste bloco dentro do instrumento. Na simulação, CP3 vale 2 e os outros 1. */
  peso: number;
  /** por-modulo repete-se em cada módulo de e-learning. uma-vez é uma grelha só. */
  ambito: "por-modulo" | "uma-vez";
  pesosEquitativos: boolean;
  parametros: ParametroAvaliacao[];
};

export type InstrumentoCcp = {
  id: IdInstrumentoCcp;
  titulo: string;
  /** Peso na nota final do CCP. A folha usa 10, 30, 30 e 30. */
  pesoFinal: number;
  blocos: BlocoCcp[];
};

export type EstruturaCcp = {
  instrumentos: InstrumentoCcp[];
};

export type GrelhaCcp = {
  id: string;
  label: string;
  grupo: string;
  parametros: ParametroAvaliacao[];
  pesosEquitativos: boolean;
};

const MODULOS_SIMULACAO = new Set([2, 9]);

function p(id: string, label: string, peso = 1): ParametroAvaliacao {
  return { id, label, peso };
}

function blocoSimulacao(prefixo: string): BlocoCcp[] {
  return [
    {
      id: "cp1",
      titulo: "CP1 · Plano de sessão",
      peso: 1,
      ambito: "uma-vez",
      pesosEquitativos: false,
      parametros: [
        p(`${prefixo}-cp1-1`, "1. Caracterização da sessão", 20),
        p(`${prefixo}-cp1-2`, "2. Coerência entre os objetivos e a estratégia pedagógica", 30),
        p(`${prefixo}-cp1-3`, "3. Avaliação dos formandos", 10),
        p(`${prefixo}-cp1-4`, "4. Recursos didáticos", 10),
        p(`${prefixo}-cp1-5`, "5. Utilização de Plataformas Colaborativas e de Aprendizagem", 10),
        p(`${prefixo}-cp1-6`, "6. Instrumentos de avaliação", 10),
        p(`${prefixo}-cp1-7`, "7. Organização do plano de sessão", 10),
      ],
    },
    {
      id: "cp2",
      titulo: "CP2 · Recursos didáticos",
      peso: 1,
      ambito: "uma-vez",
      pesosEquitativos: false,
      parametros: [
        p(`${prefixo}-cp2-1`, "Rigor Técnico", 40),
        p(`${prefixo}-cp2-2`, "Estruturação", 40),
        p(`${prefixo}-cp2-3`, "Criatividade", 20),
      ],
    },
    {
      id: "cp3",
      titulo: "CP3 · Desenvolvimento",
      peso: 2,
      ambito: "uma-vez",
      pesosEquitativos: true,
      parametros: [
        "Domínio do Assunto",
        "Comunicação dos Objetivos",
        "Verificação dos Pré-requisitos",
        "Adequação dos Métodos e Técnicas Pedagógicas (MTP)",
        "Motivação",
        "Atividades dos Participantes",
        "Facilitação da Estruturação do Conteúdo",
        "Recursos Didáticos",
        "Comportamento Físico demonstrado na Interação com o Grupo",
        "Moderação das discussões de grupo",
        "Autoconfiança",
        "Verificação dos Resultados de Aprendizagem",
        "Comunicação dos Resultados de Aprendizagem",
        "Gestão do Tempo",
        "Criatividade Pedagógica",
        "Planeamento de Atividades com Recurso a Plataformas Colaborativas e de Aprendizagem",
      ].map((label, i) => p(`${prefixo}-cp3-${i + 1}`, label, 1)),
    },
  ];
}

/** Quatro instrumentos do CCP, com os critérios das folhas reais. */
export function estruturaCcpPadrao(): EstruturaCcp {
  return {
    instrumentos: [
      {
        id: "elearning",
        titulo: "E-learning",
        pesoFinal: 30,
        blocos: [
          {
            id: "op1",
            titulo: "OP1 · Módulos",
            peso: 1,
            ambito: "por-modulo",
            pesosEquitativos: true,
            parametros: [
              p("ccp-op1-1", "Domínio dos assuntos (aplica os conhecimentos adquiridos em exercícios ou casos concretos)"),
              p("ccp-op1-2", "Criatividade e autonomia (demonstra capacidade de análise dos temas e situaçãos, autonomia na pesquisa de informação e criatividade na abordagem dos assuntos)"),
              p("ccp-op1-3", "Generalização dos saberes (transfere ou generaliza os saberes adquiridos a novas situações)"),
              p("ccp-op1-4", "Participação (Mostra interesse e intervém a propósito, colaborando na dinamização das atividades formativas)"),
              p("ccp-op1-5", "Responsabilidade (Demonstra sentido de responsabilidade na frequência da ação, em termos de cumprimento dos tempos e das atividades propostas)"),
              p("ccp-op1-6", "Relações interpessoais (Comunica com os colegas, formadores e outros, demonstrando tolerância e espírito de equipa)"),
            ],
          },
          {
            id: "op2",
            titulo: "OP2 · Avaliações intermédias",
            peso: 1,
            ambito: "uma-vez",
            pesosEquitativos: true,
            parametros: [
              "Caracteriza os tipos, modalidade e formas de organização da formação, adequando-os com qualidade e eficácia ao sistema de formação em que intervém",
              "Reconhece os fatores potenciadores da eficácia nos processos formativos",
              "Reconhece o valor das TIC como meio de atratividade da formação",
              "Prepara apresentações multimédia em função dos objetivos criados",
              "Explora as potencialidades pedagógicas das Plataformas Colaborativas e de Aprendizagem",
              "Prepara módulos, sessões de formação em função dos públicos e contextos formativos",
              "Define os objetivos pedagógicos em função das competências a adquirir",
              "Estabelece a relação entre os objetivos, os métodos e estratégias e a avaliação da aprendizagem",
              "Caracteriza as diferentes estratégias e métodos de aprendizagem relacionando os estilos de comunicação e os tipos de liderança associados",
              "Estabelece uma boa relação de mediação em diferentes grupos, tendo em conta técnicas de dinâmica de grupo e gestão de conflitos",
            ].map((label, i) => p(`ccp-op2-${i + 1}`, label)),
          },
        ],
      },
      {
        id: "sim-inicial",
        titulo: "Simulação inicial",
        pesoFinal: 10,
        blocos: blocoSimulacao("ccp-si"),
      },
      {
        id: "sim-final",
        titulo: "Simulação final",
        pesoFinal: 30,
        blocos: blocoSimulacao("ccp-sf"),
      },
      {
        id: "projeto",
        titulo: "Projeto de intervenção",
        pesoFinal: 30,
        blocos: [
          {
            id: "as-pi",
            titulo: "AS/PI",
            peso: 1,
            ambito: "uma-vez",
            pesosEquitativos: false,
            parametros: [
              p("ccp-pi-1", "1. Estrutura do Projeto", 15),
              p("ccp-pi-2", "2. Rigor na apresentação dos instrumentos", 30),
              p("ccp-pi-3", "3. Criatividade", 25),
              p("ccp-pi-4", "4. Fundamentação Pedagógica", 20),
              p("ccp-pi-5", "5. Recurso às Novas Tecnologias", 10),
            ],
          },
        ],
      },
    ],
  };
}

export function numeroModuloPrograma(index: number) {
  return index + 1;
}

export function moduloESimulacao(numero: number) {
  return MODULOS_SIMULACAO.has(numero);
}

export function idGrelhaBloco(instrumentoId: string, blocoId: string) {
  return `ccp:${instrumentoId}:${blocoId}`;
}

function roundNota(n: number) {
  return Math.round(n * 100) / 100;
}

function fracao(params: ParametroAvaliacao[], equitativos: boolean) {
  if (!params.length) return {} as Record<string, number>;
  if (equitativos) {
    const f = 1 / params.length;
    return Object.fromEntries(params.map(p => [p.id, f]));
  }
  const soma = params.reduce((a, p) => a + (p.peso > 0 ? p.peso : 0), 0);
  if (soma <= 0) {
    const f = 1 / params.length;
    return Object.fromEntries(params.map(p => [p.id, f]));
  }
  return Object.fromEntries(params.map(item => [item.id, (item.peso > 0 ? item.peso : 0) / soma]));
}

function lerNota(mapa: Map<string, number | null>, formandoId: number, moduloId: string, parametroId: string) {
  const v = mapa.get(`${formandoId}|${moduloId}|${parametroId}`);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function notaDeParametros(
  params: ParametroAvaliacao[],
  equitativos: boolean,
  mapa: Map<string, number | null>,
  formandoId: number,
  moduloId: string,
) {
  if (!params.length) return null;
  const pesos = fracao(params, equitativos);
  let acc = 0;
  for (const item of params) {
    const n = lerNota(mapa, formandoId, moduloId, item.id);
    if (n == null) return null;
    acc += n * (pesos[item.id] ?? 0);
  }
  return roundNota(acc);
}

export function modulosElearning(topicos: Pick<TopicoPrograma, "id" | "titulo">[]) {
  return topicos.flatMap((t, i) => moduloESimulacao(numeroModuloPrograma(i)) ? [] : [{ ...t, numero: numeroModuloPrograma(i) }]);
}

function notaBloco(
  bloco: BlocoCcp,
  instrumentoId: string,
  mapa: Map<string, number | null>,
  formandoId: number,
  modulos: { id: string }[],
) {
  if (bloco.ambito === "por-modulo") {
    if (!modulos.length) return null;
    const notas: number[] = [];
    for (const mod of modulos) {
      const n = notaDeParametros(bloco.parametros, bloco.pesosEquitativos, mapa, formandoId, mod.id);
      if (n == null) return null;
      notas.push(Math.round(n));
    }
    return Math.round(notas.reduce((a, b) => a + b, 0) / notas.length);
  }
  const n = notaDeParametros(bloco.parametros, bloco.pesosEquitativos, mapa, formandoId, idGrelhaBloco(instrumentoId, bloco.id));
  return n == null ? null : Math.round(n);
}

export function notaInstrumentoCcp(
  instrumento: InstrumentoCcp,
  mapa: Map<string, number | null>,
  formandoId: number,
  topicos: Pick<TopicoPrograma, "id" | "titulo">[],
) {
  const blocos = instrumento.blocos.filter(b => b.parametros.length);
  if (!blocos.length) return null;
  const modulos = instrumento.id === "elearning" ? modulosElearning(topicos) : [];
  const soma = blocos.reduce((a, b) => a + (b.peso > 0 ? b.peso : 0), 0);
  if (soma <= 0) return null;
  let acc = 0;
  for (const bloco of blocos) {
    const n = notaBloco(bloco, instrumento.id, mapa, formandoId, modulos);
    if (n == null) return null;
    acc += n * ((bloco.peso > 0 ? bloco.peso : 0) / soma);
  }
  return Math.round(acc);
}

export function notaFinalCcp(
  estrutura: EstruturaCcp,
  mapa: Map<string, number | null>,
  formandoId: number,
  topicos: Pick<TopicoPrograma, "id" | "titulo">[],
) {
  const instrumentos = estrutura.instrumentos.filter(i => i.pesoFinal > 0 && i.blocos.some(b => b.parametros.length));
  const soma = instrumentos.reduce((a, i) => a + i.pesoFinal, 0);
  if (!instrumentos.length || soma <= 0) return null;
  let acc = 0;
  for (const instrumento of instrumentos) {
    const n = notaInstrumentoCcp(instrumento, mapa, formandoId, topicos);
    if (n == null) return null;
    // A folha final vai buscar a nota já arredondada de cada momento, como o ROUND do Excel.
    acc += Math.round(n) * (instrumento.pesoFinal / soma);
  }
  return Math.round(acc);
}

export function textoFormulaCcp(estrutura: EstruturaCcp) {
  return estrutura.instrumentos
    .filter(i => i.pesoFinal > 0)
    .map(i => `${i.pesoFinal}% ${i.titulo.toLowerCase()}`)
    .join(" + ");
}

function tituloModulo(numero: number, topico: Pick<TopicoPrograma, "titulo"> | undefined, reserva: string) {
  const titulo = topico?.titulo.trim();
  return titulo ? `M${numero} · ${titulo}` : `M${numero} · ${reserva}`;
}

/** Grelhas da turma: um separador por módulo de e-learning e por bloco das outras fichas. */
export function grelhasCcp(estrutura: EstruturaCcp, topicos: Pick<TopicoPrograma, "id" | "titulo">[]): GrelhaCcp[] {
  const out: GrelhaCcp[] = [];
  const elearning = estrutura.instrumentos.find(i => i.id === "elearning");
  const op1 = elearning?.blocos.find(b => b.ambito === "por-modulo");
  if (op1 && op1.parametros.length) {
    for (const mod of modulosElearning(topicos)) {
      out.push({
        id: mod.id,
        label: `M${mod.numero}`,
        grupo: "E-learning",
        parametros: op1.parametros,
        pesosEquitativos: op1.pesosEquitativos,
      });
    }
  }
  for (const instrumento of estrutura.instrumentos) {
    const grupo = instrumento.id === "elearning"
      ? "E-learning"
      : instrumento.id === "sim-inicial"
        ? "Simulação inicial"
        : instrumento.id === "sim-final"
          ? "Simulação final"
          : "Projeto";
    for (const bloco of instrumento.blocos) {
      if (!bloco.parametros.length) continue;
      if (bloco.ambito === "por-modulo") continue;
      const label = instrumento.id === "sim-inicial"
        ? tituloModulo(2, topicos[1], "Simulação inicial")
        : instrumento.id === "sim-final"
          ? tituloModulo(9, topicos[8], "Simulação final")
          : bloco.titulo;
      const curto = instrumento.id === "projeto"
        ? "Projeto"
        : instrumento.id === "elearning"
          ? bloco.titulo
          : `${label.split(" · ")[0]} · ${bloco.titulo.split(" · ")[0]}`;
      out.push({
        id: idGrelhaBloco(instrumento.id, bloco.id),
        label: curto,
        grupo,
        parametros: bloco.parametros,
        pesosEquitativos: bloco.pesosEquitativos,
      });
    }
  }
  return out;
}

function texto(v: unknown) {
  return String(v ?? "").trim();
}

function parseParametros(raw: unknown): ParametroAvaliacao[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = texto(row.label);
    if (!label) return [];
    const peso = Number(row.peso);
    return [{
      id: texto(row.id) || `p-ccp-${i}`,
      label,
      peso: Number.isFinite(peso) && peso > 0 ? peso : 1,
      moodle: row.moodle === true,
    }];
  });
}

export function parseEstruturaCcp(raw: unknown): EstruturaCcp | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.instrumentos)) return undefined;
  const instrumentos = o.instrumentos.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = texto(row.id);
    if (id !== "elearning" && id !== "sim-inicial" && id !== "sim-final" && id !== "projeto") return [];
    const blocos = Array.isArray(row.blocos)
      ? row.blocos.flatMap(bloco => {
        if (!bloco || typeof bloco !== "object") return [];
        const b = bloco as Record<string, unknown>;
        const blocoId = texto(b.id);
        const titulo = texto(b.titulo);
        if (!blocoId || !titulo) return [];
        const peso = Number(b.peso);
        return [{
          id: blocoId,
          titulo,
          peso: Number.isFinite(peso) && peso > 0 ? peso : 1,
          ambito: b.ambito === "por-modulo" ? "por-modulo" as const : "uma-vez" as const,
          pesosEquitativos: b.pesosEquitativos !== false,
          parametros: parseParametros(b.parametros),
        }];
      })
      : [];
    const pesoFinal = Number(row.pesoFinal);
    const instrumento: InstrumentoCcp = {
      id: id as IdInstrumentoCcp,
      titulo: texto(row.titulo) || id,
      pesoFinal: Number.isFinite(pesoFinal) && pesoFinal >= 0 ? pesoFinal : 0,
      blocos,
    };
    return [instrumento];
  });
  if (!instrumentos.length) return undefined;
  return { instrumentos };
}

export const ROTULO_MOMENTO_CCP: Record<IdInstrumentoCcp, string> = {
  "sim-inicial": "Módulo 2",
  elearning: "E-learning",
  "sim-final": "Módulo 9",
  projeto: "Projeto de intervenção",
};

const BLOCOS_ESPERADOS: Record<IdInstrumentoCcp, { id: string; nome: string }[]> = {
  "sim-inicial": [
    { id: "cp1", nome: "CP1" },
    { id: "cp2", nome: "CP2" },
    { id: "cp3", nome: "CP3" },
  ],
  elearning: [
    { id: "op1", nome: "OP1" },
    { id: "op2", nome: "OP2" },
  ],
  "sim-final": [
    { id: "cp1", nome: "CP1" },
    { id: "cp2", nome: "CP2" },
    { id: "cp3", nome: "CP3" },
  ],
  projeto: [{ id: "as-pi", nome: "AS/PI" }],
};

export type BlocoAplicadoCcp = {
  instrumentoId: IdInstrumentoCcp;
  blocoId: string;
  titulo: string;
  quantidade: number;
};

export type PrevisaoLivroCcp = {
  ccp: EstruturaCcp;
  aplicados: BlocoAplicadoCcp[];
  pesos: { instrumentoId: IdInstrumentoCcp; peso: number }[];
  avisos: string[];
};

function semAcento(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function instrumentoDaFolha(nome: string): IdInstrumentoCcp | "final" | null {
  const n = semAcento(nome);
  if (/avaliacao final|^af\b/.test(n)) return "final";
  if (/projeto|interven/.test(n)) return "projeto";
  if (/elearning|e-learning|modulos/.test(n)) return "elearning";
  if (/inicial|diagnostic/.test(n)) return "sim-inicial";
  if (/final/.test(n)) return "sim-final";
  return null;
}

function blocoIdDe(titulo: string, instrumento: IdInstrumentoCcp) {
  const t = semAcento(titulo);
  if (/^ad\b/.test(t) || /^as\/cp\b/.test(t) || /^as\/op\b/.test(t)) return "";
  if (/^cp1\b/.test(t)) return "cp1";
  if (/^cp2\b/.test(t)) return "cp2";
  if (/^cp3\b/.test(t)) return "cp3";
  if (/^op1\b/.test(t)) return "op1";
  if (/^op2\b/.test(t)) return "op2";
  if (instrumento === "projeto" && (/^as\/pi\b/.test(t) || /projeto de intervenc/.test(t))) return "as-pi";
  return "";
}

function pesosDaAvaliacaoFinal(blocos: BlocoCsv[]) {
  const bloco = blocos.find(item => /^avaliacao final\b/.test(semAcento(item.titulo)));
  const mapa = new Map<IdInstrumentoCcp, number>();
  if (!bloco) return mapa;
  for (const item of bloco.parametros) {
    const t = semAcento(item.label);
    const id: IdInstrumentoCcp | "" = /^ad\b/.test(t)
      ? "sim-inicial"
      : /as\/op/.test(t)
        ? "elearning"
        : /as\/cp/.test(t)
          ? "sim-final"
          : /as\/pi|projeto/.test(t)
            ? "projeto"
            : "";
    if (id && item.peso > 0) mapa.set(id, item.peso);
  }
  const valores = [...mapa.values()];
  const soma = valores.reduce((a, b) => a + b, 0);
  if (valores.length && valores.every(v => v <= 1) && soma > 0.9 && soma < 1.1) {
    for (const [id, peso] of mapa) mapa.set(id, Math.round(peso * 100));
  }
  return mapa;
}

function idParametroNovo() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function fundirParametros(anteriores: ParametroAvaliacao[], novos: { label: string; peso: number }[]) {
  return novos.map((item, i) => ({
    id: anteriores[i]?.id ?? idParametroNovo(),
    label: item.label,
    peso: item.peso,
  }));
}

/** Reparte os blocos de todas as folhas pelos quatro momentos. A avaliação final só atualiza os pesos. */
export function aplicarLivroCcp(
  ccp: EstruturaCcp,
  folhas: { nome: string; grid: string[][] }[],
): PrevisaoLivroCcp {
  const escolhidos = new Map<string, { instrumentoId: IdInstrumentoCcp; blocoId: string; bloco: BlocoCsv }>();
  const pesos = new Map<IdInstrumentoCcp, number>();
  const avisos: string[] = [];

  for (const folha of folhas) {
    const destino = instrumentoDaFolha(folha.nome);
    if (!destino) {
      avisos.push(`A folha «${folha.nome}» não corresponde a um momento.`);
      continue;
    }
    const blocos = blocosDoCsv(folha.grid);
    if (destino === "final") {
      const lidos = pesosDaAvaliacaoFinal(blocos);
      if (!lidos.size) avisos.push("A folha da avaliação final não trouxe os pesos AD, AS/OP, AS/CP e AS/PI.");
      for (const [id, peso] of lidos) pesos.set(id, peso);
      continue;
    }
    let algum = false;
    for (const bloco of blocos) {
      const blocoId = blocoIdDe(bloco.titulo, destino);
      if (!blocoId || !bloco.parametros.length) continue;
      algum = true;
      const chave = `${destino}:${blocoId}`;
      const anterior = escolhidos.get(chave);
      if (!anterior || bloco.parametros.length > anterior.bloco.parametros.length) {
        escolhidos.set(chave, { instrumentoId: destino, blocoId, bloco });
      }
    }
    if (!algum) avisos.push(`Na folha «${folha.nome}» não encontrei blocos de parâmetros.`);
  }

  for (const id of Object.keys(BLOCOS_ESPERADOS) as IdInstrumentoCcp[]) {
    for (const esperado of BLOCOS_ESPERADOS[id]) {
      if (!escolhidos.has(`${id}:${esperado.id}`)) {
        avisos.push(`${ROTULO_MOMENTO_CCP[id]}: falta o bloco ${esperado.nome}.`);
      }
    }
  }

  const aplicados: BlocoAplicadoCcp[] = [];
  const seguinte: EstruturaCcp = {
    instrumentos: ccp.instrumentos.map(inst => ({
      ...inst,
      pesoFinal: pesos.get(inst.id) ?? inst.pesoFinal,
      blocos: inst.blocos.map(bloco => {
        const cand = escolhidos.get(`${inst.id}:${bloco.id}`);
        if (!cand) return bloco;
        const parametros = fundirParametros(bloco.parametros, cand.bloco.parametros);
        const primeiro = parametros[0]?.peso;
        aplicados.push({
          instrumentoId: inst.id,
          blocoId: bloco.id,
          titulo: bloco.titulo,
          quantidade: parametros.length,
        });
        return {
          ...bloco,
          parametros,
          pesosEquitativos: parametros.length > 0 && parametros.every(item => item.peso === primeiro),
        };
      }),
    })),
  };

  return {
    ccp: seguinte,
    aplicados,
    pesos: [...pesos.entries()].map(([instrumentoId, peso]) => ({ instrumentoId, peso })),
    avisos,
  };
}
