import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Os envios saem por um nodemailer verdadeiro com jsonTransport: o envelope é o que o SMTP receberia.
const enviados = vi.hoisted(() => [] as { envelope: { from: string; to: string[] }; message: string }[]);
vi.mock("nodemailer", async importOriginal => {
  const real = ((await importOriginal()) as { default: typeof import("nodemailer") }).default;
  return {
    default: {
      createTransport: () => {
        const t = real.createTransport({ jsonTransport: true });
        return {
          sendMail: async (m: Parameters<typeof t.sendMail>[0]) => {
            const info = await t.sendMail(m);
            // Um envio real demora: dá tempo a outro processo de ler a mesma fila.
            await new Promise(r => setTimeout(r, 5));
            enviados.push({ envelope: info.envelope as never, message: String(info.message) });
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
    fromName: "ENA, Formação <intruso@mau.pt>", fromEmail: "geral@exemplo.pt", replyTo: "",
  });
});

const paraQuem = (email: string) => enviados.filter(e => e.envelope.to.includes(email));

async function regraId() {
  const r = await ctx.db.query<{ id: number }>("SELECT id FROM email_rules ORDER BY id LIMIT 1");
  return r.rows[0]!.id;
}

async function porJob(email: string, extra: { estado?: string; reservadoHaMin?: number } = {}) {
  const { registarEvento } = await import("../src/repos/emails.js");
  const ev = await registarEvento(ctx.db, randomUUID(), "teste.fila", `fila:${randomUUID()}`, { email });
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO email_jobs (id, rule_id, event_id, to_email, to_name, subject, body_text, scheduled_at, status, claimed_at)
     VALUES ($1, $2, $3, $4, 'Teste', 'Assunto', 'Corpo', now() - interval '1 minute', $5,
             CASE WHEN $6::int IS NULL THEN NULL ELSE now() - make_interval(mins => $6::int) END)`,
    [id, await regraId(), ev, email, extra.estado ?? "queued", extra.reservadoHaMin ?? null],
  );
  return id;
}

const estado = async (id: string) =>
  (await ctx.db.query<{ status: string; last_error: string | null }>("SELECT status, last_error FROM email_jobs WHERE id = $1", [id])).rows[0]!;

describe("Destinatário: o nome não acrescenta endereços (achado 7)", () => {
  it("vírgulas e endereços no nome ficam no nome; o envelope só leva o destinatário", async () => {
    const { sendMail } = await import("../src/mailer.js");
    await sendMail(ctx.db, {
      to: "ana@exemplo.pt", name: '"Ana" terceiro@evil.com, Silva <outro@evil.com>', subject: "Olá", text: "Corpo",
    });
    const e = enviados.at(-1)!;
    expect(e.envelope.to).toEqual(["ana@exemplo.pt"]);
    expect(e.envelope.from).toBe("geral@exemplo.pt");
  });
});

describe("Fila de emails reservada (achado 10)", () => {
  it("três envios da fila ao mesmo tempo não repetem nenhum email", async () => {
    const { flushQueuedJobs } = await import("../src/automations.js");
    const emails = Array.from({ length: 6 }, (_, i) => `fila.${i}.${randomUUID().slice(0, 8)}@exemplo.pt`);
    const ids = [];
    for (const e of emails) ids.push(await porJob(e));
    await Promise.all([flushQueuedJobs(ctx.db, 4), flushQueuedJobs(ctx.db, 4), flushQueuedJobs(ctx.db, 4)]);
    await flushQueuedJobs(ctx.db, 20);
    for (const e of emails) expect(paraQuem(e)).toHaveLength(1);
    for (const id of ids) expect((await estado(id)).status).toBe("sent");
  });

  it("com orçamento de tempo esvazia a fila em vários lotes", async () => {
    const { flushQueuedJobs } = await import("../src/automations.js");
    const emails = Array.from({ length: 5 }, (_, i) => `lote.${i}.${randomUUID().slice(0, 8)}@exemplo.pt`);
    for (const e of emails) await porJob(e);
    await flushQueuedJobs(ctx.db, 2, 60_000);
    for (const e of emails) expect(paraQuem(e)).toHaveLength(1);
  });

  it("uma reserva presa há mais de 10 minutos passa a falhada (para rever), não volta a sair sozinha", async () => {
    const { processDueJobs } = await import("../src/automations.js");
    const preso = `preso.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const recente = `recente.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const idPreso = await porJob(preso, { estado: "sending", reservadoHaMin: 15 });
    const idRecente = await porJob(recente, { estado: "sending", reservadoHaMin: 1 });
    await processDueJobs(ctx.db);
    expect(await estado(idPreso)).toMatchObject({ status: "failed", last_error: expect.stringContaining("interrompido") });
    expect((await estado(idRecente)).status).toBe("sending");
    expect(paraQuem(preso)).toHaveLength(0);
    expect(paraQuem(recente)).toHaveLength(0);
  });

  it("a campanha repetida no mesmo dia não volta a pôr o email na fila", async () => {
    const { enviarCampanha } = await import("../src/campanhasEmail.js");
    const curso = `Curso Dup ${Date.now()}`;
    const email = `dup.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const r = await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, created_at)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Dup', $1, $2, 100, '2º Contacto', 'gold', now() - interval '40 days')
       RETURNING id`, [email, curso]);
    const lead = r.rows[0]!.id;
    for (let i = 0; i < 2; i++) await ctx.db.query("INSERT INTO preinscricao_contactos (preinscricao_id, nota) VALUES ($1, 'x')", [lead]);
    const p = { ids: [lead], campanhaId: null, criterios: { dias: 30, contactos: 2, curso } };
    const a = await enviarCampanha(ctx.db, ctx.userId.comercial, p);
    const b = await enviarCampanha(ctx.db, ctx.userId.comercial, p);
    expect(a.postos).toBe(1);
    expect(b.postos).toBe(0);
    const jobs = await ctx.db.query("SELECT 1 FROM email_jobs WHERE to_email = $1", [email]);
    expect(jobs.rows).toHaveLength(1);
    const contactos = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM preinscricao_contactos WHERE preinscricao_id = $1", [lead]);
    expect(contactos.rows[0]!.n).toBe(3);
  });
});

describe("POST /v1/events só com eventos permitidos e leads visíveis (achado 12)", () => {
  async function lead(dono: string | null, regime = "gold") {
    const email = `ev.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const r = await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, comercial_id)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Ev', $1, 'Curso Ev', 100, 'Não contactado', $2, $3) RETURNING id`,
      [email, regime, dono]);
    return { id: r.rows[0]!.id, email };
  }
  const estadoLead = async (id: number) =>
    (await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricoes WHERE id = $1", [id])).rows[0]!.estado;
  const evento = (perfil: Parameters<typeof pedido>[1], type: string, email: string, preinscricaoId?: number) =>
    pedido(ctx, perfil, "POST", "/v1/events", {
      type, payload: { email, nome: "Ev", ...(preinscricaoId ? { preinscricaoId } : {}) }, idempotencyKey: `ev:${randomUUID()}`,
    });

  it("payment.confirmed e sale.followup nunca entram por aqui, nem para a secretaria", async () => {
    const l = await lead(ctx.userId.comercial);
    for (const perfil of ["comercial", "secretaria", "admin"] as const) {
      expect((await evento(perfil, "payment.confirmed", l.email, l.id)).statusCode).toBe(403);
      expect((await evento(perfil, "sale.followup", l.email, l.id)).statusCode).toBe(403);
    }
    expect(await estadoLead(l.id)).toBe("Não contactado");
    expect(paraQuem(l.email)).toHaveLength(0);
  });

  it("o comercial só mexe nos próprios leads, com o email do lead", async () => {
    const alheio = await lead(ctx.userId.admin);
    expect((await evento("comercial", "preinscricao.contacted", alheio.email, alheio.id)).statusCode).toBe(404);
    expect((await evento("comercial", "preinscricao.contacted", alheio.email)).statusCode).toBe(400);
    expect(await estadoLead(alheio.id)).toBe("Não contactado");

    const meu = await lead(ctx.userId.comercial);
    expect((await evento("comercial", "preinscricao.contacted", alheio.email, meu.id)).statusCode).toBe(403);
    const ok = await evento("comercial", "preinscricao.contacted", meu.email, meu.id);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(await estadoLead(meu.id)).toBe("1º Contacto");
  });

  it("a Financiada não toca em leads Gold", async () => {
    const gold = await lead(null, "gold");
    expect((await evento("financiada", "preinscricao.contacted", gold.email, gold.id)).statusCode).toBe(404);
  });

  it("o aviso do sumário continua a sair para o próprio", async () => {
    const u = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
    expect((await evento("formador", "sessao.summary_signed", u.rows[0]!.email)).statusCode).toBe(200);
    const c = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.comercial]);
    expect((await evento("comercial", "sessao.summary_signed", c.rows[0]!.email)).statusCode).toBe(200);
    expect((await evento("comercial", "sessao.summary_signed", u.rows[0]!.email)).statusCode).toBe(403);
  });
});

