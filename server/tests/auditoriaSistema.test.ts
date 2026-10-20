import { createHash, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Auditoria: sistema, equipa, formadores e autenticação. Em PGlite o RLS não actua (como em produção,
// onde a API liga como superutilizador): estes testes provam que as regras estão no código e nos triggers.

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;
const emailUnico = (p: string) => `${p}.${Date.now()}.${++seq}@exemplo.pt`;

/** Conta nova com sessão própria (para perfis e estados que os testes alteram). */
async function contaComSessao(ctx: Ctx, role: string, extra: { mustChange?: boolean } = {}) {
  const id = randomUUID();
  await ctx.db.query(
    "INSERT INTO users (id, name, email, password_hash, role, active, must_change_password) VALUES ($1, $2, $3, 'x', $4, true, $5)",
    [id, `Conta ${role}`, emailUnico(role), role, Boolean(extra.mustChange)],
  );
  const token = randomBytes(24).toString("hex");
  await ctx.db.query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
    [randomUUID(), id, createHash("sha256").update(token).digest("hex")],
  );
  const { config } = await import("../src/config.js");
  return { id, cookie: `${config.cookieName}=${token}` };
}

function como(ctx: Ctx, cookie: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) {
  return ctx.app.inject({ method, url, headers: { "x-gesforma-client": "web", cookie }, payload: payload as never });
}

/** Corre uma escrita como se viesse de um pedido deste perfil (o contexto que a API põe em cada transacção). */
async function comoPerfil(ctx: Ctx, role: string, userId: string, sql: string, params: unknown[]) {
  return ctx.db.tx(async q => {
    await q("SELECT set_config('app.role', $1, true), set_config('app.user_id', $2, true)", [role, userId]);
    return q(sql, params);
  });
}

async function fichaFormador(ctx: Ctx, regimes: string[], extra: { userId?: string; email?: string } = {}) {
  const nome = unico("Formador Auditoria");
  const r = await ctx.db.query<{ id: number }>(
    "INSERT INTO formadores (id, nome, email, regimes, user_id) VALUES (nextval('ops_id_seq')::int, $1, $2, $3::jsonb, $4) RETURNING id",
    [nome, extra.email ?? "", JSON.stringify(regimes), extra.userId ?? null],
  );
  return { id: r.rows[0]!.id, nome };
}

describe("admin do ambiente no seed", () => {
  it("não volta a ser criado se já há um administrador; é criado (com auditoria) só sem nenhum", async () => {
    const ctx = await arrancar();
    const { config } = await import("../src/config.js");
    const { seed } = await import("../src/db/seed.js");
    const email = config.adminEmail.trim().toLowerCase();

    // A administração mudou o email do admin do ambiente: o arranque a frio não o recria.
    const novoEmail = emailUnico("admin.renomeado");
    await ctx.db.query("UPDATE users SET email = $2 WHERE email = $1", [email, novoEmail]);
    await seed(ctx.db);
    expect((await ctx.db.query("SELECT 1 FROM users WHERE email = $1", [email])).rows).toHaveLength(0);

    // Base sem nenhum admin: cria-o e regista na auditoria.
    const admins = (await ctx.db.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")).rows.map(r => r.id);
    await ctx.db.query("UPDATE users SET role = 'secretaria' WHERE id::text IN (SELECT jsonb_array_elements_text($1::jsonb))", [admins]);
    try {
      await seed(ctx.db);
      const criado = await ctx.db.query<{ id: string; role: string }>("SELECT id, role FROM users WHERE email = $1", [email]);
      expect(criado.rows[0]?.role).toBe("admin");
      const ev = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'user.seed_admin' AND entity_id = $1", [criado.rows[0]!.id]);
      expect(ev.rows).toHaveLength(1);
      await ctx.db.query("DELETE FROM users WHERE id = $1", [criado.rows[0]!.id]);
    } finally {
      await ctx.db.query("UPDATE users SET role = 'admin' WHERE id::text IN (SELECT jsonb_array_elements_text($1::jsonb))", [admins]);
      await ctx.db.query("UPDATE users SET email = $1 WHERE email = $2", [email, novoEmail]);
    }
  });
});

describe("formadores: Gold e Financiada não se misturam", () => {
  it("a Financiada não altera, apaga nem cria fichas da Gold", async () => {
    const ctx = await arrancar();
    const gold = await fichaFormador(ctx, ["gold"]);
    const misto = await fichaFormador(ctx, ["gold", "fin"]);
    const fin = await fichaFormador(ctx, ["fin"]);

    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${gold.id}`, { telf: "910000000" })).statusCode).toBe(403);
    // A ficha partilhada (Gold e Financiada) é também da Financiada: altera-a, mas não lhe tira a Gold.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${misto.id}`, { telf: "910000000" })).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${misto.id}`, { regimes: ["fin"] })).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/formadores/${gold.id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/formadores/${misto.id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "POST", "/v1/formadores", { nome: unico("Fin cria Gold"), regimes: ["gold"] })).statusCode).toBe(403);
    // Pôr a ficha da Financiada também na Gold é mexer na Gold.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${fin.id}`, { regimes: ["fin", "gold"] })).statusCode).toBe(403);
    expect((await ctx.db.query("SELECT 1 FROM formadores WHERE id::text IN (SELECT jsonb_array_elements_text($1::jsonb))", [[gold.id, misto.id]])).rows).toHaveLength(2);

    const ok = await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${fin.id}`, { telf: "910000001" });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/formadores/${fin.id}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${misto.id}`, { telf: "910000002" })).statusCode).toBe(200);
  });
});

