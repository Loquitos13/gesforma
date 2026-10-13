import { InscricaoErro, garantirVaga, sqlReservas } from "./inscricao.js";
import { ingestEvent } from "./automations.js";
import { transferirDocsDoLead } from "./docsParaFormando.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { COMPROVATIVO, docsCompletos, docsDoCurso, faltaValidarPreinscricao, ficheiroModelo, situacaoPagamento } from "./docsCurso.js";
import { lerEntidade } from "./regrasConfig.js";
import { avisarDocumentosEmFalta, documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { idsRecusados } from "./lembretePre.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { moverPastaFormando } from "./driveArvore.js";
import { sendMail } from "./mailer.js";
import { modulosPorOrdem, sessoesPublicas } from "./cronogramaPublico.js";
import { precoParaOferta } from "./precoOferta.js";
import { isEmail, normalizeEmail } from "./security.js";

export class PercursoErro extends Error {}

export type SessaoPublica = {
  data: string;
  inicio: string;
  fim: string;
  modalidade: string;
  modulos: string[];
  formadores: string[];
};

export type PlanoPublico = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  modulos: string[];
  formadores: string[];
};

export type TurmaPublica = {
  id: number;
  nome: string;
  local: string;
  horario: string;
  dataInicio: string;
  livres: number;
  sessoes: SessaoPublica[];
  plano: PlanoPublico[];
};

export type PedidoTurma = { local?: string; horario?: string; inicio?: string };

type TurmaRow = {
  id: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  data_inicio: string;
  ocupadas: number;
  vagas: number;
  tolerancia?: number;
  estado: string;
  activa?: boolean;
  fechada_em?: unknown;
  cronograma: unknown;
};

function norm(v: string) {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pedidoUtil(v: string | undefined) {
  const n = norm(v ?? "");
  return Boolean(n) && n !== "-" && !n.startsWith("a definir") && !n.startsWith("por definir");
}

function servePedido(t: TurmaPublica, pedido?: PedidoTurma) {
  if (!pedido) return true;
  if (pedidoUtil(pedido.local) && norm(t.local) !== norm(pedido.local ?? "")) return false;
  if (pedidoUtil(pedido.horario) && norm(t.horario) !== norm(pedido.horario ?? "")) return false;
  const inicio = isoData(pedido.inicio ?? "");
  if (inicio && isoData(t.dataInicio) !== inicio) return false;
  return true;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoData(raw: string) {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return "";
}

function sessoesDe(raw: unknown): SessaoPublica[] {
  return sessoesPublicas(raw)
    .filter(s => s.modalidade !== "matricula" && s.data)
    .map(s => ({
      data: s.data,
      inicio: s.horaInicio,
      fim: s.horaFim,
      modalidade: s.modalidade,
      modulos: modulosPorOrdem(s.modulos),
      formadores: s.formadores,
    }));
}

function planoDe(raw: unknown): PlanoPublico[] {
  return sessoesPublicas(raw).map((s, i) => ({
    id: `p${i}`,
    data: s.data,
    horaInicio: s.horaInicio,
    horaFim: s.horaFim,
    modalidade: s.modalidade,
    modulos: modulosPorOrdem(s.modulos),
    formadores: s.formadores,
  }));
}

function turmaActiva(regime: "gold" | "fin", row: TurmaRow) {
  if (row.fechada_em) return false;
  if (regime === "fin") return row.activa !== false && row.estado !== "Inativa" && row.estado !== "Cancelada" && row.estado !== "Concluída";
  return row.estado === "Ativa" || row.estado === "Ativo";
}

/** Uma turma que já começou deixa de aparecer na escolha pública. */
function aindaNaoComecou(row: TurmaRow) {
  const inicio = isoData(String(row.data_inicio ?? ""));
  return !inicio || inicio >= hojeIso();
}

function mapTurma(row: TurmaRow): TurmaPublica {
  const limite = Number(row.vagas) + Math.max(0, Number(row.tolerancia) || 0);
  const livres = Math.max(0, limite - Number(row.ocupadas));
  return {
    id: Number(row.id),
    nome: row.nome,
    local: row.local,
    horario: row.horario,
    dataInicio: isoData(row.data_inicio) || row.data_inicio,
    livres,
    sessoes: sessoesDe(row.cronograma),
    plano: planoDe(row.cronograma),
  };
}

async function turmasRegime(db: Db, regime: "gold" | "fin", curso: string) {
  const table = regime === "fin" ? "turmas_fin" : "turmas_gold";
  const ocup = regime === "fin" ? "alunos" : "total_alunos";
  const vagas = regime === "fin" ? "alunos_total" : "vagas";
  const extra = regime === "fin" ? ", activa" : "";
  const rows = await db.query<TurmaRow>(
    `SELECT t.id, t.nome, t.curso, t.local, t.horario, t.data_inicio,
            t.${ocup} + ${sqlReservas(regime, "t.id")} AS ocupadas, t.${vagas} AS vagas,
            COALESCE(t.tolerancia_vagas, 0) AS tolerancia, t.estado, t.cronograma, t.fechada_em${extra ? ", t.activa" : ""}
       FROM ${table} t
      WHERE lower(trim(t.curso)) = lower(trim($1))
      ORDER BY t.data_inicio`,
    [curso],
  );
  return rows.rows.filter(r => turmaActiva(regime, r) && aindaNaoComecou(r)).map(mapTurma);
}

export async function turmasParaEscolha(db: Db, curso: string, regime: "gold" | "fin", pedido?: PedidoTurma) {
  const hoje = hojeIso();
  const lista = (await turmasRegime(db, regime, curso)).filter(t => t.livres > 0 && servePedido(t, pedido));
  return lista.sort((a, b) => {
    const af = a.dataInicio >= hoje ? 0 : 1;
    const bf = b.dataInicio >= hoje ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome);
  });
}

/** Outro horário, no mesmo curso e no mesmo local, com vagas restantes. */
export async function recomendacoesOutroHorario(
  db: Db,
  curso: string,
  regime: "gold" | "fin",
  pedido: PedidoTurma | undefined,
  exceptoIds: number[],
) {
  if (!pedidoUtil(pedido?.local) || !pedidoUtil(pedido?.horario)) return [];
  const hoje = hojeIso();
  const sitio = norm(pedido?.local ?? "");
  const hora = norm(pedido?.horario ?? "");
  const fora = new Set(exceptoIds);
  const vistos = new Set<string>();
  const lista = (await turmasRegime(db, regime, curso))
    .filter(t => t.livres > 0 && !fora.has(t.id) && norm(t.local) === sitio && t.dataInicio >= hoje)
    .filter(t => norm(t.horario) !== hora)
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome, "pt"));
  const out: TurmaPublica[] = [];
  for (const t of lista) {
    const chave = norm(t.horario);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}

