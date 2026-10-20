import type { Db } from "./db/pool.js";
import { turmaDoFormador } from "./sessaoAcesso.js";
import {
  apagarAtalho, atalhoDoDoc, atalhosDaTurma, atalhosOrfaos, caminhosDosDocsDoLead, docsNaDriveDoFormador, emailsEquipaActiva,
  emailsSecretaria, formadorPorNome, formadoresPorNomes, gravarAtalho, gravarPastaFormador,
  gravarPastaNaTurma, gravarPastaPendente, gravarPastasTurma, nomeDaTurma, nomeDoFormador, pastaDaPreinscricao,
  turmasComAtalhosDoFormador, turmasComEquipa,
} from "./repos/driveArvore.js";
import { contaGoogle, contarPartilhasPorAcertar, marcarPartilhasSincronizadas, turmaComPartilhasPorAcertar } from "./repos/drive.js";
import { PASTAS_FIN_ANTERIORES, TOPICOS_FIN } from "./dtpTopicosFin.js";
import { sanitizeFileName } from "./ficheirosValidacao.js";
import {
  apagarItemGoogle, criarAtalhoDrive, garantirPastaFilha, moverPastaDrive, partilharPasta, permissoesDoItem, raizDoProjecto,
  revogarPermissao, tokenDrive, type PapelDrive,
} from "./googleDrive.js";

export const ZONA_PENDENTES = "01_INSCRIÇÕES_PENDENTES";
export const ZONA_TURMAS = "02_TURMAS_ATIVAS";
export const ZONA_BOLSA = "00_BOLSA_FORMADORES";

/** As 14 pastas da Drive são os tópicos do dossiê, pela mesma ordem e com o mesmo nome. */
export const PASTAS_DTP = TOPICOS_FIN.map(t => t.pasta);

/** «2. Recursos pedagógicos e materiais didáticos»: a única pasta da turma que os formadores vêem na Drive. */
export const PASTA_MATERIAIS = PASTAS_DTP[1];
export const PASTA_FORMADORES = PASTAS_DTP[2];
export const PASTA_FORMANDOS = PASTAS_DTP[4];

export type EstruturaTurma = {
  turmaPastaId: string;
  formandosId: string;
  formadoresId: string;
  pastas: Record<string, string>;
};

export function nomePastaPessoa(id: number, nome: string) {
  const pessoa = sanitizeFileName(nome.trim() || "Pessoa");
  return `${id} - ${pessoa}`.slice(0, 180);
}

export async function criarEstruturaDtp(
  db: Db,
  input: { regime: "gold" | "fin"; turmaId: number; nome: string },
  token = "",
): Promise<EstruturaTurma | null> {
  const acesso = token || await tokenDrive(db);
  if (!acesso) return null;
  const root = await raizDoProjecto(db, acesso);
  const zona = await garantirPastaFilha(acesso, root, ZONA_TURMAS);
  const turmaNome = nomePastaPessoa(input.turmaId, input.nome.trim() || `Turma ${input.turmaId}`);
  const turmaPastaId = await garantirPastaFilha(acesso, zona, turmaNome);
  const criadas = await Promise.all(PASTAS_DTP.map(async nome => {
    const id = await garantirPastaFilha(acesso, turmaPastaId, nome, PASTAS_FIN_ANTERIORES[nome] ?? []);
    return [nome, id] as const;
  }));
  const pastas = Object.fromEntries(criadas);
  const formandosId = pastas[PASTA_FORMANDOS] ?? "";
  const formadoresId = pastas[PASTA_FORMADORES] ?? "";
  await gravarPastasTurma(db, input.regime, input.turmaId, { pasta: turmaPastaId, formandos: formandosId, formadores: formadoresId });
  return { turmaPastaId, formandosId, formadoresId, pastas };
}

const emailsValidos = (lista: string[]) => [...new Set(lista.map(e => e.trim().toLowerCase()).filter(e => e.includes("@")))];

/**
 * Quem tem acesso na Drive à pasta da turma:
 * - a secretaria (admin e secretaria): editor da pasta inteira (o dossiê);
 * - os formadores associados: leitor só de «2. Recursos pedagógicos e materiais didáticos»;
 * - os formandos: nada. A pasta tem «5. Formandos» (CC, NIF, contratos, recibos) e as evidências do dossiê;
 *   o formando vê os seus documentos e certificados pela área do formando, nunca pela Drive.
 */
