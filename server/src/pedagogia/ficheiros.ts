/** PDFs gerados do dossiê (cronograma, presenças, planos, perguntas dos inquéritos) e anexos no Drive. */
import type { Db } from "../db/pool.js";
import { pdfsDoDossie, type SessaoPedagogicaPdf } from "../dtpPdfs.js";
import { apagarFicheiroSubstituido, getDriveFile, mapFile, resumoConteudo, storeDriveFile } from "../driveFicheiros.js";
import { sanitizeFileName } from "../ficheirosValidacao.js";
import { lerEntidade } from "../regrasConfig.js";
import { pdfPerguntasInqueritos } from "../relatorioFinal.js";
import { ficheiroDrive } from "../repos/drive.js";
import { anexosDaTurma, gravarAnexo } from "../repos/dtp.js";
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

/**
 * Liga um ficheiro gerado ao item do dossiê. A cópia gerada anterior desse item (mesmo nome e item)
 * deixa de estar ligada e apaga-se, para não acumular cópias no Drive; um anexo carregado à mão fica.
 */
export async function ligarAnexoGerado(
  db: Db,
  regime: Regime,
  turmaId: number,
  itemId: string,
  file: { id: string; name: string; openUrl?: string | null },
) {
  const antes = (await anexosDaTurma(db, regime, turmaId)).find(a => a.item_id === itemId);
  await gravarAnexo(db, regime, turmaId, itemId, { id: file.id, nome: file.name, url: file.openUrl ?? "" });
  if (!antes?.drive_file_id || antes.drive_file_id === file.id) return;
  const velho = await getDriveFile(db, antes.drive_file_id);
  if (velho && velho.name === file.name && velho.label === itemId) {
    await apagarFicheiroSubstituido(db, velho.id).catch(() => undefined);
  }
}

/**
 * Guarda no Drive um PDF gerado para o item do dossiê. Se o item já tem ligado o mesmo PDF (nome, item e
 * conteúdo iguais), reutiliza-o: gerar de novo sem mudanças não envia outra cópia.
 */
async function guardarPdfGerado(
  db: Db,
  actorId: string | undefined,
  regime: Regime,
  turma: { id: number; nome: string },
  itemId: string,
  name: string,
  bytes: Buffer,
) {
  const ligado = (await anexosDaTurma(db, regime, turma.id)).find(a => a.item_id === itemId)?.drive_file_id;
  const atual = ligado ? await ficheiroDrive(db, ligado) : null;
  if (atual?.sha256 && atual.sha256 === resumoConteudo(bytes) && atual.name === sanitizeFileName(name)
    && atual.label === itemId && atual.turma === turma.nome && atual.regime === regime) {
    return mapFile(atual);
  }
  return storeDriveFile(db, actorId, { name, mime: "application/pdf", bytes }, {
    kind: "dtp", regime, turma: turma.nome, label: itemId,
  }, { gerado: true });
}

/** Guarda um PDF gerado no Drive e liga-o ao item do dossiê (substitui a cópia gerada anterior; igual, não reenvia). */
export async function anexarPdfDtp(
  db: Db,
  actorId: string | undefined,
  regime: Regime,
  turma: { id: number; nome: string },
  itemId: string,
  name: string,
  bytes: Buffer,
) {
  const file = await guardarPdfGerado(db, actorId, regime, turma, itemId, name, bytes);
  await ligarAnexoGerado(db, regime, turma.id, itemId, file);
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
  const guardar = (name: string, bytes: Buffer, itemId: string) => guardarPdfGerado(db, actorId, regime, turma, itemId, name, bytes);
  const folhas = await guardar("Folhas de presenca e sumarios.pdf", pdfs.folhas, "presencas");
  const pares = [
    { itemId: "cronograma", file: await guardar("Cronograma.pdf", pdfs.cronograma, "cronograma") },
    { itemId: "presencas", file: folhas },
    { itemId: "sumarios", file: folhas },
    { itemId: "planos", file: await guardar("Planos de sessao.pdf", pdfs.planos, "planos") },
  ];
  for (const par of pares) await ligarAnexoGerado(db, regime, turma.id, par.itemId, par.file);
}
