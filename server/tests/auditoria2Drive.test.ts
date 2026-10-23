import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Ficheiros locais da Drive numa pasta temporária (config lê-a no primeiro import, feito por arrancar()).
process.env.DRIVE_DIR = mkdtempSync(join(tmpdir(), "gesforma-drive-"));

let seq = 0;
const unico = (p: string) => `${p} ${Date.now().toString(36)}${(seq += 1)}`;

type Chamada = { metodo: string; url: string; corpo: string };

/**
 * Google Drive de mentira: pastas encontram-se sempre (id «p:<nome>»), cada item tem as permissões de `permissoes`,
 * os uploads devolvem «up-N» e `apagar` decide a resposta ao DELETE de ficheiros.
 */
function driveFalsa(opts: {
  permissoes?: (itemId: string) => { id: string; type: string; role: string; emailAddress?: string }[];
  apagar?: number;
} = {}) {
  const chamadas: Chamada[] = [];
  let up = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const metodo = (init?.method ?? "GET").toUpperCase();
    const corpo = typeof init?.body === "string" ? init.body : "";
    chamadas.push({ metodo, url, corpo });
    const u = new URL(url);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (u.pathname.startsWith("/upload/drive/v3/files")) {
      up += 1;
      return json({ id: `up-${up}`, name: "ficheiro", webViewLink: `https://drive.google.com/file/d/up-${up}/view` });
    }
    const perm = /^\/drive\/v3\/files\/([^/]+)\/permissions(?:\/([^/]+))?$/.exec(u.pathname);
    if (perm) {
      const item = decodeURIComponent(perm[1]!);
      if (metodo === "GET") return json({ permissions: opts.permissoes?.(item) ?? [] });
      return json({ id: `nova-${chamadas.length}` });
    }
    if (u.pathname === "/drive/v3/files" && metodo === "GET") {
      const q = u.searchParams.get("q") ?? "";
      const nome = /name='((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\'/g, "'") ?? "";
      // Pastas existem sempre; ficheiros (o ZIP) ainda não.
      return json({ files: q.includes("vnd.google-apps.folder") ? [{ id: `p:${nome}`, name: nome }] : [] });
    }
    if (/^\/drive\/v3\/files\/[^/]+$/.test(u.pathname)) {
      if (metodo === "DELETE") return new Response(null, { status: opts.apagar ?? 204 });
      if (u.searchParams.get("alt") === "media") return new Response(Buffer.from("%PDF-1.4 drive\n"), { status: 200 });
      return json({ id: "x", parents: [] });
    }
    return json({ id: `criado-${chamadas.length}` });
  }));
  return chamadas;
}

async function ligarDrive(ctx: Ctx, email = "conta.drive@entidade.pt") {
  const { sealSecret } = await import("../src/secretBox.js");
  const { saveDriveConfig } = await import("../src/googleDrive.js");
  await saveDriveConfig(ctx.db, { clientId: "cliente-de-teste-123456", clientSecret: "segredo-de-teste-123456" });
  await ctx.db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
  await ctx.db.query(
    `INSERT INTO oauth_accounts (provider, email, access_token, refresh_token, expiry, scope)
     VALUES ('google', $1, $2, $3, now() + interval '1 hour', 'drive')`,
    [email, sealSecret("token-de-teste"), sealSecret("refresh-de-teste")],
  );
}

async function desligarDrive(ctx: Ctx) {
  await ctx.db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
}

afterEach(() => { vi.unstubAllGlobals(); });

async function emailDe(ctx: Ctx, perfil: keyof Ctx["userId"]) {
  return (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId[perfil]])).rows[0]!.email.toLowerCase();
}

function multipart(campos: Record<string, string>) {
  const b = "----auditoria2";
  return {
    body: Buffer.concat([
      ...Object.entries(campos).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)),
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from("%PDF-1.4\n%teste\n"),
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
    tipo: `multipart/form-data; boundary=${b}`,
  };
}

