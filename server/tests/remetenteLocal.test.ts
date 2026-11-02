// Os emails automáticos saem do email do local da pessoa; se o SMTP recusar esse remetente, sai do geral com resposta
// para o local.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, type Ctx } from "./helpers.js";

const enviados = vi.hoisted(() => [] as { from: string; replyTo: string; to: string }[]);
const recusar = vi.hoisted(() => ({ de: "" }));
vi.mock("nodemailer", async importOriginal => {
  const real = ((await importOriginal()) as { default: typeof import("nodemailer") }).default;
  return {
    default: {
      createTransport: () => {
        const t = real.createTransport({ jsonTransport: true });
        return {
          sendMail: async (m: Parameters<typeof t.sendMail>[0]) => {
            const info = await t.sendMail(m);
            const msg = JSON.parse(String(info.message)) as { from: { address: string }; replyTo?: { address: string }[]; to: { address: string }[] };
            if (recusar.de && msg.from.address === recusar.de) throw new Error("550 sender not allowed");
            enviados.push({ from: msg.from.address, replyTo: msg.replyTo?.[0]?.address ?? "", to: msg.to[0]!.address });
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
  await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES (990951, 'locais', 'gold', $1::jsonb)",
    [{ nome: "V.N.Gaia", email: "gaia@exemplo.pt", status: "Ativo" }]);
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, local)
     VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Rita', 'rita.local@exemplo.pt', 'Curso', 'Não contactado', 'gold', 'V. N. Gaia')`);
});
afterAll(async () => { await ctx.db.query("DELETE FROM catalog_items WHERE id = 990951"); });

describe("remetente do local", () => {
  it("o email da pessoa sai do email do seu local; sem local, do geral", async () => {
    const { sendMail } = await import("../src/mailer.js");
    await sendMail(ctx.db, { to: "rita.local@exemplo.pt", name: "Rita", subject: "Olá", text: "Corpo" });
    expect(enviados.at(-1)).toEqual({ from: "gaia@exemplo.pt", replyTo: "gaia@exemplo.pt", to: "rita.local@exemplo.pt" });

    await sendMail(ctx.db, { to: "sem.local@exemplo.pt", name: "X", subject: "Olá", text: "Corpo" });
    expect(enviados.at(-1)!.from).toBe("geral@exemplo.pt");

    await sendMail(ctx.db, { to: "rita.local@exemplo.pt", name: "Rita", subject: "Teste", text: "Corpo", semLocal: true });
    expect(enviados.at(-1)!.from).toBe("geral@exemplo.pt");
  });

  it("se o SMTP recusar o endereço do local, sai do geral com a resposta para o local", async () => {
    const { sendMail } = await import("../src/mailer.js");
    recusar.de = "gaia@exemplo.pt";
    await sendMail(ctx.db, { to: "rita.local@exemplo.pt", name: "Rita", subject: "Olá", text: "Corpo" });
    recusar.de = "";
    expect(enviados.at(-1)).toEqual({ from: "geral@exemplo.pt", replyTo: "gaia@exemplo.pt", to: "rita.local@exemplo.pt" });
  });
});
