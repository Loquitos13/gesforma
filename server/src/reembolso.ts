/**
 * Os dois ficheiros do pedido de reembolso da Financiada, um de cada por turma: a execução física
 * (participantes, modelo oficial preenchido) e as despesas (colunas do template de despesas).
 *
 * Geram-se sempre a partir dos dados actuais (a descarga está sempre em dia) e cada turma tem uma só
 * cópia de cada na sua pasta da Drive (DTP Financiada <turma> / 06-Certificacao e relatorios / Reembolso).
 * A cópia actualiza-se quando os dados mudam: a `impressao` guardada diz com que dados foi gerada.
 */
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { CAMPOS_DESPESA } from "../../src/partilhado/despesas.js";
import type { Db } from "./db/pool.js";
import { apagarFicheiroSubstituido, getDriveFile, storeDriveFile } from "./driveFicheiros.js";
import { sincronizarDespesasDaTurma } from "./despesasFormador.js";
import { dadosExecucaoFisica, emFaltaExecucao, xlsxExecucaoFisica } from "./execucaoFisica.js";
import { sanitizeFileName } from "./ficheirosValidacao.js";
import { textoSeguro } from "./pagamentosExportar.js";
import { listarDespesas } from "./repos/despesas.js";
import { ficheirosReembolso, trocarFicheiroReembolso, turmaReembolso, type TipoReembolso } from "./repos/reembolso.js";

export const TIPOS_REEMBOLSO: TipoReembolso[] = ["execucao-fisica", "despesas"];
export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Nome do ficheiro (o mesmo na Drive e na descarga): «Despesas - <turma> - <curso> - <dd-mm-aaaa>.xlsx».
 * O tipo à frente distingue os dois ficheiros da mesma turma, que ficam na mesma pasta.
 */
export function nomeFicheiroReembolso(tipo: TipoReembolso, turma: { id: number; nome: string; curso?: string; data_inicio?: string }) {
  const inicio = /^(\d{4})-(\d{2})-(\d{2})/.exec(turma.data_inicio ?? "");
  const partes = [
    tipo === "despesas" ? "Despesas" : "Execução Física",
    turma.nome.trim() || `Turma ${turma.id}`,
    turma.curso?.trim() ?? "",
    inicio ? `${inicio[3]}-${inicio[2]}-${inicio[1]}` : "",
  ].filter(Boolean);
  return `${sanitizeFileName(partes.join(" - ")).slice(0, 170)}.xlsx`;
}

