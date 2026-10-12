import type { Db } from "./db/pool.js";
import { listarDocsLead } from "./docsLink.js";
import { nextOpsId } from "./ops.js";
import { logLeadEvent } from "./crmDossier.js";
import { isEmail, normalizeEmail } from "./security.js";

const DOC_KEYS = ["cc", "ch", "cu", "morada", "ci", "ce", "contrato", "rgpd"] as const;

function vazioDoc() {
  return { ok: false, data: "" };
}

function asObj(v: unknown) {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return {};
}

function docDeJson(docs: Record<string, unknown>, key: string) {
  const d = asObj(docs[key]);
  return { ok: Boolean(d.ok), data: String(d.data ?? "") };
}

function docsFromInscricaoPips(pips: Record<string, boolean | undefined>) {
  const map: Record<string, boolean> = {
    cc: Boolean(pips.cc),
    ch: Boolean(pips.ch),
    cu: Boolean(pips.cu),
    ci: Boolean(pips.ci),
    ce: Boolean(pips.ce),
  };
  const hoje = new Date().toISOString().slice(0, 10);
  const out: Record<string, { ok: boolean; data: string }> = {};
  for (const k of DOC_KEYS) {
    const pip = map[k];
    out[k] = pip ? { ok: true, data: hoje } : vazioDoc();
  }
  return out;
}

async function turmaPorNomeOuId(db: Db, turma: string, curso: string) {
  const nome = turma.trim();
  if (nome && nome !== "-") {
    const porNome = await db.query<{ id: number; nome: string; curso: string }>(
      "SELECT id, nome, curso FROM turmas_fin WHERE lower(trim(nome)) = lower(trim($1)) ORDER BY id DESC LIMIT 1",
      [nome],
    );
    if (porNome.rows[0]) return porNome.rows[0];
  }
  const c = curso.trim();
  if (!c) return null;
  const porCurso = await db.query<{ id: number; nome: string; curso: string }>(
    "SELECT id, nome, curso FROM turmas_fin WHERE lower(trim(curso)) = lower(trim($1)) ORDER BY id DESC LIMIT 2",
    [c],
  );
  if (porCurso.rows.length === 1) return porCurso.rows[0]!;
  return null;
}

async function syncFormandoDocsFromLead(db: Db, formandoId: number, leadId: number) {
  const ficheiros = await listarDocsLead(db, leadId);
  const hoje = new Date().toISOString().slice(0, 10);
  for (const f of ficheiros) {
    if (f.estado !== "validado") continue;
    const tipo = String(f.tipo ?? "").trim();
    if (!DOC_KEYS.includes(tipo as typeof DOC_KEYS[number])) continue;
    await db.query(
      `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url)
       VALUES ('fin', $1, $2, true, $3, $4, $5, $6)
       ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
         ok = true, file_name = EXCLUDED.file_name, data = EXCLUDED.data,
         drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url, updated_at = now()`,
      [formandoId, tipo, f.nome, hoje, f.drive_file_id, f.drive_url],
    );
  }
}

async function mergeDocsJson(
  db: Db,
  formandoId: number,
  base: Record<string, { ok: boolean; data: string }>,
) {
  const rows = await db.query<{ doc_id: string; ok: boolean; data: string }>(
    "SELECT doc_id, ok, data FROM formando_docs WHERE regime = 'fin' AND formando_id = $1",
    [formandoId],
  );
  const out = { ...base };
  for (const r of rows.rows) {
    if (r.ok) out[r.doc_id] = { ok: true, data: String(r.data ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10) };
  }
  return out;
}

