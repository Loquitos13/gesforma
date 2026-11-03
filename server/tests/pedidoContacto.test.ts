// Pedido de contacto do site: só a confirmação por email, nunca a ligação dos documentos.
// O assunto e o texto livre ficam só na ficha: o email não leva nada escrito por quem preenche o formulário.
import { describe, expect, it, vi } from "vitest";
import { arrancar } from "./helpers.js";

const enviados = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("../src/mailer.js", () => ({
  sendMail: async (_db: unknown, m: { to: string; subject: string; text: string }) => { enviados.push({ to: m.to, subject: m.subject, text: m.text }); return "teste"; },
}));

describe("pedido de contacto do site", () => {
  it("confirma o contacto sem o email dos documentos; o assunto fica só na ficha", async () => {
    const ctx = await arrancar();
    const email = `contacto.${Date.now()}@exemplo.pt`;
    const r = await ctx.app.inject({
      method: "POST", url: "/v1/public/preinscricoes", remoteAddress: "10.9.8.7",
      payload: { nome: "Jefferson", email, telf: "912345678", origem: "WhatsApp", consentimento: true, contacto: true, assunto: "Quero saber os horários do CCP", curso: "Contacto pelo site", regime: "gold" },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json() as { aviso: string }).aviso).toContain("pedido de contacto");
    const msg = enviados.find(e => e.to === email)!;
    expect(msg.subject).toBe("Recebemos o seu pedido de contacto");
    expect(msg.text).not.toContain("Quero saber os horários do CCP");
    expect(msg.text).not.toMatch(/documentos/i);
    const jobs = (await ctx.db.query("SELECT 1 FROM email_jobs WHERE to_email = $1", [email])).rows;
    expect(jobs.length).toBe(0);
    const lead = (await ctx.db.query<{ notas: string }>("SELECT notas FROM preinscricoes WHERE email = $1", [email])).rows[0]!;
    expect(lead.notas).toContain("Pedido de contacto: Quero saber os horários do CCP");
  });

  it("curso fora da oferta: só a confirmação do contacto, sem o texto do pedido", async () => {
    const ctx = await arrancar();
    const email = `fora.${Date.now()}@exemplo.pt`;
    const r = await ctx.app.inject({
      method: "POST", url: "/v1/public/preinscricoes", remoteAddress: "10.9.8.8",
      payload: { nome: "Rui", email, telf: "912345679", consentimento: true, curso: "Reembolso em http://exemplo.invalid", regime: "gold" },
    });
    expect(r.statusCode, r.body).toBe(200);
    const msg = enviados.find(e => e.to === email)!;
    expect(msg.subject).toBe("Recebemos o seu pedido de contacto");
    expect(msg.text).not.toContain("exemplo.invalid");
  });
});