/** Mesmo curso, local e horário, com início posterior ao pedido. */
export async function turmasParaBreve(
  db: Db,
  curso: string,
  regime: "gold" | "fin",
  pedido: PedidoTurma | undefined,
  exceptoIds: number[],
) {
  if (!pedidoUtil(pedido?.local) || !pedidoUtil(pedido?.horario)) return [];
  const hoje = hojeIso();
  const sitio = norm(pedido?.local ?? "");
  const hora = norm(pedido?.horario ?? "");
  const fora = new Set(exceptoIds);
  const inicio = isoData(pedido?.inicio ?? "");
  const lista = (await turmasRegime(db, regime, curso))
    .filter(t => t.livres > 0 && !fora.has(t.id) && norm(t.local) === sitio && norm(t.horario) === hora && t.dataInicio >= hoje)
    .filter(t => (inicio ? t.dataInicio > inicio : true))
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome, "pt"));
  return lista.slice(0, 3);
}

/** Próximas turmas do mesmo curso e do mesmo local, no mesmo horário ou noutro. */
export async function sugestoesTurmaCheia(
  db: Db,
  curso: string,
  regime: "gold" | "fin",
  local: string,
  horario: string,
  exceptoId = 0,
) {
  const hoje = hojeIso();
  const sitio = norm(local);
  const hora = norm(horario);
  return (await turmasRegime(db, regime, curso))
    .filter(t => t.id !== exceptoId && t.livres > 0 && norm(t.local) === sitio && t.dataInicio >= hoje)
    .sort((a, b) => {
      const ah = norm(a.horario) === hora ? 0 : 1;
      const bh = norm(b.horario) === hora ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.dataInicio.localeCompare(b.dataInicio);
    });
}

