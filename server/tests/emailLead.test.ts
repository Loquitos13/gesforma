// Email à pessoa de uma pré-inscrição: o remetente é o email do local do pedido (os outros locais também se podem
// escolher); sem SMTP o envio é recusado (nada fica como «enviado»); remetentes fora dos locais são recusados.
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("email da pré-inscrição pelo local", () => {
  it("sugere o email do local do pedido, lista os outros e recusa remetentes que não são de um local", async () => {
    const ctx = await arrancar();
    await ctx.db.query("DELETE FROM catalog_items WHERE kind = 'locais'");
    const local = (id: number, regime: string, payload: Record<string, unknown>) =>
      ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', $2, $3::jsonb)", [id, regime, payload]);
    await local(991001, "gold", { nome: "Gaia", email: "ccpgaia@ena.pt", status: "Ativo" });
    await local(991002, "gold", { nome: "Lisboa", email: "ccplisboa@ena.pt", status: "Ativo" });
    await local(991003, "gold", { nome: "Braga", email: "ccpbraga@ena.pt", status: "Inactivo" });
    await local(991004, "gold", { nome: "Sala Virtual", status: "Ativo" });

    const r = await pedido(ctx, "secretaria", "POST", "/v1/preinscricoes", {
      nome: "Rita", email: "rita.email@exemplo.pt", curso: "Curso", regime: "gold", local: "Lisboa",
    });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().preinscricao.id as number;

    const info = await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}/email`);
    expect(info.statusCode, info.body).toBe(200);
    expect(info.json()).toMatchObject({
      para: "rita.email@exemplo.pt", sugerido: "ccplisboa@ena.pt",
      remetentes: [{ local: "Lisboa", email: "ccplisboa@ena.pt" }, { local: "Gaia", email: "ccpgaia@ena.pt" }],
    });

    const enviar = (de: string) => pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/email`, { de, assunto: "Pré-inscrição", texto: "Olá Rita" });
    expect((await enviar("outro@exemplo.pt")).statusCode).toBe(400);
    expect((await enviar("ccpbraga@ena.pt")).statusCode).toBe(400);
    // Nos testes não há SMTP: o envio não pode ficar como feito.
    const semSmtp = await enviar("ccplisboa@ena.pt");
    expect(semSmtp.statusCode).toBe(503);
    const notas = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM lead_eventos WHERE lead_id = $1 AND detalhe LIKE 'Email enviado%'", [id]);
    expect(notas.rows[0]!.n).toBe(0);
  });
});
