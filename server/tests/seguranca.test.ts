import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { podeAceder } from "../src/permissoes.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Ficheiros locais da Drive numa pasta temporária (config lê-a no primeiro import, feito por arrancar()).
process.env.DRIVE_DIR = mkdtempSync(join(tmpdir(), "gesforma-drive-"));

const PASSE = "Teste#2026abc";

// Um IP por login: o limite do login é por IP (12/min) e estes testes entram muitas vezes.
let ipN = 0;
async function login(ctx: Ctx, email: string, password = PASSE) {
  ipN += 1;
  const r = await ctx.app.inject({
    method: "POST", url: "/v1/auth/login", headers: { "x-gesforma-client": "web" }, payload: { email, password },
    remoteAddress: `10.9.${Math.floor(ipN / 250)}.${ipN % 250 + 1}`,
  });
  const set = String(r.headers["set-cookie"] ?? "").split(";")[0] ?? "";
  return { status: r.statusCode, cookie: set };
}

function comCookie(ctx: Ctx, cookie: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) {
  return ctx.app.inject({ method, url, headers: { "x-gesforma-client": "web", cookie }, payload: payload as never });
}

function multipart(campos: Record<string, string>, ficheiro: { nome: string; mime: string; bytes: Buffer }) {
  const b = "----seguranca";
  const partes = Object.entries(campos).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  return {
    body: Buffer.concat([
      ...partes,
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${ficheiro.nome}"\r\nContent-Type: ${ficheiro.mime}\r\n\r\n`),
      ficheiro.bytes,
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
    tipo: `multipart/form-data; boundary=${b}`,
  };
}

describe("caminhos codificados não saltam a matriz", () => {
  it("comercial PUT /v1/%64rive/config → 403; %xx inválido → 400", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "comercial", "PUT", "/v1/%64rive/config", { folderName: "x" })).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PUT", "/v1/drive/%63onfig", { folderName: "x" })).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/sistema/%61visos")).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "GET", "/v1/%E0%A4%A")).statusCode).toBe(400);
  });
});

describe("login Microsoft: só se confia no email do tenant da ENA ou de contas pessoais", () => {
  it("tenantConfiavel e tenantDoIdToken", async () => {
    const { tenantConfiavel, tenantDoIdToken, TENANT_CONTAS_PESSOAIS } = await import("../src/microsoftAuth.js");
    const ena = "11111111-2222-3333-4444-555555555555";
    const token = (tid: string) => `x.${Buffer.from(JSON.stringify({ tid })).toString("base64url")}.y`;
    expect(tenantDoIdToken(token(ena.toUpperCase()))).toBe(ena);
    expect(tenantDoIdToken("lixo")).toBe("");
    expect(tenantDoIdToken(undefined)).toBe("");
    expect(tenantConfiavel(ena, ena)).toBe(true);
    expect(tenantConfiavel(TENANT_CONTAS_PESSOAIS, "common")).toBe(true);
    expect(tenantConfiavel("99999999-0000-0000-0000-000000000000", ena)).toBe(false);
    expect(tenantConfiavel("99999999-0000-0000-0000-000000000000", "common")).toBe(false);
    expect(tenantConfiavel("", ena)).toBe(false);
  });
});

