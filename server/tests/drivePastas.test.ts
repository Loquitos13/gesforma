// Drive: as turmas ficam em «02_TURMAS_ATIVAS / Gold» ou «/ Financiada», e cada formando tem todos os documentos na
// sua pasta dentro da turma (a da pré-inscrição, com os documentos e o comprovativo, quando existe).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

process.env.DRIVE_DIR = mkdtempSync(join(tmpdir(), "gesforma-drive-"));

type Chamada = { metodo: string; url: string; corpo: string };

/** Google Drive de mentira: as pastas procuradas existem sempre («p:<nome>»); os outros pedidos respondem bem. */
function driveFalsa() {
  const chamadas: Chamada[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const c = { metodo: (init?.method ?? "GET").toUpperCase(), url, corpo: typeof init?.body === "string" ? init.body : "" };
    chamadas.push(c);
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    const u = new URL(url);
    if (u.pathname.startsWith("/upload/drive/v3/files")) return json({ id: `up-${chamadas.length}`, name: "ficheiro.pdf", webViewLink: "https://drive.google.com/x" });
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

/** Pedidos de mudar um item de pasta (addParents) e para onde. */
const mudancas = (chamadas: Chamada[]) => chamadas
  .filter(c => c.metodo === "PATCH" && c.url.includes("addParents="))
  .map(c => ({ item: decodeURIComponent(new URL(c.url).pathname.split("/").pop() ?? ""), para: new URL(c.url).searchParams.get("addParents") }));

let ctx: Ctx;
beforeAll(async () => {
  ctx = await arrancar();
  const { sealSecret } = await import("../src/secretBox.js");
  const { saveDriveConfig } = await import("../src/googleDrive.js");
  await saveDriveConfig(ctx.db, { clientId: "cliente-de-teste-123456", clientSecret: "segredo-de-teste-123456" });
  await ctx.db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
  await ctx.db.query(
    `INSERT INTO oauth_accounts (provider, email, access_token, refresh_token, expiry, scope)
     VALUES ('google', 'conta.drive@entidade.pt', $1, $2, now() + interval '1 hour', 'drive')`,
    [sealSecret("token-de-teste"), sealSecret("refresh-de-teste")],
  );
});
afterEach(() => { vi.unstubAllGlobals(); });

let seq = 0;
const novoId = () => 940000 + Math.floor(Math.random() * 9000) * 10 + (++seq % 10);

async function turma(regime: "gold" | "fin", pasta: string, noRegime = true) {
  const id = novoId();
  const tabela = regime === "gold" ? "turmas_gold" : "turmas_fin";
  if (regime === "gold") {
    await ctx.db.query(`INSERT INTO turmas_gold (id, nome, curso, local, horario, data_inicio, estado) VALUES ($1, $2, 'CCP', 'Porto', 'Laboral', '2030-01-10', 'Ativa')`, [id, `T-${id}`]);
  } else {
    await ctx.db.query(`INSERT INTO turmas_fin (id, nome, curso, data_inicio) VALUES ($1, $2, 'UFCD 1', '2030-01-10')`, [id, `TF-${id}`]);
  }
  await ctx.db.query(`UPDATE ${tabela} SET drive_pasta_id = $2, drive_formandos_id = $3, drive_no_regime = $4 WHERE id = $1`,
    [id, pasta, `${pasta}-formandos`, noRegime]);
  return { id, nome: regime === "gold" ? `T-${id}` : `TF-${id}`, pasta, formandos: `${pasta}-formandos` };
}

describe("pastas da Drive", () => {
  it("a tarefa noturna leva as turmas antigas para a pasta do regime", async () => {
    const g = await turma("gold", `velha-gold-${novoId()}`, false);
    const f = await turma("fin", `velha-fin-${novoId()}`, false);
    const { arrumarTurmasNoRegime } = await import("../src/driveArvore.js");
    const chamadas = driveFalsa();
    expect(await arrumarTurmasNoRegime(ctx.db, 10_000)).toBeGreaterThanOrEqual(2);
    const m = mudancas(chamadas);
    expect(m).toContainEqual({ item: g.pasta, para: "p:Gold" });
    expect(m).toContainEqual({ item: f.pasta, para: "p:Financiada" });
    const marcadas = await ctx.db.query<{ n: number }>(
      "SELECT ((SELECT count(*) FROM turmas_gold WHERE id = $1 AND drive_no_regime) + (SELECT count(*) FROM turmas_fin WHERE id = $2 AND drive_no_regime))::int AS n",
      [g.id, f.id]);
    expect(marcadas.rows[0]!.n).toBe(2);
    // Já arrumadas: a noite seguinte não mexe nelas.
    const outra = driveFalsa();
    await arrumarTurmasNoRegime(ctx.db, 10_000);
    expect(mudancas(outra).some(x => x.item.startsWith("velha-"))).toBe(false);
  });

  it("a pasta do formando é a da pré-inscrição (com os documentos e o comprovativo) e vai para a turma", async () => {
    const t = await turma("gold", `turma-${novoId()}`);
    const email = `pasta.${novoId()}@exemplo.pt`;
    const leadId = novoId();
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, preco, estado, regime, drive_pasta_id, drive_pasta_parent_id)
       VALUES ($1, '2026-11-01', 'Ana', 'Silva', $2, 'CCP', 100, 'Formando', 'gold', 'pasta-da-ana', 'pendentes')`, [leadId, email]);
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Ana", apelido: "Silva", email, curso: "CCP", turmaId: t.id, semEmails: true });
    expect(r.statusCode, r.body).toBe(200);
    const formandoId = r.json().formando.id as number;

    const { pastaDoFormando, nomePastaPessoa } = await import("../src/driveArvore.js");
    const chamadas = driveFalsa();
    const p = await pastaDoFormando(ctx.db, "gold", formandoId);
    expect(p?.pastaId).toBe("pasta-da-ana");
    expect(p?.path).toBe(`02_TURMAS_ATIVAS / Gold / ${nomePastaPessoa(t.id, t.nome)} / 5. Formandos / ${nomePastaPessoa(leadId, "Ana Silva")}`);
    expect(mudancas(chamadas)).toContainEqual({ item: "pasta-da-ana", para: t.formandos });
    const gravada = await ctx.db.query<{ drive_pasta_id: string }>("SELECT drive_pasta_id FROM formandos_gold WHERE id = $1", [formandoId]);
    expect(gravada.rows[0]!.drive_pasta_id).toBe("pasta-da-ana");

    // Um documento carregado pela equipa vai para essa pasta.
    const { carregarDocPelaEquipa } = await import("../src/formandoDocsEquipa.js");
    const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    const up = await carregarDocPelaEquipa(ctx.db, "gold", formandoId, "cc", { name: "cc.pdf", mime: "application/pdf", bytes: PDF }, { id: ctx.userId.secretaria, name: "Secretaria" });
    expect(up.ok).toBe(true);
    const ficheiro = await ctx.db.query<{ folder_path: string }>(
      "SELECT f.folder_path FROM formando_docs d JOIN drive_files f ON f.id = d.drive_file_id WHERE d.regime = 'gold' AND d.formando_id = $1 AND d.doc_id = 'cc'", [formandoId]);
    expect(ficheiro.rows[0]!.folder_path).toBe(p!.path);
  });

  it("sem pré-inscrição, cria «<n.º> - <nome>» na turma; a tarefa noturna leva para lá os documentos antigos", async () => {
    const t = await turma("fin", `turma-fin-${novoId()}`);
    const formandoId = novoId();
    await ctx.db.query("INSERT INTO formandos_fin (id, nome, apelido, email, curso, turma, turma_id) VALUES ($1, 'Rui', 'Costa', $2, 'UFCD 1', $3, $4)",
      [formandoId, `rui.${formandoId}@exemplo.pt`, t.nome, t.id]);
    // Um documento antigo na Google Drive, fora da pasta da pessoa.
    await ctx.db.query(
      `INSERT INTO drive_files (id, drive_id, name, kind, regime, turma, formando, stored_in, folder_path)
       VALUES ($1, $2, 'CC - Rui Costa.pdf', 'formando-doc', 'fin', $3, 'Rui Costa', 'google', 'GesForma / Financiada / outra')`,
      [`df-${formandoId}`, `g-${formandoId}`, t.nome]);
    await ctx.db.query(
      "INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, estado) VALUES ('fin', $1, 'cc', true, 'CC - Rui Costa.pdf', '2026-11-01', $2, 'validado')",
      [formandoId, `df-${formandoId}`]);

    const { arrumarDocsDosFormandos, nomePastaPessoa } = await import("../src/driveArvore.js");
    const chamadas = driveFalsa();
    expect(await arrumarDocsDosFormandos(ctx.db, 10_000)).toBeGreaterThanOrEqual(1);
    const pessoa = nomePastaPessoa(formandoId, "Rui Costa");
    expect(mudancas(chamadas)).toContainEqual({ item: `g-${formandoId}`, para: `p:${pessoa}` });
    const depois = await ctx.db.query<{ folder_path: string }>("SELECT folder_path FROM drive_files WHERE id = $1", [`df-${formandoId}`]);
    expect(depois.rows[0]!.folder_path).toBe(`02_TURMAS_ATIVAS / Financiada / ${nomePastaPessoa(t.id, t.nome)} / 5. Formandos / ${pessoa}`);
    const arrumado = await ctx.db.query<{ drive_docs_arrumados: boolean; drive_pasta_id: string }>(
      "SELECT drive_docs_arrumados, drive_pasta_id FROM formandos_fin WHERE id = $1", [formandoId]);
    expect(arrumado.rows[0]).toEqual({ drive_docs_arrumados: true, drive_pasta_id: `p:${pessoa}` });
  });
});
