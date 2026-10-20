import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Nodemailer verdadeiro com jsonTransport (como em auditoria2Emails); conta os transportes criados e as opções.
const enviados = vi.hoisted(() => [] as { to: string[] }[]);
const transportes = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("nodemailer", async importOriginal => {
  const real = ((await importOriginal()) as { default: typeof import("nodemailer") }).default;
  return {
    default: {
      createTransport: (opcoes: Record<string, unknown>) => {
        transportes.push(opcoes);
        const t = real.createTransport({ jsonTransport: true });
        return {
          sendMail: async (m: Parameters<typeof t.sendMail>[0]) => {
            const info = await t.sendMail(m);
            enviados.push({ to: (info.envelope as { to: string[] }).to });
            return info;
          },
        };
      },
    },
  };
});

let ctx: Ctx;
beforeAll(async () => {
  ctx = await arrancar();
  const { sealSecret } = await import("../src/secretBox.js");
  const { gravarSmtp } = await import("../src/repos/integracoes.js");
  await gravarSmtp(ctx.db, {
    host: "smtp.exemplo.pt", port: 587, login: "login", passwordSealed: sealSecret("segredo"),
    fromName: "ENA", fromEmail: "geral@exemplo.pt", replyTo: "",
  });
});

const paraQuem = (email: string) => enviados.filter(e => e.to.includes(email));
const unico = (p: string) => `${p}.${randomUUID().slice(0, 8)}@exemplo.pt`;