describe("ficheiros da Drive", () => {
  it("serve o tipo da extensão (não o do cliente) e o formador não lê ficheiros alheios", async () => {
    const ctx = await arrancar();
    const { mimeServido, abreNoBrowser } = await import("../src/driveFicheiros.js");
    expect(mimeServido("a.PDF")).toBe("application/pdf");
    expect(mimeServido("a.svg")).toBe("application/octet-stream");
    expect(abreNoBrowser("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);

    // Um "mp4" com SVG dentro e MIME do cliente image/svg+xml.
    const bytes = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")]);
    const m = multipart({ kind: "documento", regime: "gold" }, { nome: "video.mp4", mime: "image/svg+xml", bytes });
    const up = await ctx.app.inject({
      method: "POST", url: "/v1/drive/files", payload: m.body,
      headers: { "x-gesforma-client": "web", cookie: ctx.cookie.secretaria, "content-type": m.tipo },
    });
    expect(up.statusCode).toBe(200);
    const id = up.json<{ file: { id: string } }>().file.id;

    const c = await pedido(ctx, "secretaria", "GET", `/v1/drive/files/${id}/content`);
    expect(c.statusCode).toBe(200);
    expect(c.headers["content-type"]).toBe("video/mp4");

    // Formador: nem lista, nem ficha, nem conteúdo de ficheiros que não são seus.
    expect((await pedido(ctx, "formador", "GET", "/v1/drive/files")).json()).toEqual({ files: [] });
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${id}`)).statusCode).toBe(404);
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${id}/content`)).statusCode).toBe(404);
    // Financiada não lê ficheiros Gold.
    expect((await pedido(ctx, "financiada", "GET", `/v1/drive/files/${id}`)).statusCode).toBe(404);
    expect((await pedido(ctx, "financiada", "GET", "/v1/drive/files?regime=gold")).statusCode).toBe(403);
    // Apagar: só secretaria e admin.
    expect((await pedido(ctx, "comercial", "DELETE", `/v1/drive/files/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/drive/files/${id}`)).statusCode).toBe(200);
  });
});

describe("catálogos e cursos separados por regime", () => {
  it("matriz", () => {
    expect(podeAceder("comercial", "POST", "/v1/catalog/inscricoes_fin")).toBe(false);
    expect(podeAceder("comercial", "GET", "/v1/catalogos/inscricoes_fin")).toBe(false);
    expect(podeAceder("financiada", "POST", "/v1/catalog/inscricoes_fin")).toBe(true);
    expect(podeAceder("formador", "GET", "/v1/catalogos/locais")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/catalogos/inscricoes_fin")).toBe(false);
    expect(podeAceder("financiada", "PUT", "/v1/cursos/gold/1/ficha")).toBe(false);
    expect(podeAceder("financiada", "POST", "/v1/cursos/gold/1/imagem/capa")).toBe(false);
    expect(podeAceder("comercial", "PUT", "/v1/cursos/gold/1/ficha")).toBe(true);
    expect(podeAceder("comercial", "DELETE", "/v1/cursos/fin/1/documentos/abc")).toBe(false);
    expect(podeAceder("comercial", "GET", "/v1/cursos/fin/1/documentos")).toBe(false);
    expect(podeAceder("financiada", "DELETE", "/v1/cursos/fin/1/documentos/abc")).toBe(true);
    expect(podeAceder("formador", "GET", "/v1/cursos/gold/1/documentos")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/cursos/gold")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/cursos/fin/1/dtp-modelo")).toBe(true);
    expect(podeAceder("financiada", "PUT", "/v1/cursos/gold/1/dtp-modelo")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/site/paginas/inicio")).toBe(false);
  });

  it("a Financiada não altera nem lê itens Gold do catálogo", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "secretaria", "POST", "/v1/catalog/datas", { regime: "gold", payload: { data: "2030-01-01" } });
    expect(r.statusCode).toBe(200);
    const id = r.json<{ item: { id: number } }>().item.id;
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/catalog/datas/${id}`, { payload: { data: "2030-02-02" } })).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/catalog/datas/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "POST", "/v1/catalog/datas", { regime: "gold", payload: {} })).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "GET", "/v1/catalogos/datas?regime=gold")).statusCode).toBe(403);
    const todos = await pedido(ctx, "financiada", "GET", "/v1/catalogos/datas");
    expect(todos.json<{ itens: { regime: string }[] }>().itens.every(i => i.regime === "fin")).toBe(true);
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/catalog/datas/${id}`, { payload: { data: "2030-03-03" } })).statusCode).toBe(200);
  });
});