async function turmaPorId(db: Db, regime: "gold" | "fin", id: number) {
  const table = regime === "fin" ? "turmas_fin" : "turmas_gold";
  const ocup = regime === "fin" ? "alunos" : "total_alunos";
  const vagas = regime === "fin" ? "alunos_total" : "vagas";
  const extra = regime === "fin" ? ", activa" : "";
  const row = await db.query<TurmaRow>(
    `SELECT t.id, t.nome, t.curso, t.local, t.horario, t.data_inicio,
            t.${ocup} + ${sqlReservas(regime, "t.id")} AS ocupadas, t.${vagas} AS vagas,
            COALESCE(t.tolerancia_vagas, 0) AS tolerancia, t.estado, t.cronograma, t.fechada_em${extra ? ", t.activa" : ""}
       FROM ${table} t WHERE t.id = $1`,
    [id],
  );
  const found = row.rows[0];
  if (!found || !turmaActiva(regime, found)) return null;
  return mapTurma(found);
}

function regimeDe(raw: unknown): "gold" | "fin" {
  return String(raw ?? "") === "fin" ? "fin" : "gold";
}

async function evento(db: Db, leadId: number, actorId: string | undefined, titulo: string, detalhe = "") {
  await db.query(
    "INSERT INTO lead_eventos (lead_id, actor_id, tipo, titulo, detalhe) VALUES ($1,$2,'campo',$3,$4)",
    [leadId, actorId ?? null, titulo.slice(0, 160), detalhe.slice(0, 2000)],
  );
}

export async function escolherTurmaPublica(db: Db, leadId: number, turmaId: number) {
  const lead = await db.query(
    "SELECT id, curso, regime, validada_em, local, horario, inicio_curso, turmas_recusadas FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0] as {
    id: number; curso: string; regime: string; validada_em: string | null;
    local?: string; horario?: string; inicio_curso?: string; turmas_recusadas?: unknown;
  } | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  if (regime === "fin") throw new PercursoErro("Na formação financiada a turma é atribuída pela secretaria.");
  const turma = await turmaPorId(db, regime, turmaId);
  if (!turma) throw new PercursoErro("Turma indisponível.");
  const pedido = {
    local: String(row.local ?? ""),
    horario: String(row.horario ?? ""),
    inicio: String(row.inicio_curso ?? ""),
  };
  const oferecidas = await turmasParaEscolha(db, String(row.curso), regime, pedido);
  const recomendadas = await recomendacoesOutroHorario(db, String(row.curso), regime, pedido, oferecidas.map(t => t.id));
  const breves = await turmasParaBreve(db, String(row.curso), regime, pedido, [...oferecidas, ...recomendadas].map(t => t.id));
  const recusadas = new Set(idsRecusados(row.turmas_recusadas));
  if (recusadas.has(turmaId)) throw new PercursoErro("Essa turma foi dada como cheia pela secretaria. Escolha outra.");
  const escolhida = oferecidas.find(t => t.id === turmaId)
    ?? recomendadas.find(t => t.id === turmaId)
    ?? breves.find(t => t.id === turmaId);
  if (!escolhida || recusadas.has(escolhida.id)) throw new PercursoErro("Essa turma não tem vaga ou não é deste curso.");
  const preco = regime === "gold" ? await precoParaOferta(db, String(row.curso), escolhida.local, escolhida.horario) : null;
  await db.query(
    `UPDATE preinscricoes SET
       turma_escolhida_id = $2,
       turma_id = $2,
       local = $3,
       horario = $4,
       inicio_curso = $5,
       preco = COALESCE($6, preco)
     WHERE id = $1`,
    [leadId, escolhida.id, escolhida.local, escolhida.horario, escolhida.dataInicio, preco],
  );
  await evento(db, leadId, undefined, "Cronograma escolhido", `${escolhida.nome} · ${escolhida.local} · ${escolhida.horario}`);
  return escolhida;
}

function entregueAceite(estado: string | undefined) {
  return Boolean(estado) && estado !== "recusado";
}

