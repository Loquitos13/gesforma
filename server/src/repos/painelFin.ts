/**
 * Financiada: turmas a decorrer com horas dadas, assiduidade, documentos e Dossiê TP.
 * Os dados vêm em SQL; a assiduidade e as horas usam as regras de `assiduidade.ts`
 * (o cronograma é JSON e a duração de cada sessão sai das horas do plano).
 */
import { assiduidadeDoFormando, sessoesComHoras } from "../assiduidade.js";
import { hojeLisboa } from "../datas.js";
import { dtpForTurma } from "../pedagogia/dtp.js";
import { matrizDtp } from "../pedagogia/dtpCache.js";
import { pgIntArray } from "../pedagogia/util.js";
import { assiduidadeMinima, lerRegras } from "../regrasConfig.js";
import { HOJE_LISBOA, OCUPA, filtrarTurmas, type FiltroPainel } from "./estatisticas.js";
import { sqlADecorrer } from "./turmas.js";
import { DOCS_FIN_COMPLETOS, DOCS_FIN_OBRIGATORIOS } from "./painelBlocos.js";
import { Filtros, many, type Consulta } from "./sql.js";
import type { Db } from "../db/pool.js";

type TurmaFin = {
  id: number; nome: string; curso: string; ufcd_cod: string; local: string; horario: string;
  financiador: string; horas: number; cronograma: unknown; formador: string;
};

/** Turmas financiadas a decorrer: a fase «A decorrer» da lista de turmas (sem as «por fechar»). */
async function turmasFinADecorrer(c: Consulta, f: FiltroPainel) {
  const w = filtrarTurmas(f).sempre(sqlADecorrer("fin", HOJE_LISBOA));
  return many<TurmaFin>(c, `SELECT t.id, t.nome, t.curso, t.ufcd_cod, t.local, t.horario, t.financiador, t.horas, t.cronograma, t.formador
                              FROM turmas_fin t ${w.where} ORDER BY t.data_inicio, t.id`, w.params);
}

/** Ids das turmas financiadas com os filtros do painel (curso, local, horário, financiador), em qualquer fase. */
async function idsTurmasFinFiltradas(c: Consulta, f: FiltroPainel) {
  const w = filtrarTurmas(f);
  return new Set((await many<{ id: number }>(c, `SELECT t.id FROM turmas_fin t ${w.where}`, w.params)).map(t => Number(t.id)));
}

async function formandosDasTurmas(c: Consulta, ids: number[]) {
  if (!ids.length) return [];
  const w = new Filtros([pgIntArray(ids), DOCS_FIN_OBRIGATORIOS]).sempre("ff.turma_id = ANY($1::int[])").sempre(OCUPA("ff"));
  return many<{ id: number; nome: string; turma_id: number; completo: boolean }>(c, `
    SELECT ff.id, trim(ff.nome || ' ' || coalesce(ff.apelido, '')) AS nome, ff.turma_id, ${DOCS_FIN_COMPLETOS("$2")} AS completo
      FROM formandos_fin ff ${w.where}`, w.params);
}

async function folhasDasTurmas(c: Consulta, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; sessao_n: number; sumario: unknown; presencas: unknown }>(c, `
    SELECT turma_id, sessao_n, sumario, presencas FROM turma_sessoes WHERE regime = 'fin' AND turma_id = ANY($1::int[]) AND sessao_n IS NOT NULL`, [pgIntArray(ids)]);
}

export type TurmaDecorrer = {
  id: number; nome: string; curso: string; ufcd: string; local: string; financiador: string;
  formandos: number; horasDadas: number; horasPrevistas: number;
  assiduidade: number | null; abaixoMinimo: number; docsCompletos: number;
  sessoesPorAssinar: number; dtpPct: number; dtpBloqueantes: number;
};

const temFolha = (p: unknown) => Array.isArray(p) ? p.length > 0 : typeof p === "string" ? p.length > 2 : false;

/**
 * Uma linha por turma a decorrer e os totais para os indicadores
 * (formandos em formação, assiduidade média, abaixo do mínimo, sessões por assinar, dossiês com bloqueantes).
 */
