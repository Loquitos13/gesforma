import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

process.env.DRIVE_DIR = mkdtempSync(join(tmpdir(), "gesforma-drive-"));

let seq = 0;
const unico = (p: string) => `${p} ${Date.now().toString(36)}${(seq += 1)}`;
const ERRO = "A turma foi alterada por outra pessoa. Recarregue e volte a gravar.";

type Chamada = { metodo: string; url: string; corpo: string };

/** Google Drive de mentira: pastas existem sempre («p:<nome>»); `falhar` decide o estado de cada pedido. */
function driveFalsa(opts: { falhar?: (c: Chamada) => number | null } = {}) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const c = { metodo: (init?.method ?? "GET").toUpperCase(), url, corpo: typeof init?.body === "string" ? init.body : "" };
    chamadas.push(c);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    const estado = opts.falhar?.(c);
    if (estado) return json({ error: { message: estado === 404 ? "File not found: x" : "falhou" } }, estado);
    const u = new URL(url);
    if (u.pathname.startsWith("/upload/drive/v3/files")) return json({ id: `up-${chamadas.length}`, webViewLink: "https://drive.google.com/x" });
    if (/\/permissions$/.test(u.pathname) && c.metodo === "GET") return json({ permissions: [] });
    if (u.pathname === "/drive/v3/files" && c.metodo === "GET") {
      const q = u.searchParams.get("q") ?? "";
      const nome = /name='((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\'/g, "'") ?? "";
      return json({ files: q.includes("vnd.google-apps.folder") ? [{ id: `p:${nome}`, name: nome }] : [] });
    }
    return json({ id: `criado-${chamadas.length}` });
  }));
  return chamadas;
}

async function ligarDrive(ctx: Ctx) {
  const { sealSecret } = await import("../src/secretBox.js");
  const { saveDriveConfig } = await import("../src/googleDrive.js");
  await saveDriveConfig(ctx.db, { clientId: "cliente-de-teste-123456", clientSecret: "segredo-de-teste-123456" });
  await ctx.db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
  await ctx.db.query(
    `INSERT INTO oauth_accounts (provider, email, access_token, refresh_token, expiry, scope)
     VALUES ('google', 'conta.drive@entidade.pt', $1, $2, now() + interval '1 hour', 'drive')`,
    [sealSecret("token-de-teste"), sealSecret("refresh-de-teste")],
  );
}

afterEach(async () => {
  vi.unstubAllGlobals();
  const ctx = await arrancar();
  await ctx.db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
});

const sessao = (id: string, data: string) => ({ id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] });

async function turmaGold(ctx: Ctx, extra: Record<string, unknown> = {}) {
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2099-06-01", nome: unico("TPony"), curso: "Curso Sem Ficha", vagas: 10, cronograma: [sessao("a", "2099-06-01")], ...extra,
  });
  expect(t.statusCode, t.body).toBe(200);
  return t.json<{ turma: { id: number; nome: string } }>().turma;
}