function enviar(ctx: Ctx, perfil: keyof Ctx["cookie"], campos: Record<string, string>) {
  const m = multipart(campos);
  return ctx.app.inject({
    method: "POST", url: "/v1/drive/files", payload: m.body,
    headers: { "x-gesforma-client": "web", cookie: ctx.cookie[perfil], "content-type": m.tipo },
  });
}

/** Formador ligado à conta de teste «formador», com uma turma Gold sua e outra alheia. */
async function formadorComTurmas(ctx: Ctx) {
  const eu = unico("Formador Aud");
  const email = await emailDe(ctx, "formador");
  // Uma conta liga-se a uma só ficha: a ficha do teste anterior deixa de ser desta conta.
  await ctx.db.query("UPDATE formadores SET user_id = NULL, email = '' WHERE user_id = $1", [ctx.userId.formador]);
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: eu, email, regimes: ["gold"] });
  expect(r.statusCode, r.body).toBe(200);
  const turma = async (formadores: string[]) => {
    const nome = unico("TAud");
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10,
      cronograma: [{ id: "s1", data: "2099-06-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores }],
    });
    expect(t.statusCode, t.body).toBe(200);
    return { nome, id: t.json<{ turma: { id: number } }>().turma.id };
  };
  return { eu, email, minha: await turma([eu]), alheia: await turma([unico("Outro")]) };
}

describe("#6 partilhas da pasta da turma na Drive", () => {
  it("formandos nunca recebem a pasta; formadores só leem os materiais; quem saiu perde o acesso; dono e equipa ficam", async () => {
    const ctx = await arrancar();
    const { email: formador } = await formadorComTurmas(ctx);
    await ligarDrive(ctx);
    const secretaria = await emailDe(ctx, "secretaria");
    const comercial = await emailDe(ctx, "comercial");
    const formando = "formando.antigo@exemplo.pt";
    const exFormador = "ex.formador@exemplo.pt";
    const nomeTurma = unico("TPart");
    const turmaId = 990601;
    await ctx.db.query(
      "INSERT INTO turmas_gold (id, data_inicio, nome, curso, formador, cronograma) VALUES ($1, '2099-07-01', $2, 'Curso', '', '[]'::jsonb)",
      [turmaId, nomeTurma],
    );
    await ctx.db.query("INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id) VALUES (990611, 'Ana', 'Sá', $1, 'Curso', $2, $3)", [formando, nomeTurma, turmaId]);
    const { nomePastaPessoa, PASTA_MATERIAIS } = await import("../src/driveArvore.js");
    const pastaTurma = `p:${nomePastaPessoa(turmaId, nomeTurma)}`;
    const pastaMateriais = `p:${PASTA_MATERIAIS}`;
    const chamadas = driveFalsa({
      permissoes: item => item === pastaTurma
        ? [
          { id: "dono", type: "user", role: "owner", emailAddress: "conta.drive@entidade.pt" },
          { id: "sec", type: "user", role: "writer", emailAddress: secretaria },
          { id: "com", type: "user", role: "writer", emailAddress: comercial },
          { id: "fdo", type: "user", role: "writer", emailAddress: formando },
          { id: "fdr", type: "user", role: "writer", emailAddress: formador },
          { id: "exf", type: "user", role: "writer", emailAddress: exFormador },
          { id: "lig", type: "anyone", role: "reader" },
        ]
        : item === pastaMateriais
          ? [{ id: "exf2", type: "user", role: "reader", emailAddress: exFormador }]
          : [],
    });

    // Gravar a turma sincroniza dentro do pedido (na Vercel o que corre depois da resposta congela).
    const formadorNome = (await ctx.db.query<{ nome: string }>("SELECT nome FROM formadores WHERE lower(email) = $1", [formador])).rows[0]!.nome;
    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${turmaId}`, { formadores: [formadorNome] });
    expect(r.statusCode, r.body).toBe(200);

    const revogadas = chamadas.filter(c => c.metodo === "DELETE" && c.url.includes("/permissions/"))
      .map(c => `${decodeURIComponent(/files\/([^/]+)\/permissions/.exec(c.url)![1]!)}#${/permissions\/([^?]+)/.exec(c.url)![1]}`);
    // A comercial não vê turmas nem o dossiê: não fica protegida e sai como os outros.
    expect(revogadas.sort()).toEqual([`${pastaMateriais}#exf2`, `${pastaTurma}#com`, `${pastaTurma}#exf`, `${pastaTurma}#fdo`, `${pastaTurma}#fdr`].sort());
    const dadas = chamadas.filter(c => c.metodo === "POST" && /\/permissions\?/.test(c.url))
      .map(c => ({ item: decodeURIComponent(/files\/([^/]+)\/permissions/.exec(c.url)![1]!), ...JSON.parse(c.corpo) as { role: string; emailAddress: string } }));
    expect(dadas).toContainEqual({ item: pastaMateriais, role: "reader", type: "user", emailAddress: formador });
    expect(dadas.some(d => d.emailAddress === formando)).toBe(false);
    // Na pasta inteira só a secretaria (admin e secretaria), como editora.
    for (const d of dadas.filter(x => x.item === pastaTurma)) {
      const role = (await ctx.db.query<{ role: string }>("SELECT role FROM users WHERE lower(email) = $1", [d.emailAddress])).rows[0]?.role;
      expect(["admin", "secretaria"]).toContain(role);
      expect(d.role).toBe("writer");
    }
    expect(dadas.some(d => d.item === pastaTurma && d.emailAddress === secretaria)).toBe(false);
    await desligarDrive(ctx);
  });
});

