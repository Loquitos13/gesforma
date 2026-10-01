import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { docsCompletos, docsDoCurso, type DocPedido } from "./docsCurso.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { listarDocsLead, type DocLead } from "./docsLink.js";
import { sendMail } from "./mailer.js";
import { nextOpsId } from "./ops.js";
import { ensurePagamentoPendente } from "./pagamentoPedido.js";
import { isEmail, normalizeEmail } from "./security.js";

export type SessaoPercurso = {
  data: string;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  modalidade: string;
};

export type TurmaPercurso = {
  id: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  inscritos: number;
  vagas: number;
  extra: number;
  activa: boolean;
  cronograma: SessaoPercurso[];
};

export type LeadPercurso = {
  id: number;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  curso: string;
  local: string;
  horario: string;
  preco: number;
  regime: "gold" | "fin";
  percursoTurmaId: number | null;
  percursoConcluido: boolean;
  pagamentoId: string;
};

export function chaveOferta(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[./_,;:()]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chaveHorario(s: string) {
  const k = chaveOferta(s);
  if (!k) return "";
  if (/^pos[- ]?laboral$/.test(k)) return "pos laboral";
  if (/^laboral\s*manha$/.test(k)) return "laboral manha";
  if (/^laboral\s*tarde$/.test(k)) return "laboral tarde";
  if (/^sabado\s*manha$/.test(k)) return "sabado manha";
  return k;
}

export function chaveLocal(s: string) {
  return chaveOferta(s)
    .replace(/\bvila nova de gaia\b/g, "vn gaia")
    .replace(/\bv n gaia\b/g, "vn gaia")
    .replace(/\bvngaia\b/g, "vn gaia");
}

export function partirLocalHorario(local: string, horario?: string) {
  const loc = local.trim();
  const hor = (horario ?? "").trim();
  const m = loc.match(/^(.*?)\s*[-–—]\s*(.+)$/);
  if (m && chaveHorario(m[2])) {
    return { local: m[1].trim(), horario: hor || m[2].trim() };
  }
  return { local: loc, horario: hor };
}

export function locaisEquivalentes(a: string, b: string) {
  const x = chaveLocal(a);
  const y = chaveLocal(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  if (curto.length < 8) return false;
  return longo.includes(curto);
}

export function hojeIso(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

export function parseCronograma(raw: unknown): SessaoPercurso[] {
  return asArr(raw).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const s = item as Record<string, unknown>;
    const data = String(s.data ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return [];
    const modulos = Array.isArray(s.modulos) ? s.modulos.map(m => String(m)) : s.modulo ? [String(s.modulo)] : [];
    return [{
      data,
      horaInicio: String(s.horaInicio ?? s.hora_inicio ?? ""),
      horaFim: String(s.horaFim ?? s.hora_fim ?? ""),
      modulos,
      modalidade: String(s.modalidade ?? "presencial"),
    }];
  });
}

function sessaoJaComecou(data: string, hora: string, agora: Date) {
  const hoje = hojeIso(agora);
  if (data > hoje) return false;
  if (data < hoje) return true;
  const [h, m] = (hora || "00:00").split(":").map(Number);
  const inicio = new Date(agora);
  inicio.setHours(h || 0, m || 0, 0, 0);
  return agora.getTime() >= inicio.getTime();
}

export function turmaCompativelComLead(
  lead: { curso: string; local: string; horario: string },
  turma: { curso: string; local: string; horario: string },
) {
  if (chaveOferta(lead.curso) !== chaveOferta(turma.curso)) return false;
  const partido = partirLocalHorario(lead.local, lead.horario);
  if (!locaisEquivalentes(partido.local, turma.local)) return false;
  const hLead = chaveHorario(partido.horario);
  if (!hLead) return false;
  return hLead === chaveHorario(turma.horario);
}

export function turmaAbertaNoPercurso(turma: TurmaPercurso, agora = new Date(), opts?: { ignorarLotacao?: boolean }) {
  if (!turma.activa) return false;
  const limite = turma.vagas + Math.max(0, turma.extra);
  if (!opts?.ignorarLotacao && turma.inscritos >= limite) return false;
  const lectivas = turma.cronograma.filter(s => s.modalidade !== "matricula" && s.modalidade !== "avaliacao");
  if (lectivas.length) {
    const primeira = lectivas.slice().sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))[0];
    if (primeira && sessaoJaComecou(primeira.data, primeira.horaInicio, agora)) return false;
  } else if (turma.dataInicio && turma.dataInicio <= hojeIso(agora)) {
    return false;
  }
  const matricula = turma.cronograma.find(s => s.modalidade === "matricula")?.data;
  if (matricula && matricula < hojeIso(agora)) return false;
  return true;
}