describe("#7 gravações concorrentes do cronograma", () => {
  it("o GET devolve a versão; gravar com uma versão antiga dá 409; o resto da turma grava-se sem versão", async () => {
    const ctx = await arrancar();
    const { id } = await turmaGold(ctx);
    const lida = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${id}`)).json<{ turma: { versao: string } }>().turma.versao;
    expect(lida).toMatch(/^[0-9a-f]{32}$/);

    // A primeira pessoa grava e recebe a nova versão (o cockpit usa-a na gravação seguinte).
    const um = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { cronograma: [sessao("a", "2099-06-02")], versao: lida });
    expect(um.statusCode, um.body).toBe(200);
    const nova = um.json<{ turma: { versao: string } }>().turma.versao;
    expect(nova).not.toBe(lida);
    const dois = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { cronograma: [sessao("a", "2099-06-04")], versao: nova });
    expect(dois.statusCode, dois.body).toBe(200);

    // A segunda pessoa ainda tem a versão de antes: não sobrepõe.
    const outra = await pedido(ctx, "admin", "PATCH", `/v1/turmas-gold/${id}`, { cronograma: [sessao("a", "2099-06-03")], versao: lida });
    expect(outra.statusCode).toBe(409);
    expect(outra.json().error).toBe(ERRO);
    const gravado = (await ctx.db.query<{ cronograma: { data: string }[] }>("SELECT cronograma FROM turmas_gold WHERE id = $1", [id])).rows[0]!;
    expect(gravado.cronograma[0]!.data).toBe("2099-06-04");

    // Campos sem cronograma não precisam de versão.
    expect((await pedido(ctx, "admin", "PATCH", `/v1/turmas-gold/${id}`, { vagas: 12 })).statusCode).toBe(200);
    // Publicar com sessões e versão antiga: 409, nada muda.
    const pub = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${id}/cronograma/publicar`, { sessoes: [sessao("a", "2099-06-05")], versao: lida });
    expect(pub.statusCode).toBe(409);
    expect(pub.json().error).toBe(ERRO);
    const actual = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${id}`)).json<{ turma: { versao: string } }>().turma.versao;
    const ok = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${id}/cronograma/publicar`, { sessoes: [sessao("a", "2099-06-05")], versao: actual });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json<{ versao: string }>().versao).toBe((await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${id}`)).json<{ turma: { versao: string } }>().turma.versao);
  });

  it("Financiada: o mesmo 409 e as sessões com dados continuam protegidas", async () => {
    const ctx = await arrancar();
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
      dataInicio: "2099-06-01", nome: unico("TPonyF"), curso: "UFCD Sem Ficha", cronograma: [sessao("f1", "2099-06-01"), sessao("f2", "2099-06-02")],
    });
    expect(t.statusCode, t.body).toBe(200);
    const { id, versao } = t.json<{ turma: { id: number; versao: string } }>().turma;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-fin/${id}`, { cronograma: [sessao("f1", "2099-06-03"), sessao("f2", "2099-06-02")], versao })).statusCode).toBe(200);
    const velha = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-fin/${id}`, { cronograma: [sessao("f1", "2099-06-04")], versao });
    expect(velha.statusCode).toBe(409);
    expect(velha.json().error).toBe(ERRO);
  });
});

describe("#8 turmas automáticas sem nome ou com nome repetido", () => {
  it("não se criam: ficam nos conflitos; e um formando sem turma não entra numa turma sem nome", async () => {
    const ctx = await arrancar();
    const existente = await turmaGold(ctx);
    const curso = unico("Curso Regra");
    const semLocal = (await pedido(ctx, "admin", "POST", "/v1/turma-regras", { regime: "gold", curso, local: "", horario: "Pós Laboral", proximaData: "2099-09-01" })).json<{ id: number }>().id;
    const repetida = (await pedido(ctx, "admin", "POST", "/v1/turma-regras", { regime: "gold", curso, local: "Lisboa", proximaData: "2099-09-08", nomePrefixo: existente.nome })).json<{ id: number }>().id;
    const r = await pedido(ctx, "admin", "POST", "/v1/turmas/auto-regras", { regime: "gold" });
    expect(r.statusCode, r.body).toBe(200);
    const { criadas, conflitos } = r.json<{ criadas: { nome: string }[]; conflitos: { regra: number; erro: string }[] }>();
    expect(conflitos.map(c => c.regra)).toEqual(expect.arrayContaining([semLocal, repetida]));
    expect(criadas.some(c => !c.nome.trim() || c.nome === existente.nome)).toBe(false);
    expect((await ctx.db.query("SELECT 1 FROM turmas_gold WHERE curso = $1", [curso])).rows).toHaveLength(0);

    // Defesa: uma turma antiga sem nome não apanha os formandos sem turma.
    const { id } = existente;
    await ctx.db.query("UPDATE turmas_gold SET nome = '' WHERE id = $1", [id]);
    await ctx.db.query("INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma) VALUES (998801, 'Sem', 'Turma', 'sem.turma@exemplo.pt', 'Curso', '')");
    const { contactosFormandos, formandosDaTurma } = await import("../src/repos/pedagogiaTurma.js");
    const turma = { id, nome: "", curso: "Curso", cronograma: [] };
    expect((await formandosDaTurma(ctx.db, "gold", turma)).map(f => f.id)).not.toContain(998801);
    expect((await contactosFormandos(ctx.db, "gold", id, "")).some(f => f.email === "sem.turma@exemplo.pt")).toBe(false);
    await ctx.db.query("DELETE FROM formandos_gold WHERE id = 998801");
  });
});

describe("#9 mudar o nome da turma não cria outra pasta na Drive", () => {
  it("renomeia a pasta gravada; só sem pasta (ou apagada) procura ou cria pelo nome", async () => {
    const ctx = await arrancar();
    await ligarDrive(ctx);
    const { id } = await turmaGold(ctx);
    await ctx.db.query("UPDATE turmas_gold SET drive_pasta_id = 'pasta-antiga' WHERE id = $1", [id]);
    const { criarEstruturaDtp, nomePastaPessoa } = await import("../src/driveArvore.js");
    const chamadas = driveFalsa();
    const e = await criarEstruturaDtp(ctx.db, { regime: "gold", turmaId: id, nome: "Nome Novo" });
    expect(e?.turmaPastaId).toBe("pasta-antiga");
    const patch = chamadas.find(c => c.metodo === "PATCH" && c.url.includes("/files/pasta-antiga"));
    expect(JSON.parse(patch!.corpo)).toEqual({ name: nomePastaPessoa(id, "Nome Novo") });
    // Nem se procura a pasta das turmas activas (só serve para procurar ou criar pelo nome).
    expect(chamadas.some(c => c.url.includes("02_TURMAS_ATIVAS"))).toBe(false);
    expect((await ctx.db.query<{ drive_pasta_id: string }>("SELECT drive_pasta_id FROM turmas_gold WHERE id = $1", [id])).rows[0]!.drive_pasta_id).toBe("pasta-antiga");

    // Pasta apagada na Drive (404): procura-se pelo nome.
    vi.unstubAllGlobals();
    driveFalsa({ falhar: c => (c.metodo === "PATCH" && c.url.includes("pasta-antiga") ? 404 : null) });
    const f = await criarEstruturaDtp(ctx.db, { regime: "gold", turmaId: id, nome: "Nome Novo" });
    expect(f?.turmaPastaId).toBe(`p:${nomePastaPessoa(id, "Nome Novo")}`);
  });
});

describe("#10 partilhas da Drive de quem sai da equipa", () => {
  it("a comercial não fica protegida; uma partilha que falha deixa a turma por sincronizar", async () => {
    const ctx = await arrancar();
    const { emailsEquipaActiva } = await import("../src/repos/driveArvore.js");
    const comercial = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.comercial])).rows[0]!.email;
    const financiada = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.financiada])).rows[0]!.email;
    const equipa = await emailsEquipaActiva(ctx.db);
    expect(equipa).not.toContain(comercial);
    expect(equipa).toContain(financiada);

    await ligarDrive(ctx);
    const { id, nome } = await turmaGold(ctx);
    const { prepararTurmaDrive } = await import("../src/driveArvore.js");
    await ctx.db.query("UPDATE turmas_gold SET drive_partilhas_em = NULL WHERE id = $1", [id]);
    driveFalsa({ falhar: c => (c.metodo === "POST" && c.url.includes("/permissions") ? 500 : null) });
    const r = await prepararTurmaDrive(ctx.db, { regime: "gold", turmaId: id, nome });
    expect(r.ok && r.sincronizada).toBe(false);
    const em = async () => (await ctx.db.query<{ drive_partilhas_em: unknown }>("SELECT drive_partilhas_em FROM turmas_gold WHERE id = $1", [id])).rows[0]!.drive_partilhas_em;
    expect(await em()).toBeNull();

    vi.unstubAllGlobals();
    driveFalsa();
    const ok = await prepararTurmaDrive(ctx.db, { regime: "gold", turmaId: id, nome });
    expect(ok.ok && ok.sincronizada).toBe(true);
    expect(await em()).not.toBeNull();

    // Desactivar alguém da secretaria volta a pôr as turmas com pasta por sincronizar (o cron diário acerta-as).
    const u = await pedido(ctx, "admin", "POST", "/v1/utilizadores", {
      name: "Sec Sai", email: `sec.sai.${Date.now()}@exemplo.pt`, password: "Palavra-passe-1234!", role: "secretaria",
    });
    expect(u.statusCode, u.body).toBe(200);
    const uid = u.json<{ user: { id: string } }>().user.id;
    expect((await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${uid}`, { active: false })).statusCode).toBe(200);
    expect(await em()).toBeNull();
  });

  it("o ZIP do dossiê não se partilha: fora da secretaria descarrega-se", async () => {
    const ctx = await arrancar();
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-06-01", nome: unico("TPonyZ"), curso: "UFCD Sem Ficha" });
    expect(t.statusCode, t.body).toBe(200);
    const { id } = t.json<{ turma: { id: number } }>().turma;
    await ligarDrive(ctx);
    const chamadas = driveFalsa();
    const r = await pedido(ctx, "financiada", "GET", `/v1/dtp/fin/${id}/export?destino=drive`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers["content-type"]).toBe("application/zip");
    expect(chamadas.some(c => c.metodo === "POST" && c.url.includes("/permissions"))).toBe(false);
  });
});