describe("#11 PDFs de contratos assinados com a visibilidade do contrato", () => {
  it("lista, ficha e apagar seguem o contrato; os antigos sem contrato ficam para admin e secretaria", async () => {
    const ctx = await arrancar();
    await desligarDrive(ctx);
    const contrato = async (id: number, dono: string, regime: string | null) => {
      await ctx.db.query(
        "INSERT INTO contratos_comerciais (id, comercial_id, cliente_nome, formando_regime) VALUES ($1, $2, 'Cliente', $3)",
        [id, dono, regime],
      );
    };
    await contrato(991101, ctx.userId.comercial, null);
    await contrato(991102, ctx.userId.admin, null);
    await contrato(991103, ctx.userId.admin, "fin");
    const ficheiro = async (id: string, contratoId: number | null, regime: string | null = null) => {
      await ctx.db.query(
        `INSERT INTO drive_files (id, name, kind, regime, label, stored_in, local_path, contrato_id)
         VALUES ($1, $2, 'contrato', $3, 'Contratos', 'local', 'nao-existe.pdf', $4)`,
        [id, `${id}.pdf`, regime, contratoId],
      );
    };
    await ficheiro("k-meu", 991101);
    await ficheiro("k-alheio", 991102);
    await ficheiro("k-fin", 991103, "fin");
    await ficheiro("k-antigo", null);

    const ve = async (perfil: "comercial" | "financiada" | "secretaria" | "formador", id: string) =>
      (await pedido(ctx, perfil, "GET", `/v1/drive/files/${id}`)).statusCode === 200;
    expect(await ve("comercial", "k-meu")).toBe(true);
    expect(await ve("comercial", "k-alheio")).toBe(false);
    expect(await ve("comercial", "k-fin")).toBe(false);
    expect(await ve("comercial", "k-antigo")).toBe(false);
    expect(await ve("financiada", "k-fin")).toBe(true);
    expect(await ve("financiada", "k-alheio")).toBe(false);
    expect(await ve("formador", "k-meu")).toBe(false);
    for (const id of ["k-meu", "k-alheio", "k-fin", "k-antigo"]) expect(await ve("secretaria", id)).toBe(true);
    expect((await pedido(ctx, "comercial", "GET", "/v1/drive/files/k-alheio/content")).statusCode).toBe(404);

    const lista = async (perfil: "comercial" | "financiada" | "secretaria") =>
      (await pedido(ctx, perfil, "GET", "/v1/drive/files?kind=contrato")).json<{ files: { id: string }[] }>().files.map(f => f.id).filter(id => id.startsWith("k-")).sort();
    expect(await lista("comercial")).toEqual(["k-meu"]);
    expect(await lista("financiada")).toEqual(["k-fin"]);
    expect(await lista("secretaria")).toEqual(["k-alheio", "k-antigo", "k-fin", "k-meu"]);
  });

  it("o PDF guardado pela assinatura leva o contrato; a migração liga os já existentes", async () => {
    const ctx = await arrancar();
    await desligarDrive(ctx);
    await ctx.db.query("INSERT INTO contratos_comerciais (id, comercial_id, cliente_nome, formando_regime) VALUES (991201, $1, 'Cliente', NULL), (991202, $1, 'Cliente', 'fin'), (991203, $1, 'Cliente', NULL)", [ctx.userId.comercial]);
    const { guardarNaDrive } = await import("../src/assinaturas/comum.js");
    const f = await guardarNaDrive(ctx.db, {
      contratoId: 991201, signatarioNome: "Cliente Teste", formandoRegime: null, formandoId: null, clienteId: null,
    } as never, Buffer.from("%PDF-1.4\n"));
    const row = (await ctx.db.query<{ contrato_id: number; kind: string }>("SELECT contrato_id, kind FROM drive_files WHERE id = $1", [f.id])).rows[0]!;
    expect(row).toEqual({ contrato_id: 991201, kind: "contrato" });

    // Linhas antigas: uma ligada pelo pedido de assinatura, outra só pelo nome do PDF.
    await ctx.db.query("INSERT INTO drive_files (id, name, kind, stored_in) VALUES ('mig-a', 'qualquer.pdf', 'contrato', 'local'), ('mig-b', 'Contrato 991203 - Fulano - assinado.pdf', 'contrato', 'local')");
    await ctx.db.query(
      `INSERT INTO contrato_assinaturas (contrato_id, token_hash, codigo_verificacao, signatario_nome, signatario_email, expira_em, pdf_original, hash_original, drive_file_id)
       VALUES (991202, $1, $2, 'X', 'x@exemplo.pt', now(), '\\x00'::bytea, 'h', 'mig-a')`,
      [randomUUID(), randomUUID()],
    );
    const sql = readFileSync(join(import.meta.dirname, "../src/db/migrations/160_drive_contratos.sql"), "utf8");
    for (const parte of sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) await ctx.db.query(parte);
    const mig = (await ctx.db.query<{ id: string; contrato_id: number; regime: string | null }>(
      "SELECT id, contrato_id, regime FROM drive_files WHERE id IN ('mig-a', 'mig-b') ORDER BY id",
    )).rows;
    expect(mig).toEqual([{ id: "mig-a", contrato_id: 991202, regime: "fin" }, { id: "mig-b", contrato_id: 991203, regime: null }]);
  });
});