export function precisaPagamento(lead: { regime: "gold" | "fin"; preco: number }) {
  return lead.regime === "gold" && Number(lead.preco) > 0;
}

export function docsDoPercursoProntos(pedidos: DocPedido[], ficheiros: { tipo: string; estado: string }[]) {
  const required = pedidos.filter(d => d.required);
  const porTipo = new Map(ficheiros.map(f => [f.tipo, f]));
  const emFalta = required.filter(d => {
    const f = porTipo.get(d.id);
    return !f || f.estado === "recusado";
  });
  return { ok: emFalta.length === 0, emFalta };
}

export function comprovativoPronto(ficheiros: { tipo: string; estado: string }[]) {
  const f = ficheiros.find(d => d.tipo === "comprovativo");
  return Boolean(f && f.estado !== "recusado");
}

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function mapLeadPercurso(row: Record<string, unknown>): LeadPercurso {
  return {
    id: num(row.id),
    nome: String(row.nome ?? ""),
    apelido: String(row.apelido ?? ""),
    email: String(row.email ?? ""),
    telf: String(row.telf ?? ""),
    curso: String(row.curso ?? ""),
    local: String(row.local ?? ""),
    horario: String(row.horario ?? ""),
    preco: num(row.preco),
    regime: String(row.regime ?? "gold") === "fin" ? "fin" : "gold",
    percursoTurmaId: row.percurso_turma_id == null || row.percurso_turma_id === "" ? null : num(row.percurso_turma_id),
    percursoConcluido: Boolean(row.percurso_concluido_em),
    pagamentoId: String(row.pagamento_id ?? ""),
  };
}

function mapTurmaRow(row: Record<string, unknown>, regime: "gold" | "fin"): TurmaPercurso {
  const fin = regime === "fin";
  return {
    id: num(row.id),
    nome: String(row.nome ?? ""),
    curso: String(row.curso ?? ""),
    local: String(row.local ?? ""),
    horario: String(row.horario ?? ""),
    dataInicio: String(row.data_inicio ?? "").slice(0, 10),
    inscritos: num(fin ? row.alunos : row.total_alunos),
    vagas: num(fin ? row.alunos_total : row.vagas),
    extra: num(row.inscricoes_adicionais),
    activa: fin ? Boolean(row.activa) : (String(row.estado ?? "") === "Ativa" || String(row.estado ?? "") === "Ativo"),
    cronograma: parseCronograma(row.cronograma),
  };
}

function cronogramaPublico(sessoes: SessaoPercurso[]) {
  return sessoes
    .filter(s => s.modalidade !== "avaliacao")
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))
    .map(s => ({
      data: s.data,
      horaInicio: s.horaInicio,
      horaFim: s.horaFim,
      modulos: s.modulos,
      modalidade: s.modalidade,
    }));
}

export function turmaParaCliente(t: TurmaPercurso) {
  return {
    id: t.id,
    nome: t.nome,
    local: t.local,
    horario: t.horario,
    dataInicio: t.dataInicio,
    cronograma: cronogramaPublico(t.cronograma),
  };
}

async function carregarTurmas(db: Db, regime: "gold" | "fin") {
  const sql = regime === "fin"
    ? `SELECT id, nome, curso, local, horario, data_inicio, alunos, alunos_total, inscricoes_adicionais, activa, cronograma
         FROM turmas_fin`
    : `SELECT id, nome, curso, local, horario, data_inicio, total_alunos, vagas, inscricoes_adicionais, estado, cronograma
         FROM turmas_gold`;
  const rows = await db.query(sql);
  return rows.rows.map(r => mapTurmaRow(r, regime));
}

export async function turmasDoPercurso(db: Db, lead: LeadPercurso, agora = new Date()) {
  const todas = await carregarTurmas(db, lead.regime);
  const compativeis = todas.filter(t => turmaCompativelComLead(lead, t));
  const abertas = compativeis.filter(t => turmaAbertaNoPercurso(t, agora, {
    ignorarLotacao: lead.percursoTurmaId === t.id,
  }) || (lead.percursoTurmaId === t.id && t.activa));
  const escolhida = lead.percursoTurmaId ? todas.find(t => t.id === lead.percursoTurmaId) ?? null : null;
  const lista = abertas.filter(t => turmaCompativelComLead(lead, t));
  if (escolhida && turmaCompativelComLead(lead, escolhida) && !lista.some(t => t.id === escolhida.id)) {
    lista.unshift(escolhida);
  }
  lista.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome, "pt"));
  return { lista, escolhida };
}