/** Content-Disposition com o nome com acentos (RFC 6266) e uma alternativa só em ASCII. */
export function anexoXlsx(nome: string) {
  const ascii = nome.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/**
 * As despesas da turma, com as mesmas colunas, pela mesma ordem, do template de despesas. As automáticas dos
 * formadores (horas × valor por hora) põem-se primeiro em dia: o ficheiro e o seu estado reflectem-nas sempre.
 */
export async function dadosDespesasTurma(db: Db, turmaId: number) {
  await sincronizarDespesasDaTurma(db, turmaId, { soAberta: true });
  const linhas = await listarDespesas(db, turmaId);
  const dados = linhas.map(l => [
    Number(l.ordem),
    ...CAMPOS_DESPESA.map(c => {
      const v = l.dados[c.chave];
      return typeof v === "number" ? v : textoSeguro(v ?? "");
    }),
  ]);
  const impressao = createHash("sha256").update(JSON.stringify({ v: 1, dados })).digest("hex");
  return { dados, impressao, total: linhas.length };
}

export function xlsxDespesas(dados: (string | number)[][]) {
  const cab = ["Ordem", ...CAMPOS_DESPESA.map(c => c.rotulo)];
  const folha = XLSX.utils.aoa_to_sheet([cab, ...dados]);
  folha["!cols"] = cab.map(c => ({ wch: Math.max(12, Math.min(40, c.length + 4)) }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, folha, "Despesas");
  return XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** O ficheiro de um tipo, gerado agora, com a impressão dos dados. */
export async function gerarFicheiroReembolso(db: Db, turmaId: number, tipo: TipoReembolso) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const nome = nomeFicheiroReembolso(tipo, turma);
  if (tipo === "despesas") {
    const d = await dadosDespesasTurma(db, turmaId);
    return { turma, nome, impressao: d.impressao, bytes: () => xlsxDespesas(d.dados) };
  }
  const d = (await dadosExecucaoFisica(db, turmaId))!;
  return { turma, nome, impressao: d.impressao, bytes: () => xlsxExecucaoFisica(d.linhas) };
}

async function impressaoActual(db: Db, turmaId: number, tipo: TipoReembolso) {
  if (tipo === "despesas") return (await dadosDespesasTurma(db, turmaId)).impressao;
  return (await dadosExecucaoFisica(db, turmaId))?.impressao ?? "";
}

/**
 * Actualiza a cópia da turma na Drive quando os dados mudaram (ou com `forcar`). Guarda o novo ficheiro,
 * passa a linha da turma para ele e só então apaga o anterior: há sempre uma cópia, e uma só.
 * Sem Drive ligada (na Vercel) lança o erro da Drive; quem chama decide se o mostra.
 */
export async function sincronizarReembolso(
  db: Db,
  actorId: string | undefined,
  turmaId: number,
  tipo: TipoReembolso,
  opts: { forcar?: boolean; gerado?: Awaited<ReturnType<typeof gerarFicheiroReembolso>> } = {},
) {
  const g = opts.gerado ?? await gerarFicheiroReembolso(db, turmaId, tipo);
  if (!g) return null;
  const actual = (await ficheirosReembolso(db, turmaId)).find(f => f.tipo === tipo);
  const naDrive = actual ? await getDriveFile(db, actual.drive_file_id) : null;
  // Também se substitui quando o nome mudou (turma ou curso renomeados, outra data de início).
  if (!opts.forcar && actual && actual.impressao === g.impressao && naDrive && naDrive.name === g.nome) {
    return { atualizado: false };
  }
  const file = await storeDriveFile(db, actorId, { name: g.nome, mime: MIME_XLSX, bytes: g.bytes() }, {
    kind: "dtp", regime: "fin", turma: g.turma.nome, itemId: "execucao", label: "Reembolso",
  }, { gerado: true });
  const anterior = await db.tx(q => trocarFicheiroReembolso(q, turmaId, tipo, file.id, g.impressao, actorId ?? null));
  if (anterior) await apagarFicheiroSubstituido(db, anterior).catch(() => undefined);
  return { atualizado: true };
}

/** Actualiza sem falhar o pedido que a chamou (a escrita principal já foi feita); devolve o erro, se houver. */
export async function sincronizarSemFalhar(db: Db, actorId: string | undefined, turmaId: number, tipo: TipoReembolso) {
  try {
    await sincronizarReembolso(db, actorId, turmaId, tipo);
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : "Não foi possível actualizar a cópia na Drive.";
  }
}

/** Estado dos dois ficheiros da turma: cópia na Drive, quando foi actualizada, se está em dia, e o que falta. */
export async function estadoReembolso(db: Db, turmaId: number) {
  const exec = await dadosExecucaoFisica(db, turmaId);
  if (!exec) return null;
  const guardados = await ficheirosReembolso(db, turmaId);
  const impressoes: Record<TipoReembolso, string> = {
    "execucao-fisica": exec.impressao,
    despesas: await impressaoActual(db, turmaId, "despesas"),
  };
  const ficheiros = await Promise.all(TIPOS_REEMBOLSO.map(async tipo => {
    const g = guardados.find(f => f.tipo === tipo);
    const drive = g ? await getDriveFile(db, g.drive_file_id) : null;
    return {
      tipo,
      nome: nomeFicheiroReembolso(tipo, exec.turma),
      atualizadoEm: drive ? g!.atualizado_em : null,
      desatualizado: !drive || g!.impressao !== impressoes[tipo] || drive.name !== nomeFicheiroReembolso(tipo, exec.turma),
      drive: drive ? { id: drive.id, nome: drive.name, url: drive.openUrl, pasta: drive.folderPath, guardadoEm: drive.storedIn } : null,
    };
  }));
  return { ficheiros, execucaoFisica: { ...emFaltaExecucao(exec.linhas, exec.faltaTurma), semCodigoPostalLocal: exec.semLocal } };
}
