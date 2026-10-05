import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { COMPROVATIVO, docsCompletos, docsDoCurso, faltaValidarPreinscricao } from "./docsCurso.js";
import { documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { relocateDriveFile } from "./googleDrive.js";
import { sendMail } from "./mailer.js";
import { precoParaOferta } from "./precoOferta.js";
import { isEmail, normalizeEmail } from "./security.js";

export class PercursoErro extends Error {}

export type SessaoPublica = { data: string; inicio: string; fim: string };

export type TurmaPublica = {
  id: number;
  nome: string;
  local: string;
  horario: string;
  dataInicio: string;
  livres: number;
  sessoes: SessaoPublica[];
};

type TurmaRow = {
  id: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  data_inicio: string;
  ocupadas: number;
  vagas: number;
  estado: string;
  activa?: boolean;
  cronograma: unknown;
};

function norm(v: string) {
  return v.trim().toLowerCase();
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

function asList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sessoesDe(raw: unknown): SessaoPublica[] {
  const list = asList(raw);
  const out: SessaoPublica[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as { data?: unknown; horaInicio?: unknown; horaFim?: unknown };
    const data = isoData(String(s.data ?? ""));
    if (!data) continue;
    out.push({ data, inicio: String(s.horaInicio ?? ""), fim: String(s.horaFim ?? "") });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
}

function turmaActiva(regime: "gold" | "fin", row: TurmaRow) {
  if (regime === "fin") return row.activa !== false && row.estado !== "Inativa";
  return row.estado === "Ativa" || row.estado === "Ativo";
}

function mapTurma(row: TurmaRow): TurmaPublica {
  const livres = Math.max(0, Number(row.vagas) - Number(row.ocupadas));
  const futuras = sessoesDe(row.cronograma).filter(s => s.data >= hojeIso());
  return {
    id: Number(row.id),
    nome: row.nome,
    local: row.local,
    horario: row.horario,
    dataInicio: isoData(row.data_inicio) || row.data_inicio,
    livres,
    sessoes: (futuras.length ? futuras : sessoesDe(row.cronograma)).slice(0, 6),
  };
}

async function turmasRegime(db: Db, regime: "gold" | "fin", curso: string) {
  const table = regime === "fin" ? "turmas_fin" : "turmas_gold";
  const ocup = regime === "fin" ? "alunos" : "total_alunos";
  const vagas = regime === "fin" ? "alunos_total" : "vagas";
  const extra = regime === "fin" ? ", activa" : "";
  const rows = await db.query<TurmaRow>(
    `SELECT id, nome, curso, local, horario, data_inicio, ${ocup} AS ocupadas, ${vagas} AS vagas, estado, cronograma${extra}
       FROM ${table}
      WHERE lower(trim(curso)) = lower(trim($1))
      ORDER BY data_inicio`,
    [curso],
  );
  return rows.rows.filter(r => turmaActiva(regime, r)).map(mapTurma);
}

export async function turmasParaEscolha(db: Db, curso: string, regime: "gold" | "fin") {
  const hoje = hojeIso();
  const lista = (await turmasRegime(db, regime, curso)).filter(t => t.livres > 0);
  return lista.sort((a, b) => {
    const af = a.dataInicio >= hoje ? 0 : 1;
    const bf = b.dataInicio >= hoje ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome);
  });
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
    `SELECT id, nome, curso, local, horario, data_inicio, ${ocup} AS ocupadas, ${vagas} AS vagas, estado, cronograma${extra}
       FROM ${table} WHERE id = $1`,
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
    "SELECT id, curso, regime, validada_em FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0] as { id: number; curso: string; regime: string; validada_em: string | null } | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  const turma = await turmaPorId(db, regime, turmaId);
  if (!turma) throw new PercursoErro("Turma indisponível.");
  const oferecidas = await turmasParaEscolha(db, String(row.curso), regime);
  const escolhida = oferecidas.find(t => t.id === turmaId);
  if (!escolhida) throw new PercursoErro("Essa turma não tem vaga ou não é deste curso.");
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
    "SELECT id, curso, regime, preco, turma_escolhida_id, validada_em FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0] as {
    id: number; curso: string; regime: string; preco: number; turma_escolhida_id: number | null; validada_em: string | null;
  } | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  const pedidos = await docsDoCurso(db, row.curso, regime);
  const ficheiros = await listarDocsLead(db, leadId);
  const by = new Map(ficheiros.map(f => [f.tipo, f]));
  const obrigatorios = pedidos.filter(d => d.required);
  if (!obrigatorios.every(d => entregueAceite(by.get(d.id)?.estado))) {
    throw new PercursoErro("Ainda faltam documentos obrigatórios.");
  }
  if (!row.turma_escolhida_id) throw new PercursoErro("Escolha o cronograma antes de concluir.");
  const precisa = regime === "gold" && Number(row.preco) > 0;
  if (precisa && !entregueAceite(by.get(COMPROVATIVO.id)?.estado)) {
    throw new PercursoErro("O comprovativo de pagamento é obrigatório.");
  }
  await db.query(
    "UPDATE preinscricoes SET percurso_concluido_em = COALESCE(percurso_concluido_em, now()) WHERE id = $1",
    [leadId],
  );
  await evento(db, leadId, undefined, "Percurso de pré-inscrição concluído", "Aguarda validação da secretaria");
  return { ok: true as const };
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
  const pessoa = `${row.nome} ${row.apelido}`.trim();
  const docs = await listarDocsLead(db, leadId);
  let moved = 0;
  for (const doc of docs) {
    if (!doc.drive_file_id) continue;
    const ok = await relocateDriveFile(db, doc.drive_file_id, {
      regime, turmaId: turma.id, turmaNome: turma.nome, pessoa,
    });
    if (ok) moved += 1;
  }
  return { moved, turma: turma.nome };
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

export async function validarPreinscricao(db: Db, leadId: number, actorId?: string) {
  const lead = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const row = lead.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  const regime = regimeDe(row.regime);
  const pedidos = await docsDoCurso(db, String(row.curso ?? ""), regime);
  const ficheiros = await listarDocsLead(db, leadId);
  const turmaId = Number(row.turma_escolhida_id || 0);
  const turma = turmaId ? await turmaPorId(db, regime, turmaId) : null;
  const precisa = regime === "gold" && Number(row.preco) > 0;
  const falta = faltaValidarPreinscricao({
    validada: Boolean(row.validada_em),
    concluido: Boolean(row.percurso_concluido_em),
    turma,
    pedidos,
    ficheiros,
    precisaPagamento: precisa,
  });
  if (falta) throw new PercursoErro(falta);
  await db.query(
    `UPDATE preinscricoes
        SET validada_em = COALESCE(validada_em, now()),
            docs_fechado_em = COALESCE(docs_fechado_em, now()),
            recusa_motivo = ''
      WHERE id = $1`,
    [leadId],
  );
  const moved = await moverDocsDoLead(db, leadId, turmaId);
  await evento(db, leadId, actorId, "Pré-inscrição validada", moved.turma ? `Documentos em ${moved.turma}` : "");
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
  const curso = String(row.curso ?? "");
  const turmaId = Number(row.turma_escolhida_id || row.turma_id || 0);
  const turma = turmaId ? await turmaPorId(db, regime, turmaId) : null;
  const local = turma?.local || String(row.local ?? "");
  const horario = turma?.horario || String(row.horario ?? "");
  if (!local.trim()) throw new PercursoErro("Indique o local da pré-inscrição para sugerir outra turma.");
  const sugestoes = await sugestoesTurmaCheia(db, curso, regime, local, horario, turmaId);
  const token = await ensureDocsToken(db, leadId);
  const url = documentosUrl(token);
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
            turma_escolhida_id = NULL,
            percurso_concluido_em = NULL,
            docs_fechado_em = NULL
      WHERE id = $1 AND validada_em IS NULL`,
    [leadId],
  );
  await evento(db, leadId, actorId, "Sugestão por turma cheia", sugestoes.map(t => t.nome).join(", ") || "Sem turmas com vaga");
  return { ok: true as const, enviadas: sugestoes.length, turmas: sugestoes };
}

type Ficheiro = { id: number; tipo: string; nome: string; created_at: string; estado: string; observacao: string };

export async function vistaDocumentosPublica(db: Db, lead: Record<string, unknown>) {
  const id = Number(lead.id);
  const regime = regimeDe(lead.regime);
  const curso = String(lead.curso ?? "");
  const pedidos = await docsDoCurso(db, curso, regime);
  const docs = await listarDocsLead(db, id) as Ficheiro[];
  const { ok, emFalta } = docsCompletos(pedidos, docs.map(d => d.tipo));
  let pagamento: { entidade: string; referencia: string; valor: number; estado: string } | null = null;
  if (lead.pagamento_id) {
    const pag = await db.query("SELECT * FROM pagamentos WHERE id = $1", [String(lead.pagamento_id)]);
    const pagRow = pag.rows[0] as { referencia?: string; valor?: number; estado?: string } | undefined;
    if (pagRow) {
      const settings = await db.query("SELECT values FROM app_settings WHERE id = $1", ["gold"]);
      const values = settings.rows[0]?.values && typeof settings.rows[0].values === "object"
        ? settings.rows[0].values as Record<string, string> : {};
      const ref = String(pagRow.referencia ?? "");
      pagamento = {
        entidade: String(values["Entidade Multibanco"] ?? ""),
        referencia: ref.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") || ref,
        valor: Number(pagRow.valor) || 0,
        estado: String(pagRow.estado ?? "Pendente"),
      };
    }
  }
  const pagPago = Boolean(pagamento && /pago/i.test(pagamento.estado));
  const precisaPagamento = regime === "gold" && Number(lead.preco) > 0 && !pagPago;
  const by = new Map(docs.map(d => [d.tipo, d]));
  const obrigatoriosOk = pedidos.filter(d => d.required).every(d => entregueAceite(by.get(d.id)?.estado));
  const compOk = !precisaPagamento || entregueAceite(by.get(COMPROVATIVO.id)?.estado);
  const turmaId = Number(lead.turma_escolhida_id || 0);
  const turmas = await turmasParaEscolha(db, curso, regime);
  const turmaEscolhida = turmaId
    ? turmas.find(t => t.id === turmaId) ?? await turmaPorId(db, regime, turmaId)
    : null;
  const recusados = docs.filter(d => d.estado === "recusado");
  const encerrada = Boolean(lead.validada_em);
  const percursoConcluido = Boolean(lead.percurso_concluido_em) && obrigatoriosOk && Boolean(turmaEscolhida) && compOk && recusados.length === 0;
  let passo: 1 | 2 | 3 = 1;
  if (obrigatoriosOk && turmaEscolhida) passo = 3;
  else if (obrigatoriosOk) passo = 2;
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
    precisaPagamento,
    encerrada,
    correcao: !encerrada && recusados.length > 0,
    passo,
    percursoConcluido,
    turmas,
    turmaEscolhida,
  };
}