async function ibanEntidade(db: Db) {
  const row = await db.query<{ values: unknown }>("SELECT values FROM app_settings WHERE id = 'gold'");
  const values = row.rows[0]?.values;
  const obj = values && typeof values === "object" ? values as Record<string, string> : {};
  return {
    iban: String(obj.IBAN ?? "").trim(),
    entidade: String(obj["Entidade Multibanco"] ?? "").trim(),
  };
}

export async function vistaPercurso(db: Db, row: Record<string, unknown>) {
  const lead = mapLeadPercurso(row);
  const pedidos = await docsDoCurso(db, lead.curso, lead.regime);
  const ficheiros = await listarDocsLead(db, lead.id);
  const entregues = ficheiros.map(f => ({ tipo: f.tipo, estado: f.estado }));
  const docsOk = docsDoPercursoProntos(pedidos, entregues);
  const catalogoOk = docsCompletos(pedidos, ficheiros.map(f => f.tipo));
  const paga = precisaPagamento(lead);
  const compOk = comprovativoPronto(entregues);
  const recusados = ficheiros.filter(f => f.estado === "recusado");
  const { lista, escolhida } = docsOk.ok || lead.percursoTurmaId
    ? await turmasDoPercurso(db, lead)
    : { lista: [] as TurmaPercurso[], escolhida: null as TurmaPercurso | null };
  const settings = await ibanEntidade(db);
  let pagamento: { entidade: string; referencia: string; valor: number; estado: string } | null = null;
  if (lead.pagamentoId) {
    const pag = await db.query("SELECT referencia, valor, estado FROM pagamentos WHERE id = $1", [lead.pagamentoId]);
    const p = pag.rows[0];
    if (p) {
      const ref = String(p.referencia ?? "");
      pagamento = {
        entidade: settings.entidade,
        referencia: ref.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") || ref,
        valor: num(p.valor) || lead.preco,
        estado: String(p.estado ?? "Pendente"),
      };
    }
  }
  const correcao = recusados.length > 0;
  const encerrada = lead.percursoConcluido && !correcao;
  let passo: "documentos" | "turma" | "pagamento" | "concluido" | "correcao" = "documentos";
  if (encerrada) passo = "concluido";
  else if (correcao && lead.percursoConcluido) passo = "correcao";
  else if (!docsOk.ok) passo = "documentos";
  else if (!lead.percursoTurmaId) passo = "turma";
  else if (paga && !compOk) passo = "pagamento";
  else passo = "concluido";

  let tipos = pedidos;
  if (passo === "correcao") {
    const ids = new Set(recusados.map(d => d.tipo));
    tipos = pedidos.filter(p => ids.has(p.id));
    if (ids.has("comprovativo")) tipos = [...tipos, { id: "comprovativo", label: "Comprovativo de pagamento", required: true }];
  }

  return {
    nome: `${lead.nome} ${lead.apelido}`.trim(),
    curso: lead.curso,
    local: partirLocalHorario(lead.local, lead.horario).local,
    horario: partirLocalHorario(lead.local, lead.horario).horario || lead.horario,
    preco: lead.preco,
    tipos,
    ficheiros: ficheiros.map(d => ({
      id: d.id, tipo: d.tipo, nome: d.nome, created_at: d.created_at,
      estado: d.estado, observacao: d.observacao,
    })),
    docsCompletos: docsOk.ok,
    emFalta: docsOk.emFalta.map(d => d.label),
    precisaPagamento: paga,
    pagamento: pagamento ?? (paga ? { entidade: settings.entidade, referencia: "", valor: lead.preco, estado: "Pendente" } : null),
    iban: settings.iban,
    turmas: (docsOk.ok ? lista : []).map(turmaParaCliente),
    turmaEscolhida: escolhida && turmaCompativelComLead(lead, escolhida) ? turmaParaCliente(escolhida) : null,
    passo,
    encerrada,
    correcao,
    catalogoOk: catalogoOk.ok,
  };
}