describe("Gold e Financiada nunca se misturam", () => {
  it("matriz: quem só trabalha num regime não chega a rotas do outro", async () => {
    const { regimeDoCaminho } = await import("../src/permissoes.js");
    expect(regimeDoCaminho("/v1/turmas-fin/3")).toBe("fin");
    expect(regimeDoCaminho("/v1/dtp/gold/entidades")).toBe("gold");
    expect(regimeDoCaminho("/v1/crm/leads")).toBe(null);
    const fin = ["/v1/turmas/fin/1", "/v1/turmas/fin/1/pedagogia", "/v1/dtp/fin", "/v1/turmas/fin/1/relatorio-final", "/v1/cursos/fin"];
    const gold = ["/v1/turmas/gold/1", "/v1/dtp/gold/entidades", "/v1/dtp/gold/resumo", "/v1/turmas/gold/1/avaliacao"];
    for (const p of fin) {
      expect(podeAceder("comercial", "GET", p), p).toBe(false);
      expect(podeAceder("admin", "GET", p), p).toBe(true);
    }
    for (const p of gold) {
      expect(podeAceder("financiada", "GET", p), p).toBe(false);
      expect(podeAceder("admin", "GET", p), p).toBe(true);
    }
    for (const [m, p] of [["POST", "/v1/turmas-gold"], ["PATCH", "/v1/turmas-gold/1"], ["DELETE", "/v1/turmas-gold/1"],
      ["PUT", "/v1/turmas/gold/1/sessoes/1"], ["POST", "/v1/turmas/gold/1/fecho"], ["POST", "/v1/dtp/gold/entidades"]] as const) {
      expect(podeAceder("financiada", m, p), `${m} ${p}`).toBe(false);
    }
    // Entidades do dossiê Gold: escrita da secretaria (como o resto do dossiê Gold).
    expect(podeAceder("comercial", "POST", "/v1/dtp/gold/entidades")).toBe(false);
    expect(podeAceder("secretaria", "POST", "/v1/dtp/gold/entidades")).toBe(true);
    // O formador trabalha nos dois regimes (os handlers limitam-no às suas turmas).
    expect(podeAceder("formador", "GET", "/v1/turmas/fin/1")).toBe(true);
  });

  it("registar pagamento: só a secretaria", async () => {
    const ctx = await arrancar();
    expect(podeAceder("comercial", "POST", "/v1/formandos/gold/1/registar-pagamento")).toBe(false);
    expect((await pedido(ctx, "comercial", "POST", "/v1/formandos/gold/1/registar-pagamento", { metodo: "Transferência" })).statusCode).toBe(403);
  });

  it("pesquisa global: comercial só Gold, Financiada só Fin", async () => {
    const ctx = await arrancar();
    const marca = `Pesqreg${Date.now().toString(36).replace(/[0-9]/g, "x")}`;
    expect((await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome: `${marca} G`, curso: "Curso Sem Ficha", vagas: 10 })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-06-01", nome: `${marca} F`, curso: "UFCD X", capacidade: 5 })).statusCode).toBe(200);
    const vistas = async (perfil: "comercial" | "financiada" | "secretaria") => {
      const r = await pedido(ctx, perfil, "GET", `/v1/search?q=${marca}`);
      return r.json<{ groups: { items: { view: string }[] }[] }>().groups.flatMap(g => g.items.map(i => i.view)).sort();
    };
    expect(await vistas("comercial")).toEqual(["gold-cockpit-turma"]);
    expect(await vistas("financiada")).toEqual(["fin-cockpit-turma"]);
    expect(await vistas("secretaria")).toEqual(["fin-cockpit-turma", "gold-cockpit-turma"]);
  });
});

