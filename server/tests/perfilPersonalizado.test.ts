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

  it("auditoria: regime no corpo, lotes, ficheiros, emails, pesquisa e alertas somam os perfis", async () => {
    const sf = await criar(["secretaria", "financiada"]);
    const cf = await criar(["comercial", "financiada"]);
    const cc = await criar(["comercial", "contabilidade"]);
    const fc = await criar(["financiada", "contabilidade"]);
    const regimeDe = async (id: number) => (await ctx.db.query<{ regime: string }>("SELECT regime FROM preinscricoes WHERE id = $1", [id])).rows[0]?.regime;

    // 1. Criar no regime pedido (vem no corpo).
    let r = await sf("POST", "/v1/preinscricoes", { nome: "Audit", email: `a1.${randomUUID().slice(0, 6)}@exemplo.pt`, regime: "fin", curso: "Primeiros Socorros" });
    expect(r.statusCode, r.body).toBe(200);
    expect(await regimeDe(r.json().preinscricao.id)).toBe("fin");
    r = await cf("POST", "/v1/preinscricoes", { nome: "Audit", email: `a2.${randomUUID().slice(0, 6)}@exemplo.pt`, regime: "gold", curso: "Formação de Formadores - CCP" });
    expect(r.statusCode, r.body).toBe(200);
    expect(await regimeDe(r.json().preinscricao.id)).toBe("gold");

    // 2. Lotes com o regime da lista.
    const base = 960000 + Math.floor(Math.random() * 9000);
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, estado, regime) VALUES
         ($1, '2031-01-01 10:00', 'Quokkaaudit', 'G', $3, '912', 'C', '1º Contacto', 'gold'),
         ($2, '2031-01-01 10:00', 'Quokkaaudit', 'F', $4, '913', 'C', '1º Contacto', 'fin')`,
      [base, base + 1, `qg${base}@exemplo.pt`, `qf${base}@exemplo.pt`]);
    expect((await cf("POST", "/v1/crm/lote?regime=gold", { ids: [base], acao: "estado", estado: "2º Contacto" })).json().updated).toBe(1);
    expect((await sf("POST", "/v1/crm/lote?regime=fin", { ids: [base + 1], acao: "estado", estado: "2º Contacto" })).json().updated).toBe(1);

    // 5. Pesquisa: os dois regimes.
    const regimes = (r2: { json(): { leads: { regime: string }[] } }) => r2.json().leads.map(l => l.regime).sort();
    expect(regimes(await sf("GET", "/v1/crm/search?q=Quokkaaudit"))).toEqual(["fin", "gold"]);
    expect(regimes(await cf("GET", "/v1/crm/search?q=Quokkaaudit"))).toEqual(["fin", "gold"]);

    // 6. Alertas de documentos dos dois regimes.
    await ctx.db.query("INSERT INTO doc_alertas (id, preinscricao_id) VALUES ($1, $2), ($3, $4)", [`al-${base}`, base, `al-${base + 1}`, base + 1]);
    const alertas = (await sf("GET", "/v1/alertas/documentos")).json().alertas.map((a: { preinscricaoId: number }) => a.preinscricaoId);
    expect(alertas).toEqual(expect.arrayContaining([base, base + 1]));

    // 3. Ficheiros: Financiada com a coordenação Financiada; documento da pré-inscrição Gold com o comercial.
    const fFin = `ff-${base}`;
    const fGold = `fg-${base}`;
    await ctx.db.query(
      `INSERT INTO drive_files (id, name, kind, regime, formando, stored_in) VALUES
         ($1, 'cc.pdf', 'formando-doc', 'fin', 'Ana', 'local'), ($2, 'cc.pdf', 'preinscricao-doc', 'gold', 'Ana', 'local')`, [fFin, fGold]);
    await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, drive_file_id) VALUES ($1, 'cc', 'cc.pdf', $2)", [base, fGold]);
    expect((await sf("GET", `/v1/drive/files/${fFin}`)).statusCode).toBe(200);
    expect((await cc("GET", `/v1/drive/files/${fGold}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/drive/files/${fFin}`)).statusCode).toBe(404);

    // Formadores: cada regime com o seu perfil.
    expect((await sf("GET", "/v1/formadores?regime=gold")).statusCode).toBe(200);
    expect((await sf("GET", "/v1/formadores?regime=fin")).statusCode).toBe(200);
    expect((await cf("GET", "/v1/formadores?regime=fin")).statusCode).toBe(200);

    // 4. Emails automáticos: as áreas dos dois perfis.
    const areas = (await fc("GET", "/v1/email/templates")).json();
    const areasVistas = new Set(((areas.templates ?? areas.modelos ?? []) as { area: string }[]).map(t => t.area));
    expect(areasVistas.has("fin")).toBe(true);
    expect(areasVistas.has("contabilidade")).toBe(true);
  });

  it("8. a base não aceita um personalizado sem perfis", async () => {
    await expect(ctx.db.query(
      "INSERT INTO users (id, name, email, password_hash, role, active, perfis) VALUES ($1, 'X', $2, 'x', 'personalizado', true, '{}')",
      [randomUUID(), `vazio.${randomUUID().slice(0, 6)}@exemplo.pt`])).rejects.toThrow();
  });

  it("comercial + coordenação Gold: abre a ficha do formando e trata dos comprovativos e do lembrete das prestações", async () => {
    const pessoa = await criar(["comercial", "secretaria"]);
    const id = 910000 + Math.floor(Math.random() * 9000);
    const email = `pc.${id}@exemplo.pt`;
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime, pagamento_pedido_em, prestacoes, validada_em)
       VALUES ($1, '2031-01-01 10:00', 'PC', 'T', $2, '912000000', 'Formação de Formadores - CCP', 130, 'Formando', 'gold', now(), '[80, 50]'::jsonb, now())`, [id, email]);
    const f = await pedido(ctx, "admin", "POST", "/v1/formandos-gold", { nome: "PC", apelido: "T", email, curso: "Formação de Formadores - CCP", valor: 130, semEmails: true });
    const fid = f.json().formando.id as number;
    const ficha = await pessoa("GET", `/v1/formandos/gold/${fid}`);
    expect(ficha.statusCode, ficha.body).toBe(200);
    expect(ficha.json().ficha.pagamento.preinscricaoId).toBe(id);
    expect((await pessoa("GET", "/v1/formandos?regime=gold")).statusCode).toBe(200);
    expect((await pessoa("POST", `/v1/crm/leads/${id}/lembrete-prestacao`, {})).statusCode).toBe(200);
    // Só comercial: não abre a ficha do formando.
    expect((await pedido(ctx, "comercial", "GET", `/v1/formandos/gold/${fid}`)).statusCode).toBe(403);
  });
});