async function soltarLugar(db: Db, regime: "gold" | "fin", turmaId: number) {
  if (regime === "fin") {
    await db.query("UPDATE turmas_fin SET alunos = GREATEST(alunos - 1, 0) WHERE id = $1", [turmaId]);
    return;
  }
  await db.query("UPDATE turmas_gold SET total_alunos = GREATEST(total_alunos - 1, 0) WHERE id = $1", [turmaId]);
}

async function ocuparLugar(db: Db, regime: "gold" | "fin", turmaId: number) {
  if (regime === "fin") {
    const upd = await db.query<{ id: number }>(
      `UPDATE turmas_fin
          SET alunos = alunos + 1
        WHERE id = $1 AND activa = true AND alunos < alunos_total + GREATEST(inscricoes_adicionais, 0)
        RETURNING id`,
      [turmaId],
    );
    return Boolean(upd.rows[0]);
  }
  const upd = await db.query<{ id: number }>(
    `UPDATE turmas_gold
        SET total_alunos = total_alunos + 1
      WHERE id = $1 AND estado IN ('Ativa', 'Ativo')
        AND total_alunos < vagas + GREATEST(inscricoes_adicionais, 0)
      RETURNING id`,
    [turmaId],
  );
  return Boolean(upd.rows[0]);
}

export async function reservarTurmaPercurso(db: Db, leadId: number, turmaId: number) {
  const row = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const raw = row.rows[0];
  if (!raw) return { ok: false as const, error: "Pré-inscrição inexistente." };
  const lead = mapLeadPercurso(raw);
  if (lead.percursoConcluido) return { ok: false as const, error: "Este percurso já foi concluído." };
  const pedidos = await docsDoCurso(db, lead.curso, lead.regime);
  const ficheiros = await listarDocsLead(db, lead.id);
  if (!docsDoPercursoProntos(pedidos, ficheiros).ok) {
    return { ok: false as const, error: "Submeta primeiro todos os documentos obrigatórios." };
  }
  const { lista } = await turmasDoPercurso(db, lead);
  const turma = lista.find(t => t.id === turmaId);
  if (!turma || !turmaCompativelComLead(lead, turma) || !turmaAbertaNoPercurso(turma, new Date(), { ignorarLotacao: lead.percursoTurmaId === turma.id })) {
    return { ok: false as const, error: "Esta turma não corresponde ao curso, local e horário da pré-inscrição, ou já não aceita inscrições." };
  }
  if (lead.percursoTurmaId === turma.id) {
    await tentarConcluirPercurso(db, lead.id);
    return { ok: true as const };
  }
  if (lead.percursoTurmaId) await soltarLugar(db, lead.regime, lead.percursoTurmaId);
  const ocupou = await ocuparLugar(db, lead.regime, turma.id);
  if (!ocupou) {
    if (lead.percursoTurmaId) await ocuparLugar(db, lead.regime, lead.percursoTurmaId);
    return { ok: false as const, error: "Esta turma já atingiu o limite de inscrições, incluindo as adicionais." };
  }
  await db.query(
    "UPDATE preinscricoes SET percurso_turma_id = $2, turma_id = $2, inicio_curso = $3, ultima_actividade_em = now() WHERE id = $1",
    [lead.id, turma.id, turma.dataInicio || "-"],
  );
  await logLeadEvent(db, lead.id, undefined, "campo", "Turma escolhida no percurso", `${turma.nome} · ${turma.local} · ${turma.horario}`);
  if (precisaPagamento(lead)) {
    await ensurePagamentoPendente(db, {
      id: lead.id, nome: lead.nome, apelido: lead.apelido, email: lead.email,
      curso: lead.curso, preco: lead.preco, pagamento_id: lead.pagamentoId || null,
    }).catch(() => undefined);
  }
  await tentarConcluirPercurso(db, lead.id);
  return { ok: true as const };
}

function fmtData(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "-";
}