export async function turmasFinEmCurso(db: Db, f: FiltroPainel) {
  const [turmas, regras] = await Promise.all([turmasFinADecorrer(db, f), lerRegras(db)]);
  const ids = turmas.map(t => Number(t.id));
  const [formandos, folhas] = await Promise.all([formandosDasTurmas(db, ids), folhasDasTurmas(db, ids)]);
  const minimo = assiduidadeMinima(regras, "fin");
  const hoje = hojeLisboa();
  const linhas: TurmaDecorrer[] = [];
  const pcts: number[] = [];
  const [matriz, filtradas] = await Promise.all([matrizDtp(db, "fin"), idsTurmasFinFiltradas(db, f)]);
  for (const t of turmas) {
    const id = Number(t.id);
    const membros = formandos.filter(x => Number(x.turma_id) === id);
    const folhasTurma = folhas.filter(x => Number(x.turma_id) === id);
    const sessoes = sessoesComHoras(t.cronograma, folhasTurma.map(x => ({ sessao_n: Number(x.sessao_n), presencas: x.presencas })));
    const porN = new Map(folhasTurma.map(x => [Number(x.sessao_n), x]));
    let horasDadas = 0;
    let porAssinar = 0;
    for (const s of sessoes) {
      const folha = porN.get(s.n);
      // A Financiada não tem sumário: a sessão conta como dada com a folha de presenças preenchida.
      if (temFolha(folha?.presencas)) horasDadas += s.horas;
      else if (s.data && s.data < hoje) porAssinar += 1;
    }
    const assid = membros.map(m => assiduidadeDoFormando({ id: Number(m.id), nome: m.nome }, sessoes, { justificadasContam: regras.justificadasContam }).pctRegistado);
    const validos = assid.filter((p): p is number => p != null);
    pcts.push(...validos);
    const naMatriz = matriz.turmas.find(x => x.id === id);
    const dtp = naMatriz
      ? { pct: naMatriz.pct, bloqueantes: naMatriz.bloqueantes }
      : await dtpForTurma(db, "fin", { id, nome: t.nome, curso: t.curso, cronograma: t.cronograma, formador: t.formador })
        .then(d => ({ pct: d.pct, bloqueantes: d.items.filter(i => i.estado !== "ok" && i.bloqueante).length }));
    linhas.push({
      id,
      nome: t.nome,
      curso: t.curso,
      ufcd: t.ufcd_cod,
      local: t.local,
      financiador: t.financiador,
      formandos: membros.length,
      horasDadas: Math.round(horasDadas * 10) / 10,
      horasPrevistas: Math.round((sessoes.reduce((s, x) => s + x.horas, 0) || Number(t.horas ?? 0)) * 10) / 10,
      assiduidade: validos.length ? Math.round((validos.reduce((s, x) => s + x, 0) / validos.length) * 10) / 10 : null,
      abaixoMinimo: validos.filter(p => p < minimo).length,
      docsCompletos: membros.filter(m => m.completo).length,
      sessoesPorAssinar: porAssinar,
      dtpPct: dtp.pct,
      dtpBloqueantes: dtp.bloqueantes,
    });
  }
  return {
    linhas,
    minimo,
    emFormacao: linhas.reduce((s, l) => s + l.formandos, 0),
    assiduidadeMedia: pcts.length ? Math.round((pcts.reduce((s, x) => s + x, 0) / pcts.length) * 10) / 10 : null,
    abaixoMinimo: linhas.reduce((s, l) => s + l.abaixoMinimo, 0),
    sessoesPorAssinar: linhas.reduce((s, l) => s + l.sessoesPorAssinar, 0),
    turmasPorAssinar: linhas.filter(l => l.sessoesPorAssinar > 0),
    // Mesmo âmbito do destino (Dossiê TP › «Com bloqueantes»): todas as turmas abertas do regime, não só as a decorrer,
    // com os filtros do painel (curso, local, horário, financiador).
    comBloqueantes: matriz.turmas.filter(t => !t.fechada && t.bloqueantes > 0 && filtradas.has(t.id)).map(t => ({
      id: t.id, nome: t.nome, ufcd: linhas.find(l => l.id === t.id)?.ufcd ?? "", dtpPct: t.pct,
    })),
  };
}