async function acessosDaTurma(db: Db, input: {
  formador?: string;
  formadores?: string[];
  cronograma?: unknown;
}) {
  const secretaria = emailsValidos(await emailsSecretaria(db));
  const nomes = nomesNoCronograma(input.cronograma, [input.formador ?? "", ...(input.formadores ?? [])]);
  const formadores = emailsValidos((await formadoresPorNomes(db, nomes)).map(f => f.email ?? ""));
  // Nunca se retira a partilha à conta dona da Drive nem a quem trabalha na equipa.
  const conta = (await contaGoogle(db))?.email ?? "";
  const protegidos = new Set(emailsValidos([...await emailsEquipaActiva(db), conta]));
  return { secretaria, formadores, protegidos, nomes };
}

/**
 * Deixa as partilhas pessoais de um item iguais às pretendidas: acrescenta as que faltam e tira as de quem
 * já não devia lá estar (formandos, formadores que saíram da turma, contas desactivadas). Não toca no dono,
 * nas partilhas herdadas da pasta de cima, nas de domínio/grupo/ligação nem nas contas protegidas.
 */
export async function acertarPartilhas(
  token: string,
  itemId: string,
  pretendidas: Map<string, PapelDrive>,
  protegidos: Set<string>,
) {
  const actuais = await permissoesDoItem(token, itemId);
  const ja = new Set<string>();
  for (const p of actuais) {
    const email = (p.emailAddress ?? "").trim().toLowerCase();
    if (p.type !== "user" || !email || p.role === "owner") continue;
    if (p.permissionDetails?.length && p.permissionDetails.every(d => d.inherited)) continue;
    const papel = pretendidas.get(email);
    if (papel && (p.role === papel || (papel === "reader" && protegidos.has(email)))) {
      ja.add(email);
      continue;
    }
    if (!papel && protegidos.has(email)) continue;
    // Papel errado (p.ex. editor antigo que agora só lê) ou pessoa que já não pertence: sai.
    await revogarPermissao(token, itemId, p.id).catch(() => undefined);
  }
  for (const [email, papel] of pretendidas) {
    if (ja.has(email)) continue;
    await partilharPasta(token, itemId, email, papel).catch(() => undefined);
  }
}

export async function prepararTurmaDrive(db: Db, input: {
  regime: "gold" | "fin";
  turmaId: number;
  nome: string;
  formador?: string;
  formadores?: string[];
  cronograma?: unknown;
}) {
  const token = await tokenDrive(db);
  if (!token) return { ok: false as const, reason: "drive" as const };
  const estrutura = await criarEstruturaDtp(db, input, token);
  if (!estrutura) return { ok: false as const, reason: "drive" as const };
  const pessoas = await acessosDaTurma(db, input);
  await acertarPartilhas(token, estrutura.turmaPastaId, new Map(pessoas.secretaria.map(e => [e, "writer" as const])), pessoas.protegidos);
  const materiaisId = estrutura.pastas[PASTA_MATERIAIS];
  if (materiaisId) {
    await acertarPartilhas(token, materiaisId, new Map(pessoas.formadores.map(e => [e, "reader" as const])), pessoas.protegidos);
  }
  await atalhosDosNomes(db, token, input.regime, input.turmaId, estrutura.formadoresId, pessoas.nomes);
  await marcarPartilhasSincronizadas(db, input.regime, input.turmaId);
  return { ok: true as const, ...estrutura };
}

/**
 * Acerta as partilhas das turmas que ainda não foram sincronizadas desde a mudança das regras (os formandos
 * deixaram de ser editores da pasta inteira). Uma turma de cada vez, até ao prazo: o cron diário continua
 * onde parou. Devolve quantas acertou e quantas faltam.
 */
export async function sincronizarPartilhasPendentes(db: Db, prazoMs: number) {
  const fim = Date.now() + prazoMs;
  let acertadas = 0;
  while (Date.now() < fim) {
    const t = await turmaComPartilhasPorAcertar(db);
    if (!t) break;
    const r = await prepararTurmaDrive(db, {
      regime: t.regime, turmaId: t.id, nome: t.nome, formador: t.formador,
      formadores: Array.isArray(t.formadores) ? t.formadores.map(String) : [], cronograma: t.cronograma,
    });
    if (!r.ok) break;
    acertadas++;
  }
  return { acertadas, porAcertar: await contarPartilhasPorAcertar(db) };
}

