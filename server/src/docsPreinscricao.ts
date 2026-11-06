/**
 * Guardar um documento na ficha de uma pré-inscrição (ligação pessoal, ou a equipa a partir de um ficheiro recebido no
 * WhatsApp): pasta da pessoa na Drive, substitui o anterior ainda por rever, regista na cronologia e, no comprovativo,
 * segue para a contabilidade e avisa a equipa (nos outros documentos, o aviso sai quando estão todos os obrigatórios).
 * As regras de quem pode entregar o quê ficam em quem chama.
 */
import { avisarDocumentoRecebido } from "./avisosEquipa.js";
import { comprovativoRecebido } from "./comprovativoContabilidade.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import type { DadosGatilho } from "../../src/partilhado/gatilhosDocs.js";
import { comprovativosPelaEquipa, eComprovativo, prestacoesDoLead, rotuloPrestacao } from "./docsCurso.js";
import { COMPROVATIVO, docsDoCurso, listarDocsLead } from "./docsLink.js";
import { garantirPastaPendente } from "./driveArvore.js";
import { apagarFicheiroSubstituido, storeDriveFile } from "./driveFicheiros.js";
import { nomeIdentificado } from "./ficheirosValidacao.js";
import * as docsRepo from "./repos/leadDocs.js";

type Pedidos = Awaited<ReturnType<typeof docsDoCurso>>;
type DocsJa = Awaited<ReturnType<typeof listarDocsLead>>;

export async function guardarDocDaPreinscricao(
  db: Db,
  lead: Record<string, unknown>,
  tipo: string,
  up: { name: string; mime: string; bytes: Buffer },
  ctx: { pedidos: Pedidos; ja: DocsJa; actorId?: string; origem?: string },
) {
  const leadId = Number(lead.id);
  const regime = String(lead.regime ?? "gold") === "fin" ? "fin" : "gold";
  const comprovativo = tipo === COMPROVATIVO.id;
  // Prestação seguinte (comprovativo-2, …): fica na ficha e avisa a equipa e a contabilidade, sem o passo da faturação.
  const prestacao = !comprovativo && eComprovativo(tipo);
  const antigo = ctx.ja.find(d => d.tipo === tipo && d.drive_file_id);
  const zona = await garantirPastaPendente(db, { id: leadId, nome: String(lead.nome ?? ""), apelido: String(lead.apelido ?? "") });
  // O ficheiro fica com o nome do documento e da pessoa («Cartão de Cidadão - Ana Silva.pdf»).
  const rotulo = comprovativo || prestacao
    ? rotuloPrestacao(prestacao ? Number(tipo.split("-")[1]) : 1, prestacoesDoLead(lead))
    : ctx.pedidos.find(p => p.id === tipo)?.label ?? tipo;
  const nome = nomeIdentificado(up.name, rotulo, `${lead.nome ?? ""} ${lead.apelido ?? ""}`);
  const file = await storeDriveFile(db, undefined, { name: nome, mime: up.mime, bytes: up.bytes }, {
    kind: comprovativo || prestacao ? "comprovativo-pagamento" : "preinscricao-doc",
    regime,
    formando: `${lead.nome} ${lead.apelido}`.trim(),
    label: tipo,
    itemId: String(leadId),
    parentDriveId: zona?.pastaId,
    folderPath: zona?.path || undefined,
  });
  // Só o documento errado (recusado) ou ainda por rever é substituído; um ficheiro partilhado com outro registo fica.
  if (antigo?.drive_file_id && antigo.drive_file_id !== file.id && !(await docsRepo.ficheiroEmOutroSitio(db, antigo.drive_file_id, leadId))) {
    await apagarFicheiroSubstituido(db, antigo.drive_file_id);
  }
  await docsRepo.substituirDoc(db, { leadId, tipo, nome: file.name, driveFileId: file.id, driveUrl: file.openUrl ?? "" });
  const titulo = comprovativo || prestacao ? `${rotulo} na ficha` : `Documento na ficha · ${tipo}`;
  await logLeadEvent(db, leadId, ctx.actorId, "campo", ctx.origem ? `${titulo} (${ctx.origem})` : titulo, file.name);
  // O comprovativo segue também para a contabilidade (com o ficheiro e os dados de faturação; sem estes, espera por
  // eles: é o passo seguinte da ligação). Uma falha no email não recusa o envio.
  if (comprovativo) {
    await comprovativoRecebido(db, lead, { driveFileId: file.id, nome: file.name, mime: up.mime, bytes: up.bytes })
      .catch(err => console.error("[pagamentos] comprovativo para a contabilidade:", err));
  }
  // Aviso à equipa: o comprovativo logo; os documentos só quando estão todos os obrigatórios (um email, não um por ficheiro).
  if (comprovativo || prestacao) {
    await avisarDocumentoRecebido(db, lead, rotulo, file.id, { comprovativo: true }).catch(err => console.error("[emails] aviso de comprovativo recebido:", err));
  } else {
    const agora = await listarDocsLead(db, leadId);
    const entregue = (id: string) => agora.some(d => d.tipo === id && d.estado !== "recusado");
    const obrigatorios = ctx.pedidos.filter(p => p.required);
    if (obrigatorios.length && obrigatorios.every(p => entregue(p.id))) {
      const lista = `Todos os documentos obrigatórios: ${obrigatorios.map(p => p.label).join(", ")}`;
      await avisarDocumentoRecebido(db, lead, lista, file.id).catch(err => console.error("[emails] aviso de documentos recebidos:", err));
    }
  }
  return file;
}

/** Documentos que se podem entregar nesta pré-inscrição (os do curso e, se se pede, o comprovativo), com os já validados. */
export async function tiposDoLead(db: Db, lead: Record<string, unknown>) {
  const regime = String(lead.regime ?? "gold") === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, String(lead.curso ?? ""), regime, lead as DadosGatilho);
  const ja = await listarDocsLead(db, Number(lead.id));
  const validado = (id: string) => ja.some(d => d.tipo === id && d.estado === "validado");
  const tipos = pedidos.map(p => ({ id: p.id, label: p.label, validado: validado(p.id) }));
  const obrigatorios = pedidos.filter(p => p.required);
  const todosValidados = obrigatorios.length > 0 && obrigatorios.every(p => validado(p.id));
  for (const c of await comprovativosPelaEquipa(db, lead, ja, todosValidados)) tipos.push({ ...c, validado: false });
  return { tipos, pedidos, ja };
}