describe("formadores: conta de acesso", () => {
  it("não liga a ficha a uma conta da equipa nem à de outro formador (409, sem ficha a meio)", async () => {
    const ctx = await arrancar();
    const equipa = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.secretaria]);
    const nomeEquipa = unico("Formador Email Equipa");
    const r1 = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: nomeEquipa, email: equipa.rows[0]!.email, regimes: ["gold"] });
    expect(r1.statusCode, r1.body).toBe(409);
    expect((await ctx.db.query("SELECT 1 FROM formadores WHERE nome = $1", [nomeEquipa])).rows).toHaveLength(0);

    const email = emailUnico("formador.unico");
    const a = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: unico("Formador A"), email, regimes: ["gold"] });
    expect(a.statusCode, a.body).toBe(200);
    expect(a.json().acesso?.criado).toBe(true);
    const nomeB = unico("Formador B");
    const b = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: nomeB, email, regimes: ["gold"] });
    expect(b.statusCode, b.body).toBe(409);
    expect((await ctx.db.query("SELECT 1 FROM formadores WHERE nome = $1", [nomeB])).rows).toHaveLength(0);

    // Ficha sem conta: dar-lhe o email de outro formador também é recusado, e a alteração não fica.
    const c = await fichaFormador(ctx, ["gold"]);
    const r2 = await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${c.id}`, { email, telf: "911111111" });
    expect(r2.statusCode, r2.body).toBe(409);
    const depois = await ctx.db.query<{ email: string; telf: string; user_id: string | null }>("SELECT email, telf, user_id FROM formadores WHERE id = $1", [c.id]);
    expect(depois.rows[0]).toMatchObject({ email: "", user_id: null });
    expect(depois.rows[0]!.telf).not.toBe("911111111");

    // Conta de formador ainda sem ficha: liga-se.
    const solta = await contaComSessao(ctx, "formador");
    const emailSolta = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [solta.id])).rows[0]!.email;
    const d = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: unico("Formador D"), email: emailSolta, regimes: ["gold"] });
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().acesso).toMatchObject({ email: emailSolta, criado: false });
  });
});

describe("formadores: documentos entregues", () => {
  it("o formador só marca como entregue o que carregou para a sua ficha", async () => {
    const ctx = await arrancar();
    const ficha = await fichaFormador(ctx, ["gold"], { userId: ctx.userId.formador });
    const outro = await fichaFormador(ctx, ["gold"]);
    const meu = `f${randomBytes(8).toString("hex")}`;
    const alheio = `f${randomBytes(8).toString("hex")}`;
    await ctx.db.query(
      "INSERT INTO drive_files (id, name, kind, regime, formando, stored_in) VALUES ($1, 'cc.pdf', 'formador-doc', 'gold', $2, 'local'), ($3, 'cv.pdf', 'formador-doc', 'gold', $4, 'local')",
      [meu, ficha.nome, alheio, outro.nome],
    );
    const r = await pedido(ctx, "formador", "PUT", `/v1/formadores/${ficha.id}/docs`, {
      docs: [
        { id: "ccp", uploaded: true, fileName: "inventado.pdf", driveUrl: "https://exemplo.pt/x" },
        { id: "cv", uploaded: true, fileName: "cv.pdf", driveFileId: alheio, driveUrl: "https://exemplo.pt/y" },
        { id: "inventado", uploaded: true, fileName: "x.pdf", driveFileId: meu },
        { id: "cc", uploaded: true, fileName: "outro-nome.pdf", driveFileId: meu, driveUrl: "https://exemplo.pt/z" },
      ],
    });
    expect(r.statusCode, r.body).toBe(200);
    const docs = await ctx.db.query<{ doc_id: string; file_name: string; drive_url: string; drive_file_id: string }>(
      "SELECT doc_id, file_name, drive_url, drive_file_id FROM formador_docs WHERE formador_id = $1", [ficha.id],
    );
    expect(docs.rows).toEqual([{ doc_id: "cc", file_name: "cc.pdf", drive_url: `/api/v1/drive/files/${meu}/content`, drive_file_id: meu }]);

    // A equipa continua a gravar a lista (incluindo documentos extra do dossiê).
    const equipa = await pedido(ctx, "secretaria", "PUT", `/v1/formadores/${outro.id}/docs`, {
      docs: [{ id: "extra_dtp", uploaded: true, fileName: "extra.pdf" }],
    });
    expect(equipa.statusCode, equipa.body).toBe(200);
    expect((await ctx.db.query("SELECT 1 FROM formador_docs WHERE formador_id = $1 AND doc_id = 'extra_dtp'", [outro.id])).rows).toHaveLength(1);
  });
});

describe("palavra-passe temporária", () => {
  it("até a mudar, só /v1/me e a troca respondem (equipa e área do formando)", async () => {
    const ctx = await arrancar();
    const s = await contaComSessao(ctx, "secretaria", { mustChange: true });
    expect((await como(ctx, s.cookie, "GET", "/v1/me")).statusCode).toBe(200);
    expect((await como(ctx, s.cookie, "GET", "/v1/formadores?regime=gold")).statusCode).toBe(403);
    expect((await como(ctx, s.cookie, "POST", "/v1/formadores", { nome: unico("Bloqueado"), regimes: ["gold"] })).statusCode).toBe(403);
    const troca = await como(ctx, s.cookie, "POST", "/v1/auth/password", { password: "Nova.Palavra2026!" });
    expect(troca.statusCode, troca.body).toBe(200);
    expect((await como(ctx, s.cookie, "GET", "/v1/formadores?regime=gold")).statusCode).toBe(200);

    const f = await contaComSessao(ctx, "formando", { mustChange: true });
    expect((await como(ctx, f.cookie, "GET", "/v1/me")).statusCode).toBe(200);
    expect((await como(ctx, f.cookie, "GET", "/v1/area-formando")).statusCode).toBe(403);
    expect((await como(ctx, f.cookie, "POST", "/v1/auth/password", { password: "Nova.Palavra2026!" })).statusCode).toBe(200);
    expect((await como(ctx, f.cookie, "POST", "/v1/auth/logout")).statusCode).toBe(200);
  });
});

describe("users: perfil e estado protegidos por trigger", () => {
  it("fora do admin ninguém muda o próprio perfil nem desactiva contas da equipa", async () => {
    const ctx = await arrancar();
    const c = await contaComSessao(ctx, "comercial");
    await expect(comoPerfil(ctx, "comercial", c.id, "UPDATE users SET role = 'admin' WHERE id = $1", [c.id])).rejects.toThrow(/perfil/);
    await expect(comoPerfil(ctx, "comercial", c.id, "UPDATE users SET active = false WHERE id = $1", [c.id])).rejects.toThrow();
    await expect(comoPerfil(ctx, "secretaria", ctx.userId.secretaria, "UPDATE users SET active = false WHERE id = $1", [c.id])).rejects.toThrow();
    await expect(comoPerfil(ctx, "secretaria", ctx.userId.secretaria,
      "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'X', $2, 'x', 'admin')", [randomUUID(), emailUnico("x")])).rejects.toThrow();
    // O próprio nome continua a poder mudar.
    await comoPerfil(ctx, "comercial", c.id, "UPDATE users SET name = 'Novo Nome' WHERE id = $1", [c.id]);

    // A equipa activa/desactiva contas de formador (ficha Inactiva) e o admin muda perfis.
    const fo = await contaComSessao(ctx, "formador");
    await comoPerfil(ctx, "secretaria", ctx.userId.secretaria, "UPDATE users SET active = false WHERE id = $1", [fo.id]);
    await comoPerfil(ctx, "admin", ctx.userId.admin, "UPDATE users SET role = 'financiada' WHERE id = $1", [c.id]);
    const r = await ctx.db.query<{ role: string; name: string }>("SELECT role, name FROM users WHERE id = $1", [c.id]);
    expect(r.rows[0]).toEqual({ role: "financiada", name: "Novo Nome" });
  });
});

describe("equipa: notas e objectivos só de membros", () => {
  it("valida o :id da pessoa", async () => {
    const ctx = await arrancar();
    const lead = await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, comercial_id, regime)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Lead', $1, 'Curso', 100, 'Nova', $2, 'gold') RETURNING id`,
      [emailUnico("lead"), ctx.userId.comercial],
    );
    const preinscricaoId = lead.rows[0]!.id;
    const outro = await contaComSessao(ctx, "comercial");
    const nota = { preinscricaoId, nota: "Ligou de volta." };

    expect((await pedido(ctx, "secretaria", "POST", `/v1/equipa/${randomUUID()}/notas`, nota)).statusCode).toBe(404);
    // Pessoa de outra equipa (Financiada) para um lead da Gold.
    expect((await pedido(ctx, "secretaria", "POST", `/v1/equipa/${ctx.userId.financiada}/notas`, nota)).statusCode).toBe(404);
    expect((await pedido(ctx, "comercial", "POST", `/v1/equipa/${outro.id}/notas`, nota)).statusCode).toBe(404);
    const ok = await pedido(ctx, "comercial", "POST", `/v1/equipa/${ctx.userId.comercial}/notas`, nota);
    expect(ok.statusCode, ok.body).toBe(200);

    expect((await pedido(ctx, "admin", "PUT", `/v1/equipa/${randomUUID()}/objetivo`, { metaPct: 10 })).statusCode).toBe(404);
    expect((await pedido(ctx, "admin", "PUT", `/v1/equipa/${ctx.userId.formador}/objetivo`, { metaPct: 10 })).statusCode).toBe(404);
    expect((await pedido(ctx, "admin", "PUT", `/v1/equipa/${ctx.userId.comercial}/objetivo`, { metaPct: 10 })).statusCode).toBe(200);
  });
});

