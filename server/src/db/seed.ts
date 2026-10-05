import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { ctaDestino } from "../emailCta.js";
import { linesToXml } from "../emailXml.js";
import { hashPassword, normalizeEmail } from "../security.js";
import { seedOperational } from "./opsSeed.js";
import type { Db } from "./pool.js";

const TEMPLATES = [
  {
    tipo: "welcome",
    nome: "Boas-vindas",
    assunto: "Bem-vindo(a) à ENA, {{nome}}",
    linhas: [
      "Confirmámos o seu interesse em {{curso}}.",
      "Abra a ligação pessoal para enviar os documentos: {{documentos_lista}}.",
      "No mesmo percurso escolhe o cronograma e, quando houver pagamento, anexa o comprovativo.",
      "A secretaria valida a pré-inscrição. A ligação fica aberta até essa validação.",
    ],
    cta: "Abrir pré-inscrição",
  },
  {
    tipo: "pagamento_ref",
    nome: "Referência de pagamento",
    assunto: "Pagamento de {{curso}} · referência {{referencia}}",
    linhas: [
      "Recebemos os documentos de {{curso}}.",
      "Pague por Multibanco: entidade {{entidade}}, referência {{referencia}}, valor € {{valor}}.",
      "Em seguida anexe o comprovativo na mesma ligação pessoal.",
    ],
    cta: "Anexar comprovativo",
  },
  {
    tipo: "payment",
    nome: "Confirmação de Pagamento",
    assunto: "Pagamento confirmado: {{curso}}",
    linhas: [
      "{{nome}}, o pagamento de {{curso}} chegou.",
      "A secretaria confirma-lhe a turma {{turma}} e o horário por telefone ou por este email.",
    ],
    cta: "Falar com a secretaria",
  },
  {
    tipo: "sale_followup",
    nome: "Contacto após a venda",
    assunto: "Obrigado, {{nome}} - próximos passos em {{curso}}",
    linhas: [
      "O pagamento ficou registado. Daqui a pouco a secretaria confirma-lhe a turma {{turma}} e o horário.",
      "Se precisar de fatura, recibo ou de alterar o nome no certificado, responda a este email.",
      "Guarde este comprovativo. A ENA trata a formação pela turma, não por «ação».",
    ],
    cta: "Falar com a secretaria",
  },
  {
    tipo: "unpaid_3d",
    nome: "Lembrete de pagamento (3 dias)",
    assunto: "{{nome}}, o pagamento de {{curso}} ainda não chegou",
    linhas: [
      "Há três dias que a pré-inscrição em {{curso}} está sem pagamento.",
      "Se ainda quiser a vaga, responda a este email ou ligue para a secretaria. Enviamos a referência Multibanco.",
    ],
    cta: "Pedir dados de pagamento",
  },
  {
    tipo: "reminder_24h",
    nome: "Lembrete 24h",
    assunto: "Amanhã começa {{curso}}",
    linhas: [
      "{{nome}}, a primeira sessão de {{curso}} é amanhã, turma {{turma}}.",
      "Traga o CC e, se for CCP, o portefólio em construção. Qualquer dúvida, responda a este email.",
    ],
    cta: "Confirmar com a secretaria",
  },
  {
    tipo: "certificate",
    nome: "Certificado de Conclusão",
    assunto: "O seu certificado está disponível",
    linhas: [
      "Parabéns, {{nome}}. Concluiu {{curso}} na turma {{turma}}.",
      "A secretaria envia o certificado em PDF. A ENA arquiva o DTP durante 10 anos.",
    ],
    cta: "Pedir o certificado",
  },
  {
    tipo: "reengagement",
    nome: "Reengajamento",
    assunto: "Ainda está a tempo de começar {{curso}}",
    linhas: [
      "{{nome}}, a pré-inscrição em {{curso}} ficou a meio.",
      "Se ainda quiser começar, volte a deixar os dados. A secretaria contacta-o de novo.",
    ],
    cta: "Voltar a pré-inscrever-me",
  },
].map(t => {
  const dest = ctaDestino(t.tipo);
  return { ...t, href: dest.href, ambito: dest.ambito };
});

const RULES = [
  { nome: "Boas-vindas ao registo", gatilho: "Nova pré-inscrição recebida", key: "preinscricao.created", tipo: "welcome", delay: 0 },
  { nome: "Documentos na pré-inscrição", gatilho: "Pré-inscrição promovida", key: "preinscricao.promoted", tipo: "welcome", delay: 0 },
  { nome: "Referência após documentos", gatilho: "Documentos da pré-inscrição submetidos", key: "preinscricao.docs_completos", tipo: "pagamento_ref", delay: 0 },
  { nome: "Lembrete sem pagamento (3 dias)", gatilho: "Pré-inscrição sem pagamento há 3 dias", key: "preinscricao.unpaid_3d", tipo: "unpaid_3d", delay: 0 },
  { nome: "Confirmação de pagamento", gatilho: "Pagamento confirmado", key: "payment.confirmed", tipo: "payment", delay: 0 },
  { nome: "Contacto após a venda", gatilho: "Contacto após a venda", key: "sale.followup", tipo: "sale_followup", delay: 3600 },
  { nome: "Lembrete 24h antes do curso", gatilho: "24 horas antes do início", key: "turma.starts_in_24h", tipo: "reminder_24h", delay: 0 },
  { nome: "Certificado de conclusão", gatilho: "Formando marcado como concluído", key: "formando.completed", tipo: "certificate", delay: 0 },
  { nome: "Reengajamento 30 dias", gatilho: "30 dias sem compra", key: "lead.stale_30d", tipo: "reengagement", delay: 0 },
];

