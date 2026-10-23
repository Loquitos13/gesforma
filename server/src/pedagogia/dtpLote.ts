/**
 * Fontes do Dossiê TP de todas as turmas de um regime, carregadas em lote:
 * ~12 consultas no total em vez de ~10 por turma (era o que tornava lentas as notificações e o painel).
 * As regras de associação (formando ↔ turma, pré-inscrição ↔ formando) são as mesmas do cálculo por turma.
 */
import type { Db } from "../db/pool.js";
import type { DtpEstado } from "../dtpModel.js";
import * as repo from "../repos/dtp.js";
import * as lote from "../repos/dtpLote.js";
import type { FormandoTurma, TurmaRow } from "../repos/pedagogiaTurma.js";
import { resultadosDeTurmas } from "../resultados.js";
import { contarPercurso, nomesFormadoresDaTurma, type FontesTurma } from "./dtp.js";
import { asObj, type Regime } from "./util.js";

type Alvo = { turma: TurmaRow; cursoId: number | null };

function agrupar<T extends { turma_id: number }>(linhas: T[]) {
  const m = new Map<number, T[]>();
  for (const l of linhas) {
    const lista = m.get(Number(l.turma_id)) ?? [];
    lista.push(l);
    m.set(Number(l.turma_id), lista);
  }
  return m;
}

const porNome = (a: FormandoTurma, b: FormandoTurma) => a.nome.localeCompare(b.nome);