export async function concluirPercurso(db: Db, leadId: number) {
  const lead = await db.query(
    "SELECT id, curso, regime, preco, pagamento_id, turma_escolhida_id, validada_em, percurso_concluido_em FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0] as {
    id: number; curso: string; regime: string; preco: number; pagamento_id: string | null; turma_escolhida_id: number | null;
    validada_em: string | null; percurso_concluido_em: string | null;
  } | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  // Concluir o percurso é documentos + turma; o pagamento vem depois, pedido pela secretaria.
  const pedidos = await docsDoCurso(db, row.curso, regime);
  const ficheiros = await listarDocsLead(db, leadId);
  const by = new Map(ficheiros.map(f => [f.tipo, f]));
  const emFalta = pedidos.filter(d => d.required && !entregueAceite(by.get(d.id)?.estado)).map(d => {
    const ficheiro = by.get(d.id);
    return {
      label: d.label,
      recusado: ficheiro?.estado === "recusado",
      observacao: ficheiro?.observacao ?? "",
    };
  });
  if (!row.turma_escolhida_id && regime !== "fin") throw new PercursoErro("Escolha o cronograma antes de concluir.");
  const jaConcluido = Boolean(row.percurso_concluido_em);
  if (!jaConcluido) {
    await db.query(
      "UPDATE preinscricoes SET percurso_concluido_em = now() WHERE id = $1",
      [leadId],
    );
    let avisou = false;
    if (emFalta.length) {
      const aviso = await avisarDocumentosEmFalta(db, leadId, emFalta).catch(() => null);
      avisou = Boolean(aviso && "enviado" in aviso && aviso.enviado);
    }
    await evento(
      db,
      leadId,
      undefined,
      "Percurso de pré-inscrição concluído",
      avisou ? "Aguarda validação. Email com os documentos em falta." : "Aguarda validação da secretaria",
    );
  }
  return { ok: true as const, emFalta: emFalta.filter(d => !d.recusado).map(d => d.label) };
}

