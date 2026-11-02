import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ingestEvent } from "../src/automations.js";
import { arrancar } from "./helpers.js";

const unico = (p: string) => `${p}.${randomUUID().slice(0, 8)}@exemplo.pt`;

describe("um evento, um email", () => {
  it("pré-inscrição promovida: só a regra da promovida (não também a da nova pré-inscrição)", async () => {
    const ctx = await arrancar();
    const email = unico("promovida");
    await ingestEvent(ctx.db, "preinscricao.promoted", { email, nome: "Lia", curso: "Curso X" }, `promovida:${email}`);
    const jobs = await ctx.db.query<{ trigger_key: string }>(
      "SELECT r.trigger_key FROM email_jobs j JOIN email_rules r ON r.id = j.rule_id WHERE j.to_email = $1", [email]);
    expect(jobs.rows.map(r => r.trigger_key)).toEqual(["preinscricao.promoted"]);
  });

  it("pagamento confirmado: um só email (o «contacto após a venda» já não sai junto)", async () => {
    const ctx = await arrancar();
    const email = unico("pago");
    await ingestEvent(ctx.db, "payment.confirmed", { email, nome: "Rui", curso: "Curso X" }, `pago:${email}`);
    const jobs = await ctx.db.query<{ trigger_key: string }>(
      "SELECT r.trigger_key FROM email_jobs j JOIN email_rules r ON r.id = j.rule_id WHERE j.to_email = $1", [email]);
    expect(jobs.rows.map(r => r.trigger_key)).toEqual(["payment.confirmed"]);
  });
});