describe("#15 o formador só envia para as suas turmas", () => {
  it("kinds fechados e turma sua obrigatória", async () => {
    const ctx = await arrancar();
    await desligarDrive(ctx);
    const { eu, minha, alheia } = await formadorComTurmas(ctx);
    const estado = async (campos: Record<string, string>) => (await enviar(ctx, "formador", { regime: "gold", ...campos })).statusCode;
    expect(await estado({ kind: "dtp", turma: minha.nome, itemId: "programa" })).toBe(403);
    expect(await estado({ kind: "certificado", turma: minha.nome })).toBe(403);
    expect(await estado({ kind: "formando-doc", turma: minha.nome })).toBe(403);
    expect(await estado({ kind: "documento", turma: alheia.nome })).toBe(403);
    expect(await estado({ kind: "documento" })).toBe(403);
    expect(await estado({ kind: "documento", turma: String(minha.id) })).toBe(403);
    expect(await estado({ kind: "formador-doc", formando: eu, turma: alheia.nome })).toBe(403);
    expect(await estado({ kind: "formador-doc", formando: unico("Outro") })).toBe(403);
    expect(await estado({ kind: "documento", turma: minha.nome })).toBe(200);
    expect(await estado({ kind: "conteudo", turma: minha.nome })).toBe(200);
    expect(await estado({ kind: "formador-doc", formando: eu })).toBe(200);
    expect(await estado({ kind: "formador-doc", formando: eu, turma: minha.nome })).toBe(200);
    // A equipa continua a enviar qualquer kind.
    expect((await enviar(ctx, "secretaria", { kind: "dtp", regime: "gold", turma: alheia.nome })).statusCode).toBe(200);
  });
});