describe("formadores: o comercial só mexe na disponibilidade", () => {
  it("grava só a disponibilidade de formadores da Gold e não vê NIF nem custo por hora", async () => {
    const ctx = await arrancar();
    const criar = async (regimes: string[]) => {
      const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: `Disp ${Date.now()} ${regimes}`, regimes, nif: "123456789", custoHora: 30 });
      expect(r.statusCode, r.body).toBe(200);
      return r.json<{ formador: { id: number } }>().formador.id;
    };
    const gold = await criar(["gold"]);
    const fin = await criar(["fin"]);
    const r = await pedido(ctx, "comercial", "PATCH", `/v1/formadores/${gold}`, { disponibilidade: ["laboral"] });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().formador).toMatchObject({ disponibilidade: ["laboral"], nif: "", custoHora: 0 });
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/formadores/${gold}`, { nome: "Outro nome" })).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/formadores/${gold}`, { disponibilidade: ["laboral"], custoHora: 1 })).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/formadores/${fin}`, { disponibilidade: ["laboral"] })).statusCode).toBe(403);
  });
});

describe("acesso do formando", () => {
  it("o comercial não gera palavras-passe", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "comercial", "POST", "/v1/formandos/gold/1/acesso", {})).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "POST", "/v1/formandos/gold/1/acesso", {})).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "POST", "/v1/formandos/fin/1/acesso", {})).statusCode).toBe(403);
  });
});

describe("conta do formador acompanha a ficha", () => {
  it("Inactivo bloqueia, Ativo reabre, apagar remove a conta", async () => {
    const ctx = await arrancar();
    const email = `formador.seg.${Date.now()}@exemplo.pt`;
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: `Formador Seg ${Date.now()}`, email, regimes: ["gold"] });
    expect(r.statusCode).toBe(200);
    const { formador, acesso } = r.json<{ formador: { id: number }; acesso: { password: string } }>();
    const s1 = await login(ctx, email, acesso.password);
    expect(s1.status).toBe(200);

    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${formador.id}`, { estado: "Inactivo" })).statusCode).toBe(200);
    expect((await comCookie(ctx, s1.cookie, "GET", "/v1/me")).statusCode).toBe(401);
    expect((await login(ctx, email, acesso.password)).status).toBe(401);

    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${formador.id}`, { estado: "Ativo" })).statusCode).toBe(200);
    const s2 = await login(ctx, email, acesso.password);
    expect(s2.status).toBe(200);

    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/formadores/${formador.id}`)).statusCode).toBe(200);
    expect((await comCookie(ctx, s2.cookie, "GET", "/v1/me")).statusCode).toBe(401);
    expect((await login(ctx, email, acesso.password)).status).toBe(401);
    expect((await ctx.db.query("SELECT 1 FROM users WHERE email = $1", [email])).rows).toHaveLength(0);
  });
});

