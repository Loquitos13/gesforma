// Avisos internos por equipa: documentos e comprovativo vão para os utilizadores das equipas da regra («Enviar para»),
// nunca para a administração (o email da entidade ou do local deixou de contar).
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

vi.mock("../src/mailer.js", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/mailer.js")>()),
  sendMail: async () => "teste",
}));

let ctx: Ctx;
let seq = 0;
beforeAll(async () => {
  ctx = await arrancar();
});

const lead = (regime: "gold" | "fin") => ({ id: 970000 + (++seq), nome: "Rui", apelido: "Costa", curso: "CCP", regime, email: `rui.${seq}@exemplo.pt` });

/** Para quem ficou na fila cada aviso desta pré-inscrição. */
async function destinos(evento: string, leadId: number) {
  const rows = (await ctx.db.query<{ to_email: string }>(
    `SELECT DISTINCT lower(j.to_email) AS to_email FROM email_jobs j
       JOIN email_rules r ON r.id = j.rule_id
       JOIN automation_events e ON e.id = j.event_id
      WHERE r.trigger_key = $1 AND e.idempotency_key LIKE $2`, [evento, `%:${leadId}:%`])).rows;
  return rows.map(r => r.to_email).sort();
}

async function emailsDosPerfis(perfis: string[]) {
  return (await ctx.db.query<{ email: string }>(
    "SELECT DISTINCT lower(email) AS email FROM users WHERE active = true AND role = ANY($1::text[])", [`{${perfis.join(",")}}`])).rows.map(r => r.email).sort();
}

describe("avisos internos por equipa", () => {
  it("documentos Gold → comerciais e coordenação Gold; Financiada → coordenação Financiada; comprovativo Gold → também a contabilidade", async () => {
    const { avisarDocumentoRecebido } = await import("../src/avisosEquipa.js");
    const gold = lead("gold");
    await avisarDocumentoRecebido(ctx.db, gold, "Todos os documentos obrigatórios: CC", "f1");
    expect(await destinos("equipa.documentos_recebidos", gold.id)).toEqual(await emailsDosPerfis(["comercial", "secretaria"]));

    const fin = lead("fin");
    await avisarDocumentoRecebido(ctx.db, fin, "Todos os documentos obrigatórios: CC", "f2");
    expect(await destinos("equipa.documentos_recebidos", fin.id)).toEqual(await emailsDosPerfis(["financiada"]));

    const pago = lead("gold");
    await avisarDocumentoRecebido(ctx.db, pago, "Comprovativo de pagamento", "f3", { comprovativo: true });
    const comprovativo = await destinos("equipa.comprovativo_recebido", pago.id);
    expect(comprovativo).toEqual(await emailsDosPerfis(["comercial", "secretaria", "contabilidade"]));
    // Nunca a administração.
    const admins = await emailsDosPerfis(["admin"]);
    for (const e of [...comprovativo, ...(await destinos("equipa.documentos_recebidos", gold.id))]) expect(admins).not.toContain(e);
  });

  it("«Enviar para» na regra muda quem recebe", async () => {
    const regras = (await pedido(ctx, "admin", "GET", "/v1/email/rules")).json().rules as { id: number; area: string; evento: string; destinatarios: string[] | null }[];
    const regra = regras.find(r => r.evento === "equipa.documentos_recebidos" && r.area === "gold")!;
    expect(regra.destinatarios).toEqual(["gold"]);
    expect((await pedido(ctx, "admin", "PATCH", `/v1/email/rules/${regra.id}`, { destinatarios: ["contabilidade"] })).statusCode).toBe(200);
    expect((await pedido(ctx, "admin", "PATCH", `/v1/email/rules/${regra.id}`, { destinatarios: ["admin"] })).statusCode).toBe(400);

    const { avisarDocumentoRecebido } = await import("../src/avisosEquipa.js");
    const l = lead("gold");
    await avisarDocumentoRecebido(ctx.db, l, "Todos os documentos obrigatórios: CC", "f4");
    expect(await destinos("equipa.documentos_recebidos", l.id)).toEqual(await emailsDosPerfis(["contabilidade"]));
    await pedido(ctx, "admin", "PATCH", `/v1/email/rules/${regra.id}`, { destinatarios: ["gold"] });
  });
});
