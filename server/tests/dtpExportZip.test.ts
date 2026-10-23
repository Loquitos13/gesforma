import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Ficheiros «da Drive» guardados em disco (sem conta Google ligada), numa pasta temporária.
process.env.DRIVE_DIR = mkdtempSync(join(tmpdir(), "gesforma-drive-"));

let seq = 0;
const unico = (p: string) => `${p} ${Date.now().toString(36)}${(seq += 1)}`;
const pdf = (texto: string) => Buffer.from(`%PDF-1.4\n% ${texto}\n%%EOF\n`);

type Entrada = { nome: string; flags: number; flagsLocal: number; metodo: number; hora: number; data: number; conteudo: Buffer };

/** Lê o diretório central de um ZIP (o suficiente para conferir o que o zipStore escreve). */
function lerZip(buf: Buffer): Entrada[] {
  const fim = buf.lastIndexOf(Buffer.from("PK\u0005\u0006"));
  const n = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const out: Entrada[] = [];
  for (let i = 0; i < n; i++) {
    const tam = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const metodo = buf.readUInt16LE(p + 10);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(inicio, inicio + tam);
    out.push({
      nome: buf.subarray(p + 46, p + 46 + nomeLen).toString("utf8"),
      flags: buf.readUInt16LE(p + 8),
      flagsLocal: buf.readUInt16LE(local + 6),
      metodo,
      hora: buf.readUInt16LE(p + 12),
      data: buf.readUInt16LE(p + 14),
      conteudo: metodo === 8 ? inflateRawSync(raw) : Buffer.from(raw),
    });
    p += 46 + nomeLen + extra;
  }
  return out;
}

async function exportar(ctx: Ctx, regime: "gold" | "fin", id: number) {
  const { carregarTurma } = await import("../src/repos/pedagogiaTurma.js");
  const { exportarDossie } = await import("../src/pedagogia/dtpExport.js");
  const turma = (await carregarTurma(ctx.db, regime, id))!;
  const out = await exportarDossie(ctx.db, undefined, regime, turma);
  const entradas = lerZip(out.zip);
  const indice = entradas.find(e => e.nome.endsWith("/00-Indice geral.txt"))!.conteudo.toString("utf8");
  return { out, entradas, nomes: entradas.map(e => e.nome), indice };
}

async function guardar(ctx: Ctx, nome: string, contexto: import("../src/googleDrive.js").DriveContext) {
  const { storeDriveFile } = await import("../src/driveFicheiros.js");
  return storeDriveFile(ctx.db, undefined, { name: nome, mime: "application/pdf", bytes: pdf(nome) }, contexto);
}

async function turmaGold(ctx: Ctx) {
  const nome = unico("TZip");
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10 });
  expect(t.statusCode, t.body).toBe(200);
  return { id: t.json<{ turma: { id: number } }>().turma.id, nome };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("ZIP do dossiê: formato", () => {
  it("nomes em UTF-8 (bit 11), data e hora de Lisboa, PDFs guardados sem recomprimir", async () => {
    const { zipStore, dataDos } = await import("../src/zipStore.js");
    // 15 de julho, 12:34 UTC = 13:34 em Lisboa (hora de verão).
    const zip = zipStore([
      { name: "DTP/Sumários/João.pdf", data: pdf("x") },
      { name: "DTP/a.txt", data: Buffer.from("a".repeat(2000)) },
    ], new Date("2026-07-15T12:34:56Z"));
    const [p, t] = lerZip(zip);
    expect(p!.nome).toBe("DTP/Sumários/João.pdf");
    for (const e of [p!, t!]) {
      expect(e.flags & 0x0800).toBe(0x0800);
      expect(e.flagsLocal & 0x0800).toBe(0x0800);
      expect(e.hora).toBe((13 << 11) | (34 << 5));
      expect(e.data).toBe(((2026 - 1980) << 9) | (7 << 5) | 15);
    }
    expect(p!.metodo).toBe(0);
    expect(p!.conteudo.equals(pdf("x"))).toBe(true);
    expect(t!.metodo).toBe(8);
    expect(t!.conteudo.toString()).toBe("a".repeat(2000));
    expect(dataDos(new Date("2026-01-10T23:30:00Z")).data).toBe(((2026 - 1980) << 9) | (1 << 5) | 10);
  });

  it("o prazo da exportação usa o maxDuration da função em vercel.json", async () => {
    const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { functions: Record<string, { maxDuration: number }> };
    const { DURACAO_MAXIMA_VERCEL_MS } = await import("../src/rotas/dtp.js");
    expect(vercel.functions["api/index.ts"]!.maxDuration * 1000).toBe(DURACAO_MAXIMA_VERCEL_MS);
  });
});