const SECRETARIA_SEED = {
  name: "Aguiar",
  email: "aguiar@ena.pt",
  password: "ena.Formacao2026#",
};

async function upsertUser(db: Db, user: { name: string; email: string; password: string; role?: string }) {
  const email = normalizeEmail(user.email);
  const hash = await hashPassword(user.password);
  await db.query(
    `INSERT INTO users (id, name, email, password_hash, role, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = CASE WHEN users.name = '' THEN EXCLUDED.name ELSE users.name END,
       role = CASE WHEN users.role IN ('admin', 'secretaria') AND EXCLUDED.role = 'comercial' THEN users.role ELSE COALESCE(EXCLUDED.role, users.role) END,
       active = true`,
    [randomUUID(), user.name, email, hash, user.role ?? "admin"],
  );
}

async function seedPropostasDemo(db: Db) {
  const comerciais = await db.query<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE role = 'comercial' AND active = true ORDER BY name",
  );
  if (!comerciais.rows.length) return;

  const unassigned = await db.query<{ id: number }>(
    "SELECT id FROM preinscricoes WHERE comercial_id IS NULL ORDER BY id",
  );
  for (let i = 0; i < unassigned.rows.length; i++) {
    const comercial = comerciais.rows[i % comerciais.rows.length];
    await db.query("UPDATE preinscricoes SET comercial_id = $2 WHERE id = $1", [unassigned.rows[i].id, comercial.id]);
  }

  const existing = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM propostas_comerciais");
  if ((existing.rows[0]?.n ?? 0) > 0) return;

  const leads = await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string; preco: number; comercial_id: string }>(
    "SELECT id, nome, apelido, email, curso, preco, comercial_id FROM preinscricoes WHERE comercial_id IS NOT NULL ORDER BY id LIMIT 12",
  );
  const estados = ["Enviada", "Negociação", "Aceite", "Recusada", "Enviada", "Aceite"] as const;
  const respostas: Record<string, string> = {
    Aceite: "Confirmado por email. Pede fatura e data de início.",
    Recusada: "Disse que o horário não serve e vai pensar noutro curso.",
    Negociação: "Pediu desconto de 10% e pagamento em duas prestações.",
    Enviada: "",
  };
  let i = 0;
  for (const lead of leads.rows) {
    const estado = estados[i % estados.length];
    const idRow = await db.query<{ id: number }>("SELECT nextval('ops_id_seq')::int AS id");
    const pid = idRow.rows[0]?.id ?? 9000 + i;
    await db.query(
      `INSERT INTO propostas_comerciais
         (id, comercial_id, preinscricao_id, cliente_nome, cliente_email, curso, valor, estado, resposta_cliente, resposta_em, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        pid, lead.comercial_id, lead.id,
        `${lead.nome} ${lead.apelido}`.trim(), lead.email, lead.curso, Number(lead.preco) || 125,
        estado, respostas[estado] ?? "", estado === "Enviada" ? null : new Date(),
        estado === "Negociação" ? "Aguardar resposta até sexta." : "",
      ],
    );
    if (i % 3 === 0) {
      await db.query(
        "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota) VALUES ($1,$2,$3)",
        [lead.id, lead.comercial_id, "Primeiro contacto: apresentou o CCP e enviou proposta por email."],
      );
    }
    i += 1;
  }
}

export async function seed(db: Db) {
  const email = normalizeEmail(config.adminEmail);
  const existing = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!existing.rows[0]) {
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, $2, $3, $4, 'admin', true)",
      [randomUUID(), config.adminName, email, await hashPassword(config.adminPassword)],
    );
  }
  await upsertUser(db, SECRETARIA_SEED);
  await upsertUser(db, { name: "Inês Costa", email: "ines.costa@ena.pt", password: SECRETARIA_SEED.password, role: "comercial" });
  await upsertUser(db, { name: "Tiago Melo", email: "tiago.melo@ena.pt", password: SECRETARIA_SEED.password, role: "comercial" });
  await upsertUser(db, { name: "Marta Lopes", email: "marta.lopes@ena.pt", password: SECRETARIA_SEED.password, role: "financiada" });

  for (const t of TEMPLATES) {
    await db.query(
      `INSERT INTO email_templates (tipo, nome, assunto, body_lines, cta, cta_href, cta_ambito)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (tipo) DO UPDATE SET
         nome = EXCLUDED.nome,
         assunto = CASE WHEN email_templates.assunto = EXCLUDED.assunto THEN email_templates.assunto ELSE email_templates.assunto END,
         body_lines = CASE WHEN email_templates.body_lines = '[]'::jsonb THEN EXCLUDED.body_lines ELSE email_templates.body_lines END,
         cta_href = CASE WHEN email_templates.cta_href = '' THEN EXCLUDED.cta_href ELSE email_templates.cta_href END,
         cta_ambito = CASE WHEN email_templates.cta_href = '' THEN EXCLUDED.cta_ambito ELSE email_templates.cta_ambito END`,
      [t.tipo, t.nome, t.assunto, t.linhas, t.cta, t.href, t.ambito],
    );
    const row = await db.query<{ body_lines: unknown; body_xml: string; cta_href: string }>(
      "SELECT body_lines, body_xml, cta_href FROM email_templates WHERE tipo = $1",
      [t.tipo],
    );
    const lines = row.rows[0]?.body_lines;
    const empty = !lines || (Array.isArray(lines) && lines.length === 0);
    const xml = linesToXml(t.linhas, t.cta, t.href, t.ambito);
    if (empty) {
      await db.query(
        "UPDATE email_templates SET assunto = $2, body_lines = $3::jsonb, cta = $4, cta_href = $5, cta_ambito = $6, body_xml = $7, updated_at = now() WHERE tipo = $1",
        [t.tipo, t.assunto, t.linhas, t.cta, t.href, t.ambito, xml],
      );
    } else if (!row.rows[0]?.body_xml?.trim()) {
      await db.query("UPDATE email_templates SET body_xml = $2, updated_at = now() WHERE tipo = $1", [t.tipo, xml]);
    } else if (!/<cta\b[^>]*\bhref\s*=/i.test(row.rows[0]?.body_xml ?? "")) {
      const nextXml = (row.rows[0]?.body_xml ?? "").replace(
        /<cta\b[^>]*>[\s\S]*?<\/cta>/i,
        `<cta ambito="${t.ambito}" href="${t.href.replace(/&/g, "&amp;")}">${t.cta}</cta>`,
      );
      await db.query(
        "UPDATE email_templates SET body_xml = $2, cta_href = CASE WHEN cta_href = '' THEN $3 ELSE cta_href END, cta_ambito = $4, updated_at = now() WHERE tipo = $1",
        [t.tipo, nextXml, t.href, t.ambito],
      );
    }
    const href = row.rows[0]?.cta_href ?? "";
    if (href.includes("formandos.ena.pt") || href.includes("plataforma_url") || href.includes("plataforma")) {
      await db.query(
        "UPDATE email_templates SET cta = $2, cta_href = $3, cta_ambito = $4, body_xml = $5, updated_at = now() WHERE tipo = $1",
        [t.tipo, t.cta, t.href, t.ambito, xml],
      );
    }
  }

  const welcome = TEMPLATES.find(t => t.tipo === "welcome");
  if (welcome) {
    const xml = linesToXml(welcome.linhas, welcome.cta, welcome.href, welcome.ambito);
    await db.query(
      `UPDATE email_templates
          SET cta = $1, cta_href = $2, cta_ambito = $3, body_xml = $4, body_lines = $5::jsonb, updated_at = now()
        WHERE tipo = 'welcome'
          AND (body_xml ILIKE '%Use a ligação%' OR body_lines::text ILIKE '%Use a ligação%')`,
      [welcome.cta, welcome.href, welcome.ambito, xml, JSON.stringify(welcome.linhas)],
    );
    await db.query(
      `UPDATE email_templates
          SET cta_href = '{{documentos_url}}',
              cta_ambito = 'documentos',
              body_xml = regexp_replace(body_xml, '(<cta\\b[^>]*\\bhref=")[^"]*(")', '\\1{{documentos_url}}\\2'),
              updated_at = now()
        WHERE tipo = 'welcome'
          AND (cta_href IS DISTINCT FROM '{{documentos_url}}' OR COALESCE(body_xml, '') NOT LIKE '%href="{{documentos_url}}"%')`,
    );
  }

  for (const r of RULES) {
    const existing = await db.query<{ id: number }>(
      "SELECT id FROM email_rules WHERE trigger_key = $1 ORDER BY id LIMIT 1",
      [r.key],
    );
    if (existing.rows[0]) {
      if (r.key === "lead.stale_30d" || r.key === "preinscricao.unpaid_3d") {
        await db.query("UPDATE email_rules SET ativo = true WHERE id = $1", [existing.rows[0].id]);
      }
      continue;
    }
    await db.query(
      `INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, ativo)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [r.nome, r.key, r.gatilho, r.tipo, r.delay],
    );
  }

  try {
    await seedOperational(db);
    await seedPropostasDemo(db);
  } catch (err) {
    console.error("seed operacional falhou", err);
  }
}