export async function fontesEmLote(db: Db, regime: Regime, alvos: Alvo[]): Promise<Map<number, FontesTurma>> {
  const out = new Map<number, FontesTurma>();
  if (!alvos.length) return out;
  const ids = alvos.map(a => a.turma.id);
  const cursoIds = [...new Set(alvos.map(a => a.cursoId).filter((x): x is number => x != null))];

  const nomesFormadores = [...new Set(alvos.flatMap(a => nomesFormadoresDaTurma(a.turma)))];
  const [sessoes, docs, resultados, manuais, anexos, ficheiros, inqueritos, formadores, formandosGold, formandosFin, recibos] = await Promise.all([
    lote.sessoesDasTurmas(db, regime, ids),
    lote.documentosDasTurmas(db, regime, ids),
    resultadosDeTurmas(db, regime, ids),
    lote.estadosManuaisDasTurmas(db, regime, ids),
    lote.anexosDasTurmas(db, regime, ids).catch(() => []),
    lote.ficheirosDosCursos(db, regime, cursoIds).catch(() => []),
    lote.inqueritosEnviadosAsTurmas(db, regime, ids).catch(() => []),
    repo.docsDosFormadores(db, nomesFormadores),
    regime === "gold" ? lote.formandosGoldDasTurmas(db, ids, alvos.map(a => a.turma.nome)) : Promise.resolve([]),
    regime === "fin" ? lote.formandosFinDasTurmas(db, ids, alvos.map(a => a.turma.nome)) : Promise.resolve([]),
    regime === "gold" ? repo.recibosDasTurmasGold(db, ids).catch(() => []) : Promise.resolve([]),
  ]);
  const recibosDe = new Map(recibos.map(r => [Number(r.turma_id), { pagos: Number(r.pagos), comRecibo: Number(r.com_recibo) }]));

  // Formandos de cada turma, com as mesmas regras de formandosDaTurma (sem turma não entram em nenhuma).
  const formandosDe = new Map<number, (FormandoTurma & { email?: string })[]>();
  for (const { turma } of alvos) {
    const lista = regime === "gold"
      ? formandosGold
        .filter(f => Number(f.turma_id) === turma.id || f.turma === turma.nome)
        .map(f => ({ id: Number(f.id), nome: `${f.nome} ${f.apelido}`.trim(), docs: {}, email: f.email }))
      : formandosFin
        .filter(f => Number(f.turma_id) === turma.id
          || (f.turma_id == null && f.turma === turma.nome))
        .map(f => ({ id: Number(f.id), nome: `${f.nome} ${f.apelido}`.trim(), docs: asObj(f.docs) }));
    formandosDe.set(turma.id, lista.sort(porNome));
  }

  const todosFormandos = [...new Set([...formandosDe.values()].flat().map(f => f.id))];
  const validados = todosFormandos.length ? await repo.docsValidadosDosFormandos(db, regime, todosFormandos) : [];
  const validadosDe = new Map<number, { formando_id: number; doc_id: string }[]>();
  for (const v of validados) {
    const lista = validadosDe.get(Number(v.formando_id)) ?? [];
    lista.push(v);
    validadosDe.set(Number(v.formando_id), lista);
  }

  // Percurso público (Gold): pré-inscrições dos emails dos formandos e os seus documentos.
  let leads: Awaited<ReturnType<typeof lote.leadsGoldDosEmails>> = [];
  let docsLeads: Awaited<ReturnType<typeof repo.docsDasPreinscricoes>> = [];
  if (regime === "gold") {
    const emails = [...new Set(formandosGold.map(f => f.email).filter(Boolean))];
    leads = await lote.leadsGoldDosEmails(db, emails);
    docsLeads = await repo.docsDasPreinscricoes(db, [...new Set(leads.map(l => Number(l.id)))]);
  }
  const docsDoLead = new Map<number, typeof docsLeads>();
  for (const d of docsLeads) {
    const lista = docsDoLead.get(Number(d.preinscricao_id)) ?? [];
    lista.push(d);
    docsDoLead.set(Number(d.preinscricao_id), lista);
  }

  const sessoesDe = agrupar(sessoes);
  const docsDe = agrupar(docs);
  const manuaisDe = agrupar(manuais);
  const anexosDe = agrupar(anexos);
  const inqueritosDe = agrupar(inqueritos);
  const ficheirosDe = new Map<number, typeof ficheiros>();
  for (const f of ficheiros) {
    const lista = ficheirosDe.get(Number(f.curso_id)) ?? [];
    lista.push(f);
    ficheirosDe.set(Number(f.curso_id), lista);
  }

  for (const { turma, cursoId } of alvos) {
    const formandos = formandosDe.get(turma.id) ?? [];
    let percurso: FontesTurma["percurso"] = null;
    if (regime === "gold") {
      const comEmail = formandos.map(f => ({ id: f.id, email: f.email ?? "" }));
      const emails = new Set(comEmail.map(f => f.email).filter(Boolean));
      const curso = turma.curso.trim().toLowerCase();
      // Uma pré-inscrição por email: primeiro a do percurso desta turma, depois a mais recente.
      const escolhida = new Map<string, { id: number; daTurma: boolean }>();
      for (const l of leads) {
        if (!emails.has(l.email)) continue;
        const daTurma = Number(l.percurso_turma_id) === turma.id;
        if (!daTurma && l.curso !== curso) continue;
        const atual = escolhida.get(l.email);
        const id = Number(l.id);
        if (!atual || (daTurma && !atual.daTurma) || (daTurma === atual.daTurma && id > atual.id)) escolhida.set(l.email, { id, daTurma });
      }
      const porEmail = new Map([...escolhida].map(([e, v]) => [e, v.id]));
      const docsEscolhidos = [...new Set(porEmail.values())].flatMap(id => docsDoLead.get(id) ?? []);
      percurso = formandos.length ? contarPercurso(comEmail, porEmail, docsEscolhidos) : { total: 0, porTipo: new Map() };
    }
    out.set(turma.id, {
      sessoes: sessoesDe.get(turma.id) ?? [],
      docs: docsDe.get(turma.id) ?? [],
      formandos: formandos.map(({ id, nome, docs }) => ({ id, nome, docs })),
      docsValidados: formandos.flatMap(f => validadosDe.get(f.id) ?? []),
      inqueritos: inqueritosDe.get(turma.id) ?? [],
      resultados: resultados.get(turma.id)?.formandos ?? [],
      formadores,
      manual: Object.fromEntries((manuaisDe.get(turma.id) ?? []).map(r => [r.item_id, r.estado])) as Record<string, DtpEstado>,
      anexos: anexosDe.get(turma.id) ?? [],
      ficheiros: cursoId == null ? [] : ficheirosDe.get(cursoId) ?? [],
      percurso,
      recibos: recibosDe.get(turma.id) ?? null,
    });
  }
  return out;
}