describe("ZIP do dossiê (Gold)", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });

  it("#7 uma segunda exportação não duplica PDFs gerados nem leva anexos substituídos", async () => {
    const { id, nome } = await turmaGold(ctx);
    const { gravarAnexo } = await import("../src/repos/dtp.js");
    const v1 = await guardar(ctx, "Regulamento v1.pdf", { kind: "dtp", regime: "gold", turma: nome, label: "Regulamento de formação", itemId: "regulamento" });
    await gravarAnexo(ctx.db, "gold", id, "regulamento", { id: v1.id, nome: v1.name, url: "" });
    // Substituir o anexo (PUT …/anexo): o ficheiro antigo continua registado na Drive.
    const v2 = await guardar(ctx, "Regulamento v2.pdf", { kind: "dtp", regime: "gold", turma: nome, label: "Regulamento de formação", itemId: "regulamento" });
    await gravarAnexo(ctx.db, "gold", id, "regulamento", { id: v2.id, nome: v2.name, url: "" });

    await exportar(ctx, "gold", id);
    const { nomes } = await exportar(ctx, "gold", id);
    expect(nomes.filter(n => /-\d+\.pdf$/.test(n))).toEqual([]);
    expect(nomes.filter(n => n.endsWith("/Cronograma.pdf"))).toHaveLength(1);
    expect(nomes.filter(n => n.includes("Folhas de presenca"))).toHaveLength(1);
    expect(nomes.filter(n => n.includes("Planos de sessao"))).toHaveLength(1);
    expect(nomes.some(n => n.includes("Regulamento v2.pdf"))).toBe(true);
    expect(nomes.some(n => n.includes("Regulamento v1.pdf"))).toBe(false);
  });

  it("#6 um ficheiro que não se descarrega fica listado no índice geral e no índice da pasta", async () => {
    const { id, nome } = await turmaGold(ctx);
    const { gravarAnexo } = await import("../src/repos/dtp.js");
    // Ficheiro na Google, sem conta ligada: a descarga não é possível.
    await ctx.db.query(
      "INSERT INTO drive_files (id, drive_id, name, kind, regime, turma, label, stored_in) VALUES ($1, 'g-falha', 'Divulgacao.pdf', 'dtp', 'gold', $2, 'divulgacao', 'google')",
      [`falha-${id}`, nome],
    );
    await gravarAnexo(ctx.db, "gold", id, "divulgacao", { id: `falha-${id}`, nome: "Divulgacao.pdf", url: "" });
    const { indice, entradas, out } = await exportar(ctx, "gold", id);
    expect(out.omitidos).toBeGreaterThanOrEqual(1);
    expect(indice).toContain("Ficheiros que NÃO estão neste ZIP (1):");
    expect(indice).toMatch(/01-Identificacao e programa\/Divulgação da turma\/.*Divulgacao\.pdf · sem ligação à Drive/);
    expect(indice).toContain("Para os obter: exporte de novo");
    const pasta = entradas.find(e => e.nome.endsWith("01-Identificacao e programa/_indice.txt"))!.conteudo.toString("utf8");
    expect(pasta).toMatch(/Divulgação da turma · Divulgacao\.pdf · NÃO ESTÁ NESTE ZIP/);
  });

  it("#6 os certificados continuam no ZIP depois de renomear a turma e entram também pelo turma_certificados", async () => {
    const { id, nome } = await turmaGold(ctx);
    const ana = 994_000 + (id % 900);
    const rui = ana + 1;
    await ctx.db.query(
      "INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id) VALUES ($1, 'Ana', 'Sá', 'ana.zip@exemplo.pt', 'Curso', $3, $4), ($2, 'Rui', 'Lopes', 'rui.zip@exemplo.pt', 'Curso', $3, $4)",
      [ana, rui, nome, id],
    );
    // Carregado pelo cockpit: registado na Drive com o nome da turma e o id do formando.
    await guardar(ctx, "Certificado Ana.pdf", { kind: "certificado", regime: "gold", turma: nome, formando: String(ana), label: "Certificado" });
    // Só ligado em turma_certificados (o nome da turma no registo da Drive é outro).
    const cRui = await guardar(ctx, "Certificado Rui.pdf", { kind: "certificado", regime: "gold", turma: "Outra turma qualquer", formando: String(rui), label: "Certificado" });
    await ctx.db.query(
      "INSERT INTO turma_certificados (regime, turma_id, formando_id, emitido, ficheiro_id, ficheiro_nome) VALUES ('gold', $1, $2, true, $3, $4)",
      [id, rui, cRui.id, cRui.name],
    );
    const novo = unico("TZip renomeada");
    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { nome: novo });
    expect(r.statusCode, r.body).toBe(200);
    const { nomes, indice } = await exportar(ctx, "gold", id);
    expect(nomes.some(n => n.includes("06-Certificacao e relatorios/Certificados/Ana Sá/") && n.endsWith("Certificado Ana.pdf"))).toBe(true);
    expect(nomes.some(n => n.includes("06-Certificacao e relatorios/Certificados/Rui Lopes/") && n.endsWith("Certificado Rui.pdf"))).toBe(true);
    expect(indice).not.toContain("NÃO estão neste ZIP");
  });

  it("#16 o recibo fica na pasta do formando, no item dos comprovativos de pagamento", async () => {
    const { id, nome } = await turmaGold(ctx);
    const fid = 995_000 + (id % 900);
    await ctx.db.query(
      "INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id) VALUES ($1, 'Inês', 'Recibo', 'ines.recibo@exemplo.pt', 'Curso', $2, $3)",
      [fid, nome, id],
    );
    const p = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", {
      nome: "Inês Recibo", valor: 50, metodo: "Transferência bancária", curso: "Curso Sem Ficha", email: "ines.recibo@exemplo.pt", estado: "Pago",
    });
    expect(p.statusCode, p.body).toBe(200);
    const pagamento = p.json<{ pagamento: { id: string } }>().pagamento.id;
    await ctx.db.query("UPDATE pagamentos SET turma_id = $2, formando_id = $3 WHERE id = $1", [pagamento, id, fid]);
    const r = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pagamento}/recibo`);
    expect(r.statusCode, r.body).toBe(200);
    const f = (await ctx.db.query<{ kind: string; formando: string; folder_path: string }>(
      "SELECT f.kind, f.formando, f.folder_path FROM recibos r JOIN drive_files f ON f.id = r.drive_file_id WHERE r.pagamento_id = $1", [pagamento],
    )).rows[0]!;
    expect(f.formando).toBe("Inês Recibo");
    expect(f.folder_path).toContain("02-Formandos / Inês Recibo / Comprovativos de pagamento recibos");
    const { nomes } = await exportar(ctx, "gold", id);
    expect(nomes.some(n => n.includes("/02-Formandos/Inês Recibo/Comprovativos de pagamento recibos/") && n.includes("Recibo"))).toBe(true);
    expect(nomes.some(n => n.includes("01-Identificacao e programa/Recibo"))).toBe(false);
  });
});

describe("ZIP e Drive do dossiê (Financiada)", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });

  async function turmaFin(formador = "") {
    const id = 996_000 + (seq += 1);
    const nome = unico("TFinZip");
    await ctx.db.query(
      "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, formador, cronograma) VALUES ($1, '2099-08-01', $2, 'UFCD', 'IEFP', $3, '[]'::jsonb)",
      [id, nome, formador],
    );
    return { id, nome };
  }

  it("#8 formandos, formadores e reembolso nos tópicos da Financiada, nunca nas pastas da Gold", async () => {
    const formador = unico("Formadora Fin");
    const { id, nome } = await turmaFin(formador);
    const fid = id + 500_000;
    await ctx.db.query("INSERT INTO formandos_fin (id, nome, apelido, turma, curso, turma_id) VALUES ($1, 'Rita', 'Fin', $2, 'UFCD', $3)", [fid, nome, id]);
    const cc = await guardar(ctx, "cc rita.pdf", { kind: "formando-doc", regime: "fin", turma: nome, formando: "Rita Fin", label: "Cartão de cidadão" });
    await ctx.db.query(
      "INSERT INTO formando_docs (regime, formando_id, doc_id, file_name, drive_file_id, estado) VALUES ('fin', $1, 'cc', $2, $3, 'pendente')",
      [fid, cc.name, cc.id],
    );
    const formadorId = (await ctx.db.query<{ id: number }>(
      "INSERT INTO formadores (id, nome, regimes, estado) VALUES (nextval('ops_id_seq')::int, $1, '[\"fin\"]'::jsonb, 'Ativo') RETURNING id", [formador],
    )).rows[0]!.id;
    const cv = await guardar(ctx, "cv formadora.pdf", { kind: "formador-doc", regime: "fin", formando: formador, label: "CV" });
    await ctx.db.query("INSERT INTO formador_docs (formador_id, doc_id, uploaded, file_name, drive_file_id) VALUES ($1, 'cv', true, $2, $3)", [formadorId, cv.name, cv.id]);
    const exec = await guardar(ctx, "Execucao Fisica.pdf", { kind: "dtp", regime: "fin", turma: nome, itemId: "execucao", label: "Reembolso" });
    await ctx.db.query("INSERT INTO reembolso_ficheiros (turma_id, tipo, drive_file_id) VALUES ($1, 'execucao-fisica', $2)", [id, exec.id]);

    const { nomes } = await exportar(ctx, "fin", id);
    expect(nomes.some(n => n.includes("/5. Formandos/Rita Fin/") && n.endsWith("cc rita.pdf"))).toBe(true);
    expect(nomes.some(n => n.includes(`/3. Formadores/${formador}/`) && n.endsWith("cv formadora.pdf"))).toBe(true);
    expect(nomes.some(n => n.includes("/8. Mecanismos de avaliação à ação formativa/") && n.endsWith("Execucao Fisica.pdf"))).toBe(true);
    expect(nomes.filter(n => /\/0[1-6]-[A-Z]/.test(n))).toEqual([]);

    // Na Drive (sem pasta da turma): também pelos tópicos.
    expect(cc.folderPath).toContain("5. Formandos / Rita Fin");
    expect(exec.folderPath).toContain("8. Mecanismos de avaliação à ação formativa");
    expect(exec.folderPath).not.toContain("01-Identificacao");
  });

  it("#8 com a pasta da turma na Drive, o ficheiro vai para o tópico dentro dela", async () => {
    const { id, nome } = await turmaFin();
    await ctx.db.query("UPDATE turmas_fin SET drive_pasta_id = 'pasta-da-turma' WHERE id = $1", [id]);
    const { sealSecret } = await import("../src/secretBox.js");
    const { saveDriveConfig } = await import("../src/googleDrive.js");
    await saveDriveConfig(ctx.db, { clientId: "cliente-de-teste-123456", clientSecret: "segredo-de-teste-123456" });
    await ctx.db.query(
      `INSERT INTO oauth_accounts (provider, email, access_token, refresh_token, expiry, scope)
       VALUES ('google', 'conta@entidade.pt', $1, $2, now() + interval '1 hour', 'drive')`,
      [sealSecret("token-de-teste"), sealSecret("refresh-de-teste")],
    );
    const pedidosDrive: string[] = [];
    let parentUpload = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const u = new URL(String(input));
      const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
      if (u.pathname.startsWith("/upload/drive/v3/files")) {
        parentUpload = /"parents":\["([^"]+)"\]/.exec(Buffer.from(init?.body as Buffer).toString("utf8"))?.[1] ?? "";
        return json({ id: "up-1", name: "ficheiro" });
      }
      const q = u.searchParams.get("q") ?? "";
      pedidosDrive.push(q);
      const nomePasta = /name='((?:[^'\\]|\\.)*)'/.exec(q)?.[1] ?? "";
      const pai = /'([^']+)' in parents/.exec(q)?.[1] ?? "";
      return json({ files: [{ id: `${pai}>${nomePasta}`, name: nomePasta }] });
    }));
    try {
      await guardar(ctx, "cc ze.pdf", { kind: "formando-doc", regime: "fin", turma: nome, formando: "Zé Fin", label: "Cartão de cidadão" });
    } finally {
      await ctx.db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
    }
    expect(parentUpload).toBe("pasta-da-turma>5. Formandos>Zé Fin");
  });

  it("#14 o relatório final do fecho nunca é apagado nem substituído ao gerar de novo", async () => {
    const { id, nome } = await turmaFin();
    const { anexarPdfDtp, nomeRelatorioDoFecho } = await import("../src/pedagogia/ficheiros.js");
    expect(nomeRelatorioDoFecho(new Date("2026-10-23T23:30:00Z"))).toBe("RelatorioFinalAccao - fecho 2026-10-24.pdf");
    await ctx.db.query("UPDATE turmas_fin SET fechada_em = now() WHERE id = $1", [id]);
    await anexarPdfDtp(ctx.db, undefined, "fin", { id, nome }, "relatorio", nomeRelatorioDoFecho(), pdf("fecho"));
    const doFecho = (await ctx.db.query<{ drive_file_id: string }>(
      "SELECT drive_file_id FROM dtp_anexos WHERE regime = 'fin' AND turma_id = $1 AND item_id = 'relatorio'", [id],
    )).rows[0]!.drive_file_id;

    // Gerar de novo depois do fecho: descarrega-se, mas o dossiê fica com o do fecho.
    const r = await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${id}/relatorio-final`);
    expect(r.statusCode, r.body).toBe(200);
    const depois = (await ctx.db.query<{ drive_file_id: string }>(
      "SELECT drive_file_id FROM dtp_anexos WHERE regime = 'fin' AND turma_id = $1 AND item_id = 'relatorio'", [id],
    )).rows[0]!.drive_file_id;
    expect(depois).toBe(doFecho);

    // Outro PDF gerado com o mesmo nome numa turma fechada: o anterior fica na Drive.
    await anexarPdfDtp(ctx.db, undefined, "fin", { id, nome }, "relatorio-pos", "RelatorioPosFormacao.pdf", pdf("a"));
    const primeiro = (await ctx.db.query<{ drive_file_id: string }>(
      "SELECT drive_file_id FROM dtp_anexos WHERE regime = 'fin' AND turma_id = $1 AND item_id = 'relatorio-pos'", [id],
    )).rows[0]!.drive_file_id;
    await anexarPdfDtp(ctx.db, undefined, "fin", { id, nome }, "relatorio-pos", "RelatorioPosFormacao.pdf", pdf("b"));
    expect((await ctx.db.query("SELECT 1 FROM drive_files WHERE id = $1", [primeiro])).rows).toHaveLength(1);
    expect((await ctx.db.query("SELECT 1 FROM drive_files WHERE id = $1", [doFecho])).rows).toHaveLength(1);

    // O ZIP de uma turma fechada leva o relatório do fecho, não um gerado na hora.
    const { nomes } = await exportar(ctx, "fin", id);
    expect(nomes.some(n => n.includes("RelatorioFinalAccao - fecho"))).toBe(true);
    expect(nomes.some(n => n.endsWith("/RelatorioFinalAccao.pdf"))).toBe(false);
  });
});
