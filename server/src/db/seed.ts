import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { hashPassword, normalizeEmail } from "../security.js";
import type { Db } from "./pool.js";

const TEMPLATES = [
  {
    tipo: "welcome",
    nome: "Boas-vindas",
    assunto: "Bem-vindo(a) à ENA, {{nome}}",
    linhas: [
      "Confirmámos o seu interesse em {{curso}}.",
      "A turma {{turma}} é a unidade de gestão: datas, sessões e documentos ficam todos aí.",
      "Se ainda não escolheu horário, responda a este email ou complete a inscrição no site.",
    ],
    cta: "Ver a minha inscrição",
  },
  {
    tipo: "payment",
    nome: "Confirmação de Pagamento",
    assunto: "Pagamento confirmado – {{curso}}",
    linhas: [
      "{{nome}}, o pagamento de {{curso}} chegou.",
      "Já está inscrita na turma {{turma}}. O cronograma e o acesso à plataforma seguem nas próximas horas.",
    ],
    cta: "Abrir a turma",
  },
  {
    tipo: "sale_followup",
    nome: "Contacto após a venda",
    assunto: "Obrigado, {{nome}} — próximos passos em {{curso}}",
    linhas: [
      "O pagamento ficou registado. Daqui a pouco a secretaria confirma-lhe a turma {{turma}} e o horário.",
      "Se precisar de fatura, recibo ou de alterar o nome no certificado, responda a este email.",
      "Guarde este comprovativo. A ENA trata a formação pela turma, não por «ação».",
    ],
    cta: "Falar com a secretaria",
  },
  {
    tipo: "reminder_24h",
    nome: "Lembrete 24h",
    assunto: "Amanhã começa {{curso}}",
    linhas: [
      "{{nome}}, a primeira sessão de {{curso}} é amanhã, turma {{turma}}.",
      "Traga o CC e, se for CCP, o portefólio em construção. O link da sala está no botão abaixo.",
    ],
    cta: "Abrir o cronograma",
  },
  {
    tipo: "certificate",
    nome: "Certificado de Conclusão",
    assunto: "O seu certificado está disponível",
    linhas: [
      "Parabéns, {{nome}}. Concluiu {{curso}} na turma {{turma}}.",
      "O certificado está no cockpit da turma, em Certificados. Guarde o PDF - a ENA arquiva o DTP durante 10 anos.",
    ],
    cta: "Descarregar certificado",
  },
  {
    tipo: "reengagement",
    nome: "Reengajamento",
    assunto: "Ainda está a tempo de começar {{curso}}",
    linhas: [
      "{{nome}}, a pré-inscrição em {{curso}} ficou a meio.",
      "Há vagas na turma {{turma}}. Se quiser retomar, o pagamento reabre a inscrição sem perder os dados.",
    ],
    cta: "Retomar inscrição",
  },
];

const RULES = [
  { nome: "Boas-vindas ao registo", gatilho: "Nova pré-inscrição recebida", key: "preinscricao.created", tipo: "welcome", delay: 0 },
  { nome: "Confirmação de pagamento", gatilho: "Pagamento confirmado", key: "payment.confirmed", tipo: "payment", delay: 0 },
  { nome: "Contacto após a venda", gatilho: "Contacto após a venda", key: "sale.followup", tipo: "sale_followup", delay: 3600 },
  { nome: "Lembrete 24h antes do curso", gatilho: "24 horas antes do início", key: "turma.starts_in_24h", tipo: "reminder_24h", delay: 0 },
  { nome: "Certificado de conclusão", gatilho: "Formando marcado como concluído", key: "formando.completed", tipo: "certificate", delay: 0 },
  { nome: "Reengajamento 30 dias", gatilho: "30 dias sem compra", key: "lead.stale_30d", tipo: "reengagement", delay: 0, ativo: false },
];

export async function seed(db: Db) {
  const email = normalizeEmail(config.adminEmail);
  const existing = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!existing.rows[0]) {
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, $2, $3, $4, 'admin', true)",
      [randomUUID(), config.adminName, email, await hashPassword(config.adminPassword)],
    );
  }

  for (const t of TEMPLATES) {
    await db.query(
      `INSERT INTO email_templates (tipo, nome, assunto, body_lines, cta)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (tipo) DO UPDATE SET
         nome = EXCLUDED.nome,
         assunto = CASE WHEN email_templates.assunto = EXCLUDED.assunto THEN email_templates.assunto ELSE email_templates.assunto END,
         body_lines = CASE WHEN email_templates.body_lines = '[]'::jsonb THEN EXCLUDED.body_lines ELSE email_templates.body_lines END`,
      [t.tipo, t.nome, t.assunto, JSON.stringify(t.linhas), t.cta],
    );
    const row = await db.query<{ body_lines: unknown }>("SELECT body_lines FROM email_templates WHERE tipo = $1", [t.tipo]);
    const lines = row.rows[0]?.body_lines;
    const empty = !lines || (Array.isArray(lines) && lines.length === 0);
    if (empty) {
      await db.query(
        "UPDATE email_templates SET assunto = $2, body_lines = $3::jsonb, cta = $4, updated_at = now() WHERE tipo = $1",
        [t.tipo, t.assunto, JSON.stringify(t.linhas), t.cta],
      );
    }
  }

  const count = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM email_rules");
  if ((count.rows[0]?.n ?? 0) === 0) {
    for (const r of RULES) {
      await db.query(
        `INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, ativo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.nome, r.key, r.gatilho, r.tipo, r.delay, r.ativo !== false],
      );
    }
  }
}