describe("utilizadores", () => {
  it("desactivar termina sessões, reactivar volta a deixar entrar, eliminar apaga a conta", async () => {
    const ctx = await arrancar();
    const email = `user.seg.${Date.now()}@exemplo.pt`;
    const c = await pedido(ctx, "admin", "POST", "/v1/utilizadores", { name: "Conta Seg", email, password: PASSE, role: "comercial", mustChangePassword: false });
    expect(c.statusCode).toBe(200);
    const id = c.json<{ user: { id: string } }>().user.id;
    const s1 = await login(ctx, email);
    expect(s1.status).toBe(200);

    expect((await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${id}`, { active: false })).statusCode).toBe(200);
    expect((await comCookie(ctx, s1.cookie, "GET", "/v1/me")).statusCode).toBe(401);
    expect((await login(ctx, email)).status).toBe(401);

    expect((await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${id}`, { active: true })).statusCode).toBe(200);
    expect((await login(ctx, email)).status).toBe(200);

    expect((await pedido(ctx, "admin", "DELETE", `/v1/utilizadores/${id}`)).statusCode).toBe(200);
    expect((await login(ctx, email)).status).toBe(401);
    expect((await ctx.db.query("SELECT 1 FROM sessions WHERE user_id = $1", [id])).rows).toHaveLength(0);
  });

  it("eliminar um comercial com contrato e proposta: a conta sai, os documentos ficam sem comercial", async () => {
    const ctx = await arrancar();
    const email = `comercial.seg.${Date.now()}@exemplo.pt`;
    const c = await pedido(ctx, "admin", "POST", "/v1/utilizadores", { name: "Comercial Seg", email, password: PASSE, role: "comercial", mustChangePassword: false });
    const id = c.json<{ user: { id: string } }>().user.id;
    expect((await login(ctx, email)).status).toBe(200);
    const doc = 900_000 + Math.floor(Math.random() * 99_999);
    await ctx.db.query("INSERT INTO contratos_comerciais (id, comercial_id, cliente_nome) VALUES ($1, $2, 'Cliente Seg')", [doc, id]);
    await ctx.db.query("INSERT INTO propostas_comerciais (id, comercial_id, cliente_nome, cliente_email) VALUES ($1, $2, 'Cliente Seg', '')", [doc, id]);
    await ctx.db.query("INSERT INTO cliente_interesses (comercial_id, cliente_nome, produto) VALUES ($1, 'Cliente Seg', 'CCP')", [id]);

    expect((await pedido(ctx, "admin", "DELETE", `/v1/utilizadores/${id}`)).statusCode).toBe(200);
    expect((await login(ctx, email)).status).toBe(401);
    expect((await ctx.db.query("SELECT comercial_id FROM contratos_comerciais WHERE id = $1", [doc])).rows).toEqual([{ comercial_id: null }]);
    expect((await ctx.db.query("SELECT comercial_id FROM propostas_comerciais WHERE id = $1", [doc])).rows).toEqual([{ comercial_id: null }]);
    expect((await ctx.db.query("SELECT 1 FROM cliente_interesses WHERE cliente_nome = 'Cliente Seg' AND comercial_id IS NULL")).rows).toHaveLength(1);
    const lista = await pedido(ctx, "secretaria", "GET", "/v1/crm/contratos?porPagina=200");
    expect(lista.json<{ linhas: { id: number; comercial: string }[] }>().linhas.find(k => k.id === doc)?.comercial).toBe("");
  });

  it("o admin não se desactiva; o último admin não é desactivado nem despromovido", async () => {
    const ctx = await arrancar();
    const eu = ctx.userId.admin;
    expect((await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${eu}`, { active: false })).statusCode).toBe(400);
    const outros = (await ctx.db.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' AND active AND id <> $1", [eu])).rows.map(r => r.id);
    await ctx.db.query("UPDATE users SET active = false WHERE role = 'admin' AND id <> $1", [eu]);
    try {
      expect((await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${eu}`, { role: "secretaria" })).statusCode).toBe(409);
    } finally {
      for (const o of outros) await ctx.db.query("UPDATE users SET active = true WHERE id = $1", [o]);
    }
  });

  it("mudar a própria palavra-passe pede a atual e termina as outras sessões", async () => {
    const ctx = await arrancar();
    const email = `passe.seg.${Date.now()}@exemplo.pt`;
    await pedido(ctx, "admin", "POST", "/v1/utilizadores", { name: "Passe Seg", email, password: PASSE, role: "secretaria", mustChangePassword: false });
    const a = await login(ctx, email);
    const b = await login(ctx, email);
    const nova = "Nova#2026xyz";
    expect((await comCookie(ctx, a.cookie, "POST", "/v1/auth/password", { password: nova })).statusCode).toBe(400);
    expect((await comCookie(ctx, a.cookie, "POST", "/v1/auth/password", { password: nova, atual: "errada" })).statusCode).toBe(400);
    expect((await comCookie(ctx, a.cookie, "POST", "/v1/auth/password", { password: nova, atual: PASSE })).statusCode).toBe(200);
    expect((await comCookie(ctx, a.cookie, "GET", "/v1/me")).statusCode).toBe(200);
    expect((await comCookie(ctx, b.cookie, "GET", "/v1/me")).statusCode).toBe(401);
    expect((await login(ctx, email, nova)).status).toBe(200);
  });
});