export async function upsertFormandoFinFromLead(db: Db, leadId: number, actorId?: string) {
  const lead = await db.query(
    "SELECT * FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.regime ?? "gold") !== "fin") return null;

  const email = normalizeEmail(String(row.email ?? ""));
  const turmaId = Number(row.turma_escolhida_id || row.turma_id || 0);
  let turma: { id: number; nome: string; curso: string } | null = null;
  if (turmaId) {
    const turmaRow = await db.query<{ id: number; nome: string; curso: string }>(
      "SELECT id, nome, curso FROM turmas_fin WHERE id = $1",
      [turmaId],
    );
    turma = turmaRow.rows[0] ?? null;
  }
  if (!turma) {
    const curso = String(row.curso ?? "").trim();
    const local = String(row.local ?? "").trim();
    const horario = String(row.horario ?? "").trim();
    if (curso) {
      const q = await db.query<{ id: number; nome: string; curso: string }>(
        `SELECT id, nome, curso FROM turmas_fin
          WHERE lower(trim(curso)) = lower(trim($1))
            AND ($2 = '' OR lower(trim(local)) = lower(trim($2)))
            AND ($3 = '' OR lower(trim(horario)) = lower(trim($3)))
          ORDER BY id DESC LIMIT 2`,
        [curso, local, horario],
      );
      if (q.rows.length === 1) turma = q.rows[0]!;
    }
  }
  if (!turma) {
    turma = await turmaPorNomeOuId(db, "", String(row.curso ?? ""));
  }
  const turmaNome = turma?.nome ?? (turmaId ? `Turma #${turmaId}` : "-");
  const curso = String(turma?.curso ?? row.curso ?? "");

  const found = email
    ? await db.query<{ id: number }>(
      "SELECT id FROM formandos_fin WHERE email <> '' AND lower(trim(email)) = $1 ORDER BY id DESC LIMIT 1",
      [email],
    )
    : { rows: [] as { id: number }[] };

  let id = found.rows[0]?.id;
  const estado = "Elegível";
  const docsBase = docsFromInscricaoPips({});
  if (!id) {
    id = await nextOpsId(db);
    await db.query(
      `INSERT INTO formandos_fin (id, nome, apelido, turma, turma_id, telf, email, curso, estado, docs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        id,
        String(row.nome ?? ""),
        String(row.apelido ?? ""),
        turmaNome,
        turma?.id ?? (turmaId || null),
        String(row.telf ?? ""),
        email,
        curso,
        estado,
        docsBase,
      ],
    );
    await logLeadEvent(db, leadId, actorId, "estado", "Formando financiado criado", `Ficha #${id} · ${turmaNome}`);
  } else {
    await db.query(
      `UPDATE formandos_fin SET
         nome = COALESCE(NULLIF($2,''), nome), apelido = COALESCE(NULLIF($3,''), apelido),
         turma = $4, turma_id = $5, telf = COALESCE(NULLIF($6,''), telf), curso = $7, estado = $8
       WHERE id = $1`,
      [id, String(row.nome ?? ""), String(row.apelido ?? ""), turmaNome, turma?.id ?? null, String(row.telf ?? ""), curso, estado],
    );
    await logLeadEvent(db, leadId, actorId, "estado", "Formando financiado actualizado", `Ficha #${id} · ${turmaNome}`);
  }

  await syncFormandoDocsFromLead(db, id, leadId);
  const merged = await mergeDocsJson(db, id, docsBase);
  await db.query("UPDATE formandos_fin SET docs = $2::jsonb WHERE id = $1", [id, merged]);
  await db.query(
    "UPDATE preinscricoes SET estado = 'Formando', ultima_actividade_em = now() WHERE id = $1 AND estado <> 'Formando'",
    [leadId],
  );
  return { formandoId: id, turmaId: turma?.id ?? null };
}

export async function upsertFormandoFinFromInscricao(db: Db, payload: Record<string, unknown>) {
  const estado = String(payload.estado ?? "").trim();
  if (estado !== "Colocado na turma" && estado !== "Elegível") return null;

  const email = normalizeEmail(String(payload.email ?? ""));
  const curso = String(payload.curso ?? "").trim();
  const turmaTxt = String(payload.turma ?? "").trim();
  const turma = await turmaPorNomeOuId(db, turmaTxt, curso);
  const docsPips = asObj(payload.docs);
  const docsBase = docsFromInscricaoPips({
    cc: Boolean(docsPips.cc),
    ch: Boolean(docsPips.ch),
    cu: Boolean(docsPips.cu),
    ci: Boolean(docsPips.ci),
    ce: Boolean(docsPips.ce),
  });

  const found = email
    ? await db.query<{ id: number; docs: unknown }>(
      "SELECT id, docs FROM formandos_fin WHERE email <> '' AND lower(trim(email)) = $1 ORDER BY id DESC LIMIT 1",
      [email],
    )
    : { rows: [] as { id: number; docs: unknown }[] };

  let id = found.rows[0]?.id;
  const finEstado = estado === "Colocado na turma" ? "Colocado" : "Elegível";

  if (!id) {
    id = await nextOpsId(db);
    await db.query(
      `INSERT INTO formandos_fin (id, nome, apelido, turma, turma_id, telf, email, curso, estado, docs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        id,
        String(payload.nome ?? ""),
        String(payload.apelido ?? ""),
        turma?.nome ?? turmaTxt || "-",
        turma?.id ?? null,
        String(payload.telf ?? ""),
        email,
        turma?.curso ?? curso,
        finEstado,
        docsBase,
      ],
    );
  } else {
    const prev = asObj(found.rows[0]?.docs);
    const merged: Record<string, { ok: boolean; data: string }> = {};
    for (const k of DOC_KEYS) {
      const fromPip = docsBase[k];
      const fromPrev = docDeJson(prev, k);
      merged[k] = fromPip.ok ? fromPip : fromPrev;
    }
    await db.query(
      `UPDATE formandos_fin SET
         nome = COALESCE(NULLIF($2,''), nome), apelido = COALESCE(NULLIF($3,''), apelido),
         turma = $4, turma_id = $5, telf = COALESCE(NULLIF($6,''), telf), curso = $7, estado = $8, docs = $9::jsonb
       WHERE id = $1`,
      [
        id,
        String(payload.nome ?? ""),
        String(payload.apelido ?? ""),
        turma?.nome ?? turmaTxt || "-",
        turma?.id ?? null,
        String(payload.telf ?? ""),
        turma?.curso ?? curso,
        finEstado,
        merged,
      ],
    );
  }
  return { formandoId: id };
}

export async function enviarLembreteDocsFin(db: Db, formandoId: number, actorId?: string) {
  const row = await db.query<{ nome: string; apelido: string; email: string; curso: string; docs: unknown }>(
    "SELECT nome, apelido, email, curso, docs FROM formandos_fin WHERE id = $1",
    [formandoId],
  );
  const f = row.rows[0];
  if (!f) return { enviado: false as const, erro: "Formando inexistente." };
  const email = normalizeEmail(f.email);
  if (!isEmail(email)) return { enviado: false as const, erro: "Email inválido na ficha." };

  const docs = asObj(f.docs);
  const labels: Record<string, string> = {
    cc: "Cartão de Cidadão",
    ch: "Certificado de habilitações",
    cu: "Curriculum vitae",
    morada: "Comprovativo de morada",
    ci: "IBAN / comprovativo de NIB",
    ce: "Comprovativo de situação perante o emprego",
    contrato: "Contrato de formação",
    rgpd: "Declaração RGPD",
  };
  const emFalta = DOC_KEYS.filter(k => !docDeJson(docs, k).ok).map(k => labels[k] ?? k);
  if (!emFalta.length) return { enviado: false as const, erro: "Todos os documentos obrigatórios já estão validados." };

  const { sendMail } = await import("./mailer.js");
  const { renderAutomaticEmail } = await import("./emailHtml.js");
  const { config } = await import("./config.js");
  const nome = `${f.nome} ${f.apelido}`.trim();
  const linhas = [
    `Olá ${f.nome},`,
    "",
    `Para concluir a inscrição na formação ${f.curso} faltam os seguintes documentos:`,
    ...emFalta.map(d => `· ${d}`),
    "",
    "Responda a este email com os ficheiros em anexo ou contacte a equipa pedagógica da ENA.",
  ];
  const mail = renderAutomaticEmail({
    nome,
    xml: "",
    linhas,
    cta: "Contactar a ENA",
    href: `${config.appOrigin.replace(/\/$/, "")}/area-formando`,
    vars: { nome, curso: f.curso },
    origin: config.appOrigin,
  });
  await sendMail(db, {
    to: email,
    name: nome,
    subject: `Documentos em falta · ${f.curso}`,
    text: mail.text,
    html: mail.html,
  });
  await db.query(
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ('fin', $1, $2, $3, $4)",
    [formandoId, "Sistema", actorId ?? null, `Lembrete de documentos enviado (${emFalta.length} em falta).`],
  );
  return { enviado: true as const };
}