describe("Cron dos emails (achados 18 e 27)", () => {
  let antes = "";
  beforeAll(async () => {
    const { config } = await import("../src/config.js");
    antes = config.cronSecret;
  });
  afterAll(async () => {
    const { config } = await import("../src/config.js");
    config.cronSecret = antes;
  });
  const cron = (headers: Record<string, string>) => ctx.app.inject({ method: "GET", url: "/v1/cron/email", headers });

  it("sem CRON_SECRET recusa com 503; o cabeçalho x-vercel-cron não abre", async () => {
    const { config } = await import("../src/config.js");
    config.cronSecret = "";
    expect((await cron({ "x-vercel-cron": "1" })).statusCode).toBe(503);
    config.cronSecret = "segredo-do-cron";
    expect((await cron({ "x-vercel-cron": "1" })).statusCode).toBe(401);
    expect((await cron({ authorization: "Bearer outro" })).statusCode).toBe(401);
  });

  it("com o Bearer certo envia os lembretes das pré-inscrições e esvazia a fila", async () => {
    const { config } = await import("../src/config.js");
    config.cronSecret = "segredo-do-cron";
    const emails = Array.from({ length: 25 }, (_, i) => `cron.${i}.${randomUUID().slice(0, 8)}@exemplo.pt`);
    for (const e of emails) await porJob(e);
    const res = await cron({ authorization: "Bearer segredo-do-cron" });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toHaveProperty("lembretesPreinscricao");
    for (const e of emails) expect(paraQuem(e)).toHaveLength(1);
  });
});

describe("Histórico de envios (achado 10)", () => {
  it("GET /v1/email/jobs só lista", async () => {
    const res = await pedido(ctx, "secretaria", "GET", "/v1/email/jobs");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("stats");
  });
});