describe("#16 dossiê da Financiada sem formandos sem turma", () => {
  it("quem não tem turma não entra em nenhuma turma do curso", async () => {
    const ctx = await arrancar();
    const curso = unico("UFCD Aud");
    await ctx.db.query(
      `INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma)
       VALUES (991601, '2099-01-01', 'TF Aud 1', $1, 'X', '[]'::jsonb), (991602, '2099-02-01', 'TF Aud 2', $1, 'X', '[]'::jsonb)`,
      [curso],
    );
    await ctx.db.query(
      `INSERT INTO formandos_fin (id, nome, apelido, turma, curso, turma_id) VALUES
        (991611, 'Ana', 'Ligada', '', $1, 991601),
        (991612, 'Bia', 'PeloNome', 'TF Aud 2', $1, NULL),
        (991613, 'Cid', 'SemTurma', '', $1, NULL),
        (991614, 'Dora', 'TurmaInexistente', 'Já não existe', $1, NULL)`,
      [curso],
    );
    const { carregarTurma, formandosDaTurma } = await import("../src/repos/pedagogiaTurma.js");
    const { fontesEmLote } = await import("../src/pedagogia/dtpLote.js");
    const { formandosFinComContacto } = await import("../src/repos/dossieGerado.js");
    const t1 = (await carregarTurma(ctx.db, "fin", 991601))!;
    const t2 = (await carregarTurma(ctx.db, "fin", 991602))!;
    expect((await formandosDaTurma(ctx.db, "fin", t1)).map(f => f.id)).toEqual([991611]);
    expect((await formandosDaTurma(ctx.db, "fin", t2)).map(f => f.id)).toEqual([991612]);
    const lote = await fontesEmLote(ctx.db, "fin", [{ turma: t1, cursoId: null }, { turma: t2, cursoId: null }]);
    expect(lote.get(991601)!.formandos.map(f => f.id)).toEqual([991611]);
    expect(lote.get(991602)!.formandos.map(f => f.id)).toEqual([991612]);
    expect((await formandosFinComContacto(ctx.db, 991601, "TF Aud 1")).map(f => Number(f.id))).toEqual([991611]);
  });
});

