// Perfil «personalizado»: a administração junta perfis (comercial, coordenação Gold, coordenação Financiada,
// contabilidade) e a pessoa tem a soma, ao mesmo tempo. Cada pedido corre com o perfil marcado que o pode fazer.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let ctx: Ctx;
beforeAll(async () => { ctx = await arrancar(); });

async function sessaoDe(email: string) {
  const { config } = await import("../src/config.js");
  const id = (await ctx.db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email])).rows[0]!.id;
  const token = randomBytes(24).toString("hex");
  await ctx.db.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
    [randomUUID(), id, createHash("sha256").update(token).digest("hex")]);
  const cookie = `${config.cookieName}=${token}`;
  return (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, payload?: unknown) =>
    ctx.app.inject({ method, url, headers: { cookie, "x-gesforma-client": "web" }, payload: payload as never });
}

async function criar(perfis: string[]) {
  const email = `pers.${randomUUID().slice(0, 8)}@exemplo.pt`;
  const r = await pedido(ctx, "admin", "POST", "/v1/utilizadores", {
    name: "Pessoa Personalizada", email, password: "Uma.Palavra-Passe-Longa1", role: "personalizado", perfis, mustChangePassword: false,
  });
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json().user.role).toBe("personalizado");
  expect([...r.json().user.perfis].sort()).toEqual([...perfis].sort());
  return sessaoDe(email);
}

describe("perfil personalizado", () => {
  it("a administração cria e altera; sem perfis não deixa", async () => {
    const semPerfis = await pedido(ctx, "admin", "POST", "/v1/utilizadores", {
      name: "Sem Perfis", email: `sp.${randomUUID().slice(0, 8)}@exemplo.pt`, password: "Uma.Palavra-Passe-Longa1", role: "personalizado", perfis: [],
    });
    expect(semPerfis.statusCode).toBe(400);
    const errado = await pedido(ctx, "admin", "POST", "/v1/utilizadores", {
      name: "Errado", email: `er.${randomUUID().slice(0, 8)}@exemplo.pt`, password: "Uma.Palavra-Passe-Longa1", role: "personalizado", perfis: ["admin"],
    });
    expect(errado.statusCode).toBe(400);
  });

  it("Coordenação Gold + Contabilidade: a soma das duas, sem a Financiada nem a administração", async () => {
    const eu = await criar(["secretaria", "contabilidade"]);
    const me = (await eu("GET", "/v1/me")).json();
    expect(me.user.role).toBe("personalizado");
    expect([...me.user.perfis].sort()).toEqual(["contabilidade", "secretaria"]);
    expect(me.pode).toEqual(expect.arrayContaining(["gold.ver", "pagamentos.ver", "pagamentos.confirmar", "turmas.gerir"]));
    expect(me.pode).not.toContain("fin.ver");
    expect(me.pode).not.toContain("utilizadores.gerir");
    // Pagamentos (da contabilidade) e pré-inscrições Gold (da coordenação), ao mesmo tempo.
    expect((await eu("GET", "/v1/pagamentos")).statusCode).toBe(200);
    expect((await eu("GET", "/v1/crm/leads?regime=gold")).statusCode).toBe(200);
    // Financiada e utilizadores: não.
    expect((await eu("GET", "/v1/turmas?regime=fin")).statusCode).toBe(403);
    expect((await eu("GET", "/v1/utilizadores")).statusCode).toBe(403);
  });

  it("Comercial + Coordenação Financiada: Gold com as regras do comercial, Financiada com as da coordenação", async () => {
    const eu = await criar(["comercial", "financiada"]);
    const gold = await eu("GET", "/v1/crm/leads?regime=gold");
    expect(gold.statusCode, gold.body).toBe(200);
    const fin = await eu("GET", "/v1/crm/leads?regime=fin");
    expect(fin.statusCode, fin.body).toBe(200);
    expect((await eu("GET", "/v1/turmas?regime=fin")).statusCode).toBe(200);
    // O comercial não gere turmas Gold, e a coordenação Financiada também não: fica fechado.
    expect((await eu("POST", "/v1/turmas-gold", { dataInicio: "2099-01-01", nome: "X", curso: "CCP", local: "Porto", horario: "Laboral", vagas: 5 })).statusCode).toBe(403);
    // Uma pré-inscrição pelo número (sem regime no caminho): a Gold abre como comercial, a Financiada como coordenação.
    const base = 970000 + Math.floor(Math.random() * 9000);
    for (const [id, regime] of [[base, "gold"], [base + 1, "fin"]] as const) {
      await ctx.db.query(
        `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, estado, regime)
         VALUES ($1, '2031-01-01 10:00', 'Pers', 'Teste', $2, '912000000', 'Curso', '1º Contacto', $3)`, [id, `p${id}@exemplo.pt`, regime]);
    }
    expect((await eu("GET", `/v1/crm/leads/${base}`)).statusCode).toBe(200);
    expect((await eu("GET", `/v1/crm/leads/${base + 1}`)).statusCode).toBe(200);
    // Pagamentos (contabilidade): não.
    expect((await eu("GET", "/v1/pagamentos")).statusCode).toBe(403);
  });

  it("aparece como comercial para atribuir pré-inscrições e recebe os avisos das equipas marcadas", async () => {
    const email = `pc.${randomUUID().slice(0, 8)}@exemplo.pt`;
    await pedido(ctx, "admin", "POST", "/v1/utilizadores", {
      name: "Comercial Personalizado", email, password: "Uma.Palavra-Passe-Longa1", role: "personalizado", perfis: ["comercial", "financiada"],
    });
    const { emailsDaEquipa } = await import("../src/equipaDestinatarios.js");
    expect((await emailsDaEquipa(ctx.db, ["gold"])).map(e => e.email)).toContain(email);
    expect((await emailsDaEquipa(ctx.db, ["fin"])).map(e => e.email)).toContain(email);
    expect((await emailsDaEquipa(ctx.db, ["contabilidade"])).map(e => e.email)).not.toContain(email);
    const id = (await ctx.db.query<{ id: string }>("SELECT id::text AS id FROM users WHERE email = $1", [email])).rows[0]!.id;
    const { eComercial } = await import("../src/repos/leads.js");
    expect(await eComercial(ctx.db, id)).toBe(true);
  });
});