export async function garantirPastaPendente(db: Db, lead: { id: number; nome: string; apelido: string }) {
  const token = await tokenDrive(db);
  if (!token) return null;
  const gravada = await pastaDaPreinscricao(db, lead.id);
  const nome = nomePastaPessoa(lead.id, `${lead.nome} ${lead.apelido}`);
  const path = `${ZONA_PENDENTES} / ${nome}`;
  if (gravada?.drive_pasta_id) {
    return { pastaId: gravada.drive_pasta_id, parentId: gravada.drive_pasta_parent_id, path };
  }
  const root = await raizDoProjecto(db, token);
  const pendentes = await garantirPastaFilha(token, root, ZONA_PENDENTES);
  const pastaId = await garantirPastaFilha(token, pendentes, nome);
  await gravarPastaPendente(db, lead.id, pastaId, pendentes);
  return { pastaId, parentId: pendentes, path: `${ZONA_PENDENTES} / ${nome}` };
}

export async function moverPastaFormando(
  db: Db,
  leadId: number,
  regime: "gold" | "fin",
  turmaId: number,
) {
  const token = await tokenDrive(db);
  const row = await pastaDaPreinscricao(db, leadId);
  if (!row) return { moved: false as const };
  const turmaNome = String((await nomeDaTurma(db, regime, turmaId)) ?? `Turma ${turmaId}`);
  if (!token) return { moved: false as const, turma: turmaNome };
  const estrutura = await criarEstruturaDtp(db, { regime, turmaId, nome: turmaNome }, token);
  if (!estrutura?.formandosId) return { moved: false as const, turma: turmaNome };
  const pessoa = nomePastaPessoa(row.id, `${row.nome} ${row.apelido}`);
  const path = `${ZONA_TURMAS} / ${nomePastaPessoa(turmaId, turmaNome)} / ${PASTA_FORMANDOS} / ${pessoa}`;
  let pastaId = row.drive_pasta_id.trim();
  if (!pastaId) {
    pastaId = await garantirPastaFilha(token, estrutura.formandosId, pessoa);
  } else if (row.drive_pasta_parent_id !== estrutura.formandosId) {
    await moverPastaDrive(token, pastaId, estrutura.formandosId, row.drive_pasta_parent_id);
  }
  await gravarPastaNaTurma(db, leadId, pastaId, estrutura.formandosId, turmaId);
  await caminhosDosDocsDoLead(db, leadId, path, turmaNome);
  return { moved: true as const, turma: turmaNome, pastaId };
}

export async function garantirBolsaFormador(db: Db, nome: string) {
  const token = await tokenDrive(db);
  if (!token || !nome.trim()) return null;
  const formador = await formadorPorNome(db, nome.trim());
  if (formador?.drive_pasta_id) {
    return {
      pastaId: formador.drive_pasta_id,
      path: `${ZONA_BOLSA} / ${nomePastaPessoa(formador.id, formador.nome)}`,
      formadorId: formador.id,
    };
  }
  const root = await raizDoProjecto(db, token);
  const bolsa = await garantirPastaFilha(token, root, ZONA_BOLSA);
  const etiqueta = formador ? nomePastaPessoa(formador.id, formador.nome) : sanitizeFileName(nome.trim());
  const pastaId = await garantirPastaFilha(token, bolsa, etiqueta);
  if (formador) {
    await gravarPastaFormador(db, formador.id, pastaId);
  }
  return { pastaId, path: `${ZONA_BOLSA} / ${etiqueta}`, formadorId: formador?.id ?? 0 };
}

async function atalhosDeUmFormador(
  db: Db,
  token: string,
  formadorId: number,
  nome: string,
  regime: "gold" | "fin",
  turmaId: number,
  pastaFormadoresId: string,
) {
  const docs = await docsNaDriveDoFormador(db, formadorId);
  // Documento apagado ou substituído sem ficheiro na Drive: o atalho sai do dossiê desta turma.
  const orfaos = await atalhosOrfaos(db, formadorId, regime, turmaId, docs.map(d => d.doc_id));
  for (const o of orfaos) {
    if (o.shortcut_id) await apagarItemGoogle(token, o.shortcut_id).catch(() => undefined);
    await apagarAtalho(db, o.id);
  }
  for (const doc of docs) {
    const existente = await atalhoDoDoc(db, formadorId, regime, turmaId, doc.doc_id);
    if (existente?.shortcut_id && existente.drive_file_id === doc.local_id) continue;
    if (existente?.shortcut_id) {
      await apagarItemGoogle(token, existente.shortcut_id).catch(() => undefined);
    }
    const atalho = await criarAtalhoDrive(token, {
      name: `${nome} - ${doc.file_name || doc.doc_id}`,
      targetId: doc.drive_id,
      parentId: pastaFormadoresId,
    });
    await gravarAtalho(db, { formadorId, regime, turmaId, docId: doc.doc_id, driveFileId: doc.local_id, shortcutId: atalho.id });
  }
}