describe("#17 exportação do dossiê", () => {
  it("destino=drive grava o ZIP na pasta da turma e devolve a ligação; destino=zip devolve o ZIP", async () => {
    const ctx = await arrancar();
    const nome = unico("TExp");
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10 });
    expect(t.statusCode, t.body).toBe(200);
    const id = t.json<{ turma: { id: number } }>().turma.id;
    await ligarDrive(ctx);
    await ctx.db.query(
      `INSERT INTO drive_files (id, drive_id, name, kind, regime, turma, stored_in) VALUES
        ('exp-1', 'g-exp-1', 'a.pdf', 'dtp', 'gold', $1, 'google'),
        ('exp-2', 'g-exp-2', 'b.pdf', 'dtp', 'gold', $1, 'google'),
        ('exp-3', 'g-exp-3', 'c.pdf', 'documento', 'gold', $1, 'google')`,
      [nome],
    );
    // Os ficheiros «dtp» só entram no ZIP como anexo actual de um item (os substituídos ficam de fora).
    await ctx.db.query(
      `INSERT INTO dtp_anexos (regime, turma_id, item_id, drive_file_id, file_name, drive_url) VALUES
        ('gold', $1, 'regulamento', 'exp-1', 'a.pdf', ''), ('gold', $1, 'divulgacao', 'exp-2', 'b.pdf', '')`,
      [id],
    );
    // O comercial só vende: não exporta dossiês (permissoes/comercial.ts).
    expect((await pedido(ctx, "comercial", "GET", `/v1/dtp/gold/${id}/export?destino=drive`)).statusCode).toBe(403);
    const chamadas = driveFalsa();
    const r = await pedido(ctx, "secretaria", "GET", `/v1/dtp/gold/${id}/export?destino=drive`);
    expect(r.statusCode, r.body).toBe(200);
    const corpo = r.json<{ drive: { url: string; nome: string; ficheiros: number } }>();
    expect(corpo.drive.url).toMatch(/^https:\/\/drive\.google\.com\/file\/d\/up-\d+\/view$/);
    expect(corpo.drive.ficheiros).toBeGreaterThanOrEqual(3);
    const descargas = chamadas.filter(c => c.url.includes("alt=media"));
    expect(descargas).toHaveLength(3);
    const zipUp = chamadas.filter(c => c.url.includes("/upload/drive/v3/files") && c.metodo === "POST");
    expect(zipUp.length).toBeGreaterThanOrEqual(1);
    // A secretaria já edita a pasta da turma: não recebe uma partilha de leitura do ZIP.
    const secretaria = await emailDe(ctx, "secretaria");
    expect(chamadas.some(c => c.metodo === "POST" && c.url.includes("/permissions?") && c.corpo.includes(secretaria) && c.corpo.includes("\"reader\""))).toBe(false);

    const z = await pedido(ctx, "secretaria", "GET", `/v1/dtp/gold/${id}/export?destino=zip`);
    expect(z.statusCode).toBe(200);
    expect(z.headers["content-type"]).toBe("application/zip");
    expect(z.rawPayload.subarray(0, 2).toString()).toBe("PK");
    await ctx.db.query("DELETE FROM drive_files WHERE id LIKE 'exp-%'");
    await desligarDrive(ctx);
  });

  it("sem ligação à Drive devolve sempre o ZIP, mesmo com destino=drive", async () => {
    const ctx = await arrancar();
    await desligarDrive(ctx);
    const nome = unico("TExp2");
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10 });
    const id = t.json<{ turma: { id: number } }>().turma.id;
    const z = await pedido(ctx, "secretaria", "GET", `/v1/dtp/gold/${id}/export?destino=drive`);
    expect(z.statusCode).toBe(200);
    expect(z.headers["content-type"]).toBe("application/zip");
  });
});

describe("#28 sem órfãos na Drive", () => {
  const linha = (ctx: Ctx, id: string) => ctx.db.query("INSERT INTO drive_files (id, drive_id, name, kind, stored_in) VALUES ($1, $2, 'x.pdf', 'documento', 'google')", [id, `g-${id}`]);
  const existe = async (ctx: Ctx, id: string) => (await ctx.db.query("SELECT 1 FROM drive_files WHERE id = $1", [id])).rows.length === 1;

  it("o registo só sai quando a Google confirma (ou responde 404)", async () => {
    const ctx = await arrancar();
    await ligarDrive(ctx);
    await linha(ctx, "del-erro");
    driveFalsa({ apagar: 500 });
    expect((await pedido(ctx, "secretaria", "DELETE", "/v1/drive/files/del-erro")).statusCode).toBe(502);
    expect(await existe(ctx, "del-erro")).toBe(true);

    vi.unstubAllGlobals();
    driveFalsa({ apagar: 404 });
    expect((await pedido(ctx, "secretaria", "DELETE", "/v1/drive/files/del-erro")).statusCode).toBe(200);
    expect(await existe(ctx, "del-erro")).toBe(false);

    vi.unstubAllGlobals();
    await linha(ctx, "del-ok");
    const chamadas = driveFalsa({ apagar: 204 });
    expect((await pedido(ctx, "secretaria", "DELETE", "/v1/drive/files/del-ok")).statusCode).toBe(200);
    expect(chamadas.some(c => c.metodo === "DELETE" && c.url.includes("/files/g-del-ok"))).toBe(true);
    expect(await existe(ctx, "del-ok")).toBe(false);

    // Sem ligação não se pode confirmar: fica tudo como estava.
    await desligarDrive(ctx);
    await linha(ctx, "del-sem");
    expect((await pedido(ctx, "secretaria", "DELETE", "/v1/drive/files/del-sem")).statusCode).toBe(502);
    expect(await existe(ctx, "del-sem")).toBe(true);
  });

  it("se o registo falha depois do upload, o ficheiro sai da Drive", async () => {
    const ctx = await arrancar();
    await ligarDrive(ctx);
    const chamadas = driveFalsa();
    const { storeDriveFile } = await import("../src/driveFicheiros.js");
    // contrato_id inválido: o INSERT falha depois de o ficheiro já estar na Google.
    await expect(storeDriveFile(ctx.db, undefined, { name: "x.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF-1.4\n") }, {
      kind: "documento", contratoId: "nao-e-numero" as never,
    }, { gerado: true })).rejects.toThrow();
    const subido = chamadas.find(c => c.url.includes("/upload/drive/v3/files"));
    expect(subido).toBeTruthy();
    expect(chamadas.some(c => c.metodo === "DELETE" && /\/files\/up-1\?/.test(c.url))).toBe(true);
    await desligarDrive(ctx);
  });
});