export async function moverDocsDoLead(db: Db, leadId: number, turmaId: number) {
  const lead = await db.query(
    "SELECT id, nome, apelido, regime, curso FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0] as { id: number; nome: string; apelido: string; regime: string; curso: string } | undefined;
  if (!row) return { moved: 0 };
  const regime = regimeDe(row.regime);
  const turma = await turmaPorId(db, regime, turmaId);
  if (!turma) return { moved: 0 };
  const validada = await db.query<{ validada_em: string | null }>(
    "SELECT validada_em FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  if (!validada.rows[0]?.validada_em) return { moved: 0, turma: turma.nome };
  const r = await moverPastaFormando(db, leadId, regime, turma.id);
  return { moved: r.moved ? 1 : 0, turma: r.turma || turma.nome };
}

export async function moverDocsParaTurma(db: Db, input: {
  email: string;
  turmaId: number;
  curso?: string;
  regime: "gold" | "fin";
}) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { moved: 0 };
  const leads = await db.query<{ id: number; curso: string }>(
    "SELECT id, curso FROM preinscricoes WHERE email <> '' AND lower(email) = $1 AND COALESCE(regime, 'gold') = $2",
    [email, input.regime],
  );
  let moved = 0;
  for (const lead of leads.rows) {
    if (input.curso && norm(lead.curso) !== norm(input.curso)) continue;
    const r = await moverDocsDoLead(db, lead.id, input.turmaId);
    moved += r.moved;
    await db.query(
      "UPDATE preinscricoes SET turma_id = $2, turma_escolhida_id = $2 WHERE id = $1",
      [lead.id, input.turmaId],
    );
  }
  return { moved };
}

export async function validarPreinscricao(db: Db, leadId: number, actorId?: string, turmaDestinoId?: number) {
  const lead = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const row = lead.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  const regime = regimeDe(row.regime);
  const pedidos = await docsDoCurso(db, String(row.curso ?? ""), regime);
  const ficheiros = await listarDocsLead(db, leadId);
  let turmaId = Number(row.turma_escolhida_id || 0);
  const transferir = Boolean(turmaDestinoId && turmaDestinoId !== turmaId);
  if (transferir && turmaDestinoId) {
    const table = regime === "fin" ? "turmas_fin" : "turmas_gold";
    const destinoCurso = await db.query<{ curso: string }>(`SELECT curso FROM ${table} WHERE id = $1`, [turmaDestinoId]);
    const cursoDestino = String(destinoCurso.rows[0]?.curso ?? "");
    if (!cursoDestino || norm(cursoDestino) !== norm(String(row.curso ?? ""))) {
      throw new PercursoErro("A turma de destino é de outro curso.");
    }
    turmaId = turmaDestinoId;
  }
  const turma = turmaId ? await turmaPorId(db, regime, turmaId) : null;
  const falta = faltaValidarPreinscricao({
    validada: Boolean(row.validada_em),
    concluido: Boolean(row.percurso_concluido_em),
    turma,
    pedidos,
    ficheiros,
    pagamento: (await situacaoPagamento(db, row)).estado,
    turmaPelaSecretaria: regime === "fin",
  });
  if (falta) throw new PercursoErro(falta);
  if (regime === "fin" && !turmaId) throw new PercursoErro("Escolha a turma onde colocar o formando.");
  if (regime === "fin" && turma && turma.livres <= 0) throw new PercursoErro("A turma escolhida está cheia.");
  if (turmaId) {
    // Financiada: a validação cria a ficha. Gold: a validação reserva a vaga até a secretaria inscrever.
    const email = normalizeEmail(String(row.email ?? ""));
    const existente = email
      ? await db.query<{ id: number }>(`SELECT id FROM ${regime === "fin" ? "formandos_fin" : "formandos_gold"} WHERE email <> '' AND lower(trim(email)) = $1 AND turma_id = $2 ORDER BY id DESC LIMIT 1`, [email, turmaId])
      : { rows: [] as { id: number }[] };
    try {
      await db.tx(q => garantirVaga(q, regime, turmaId, { email, excluirFormandoId: existente.rows[0]?.id }));
    } catch (err) {
      if (err instanceof InscricaoErro) throw new PercursoErro(err.message);
      throw err;
    }
  }
  let moved: { moved: number; turma?: string };
  try {
    const pasta = await moverPastaFormando(db, leadId, regime, turmaId);
    moved = { moved: pasta.moved ? 1 : 0, turma: pasta.turma };
  } catch (err) {
    throw new PercursoErro(err instanceof Error ? err.message : "Não foi possível mover a pasta na Drive.");
  }
  if (transferir) {
    await db.query(
      "UPDATE preinscricoes SET turma_escolhida_id = $2, turma_id = $2 WHERE id = $1",
      [leadId, turmaId],
    );
  }
  await db.query(
    `UPDATE preinscricoes
        SET validada_em = COALESCE(validada_em, now()),
            docs_fechado_em = COALESCE(docs_fechado_em, now()),
            recusa_motivo = ''
      WHERE id = $1`,
    [leadId],
  );
  await evento(db, leadId, actorId, "Pré-inscrição validada", moved.turma ? `Pasta do formando em ${moved.turma}` : "");
  const emailValidado = normalizeEmail(String(row.email ?? ""));
  if (isEmail(emailValidado)) {
    await ingestEvent(db, "preinscricao.validated", {
      email: emailValidado,
      nome: `${row.nome ?? ""} ${row.apelido ?? ""}`.trim(),
      curso: String(row.curso ?? ""),
      turma: turma?.nome ?? moved.turma ?? "-",
      preinscricaoId: leadId,
    }, `validated:${leadId}`).catch(() => undefined);
  }
  if (regime === "gold") {
    // Se a secretaria já tinha criado a ficha numa turma deste curso, liga-a agora (e os documentos passam).
    const email = normalizeEmail(String(row.email ?? ""));
    const ficha = isEmail(email)
      ? await db.query<{ id: number }>(
        `SELECT f.id FROM formandos_gold f JOIN turmas_gold t ON t.id = f.turma_id
          WHERE lower(f.email) = $1 AND lower(trim(t.curso)) = lower(trim($2)) ORDER BY f.id DESC LIMIT 1`,
        [email, String(row.curso ?? "")],
      )
      : { rows: [] as { id: number }[] };
    if (ficha.rows[0]) await ligarPreinscricaoAoFormandoGold(db, Number(ficha.rows[0].id), actorId).catch(() => undefined);
  }
  if (regime === "fin") {
    const { upsertFormandoFinFromLead } = await import("./finPipeline.js");
    const ficha = await upsertFormandoFinFromLead(db, leadId, actorId).catch(err => {
      console.warn(`[percurso] ficha financiada do lead ${leadId} não criada:`, err instanceof Error ? err.message : err);
      return null;
    });
    // Financiada (sem pagamento): a conta da área do formando e o email de acesso saem com a validação.
    if (ficha?.formandoId) {
      const { darAcessoAoFormando } = await import("./inscricaoPaga.js");
      const acesso = await darAcessoAoFormando(db, "fin", Number(ficha.formandoId), String(row.curso ?? ""), false)
        .catch(err => ({ enviado: false as const, erro: err instanceof Error ? err.message : "erro" }));
      await evento(db, leadId, actorId, "Acesso à área do formando", acesso.enviado ? "Enviado por email." : `Não enviado: ${acesso.erro}`);
    }
  }
  return { ok: true as const, moved: moved.moved };
}

function fmtData(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export async function enviarSugestaoTurmaCheia(db: Db, leadId: number, actorId?: string) {
  const lead = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const row = lead.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A pré-inscrição já foi validada.");
  const email = normalizeEmail(String(row.email ?? ""));
  if (!isEmail(email)) throw new PercursoErro("A ficha não tem email.");
  const regime = regimeDe(row.regime);
  if (regime === "fin") throw new PercursoErro("Na formação financiada a secretaria escolhe outra turma ao validar.");
  const curso = String(row.curso ?? "");
  const turmaId = Number(row.turma_escolhida_id || row.turma_id || 0);
  const turma = turmaId ? await turmaPorId(db, regime, turmaId) : null;
  const local = turma?.local || String(row.local ?? "");
  const horario = turma?.horario || String(row.horario ?? "");
  if (!local.trim()) throw new PercursoErro("Indique o local da pré-inscrição para sugerir outra turma.");
  const jaRecusadas = new Set(idsRecusados(row.turmas_recusadas));
  const sugestoes = (await sugestoesTurmaCheia(db, curso, regime, local, horario, turmaId))
    .filter(t => !jaRecusadas.has(t.id));
  const token = await ensureDocsToken(db, leadId);
  const url = `${documentosUrl(token)}?passo=cronograma`;
  const nome = `${row.nome ?? ""} ${row.apelido ?? ""}`.trim();
  const linhas = [
    `A turma de ${curso} em ${local} já não tem vaga.`,
    sugestoes.length
      ? "Estas são as próximas turmas do mesmo curso, no mesmo local, no mesmo horário ou noutro horário:"
      : "Neste momento não há outra turma com vaga nesse local. A secretaria avisa quando abrir uma data.",
    ...sugestoes.map(t => `${t.nome} · ${t.horario} · início ${fmtData(t.dataInicio)} · ${t.livres} vaga${t.livres === 1 ? "" : "s"}`),
    "A ligação pessoal continua aberta para escolher outro cronograma.",
  ];
  const mail = renderAutomaticEmail({
    nome,
    xml: "",
    linhas,
    cta: "Escolher outro cronograma",
    href: url,
    vars: { nome, curso, documentos_url: url },
    origin: config.appOrigin,
  });
  await sendMail(db, {
    to: email,
    name: nome,
    subject: `Turma cheia · outras datas de ${curso}`,
    text: mail.text,
    html: mail.html,
  });
  await db.query(
    `UPDATE preinscricoes
        SET recusa_motivo = 'Turma cheia',
            turmas_recusadas = CASE WHEN $2 > 0 THEN (
              SELECT COALESCE(array_agg(DISTINCT n), '{}'::int[])
                FROM unnest(COALESCE(turmas_recusadas, '{}'::int[]) || ARRAY[$2]::int[]) AS n
               WHERE n > 0
            ) ELSE turmas_recusadas END,
            turma_escolhida_id = NULL,
            turma_id = CASE WHEN turma_id = $2 THEN NULL ELSE turma_id END,
            percurso_concluido_em = NULL,
            docs_fechado_em = NULL,
            lembrete_pre_em = now()
      WHERE id = $1 AND validada_em IS NULL`,
    [leadId, turmaId],
  );
  await evento(db, leadId, actorId, "Sugestão por turma cheia", sugestoes.map(t => t.nome).join(", ") || "Sem turmas com vaga");
  return { ok: true as const, enviadas: sugestoes.length, turmas: sugestoes };
}

type Ficheiro = { id: number; tipo: string; nome: string; created_at: string; estado: string; observacao: string };

export async function vistaDocumentosPublica(db: Db, lead: Record<string, unknown>) {
  const id = Number(lead.id);
  const regime = regimeDe(lead.regime);
  const curso = String(lead.curso ?? "");
  const pag = await situacaoPagamento(db, lead);
  const pedidos = await docsDoCurso(db, curso, regime);
  const docs = await listarDocsLead(db, id) as Ficheiro[];
  const { ok, emFalta } = docsCompletos(pedidos, docs.map(d => d.tipo));
  // O passo de pagamento só abre depois de a secretaria validar os documentos e pedir o pagamento.
  let pagamento: { valor: number; estado: string; iban: string; titular: string; comprovativo: Ficheiro | null } | null = null;
  if ((pag.estado === "pedido" || pag.estado === "pago") && lead.pagamento_id) {
    const r = await db.query<{ valor: number; estado: string }>("SELECT valor, estado FROM pagamentos WHERE id = $1", [String(lead.pagamento_id)]);
    const ent = await lerEntidade(db);
    pagamento = {
      valor: Number(r.rows[0]?.valor ?? lead.preco) || 0,
      estado: String(r.rows[0]?.estado ?? "Pendente"),
      iban: ent.iban.replace(/(.{4})/g, "$1 ").trim(),
      titular: ent.titularConta || ent.nome,
      comprovativo: docs.find(d => d.tipo === COMPROVATIVO.id) ?? null,
    };
  }
  const turmaId = Number(lead.turma_escolhida_id || 0);
  const criterios = {
    local: String(lead.local ?? ""),
    horario: String(lead.horario ?? ""),
    inicio: String(lead.inicio_curso ?? ""),
  };
  const recusadas = new Set(idsRecusados(lead.turmas_recusadas));
  // Financiada: a pessoa só envia documentos; a turma é atribuída pela secretaria.
  const escolheTurma = regime !== "fin";
  const turmas = escolheTurma ? (await turmasParaEscolha(db, curso, regime, criterios)).filter(t => !recusadas.has(t.id)) : [];
  const recomendadas = escolheTurma ? (await recomendacoesOutroHorario(db, curso, regime, criterios, turmas.map(t => t.id))).filter(t => !recusadas.has(t.id)) : [];
  const breves = escolheTurma ? (await turmasParaBreve(db, curso, regime, criterios, [...turmas, ...recomendadas].map(t => t.id))).filter(t => !recusadas.has(t.id)) : [];
  const turmaBruta = turmaId && !recusadas.has(turmaId)
    ? turmas.find(t => t.id === turmaId) ?? await turmaPorId(db, regime, turmaId)
    : null;
  const turmaEscolhida = turmaBruta && recusadas.has(turmaBruta.id) ? null : turmaBruta;
  const recusados = docs.filter(d => d.estado === "recusado" && d.tipo !== COMPROVATIVO.id);
  const encerrada = Boolean(lead.validada_em);
  const percursoConcluido = Boolean(lead.percurso_concluido_em) && (Boolean(turmaEscolhida) || !escolheTurma) && recusados.length === 0;
  let passo: 1 | 2 = 1;
  if (turmaEscolhida) passo = 2;
  return {
    nome: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim(),
    curso,
    preco: Number(lead.preco) || 0,
    tipos: pedidos,
    ficheiros: docs.map(d => ({
      id: d.id, tipo: d.tipo, nome: d.nome, created_at: d.created_at,
      estado: d.estado, observacao: d.observacao,
    })),
    docsCompletos: ok,
    emFalta: emFalta.map(d => d.label),
    pagamento,
    /** Passo de pagamento aberto: a secretaria pediu o pagamento e ainda não está confirmado. */
    precisaPagamento: pag.estado === "pedido",
    pago: pag.pago,
    encerrada,
    correcao: !encerrada && recusados.length > 0,
    passo,
    percursoConcluido,
    escolheTurma,
    turmas,
    recomendadas,
    breves,
    turmaEscolhida,
    turmaCheia: recusadas.size > 0 && !turmaEscolhida,
    criterios: {
      local: pedidoUtil(criterios.local) ? criterios.local : "",
      horario: pedidoUtil(criterios.horario) ? criterios.horario : "",
      inicio: isoData(criterios.inicio),
    },
  };
}

export async function registarConsentimento(db: Db, leadId: number, tipo: string, meta: { ip?: string } = {}) {
  const lead = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const row = lead.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  const pedidos = await docsDoCurso(db, String(row.curso ?? ""), regime);
  const pedido = pedidos.find(p => p.id === tipo && p.modelo);
  if (!pedido) throw new PercursoErro("Este documento não está preparado para consentimento.");
  const ja = await db.query<{ estado: string }>(
    "SELECT COALESCE(estado, 'pendente') AS estado FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2",
    [leadId, tipo],
  );
  if (ja.rows.some(r => r.estado === "validado")) throw new PercursoErro("Este documento já foi validado pela secretaria.");
  // Prova do consentimento: quando, de onde e que versão do modelo (ficheiro da secretaria) foi aceite.
  const modelo = await ficheiroModelo(db, regime, String(row.curso ?? ""), tipo);
  const versao = modelo ? `${modelo.nome} · ${modelo.driveFileId}` : pedido.modelo ?? "";
  await db.query("DELETE FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo]);
  await db.query(
    `INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, drive_file_id, drive_url, consentimento_ip, consentimento_modelo)
     VALUES ($1,$2,$3,'','',$4,$5)`,
    [leadId, tipo, `Consentimento · ${pedido.label}`, (meta.ip ?? "").slice(0, 64), versao.slice(0, 300)],
  );
  await evento(db, leadId, undefined, "Consentimento", `${pedido.label}${versao ? ` · modelo ${versao}` : ""}${meta.ip ? ` · IP ${meta.ip}` : ""}`);
  return { ok: true as const, nome: pedido.label };
}

/**
 * Gold (validação manual): quando a secretaria cria a ficha do formando, liga-a à pré-inscrição
 * validada do mesmo email e curso — o lead passa a «Formando», o pagamento fica associado e
 * os documentos validados passam para o dossiê. A reserva da vaga deixa de contar.
 */
export async function ligarPreinscricaoAoFormandoGold(db: Db, formandoId: number, actorId?: string) {
  // Só um formando colocado numa turma conta: o curso é o da turma.
  const f = await db.query<{ email: string; curso: string; turma_id: number | null }>(
    `SELECT f.email, t.curso, f.turma_id FROM formandos_gold f
       JOIN turmas_gold t ON t.id = f.turma_id
      WHERE f.id = $1`,
    [formandoId],
  );
  const formando = f.rows[0];
  const email = normalizeEmail(formando?.email ?? "");
  if (!formando || formando.turma_id == null || !isEmail(email)) return null;
  const lead = await db.query<{ id: number; pagamento_id: string | null; turma_escolhida_id: number | null }>(
    `SELECT id, pagamento_id, turma_escolhida_id FROM preinscricoes
      WHERE lower(email) = $1 AND lower(trim(curso)) = lower(trim($2))
        AND COALESCE(regime, 'gold') = 'gold' AND validada_em IS NOT NULL AND estado <> 'Desistiu'
      ORDER BY validada_em DESC LIMIT 1`,
    [email, formando.curso],
  );
  const row = lead.rows[0];
  if (!row) return null;
  await db.query(
    `UPDATE preinscricoes SET estado = 'Formando', ultima_actividade_em = now(),
       turma_id = COALESCE($2, turma_id), turma_escolhida_id = COALESCE($2, turma_escolhida_id)
     WHERE id = $1`,
    [row.id, formando.turma_id],
  );
  // Os ficheiros da ligação pessoal vivem no dossiê da turma onde a pessoa ficou mesmo inscrita.
  if (Number(row.turma_escolhida_id) !== Number(formando.turma_id)) {
    await moverPastaFormando(db, row.id, "gold", formando.turma_id).catch(() => undefined);
  }
  if (row.pagamento_id) {
    const pag = await db.query<{ estado: string; metodo: string }>(
      "UPDATE pagamentos SET formando_id = $2, turma_id = $3 WHERE id = $1 RETURNING estado, metodo",
      [row.pagamento_id, formandoId, formando.turma_id],
    );
    if (/^pago$/i.test(pag.rows[0]?.estado ?? "")) {
      await db.query(
        "UPDATE formandos_gold SET pago = true, metodo = CASE WHEN metodo IN ('-', '') THEN $2 ELSE metodo END WHERE id = $1",
        [formandoId, pag.rows[0]?.metodo || "Multibanco"],
      );
    }
  }
  await transferirDocsDoLead(db, row.id, actorId);
  await evento(db, row.id, actorId, "Inscrito na turma", `Ficha de formando #${formandoId}`);
  return { leadId: row.id };
}