async function lead(email: string, estado = "1º Contacto", diasAtras = 40) {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, created_at)
     VALUES (nextval('ops_id_seq')::int, to_char(now() - make_interval(days => $3::int), 'YYYY-MM-DD'), 'Lia', $1, 'Curso Pony', 100, $2, 'gold',
             now() - make_interval(days => $3::int))
     RETURNING id`,
    [email, estado, diasAtras],
  );
  return r.rows[0]!.id;
}
const estadoLead = async (id: number) =>
  (await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricoes WHERE id = $1", [id])).rows[0]!.estado;
const contactos = async (id: number) =>
  (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM preinscricao_contactos WHERE preinscricao_id = $1", [id])).rows[0]!.n;
const ligarRegras = (chaves: string[], ativo: boolean) =>
  ctx.db.query("UPDATE email_rules SET ativo = $2 WHERE trigger_key = ANY($1::text[])", [`{${chaves.join(",")}}`, ativo]);

afterEach(async () => {
  await ligarRegras(["preinscricao.unpaid_3d", "lead.stale_30d", "preinscricao.created", "preinscricao.promoted"], true);
});

describe("Cron diário dentro dos 30 s (achado 11)", () => {
  it("leads parados: quem já teve o lembrete não volta à lista", async () => {
    const { leadsParados } = await import("../src/repos/emails.js");
    const { registarEvento } = await import("../src/repos/emails.js");
    const email = unico("parado");
    const id = await lead(email);
    expect((await leadsParados(ctx.db, 3, true, "unpaid3d")).map(r => r.id)).toContain(id);
    await registarEvento(ctx.db, randomUUID(), "preinscricao.unpaid_3d", `unpaid3d:${id}:${email}`, { email });
    expect((await leadsParados(ctx.db, 3, true, "unpaid3d")).map(r => r.id)).not.toContain(id);
    // O outro lembrete (30 dias) tem chave própria: continua na lista dele.
    expect((await leadsParados(ctx.db, 30, false, "stale30d")).map(r => r.id)).toContain(id);
  });

  it("com o prazo esgotado, nem lembretes nem fila: nada fica reservado a meio", async () => {
    const { processDueJobs } = await import("../src/automations.js");
    const { enviarLembretesPreinscricao } = await import("../src/lembretePre.js");
    const fim = Date.now() - 1;
    expect((await enviarLembretesPreinscricao(ctx.db, fim)).enviados).toBe(0);
    expect(await processDueJobs(ctx.db, fim)).toMatchObject({ picked: 0, sent: 0 });
  });

  it("o transporte SMTP é reaproveitado e tem limites de tempo", async () => {
    const { sendMail } = await import("../src/mailer.js");
    const antes = transportes.length;
    await sendMail(ctx.db, { to: unico("t1"), name: "T", subject: "Um", text: "x" });
    await sendMail(ctx.db, { to: unico("t2"), name: "T", subject: "Dois", text: "x" });
    expect(transportes.length - antes).toBeLessThanOrEqual(1);
    expect(transportes.at(-1)).toMatchObject({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000 });
  });

  it("os envios do evento acabado de entrar saem antes da fila antiga", async () => {
    const { flushQueuedJobs } = await import("../src/automations.js");
    const { registarEvento } = await import("../src/repos/emails.js");
    const regra = (await ctx.db.query<{ id: number }>("SELECT id FROM email_rules ORDER BY id LIMIT 1")).rows[0]!.id;
    const porJob = async (email: string, minutos: number) => {
      const ev = (await registarEvento(ctx.db, randomUUID(), "teste.fila", `pony:${randomUUID()}`, { email }))!;
      await ctx.db.query(
        `INSERT INTO email_jobs (id, rule_id, event_id, to_email, to_name, subject, body_text, scheduled_at)
         VALUES ($1, $2, $3, $4, 'T', 'Assunto', 'Corpo', now() - make_interval(mins => $5::int))`,
        [randomUUID(), regra, ev, email, minutos],
      );
      return ev;
    };
    for (let i = 0; i < 3; i++) await porJob(unico("campanha"), 60);
    const novo = unico("boasvindas");
    const ev = await porJob(novo, 0);
    const r = await flushQueuedJobs(ctx.db, 1, 0, ev);
    expect(r.sent).toBe(1);
    expect(paraQuem(novo)).toHaveLength(1);
  });
});

describe("Nova ligação (achado 12)", () => {
  it("cada pedido envia um email novo; sem envio não fica contacto", async () => {
    const email = unico("ligacao");
    const id = await lead(email, "Pré-inscrição", 1);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/nova-ligacao`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/nova-ligacao`)).statusCode).toBe(200);
    expect(paraQuem(email)).toHaveLength(2);
    expect(await contactos(id)).toBe(2);
    // Não salta etapas do funil (antes passava a «Pré-inscrição» com o evento promoted).
    const outro = unico("funil");
    const idOutro = await lead(outro, "Não contactado", 1);
    await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${idOutro}/nova-ligacao`);
    expect(await estadoLead(idOutro)).toBe("1º Contacto");

    await ligarRegras(["preinscricao.created"], false);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/nova-ligacao`)).statusCode).toBe(200);
    expect(paraQuem(email)).toHaveLength(2);
    expect(await contactos(id)).toBe(2);
  });

  it("voltar a pôr em Pré-inscrição não regista um contacto que não saiu", async () => {
    const { notificarDocumentos } = await import("../src/docsLink.js");
    const email = unico("promovido");
    const id = await lead(email, "Pré-inscrição", 1);
    expect((await notificarDocumentos(ctx.db, id))?.queued).toBeGreaterThan(0);
    expect(await contactos(id)).toBe(1);
    expect((await notificarDocumentos(ctx.db, id))?.queued).toBe(0);
    expect(await contactos(id)).toBe(1);
  });
});

describe("Lembretes de 3 e 30 dias sem email não mudam a etapa (achado 13)", () => {
  it("regra desligada: o lead fica onde estava", async () => {
    const { ingestEvent } = await import("../src/automations.js");
    await ligarRegras(["preinscricao.unpaid_3d", "lead.stale_30d"], false);
    const email = unico("semregra");
    const id = await lead(email);
    for (const tipo of ["preinscricao.unpaid_3d", "lead.stale_30d"]) {
      const r = await ingestEvent(ctx.db, tipo, { email, nome: "Lia", preinscricaoId: id }, `${tipo}:${id}:${randomUUID()}`);
      expect(r.queued).toBe(0);
    }
    expect(await estadoLead(id)).toBe("1º Contacto");
    await ligarRegras(["preinscricao.unpaid_3d"], true);
    await ingestEvent(ctx.db, "preinscricao.unpaid_3d", { email, nome: "Lia", preinscricaoId: id }, `unpaid:${id}:${randomUUID()}`);
    expect(await estadoLead(id)).toBe("2º Contacto");
  });
});

describe("O seed respeita as regras desligadas (achado 14)", () => {
  it("correr o seed outra vez não volta a ligar os lembretes", async () => {
    const { seed } = await import("../src/db/seed.js");
    await ligarRegras(["preinscricao.unpaid_3d", "lead.stale_30d"], false);
    await seed(ctx.db);
    const r = await ctx.db.query<{ ativo: boolean }>(
      "SELECT ativo FROM email_rules WHERE trigger_key IN ('preinscricao.unpaid_3d', 'lead.stale_30d')",
    );
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every(x => !x.ativo)).toBe(true);
  });
});
