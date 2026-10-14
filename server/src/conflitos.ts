import type { Db } from "./db/pool.js";
import { cronogramasDasTurmas } from "./repos/oferta.js";
import { textoSobreposicaoNova } from "../../src/partilhado/sobreposicaoHorario.js";

/**
 * Conflitos de horário do formador entre turmas (Gold e Financiada).
 * Usado ao criar/alterar turmas, ao publicar o cronograma e nas regras automáticas.
 */

function asSessoes(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is {
    id?: string; data?: string; horaInicio?: string; horaFim?: string;
    formadores?: string[]; formador?: string; modalidade?: string;
  } => !!x && typeof x === "object");
}

export async function erroSobreposicao(db: Db, regime: "gold" | "fin", id: number | null, cronograma: unknown) {
  const { gold, fin } = await cronogramasDasTurmas(db);
  const blocos = [
    ...gold.map(r => ({ chave: `gold:${r.id}`, nome: String(r.nome ?? "turma"), cronograma: asSessoes(r.cronograma) })),
    ...fin.map(r => ({ chave: `fin:${r.id}`, nome: String(r.nome ?? "turma"), cronograma: asSessoes(r.cronograma) })),
  ];
  const chave = `${regime}:${id ?? "nova"}`;
  const atual = blocos.find(b => b.chave === chave);
  return textoSobreposicaoNova(
    { chave, nome: atual?.nome ?? "esta turma", cronograma: atual?.cronograma ?? [] },
    { chave, nome: atual?.nome ?? "esta turma", cronograma: asSessoes(cronograma) },
    blocos.filter(b => b.chave !== chave),
  );
}
