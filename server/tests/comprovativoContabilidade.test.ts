// O comprovativo de pagamento segue para os utilizadores da contabilidade com os dados da pessoa e o ficheiro em anexo.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, type Ctx } from "./helpers.js";

const enviados = vi.hoisted(() => [] as { to: string; subject: string; text: string; anexos: string[] }[]);
vi.mock("../src/mailer.js", () => ({
  sendMail: async (_db: unknown, m: { to: string; subject: string; text: string; anexos?: { nome: string }[] }) => {
    enviados.push({ to: m.to, subject: m.subject, text: m.text, anexos: (m.anexos ?? []).map(a => a.nome) });
    return "teste";
  },
}));

let ctx: Ctx;
beforeAll(async () => { ctx = await arrancar(); });

describe("comprovativo para a contabilidade", () => {
  it("sem utilizadores da contabilidade não sai; com eles leva nome, NIF, telemóvel, email e o anexo", async () => {
    const { enviarComprovativoContabilidade } = await import("../src/comprovativoContabilidade.js");
    const lead = { nome: "Rita", apelido: "Sousa", nif: "123456789", telf: "910000000", email: "rita@exemplo.pt", curso: "CCP", preco: 125 };
    const ficheiro = { nome: "Comprovativo - Rita Sousa.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF") };
    await ctx.db.query("DELETE FROM app_settings WHERE id = 'entidade'");
    await ctx.db.query("INSERT INTO app_settings (id, values) VALUES ('entidade', $1::jsonb)", [{ emailContabilidade: "externo@exemplo.pt", iban: "PT50000000000000000000000" }]);
    // O email da contabilidade das Configurações já não conta: só os utilizadores com o perfil Contabilidade.
    await ctx.db.query("UPDATE users SET active = false WHERE role = 'contabilidade'");
    expect(await enviarComprovativoContabilidade(ctx.db, lead, ficheiro)).toBe(false);

    await ctx.db.query("UPDATE users SET active = true, email = 'contas@exemplo.pt' WHERE id = $1", [ctx.userId.contabilidade]);
    const antes = enviados.length;
    expect(await enviarComprovativoContabilidade(ctx.db, lead, ficheiro)).toBe(true);
    expect(enviados.slice(antes).map(x => x.to)).toEqual(["contas@exemplo.pt"]);
    const e = enviados.at(-1)!;
    expect(e.subject).toContain("Rita Sousa");
    for (const t of ["123456789", "910000000", "rita@exemplo.pt", "125,00"]) expect(e.text).toContain(t);
    expect(e.anexos).toEqual(["Comprovativo - Rita Sousa.pdf"]);
  });
});