describe("#17 PDFs do dossiê com o texto inteiro", () => {
  it("um sumário de 600 caracteres sai completo, partido em linhas, e os \\n mudam de linha", async () => {
    const { linhasDaPagina } = await import("../src/pdfTexto.js");
    const { pdfsDoDossie } = await import("../src/dtpPdfs.js");
    const palavras = Array.from({ length: 120 }, (_, i) => `p${String(i).padStart(3, "0")}`);
    const conteudos = palavras.join(" ");
    expect(conteudos.length).toBe(599);
    const linhas = linhasDaPagina([`  Conteudos: ${conteudos}`, "  Atividades: uma\nduas"]);
    expect(linhas.every(l => l.length <= 110)).toBe(true);
    expect(linhas.every(l => l.startsWith("  "))).toBe(true);
    expect(linhas.join(" ").replace(/\s+/g, " ").trim()).toBe(`Conteudos: ${conteudos} Atividades: uma duas`);
    expect(linhas.slice(-2)).toEqual(["  Atividades: uma", "  duas"]);

    const longo = `${"x".repeat(150)} fim`;
    const pdf = pdfsDoDossie({
      turma: "T", curso: "C", cronograma: [sessao("a", "2099-06-01")], formandos: [],
      sessoes: [{ n: 1, plano: null, presencas: [], sumario: { conteudos: `${conteudos} ${longo}`, assinado: true } }],
    }).folhas.toString("latin1");
    for (const p of palavras) expect(pdf).toContain(p);
    expect(pdf).toContain(`(  ${"x".repeat(108)})`);
    expect(pdf).toContain(`(  ${"x".repeat(42)} fim)`);
  });
});
