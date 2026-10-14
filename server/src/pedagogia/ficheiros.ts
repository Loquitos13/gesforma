/** PDFs gerados do dossiê (cronograma, presenças, planos, perguntas dos inquéritos) e anexos no Drive. */
import type { Db } from "../db/pool.js";
import { pdfsDoDossie, type SessaoPedagogicaPdf } from "../dtpPdfs.js";
import { storeDriveFile } from "../driveFicheiros.js";
import { lerEntidade } from "../regrasConfig.js";
import { pdfPerguntasInqueritos } from "../relatorioFinal.js";
import { gravarAnexo } from "../repos/dtp.js";
import { listarSessoes } from "../repos/pedagogiaSessoes.js";
import { formandosDaTurma, type TurmaRow } from "../repos/pedagogiaTurma.js";
import { ITEM_PERGUNTAS, NOME_PERGUNTAS, perguntasEnviadas } from "./inqueritos.js";
import type { Regime } from "./util.js";

export async function montarPdfsDossie(db: Db, regime: Regime, turma: TurmaRow) {
  const [sessoesRows, formandos] = await Promise.all([
    listarSessoes(db, regime, turma.id),
    formandosDaTurma(db, regime, turma),
  ]);
  const sessoes: SessaoPedagogicaPdf[] = sessoesRows.map(r => ({
    n: Number(r.sessao_n),
    plano: r.plano && typeof r.plano === "object" ? r.plano as SessaoPedagogicaPdf["plano"] : null,
    sumario: r.sumario && typeof r.sumario === "object" ? r.sumario as SessaoPedagogicaPdf["sumario"] : null,
    presencas: Array.isArray(r.presencas) ? r.presencas as SessaoPedagogicaPdf["presencas"] : [],
  }));
  return pdfsDoDossie({
    entidade: (await lerEntidade(db)).nome,
    turma: turma.nome,
    curso: turma.curso,
    local: turma.local,
    horario: turma.horario,
    cronograma: turma.cronograma,
    sessoes,
    formandos: formandos.map(f => f.nome),
  });
}

/** Guarda um PDF gerado no Drive e liga-o ao item do dossiê. */
export async function anexarPdfDtp(
  db: Db,
  actorId: string | undefined,
  regime: Regime,
  turma: { id: number; nome: string },
  itemId: string,
  name: string,
  bytes: Buffer,
) {
  const file = await storeDriveFile(db, actorId, { name, mime: "application/pdf", bytes }, {
    kind: "dtp", regime, turma: turma.nome, label: itemId,
  }, { gerado: true });
  await gravarAnexo(db, regime, turma.id, itemId, { id: file.id, nome: file.name, url: file.openUrl ?? "" });
}

/** PDFs das perguntas dos inquéritos enviados à turma (Financiada). */
export async function anexarPerguntasDaTurma(db: Db, actorId: string | undefined, turma: { id: number; nome: string; curso: string }) {
  for (const publico of ["formador", "formando", "pos"] as const) {
    const itemId = ITEM_PERGUNTAS[publico];
    const nome = NOME_PERGUNTAS[publico];
    if (!itemId || !nome) continue;
    const inqueritos = await perguntasEnviadas(db, turma.id, publico);
    if (!inqueritos.length) continue;
    const bytes = pdfPerguntasInqueritos({ acao: turma.nome, curso: turma.curso, publico, inqueritos });
    await anexarPdfDtp(db, actorId, "fin", turma, itemId, nome, bytes);
  }
}

/** Grava no Drive o cronograma, as folhas de presença/sumários e os planos de sessão. */
export async function gravarPdfsDossie(db: Db, actorId: string | undefined, regime: Regime, turma: TurmaRow) {
  const pdfs = await montarPdfsDossie(db, regime, turma);
  const guardar = (name: string, bytes: Buffer, label: string) =>
    storeDriveFile(db, actorId, { name, mime: "application/pdf", bytes }, { kind: "dtp", regime, turma: turma.nome, label }, { gerado: true });
  const folhas = await guardar("Folhas de presenca e sumarios.pdf", pdfs.folhas, "presencas");
  const pares = [
    { itemId: "cronograma", file: await guardar("Cronograma.pdf", pdfs.cronograma, "cronograma") },
    { itemId: "presencas", file: folhas },
    { itemId: "sumarios", file: folhas },
    { itemId: "planos", file: await guardar("Planos de sessao.pdf", pdfs.planos, "planos") },
  ];
  for (const par of pares) {
    await gravarAnexo(db, regime, turma.id, par.itemId, { id: par.file.id, nome: par.file.name, url: par.file.openUrl ?? "" });
  }
}