describe("acerto das partilhas antigas pelo cron e dossiê fora do regime", () => {
  it("o cron /v1/cron/drive acerta as turmas por sincronizar, uma vez cada, e pede o CRON_SECRET", async () => {
    const ctx = await arrancar();
    const { config } = await import("../src/config.js");
    const antes = config.cronSecret;
    try {
      const cron = (authorization?: string) =>
        ctx.app.inject({ method: "GET", url: "/v1/cron/drive", headers: authorization ? { authorization } : {} });
      config.cronSecret = "";
      expect((await cron()).statusCode).toBe(503);
      config.cronSecret = "segredo-drive";
      expect((await cron("Bearer outro")).statusCode).toBe(401);

      await ctx.db.query("UPDATE turmas_gold SET drive_partilhas_em = now()");
      await ctx.db.query("UPDATE turmas_fin SET drive_partilhas_em = now()");
      const turmaId = 990701;
      await ctx.db.query(
        `INSERT INTO turmas_gold (id, data_inicio, nome, curso, formador, cronograma, drive_pasta_id)
         VALUES ($1, '2099-08-01', $2, 'Curso', '', '[]'::jsonb, 'pasta-antiga')`,
        [turmaId, unico("TCron")],
      );
      // Sem Drive ligada não acerta nada e a turma continua por acertar.
      await desligarDrive(ctx);
      const sem = await cron("Bearer segredo-drive");
      expect(sem.statusCode, sem.body).toBe(200);
      expect(sem.json()).toMatchObject({ acertadas: 0, porAcertar: 1 });

      driveFalsa();
      await ligarDrive(ctx);
      const com = await cron("Bearer segredo-drive");
      expect(com.json()).toMatchObject({ acertadas: 1, porAcertar: 0 });
      const marca = await ctx.db.query<{ em: string | null }>("SELECT drive_partilhas_em::text AS em FROM turmas_gold WHERE id = $1", [turmaId]);
      expect(marca.rows[0]!.em).not.toBeNull();
      expect((await cron("Bearer segredo-drive")).json()).toMatchObject({ acertadas: 0, porAcertar: 0 });
    } finally {
      config.cronSecret = antes;
    }
  });

  it("o comercial não exporta o dossiê da Financiada", async () => {
    const ctx = await arrancar();
    const turmaId = 990702;
    await ctx.db.query(
      `INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES ($1, '2099-08-01', $2, 'UFCD', 'IEFP', '[]'::jsonb)`,
      [turmaId, unico("TFinExp")],
    );
    const r = await pedido(ctx, "comercial", "GET", `/v1/dtp/fin/${turmaId}/export?destino=zip`);
    expect(r.statusCode).toBe(403);
  });
});
