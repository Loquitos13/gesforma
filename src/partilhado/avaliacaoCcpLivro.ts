// Leitura do livro Excel da CCP: aplica os blocos das folhas à estrutura de avaliação.
import type { ParametroAvaliacao } from "./avaliacaoNota.js";
import { blocosDoCsv, type BlocoCsv } from "./csvAvaliacao.js";
import type { IdInstrumentoCcp, EstruturaCcp } from "./avaliacaoCcpBase.js";

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

/** Mete na folha de um momento todos os blocos de parâmetros encontrados nessa grelha. */
export function aplicarBlocosNaFolha(
  ccp: EstruturaCcp,
  instrumentoId: IdInstrumentoCcp,
  blocos: BlocoCsv[],
): { ccp: EstruturaCcp; aplicados: BlocoAplicadoCcp[]; ignorados: string[] } {
  const escolhidos = new Map<string, BlocoCsv>();
  const ignorados: string[] = [];
  for (const bloco of blocos) {
    const blocoId = blocoIdDe(bloco.titulo, instrumentoId);
    if (!blocoId || !bloco.parametros.length) {
      ignorados.push(bloco.titulo);
      continue;
    }
    const anterior = escolhidos.get(blocoId);
    if (!anterior || bloco.parametros.length > anterior.parametros.length) escolhidos.set(blocoId, bloco);
  }

  const aplicados: BlocoAplicadoCcp[] = [];
  const seguinte: EstruturaCcp = {
    instrumentos: ccp.instrumentos.map(inst => {
      if (inst.id !== instrumentoId) return inst;
      return {
        ...inst,
        blocos: inst.blocos.map(bloco => {
          const cand = escolhidos.get(bloco.id);
          if (!cand) return bloco;
          const parametros = fundirParametros(bloco.parametros, cand.parametros);
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
      };
    }),
  };

  return { ccp: seguinte, aplicados, ignorados };
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