async function alocarFormando(db: Db, lead: LeadPercurso, turma: TurmaPercurso) {
  const email = normalizeEmail(lead.email);
  if (lead.regime === "fin") {
    const ja = await db.query<{ id: number }>(
      "SELECT id FROM formandos_fin WHERE lower(email) = $1 AND turma = $2 LIMIT 1",
      [email, turma.nome],
    );
    if (ja.rows[0]) return ja.rows[0].id;
    const id = await nextOpsId(db);
    const docs = { cc: { ok: false, data: "" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } };
    await db.query(
      "INSERT INTO formandos_fin (id, nome, apelido, turma, telf, email, curso, estado, docs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",
      [id, lead.nome, lead.apelido, turma.nome, lead.telf, email, lead.curso, "Elegível", docs],
    );
    return id;
  }
  const ja = await db.query<{ id: number }>(
    "SELECT id FROM formandos_gold WHERE lower(email) = $1 AND turma_id = $2 LIMIT 1",
    [email, turma.id],
  );
  if (ja.rows[0]) return ja.rows[0].id;
  const id = await nextOpsId(db);
  const agora = new Date().toISOString().slice(0, 16).replace("T", " ");
  await db.query(
    `INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Formando', false, $11, $12)`,
    [id, lead.nome, lead.apelido, lead.telf, email, agora, turma.local, lead.curso, turma.nome, turma.id, lead.preco, "Transferência"],
  );
  return id;
}

export async function tentarConcluirPercurso(db: Db, leadId: number) {
  const row = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const raw = row.rows[0];
  if (!raw) return { concluido: false as const };
  const lead = mapLeadPercurso(raw);
  if (lead.percursoConcluido || !lead.percursoTurmaId) return { concluido: lead.percursoConcluido };
  const pedidos = await docsDoCurso(db, lead.curso, lead.regime);
  const ficheiros = await listarDocsLead(db, lead.id);
  if (!docsDoPercursoProntos(pedidos, ficheiros).ok) return { concluido: false as const };
  if (precisaPagamento(lead) && !comprovativoPronto(ficheiros)) return { concluido: false as const };
  const turmas = await carregarTurmas(db, lead.regime);
  const turma = turmas.find(t => t.id === lead.percursoTurmaId);
  if (!turma || !turmaCompativelComLead(lead, turma)) return { concluido: false as const };
  await alocarFormando(db, lead, turma);
  const marcado = await db.query<{ id: number }>(
    "UPDATE preinscricoes SET percurso_concluido_em = now(), estado = 'Formando', turma_id = $2, ultima_actividade_em = now() WHERE id = $1 AND percurso_concluido_em IS NULL RETURNING id",
    [lead.id, turma.id],
  );
  if (!marcado.rows[0]) return { concluido: true as const };
  await enviarConfirmacao(db, lead, turma, pedidos, ficheiros);
  return { concluido: true as const };
}

async function enviarConfirmacao(
  db: Db,
  lead: LeadPercurso,
  turma: TurmaPercurso,
  pedidos: DocPedido[],
  ficheiros: DocLead[],
) {
  const email = normalizeEmail(lead.email);
  const nomes = new Map(pedidos.map(p => [p.id, p.label]));
  nomes.set("comprovativo", "Comprovativo de pagamento");
  const entregues = ficheiros
    .filter(f => f.estado !== "recusado" && f.tipo !== "comprovativo")
    .map(f => nomes.get(f.tipo) ?? f.tipo);
  const settings = await ibanEntidade(db);
  const paga = precisaPagamento(lead);
  const linhas = [
    `A inscrição em ${lead.curso} ficou registada com a turma que escolheu.`,
    `Turma ${turma.nome}, em ${turma.local}, horário ${turma.horario}, início a ${fmtData(turma.dataInicio)}.`,
    entregues.length ? `Documentos recebidos: ${entregues.join(", ")}.` : "Os documentos pessoais ficaram na ficha.",
    paga
      ? `Pagamento de € ${lead.preco.toFixed(2)} por transferência${settings.iban ? ` para o IBAN ${settings.iban}` : ""}. O comprovativo ficou na ficha e aguarda validação.`
      : "Esta inscrição não tem pagamento associado.",
    "A secretaria valida os documentos pessoais e o pagamento. A ligação pessoal fica encerrada.",
  ];
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  if (isEmail(email)) {
    const mail = renderAutomaticEmail({
      nome,
      xml: "",
      linhas,
      cta: "",
      href: "",
      vars: { nome, curso: lead.curso },
      origin: config.appOrigin,
    });
    await sendMail(db, {
      to: email,
      name: nome,
      subject: `Inscrição confirmada · ${lead.curso}`,
      text: mail.text,
      html: mail.html,
    }).catch(() => undefined);
  }
  const nota = linhas.slice(0, 3).join(" ");
  await db.query(
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio) VALUES ($1,$2,$3,$4)",
    [lead.id, null, nota, "Email"],
  );
  await logLeadEvent(db, lead.id, undefined, "seguimento", "Percurso de inscrição concluído", nota);
}