describe("utilizadores", () => {
  it("o último admin activo não perde o perfil nem é apagado", async () => {
    const ctx = await arrancar();
    const outros = (await ctx.db.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' AND active AND id <> $1", [ctx.userId.admin])).rows.map(r => r.id);
    await ctx.db.query("UPDATE users SET active = false WHERE id::text IN (SELECT jsonb_array_elements_text($1::jsonb))", [outros]);
    try {
      const r = await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${ctx.userId.admin}`, { role: "secretaria" });
      expect(r.statusCode, r.body).toBe(409);
      expect((await ctx.db.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [ctx.userId.admin])).rows[0]!.role).toBe("admin");
    } finally {
      await ctx.db.query("UPDATE users SET active = true WHERE id::text IN (SELECT jsonb_array_elements_text($1::jsonb))", [outros]);
    }
    // Com outro admin activo, pode-se tirar um.
    const segundo = await contaComSessao(ctx, "admin");
    const ok = await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${segundo.id}`, { role: "secretaria" });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await pedido(ctx, "admin", "DELETE", `/v1/utilizadores/${segundo.id}`)).statusCode).toBe(200);
  });

  it("o alias /v1/users deixou de existir", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "admin", "GET", "/v1/users")).statusCode).toBe(404);
    expect((await pedido(ctx, "admin", "GET", "/v1/utilizadores")).statusCode).toBe(200);
  });
});

describe("definições: telefones por zona", () => {
  it("aceita as 6 linhas de 120 caracteres; os outros valores continuam até 400", async () => {
    const ctx = await arrancar();
    const linhas = Array.from({ length: 6 }, (_, i) => `22378110${i} ${"x".repeat(100)}`).join("\n");
    expect(linhas.length).toBeGreaterThan(400);
    const r = await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "ENA", telefonesZona: linhas } });
    expect(r.statusCode, r.body).toBe(200);
    const longo = await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "x".repeat(401) } });
    expect(longo.statusCode).toBe(400);
  });
});