async function atalhosDosNomes(
  db: Db,
  token: string,
  regime: "gold" | "fin",
  turmaId: number,
  pastaFormadoresId: string,
  nomes: string[],
) {
  const unicos = [...new Set(nomes.map(n => n.trim()).filter(Boolean))];
  const rows = await formadoresPorNomes(db, unicos);
  // Só os formadores associados a esta turma têm atalhos no dossiê dela.
  await removerAtalhos(db, token, {
    regime, turmaId, manterFormadores: rows.map(f => Number(f.id)),
  });
  if (!pastaFormadoresId) return;
  for (const formador of rows) {
    await atalhosDeUmFormador(db, token, formador.id, formador.nome, regime, turmaId, pastaFormadoresId);
  }
}

export async function sincronizarAtalhosDoFormador(db: Db, formadorId: number) {
  const token = await tokenDrive(db);
  if (!token) return { ok: false as const };
  const nome = (await nomeDoFormador(db, formadorId))?.trim();
  if (!nome) return { ok: false as const };
  const todas = await turmasComEquipa(db);
  const meu = new Set([nome]);
  const turmas = todas.filter(t => turmaDoFormador(t, meu));
  const associadas = new Set(turmas.map(t => `${t.regime}:${t.id}`));
  // Turmas de onde saiu: os atalhos dele deixam de estar nesses dossiês.
  for (const a of await turmasComAtalhosDoFormador(db, formadorId)) {
    if (!associadas.has(`${a.regime}:${a.turma_id}`)) {
      await removerAtalhos(db, token, { regime: a.regime, turmaId: Number(a.turma_id), soFormador: formadorId });
    }
  }
  for (const turma of turmas) {
    const estrutura = await criarEstruturaDtp(db, { regime: turma.regime, turmaId: turma.id, nome: turma.nome }, token);
    if (!estrutura?.formadoresId) continue;
    await atalhosDeUmFormador(db, token, formadorId, nome, turma.regime, turma.id, estrutura.formadoresId);
  }
  return { ok: true as const, turmas: turmas.length };
}

/**
 * Apaga atalhos de formadores no dossiê de uma turma (registo e atalho na Drive):
 * - `manterFormadores`: apaga os de todos os outros formadores;
 * - `soFormador`: apaga só os deste formador;
 * - sem nenhum dos dois: apaga todos (turma apagada).
 */
export async function removerAtalhos(
  db: Db,
  token: string,
  opts: { regime: "gold" | "fin"; turmaId: number; manterFormadores?: number[]; soFormador?: number },
) {
  const rows = await atalhosDaTurma(db, opts.regime, opts.turmaId);
  const manter = opts.manterFormadores ? new Set(opts.manterFormadores) : null;
  for (const r of rows) {
    const fid = Number(r.formador_id);
    const apagar = opts.soFormador != null ? fid === opts.soFormador : manter ? !manter.has(fid) : true;
    if (!apagar) continue;
    if (token && r.shortcut_id) await apagarItemGoogle(token, r.shortcut_id).catch(() => undefined);
    await apagarAtalho(db, r.id);
  }
}

/** Turma apagada: os atalhos dos formadores saem com ela. */
export async function limparAtalhosDaTurma(db: Db, regime: "gold" | "fin", turmaId: number) {
  const token = await tokenDrive(db);
  await removerAtalhos(db, token ?? "", { regime, turmaId });
}

export function nomesNoCronograma(cronograma: unknown, extra: string[]) {
  const nomes = new Set(extra.map(n => n.trim()).filter(Boolean));
  const lista = Array.isArray(cronograma) ? cronograma : [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const row = item as { formadores?: unknown; formador?: unknown };
    if (Array.isArray(row.formadores)) {
      for (const n of row.formadores) if (typeof n === "string" && n.trim()) nomes.add(n.trim());
    } else if (typeof row.formador === "string" && row.formador.trim()) {
      nomes.add(row.formador.trim());
    }
  }
  return [...nomes];
}

/** Cria o dossiê da turma, acerta as partilhas (dá e retira) e liga os atalhos dos formadores. */
export const syncTurmaDriveAccess = prepararTurmaDrive;
