import { beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// PNG 1×1 válido (para o PDF conseguir embutir o logótipo).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function multipart(nome: string, bytes: Buffer, tipo = "image/png") {
  const boundary = "----gesformaTeste";
  const corpo = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${nome}"\r\nContent-Type: ${tipo}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { corpo, tipo: `multipart/form-data; boundary=${boundary}` };
}

async function carregarLogo(ctx: Ctx, perfil: "admin" | "secretaria", nome: string, bytes: Buffer) {
  const m = multipart(nome, bytes);
  return ctx.app.inject({
    method: "POST", url: "/v1/configuracoes/logo", payload: m.corpo,
    headers: { "x-gesforma-client": "web", cookie: ctx.cookie[perfil], "content-type": m.tipo },
  });
}

async function novoPagamento(ctx: Ctx, d: { nome: string; valor: number; estado: "Pago" | "Pendente"; curso?: string; email?: string }) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", {
    nome: d.nome, valor: d.valor, metodo: "Transferência bancária", curso: d.curso ?? "Excel Avançado",
    email: d.email ?? "pagador@exemplo.pt", estado: d.estado,
  });
  expect(r.statusCode).toBe(200);
  return (r.json() as { pagamento: { id: string } }).pagamento.id;
}

describe("logótipo da entidade", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });

  it("sem logótipo, o endereço público redirige para o logótipo ENA", async () => {
    const r = await pedido(ctx, null, "GET", "/v1/public/entidade/logo");
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe("/imagens/ena-logo-nobg.png");
  });

  it("recusa ficheiros que não são PNG nem JPG, mesmo com extensão de imagem", async () => {
    const r = await carregarLogo(ctx, "admin", "logo.png", Buffer.from("%PDF-1.4\n%falso"));
    expect(r.statusCode).toBe(400);
    const html = await carregarLogo(ctx, "admin", "logo.png", Buffer.from("<svg onload=alert(1)>"));
    expect(html.statusCode).toBe(400);
  });

  it("só o admin carrega; a secretaria vê a informação", async () => {
    expect((await carregarLogo(ctx, "secretaria", "logo.png", PNG)).statusCode).toBe(403);
    const ok = await carregarLogo(ctx, "admin", "Logo ENA.png", PNG);
    expect(ok.statusCode).toBe(200);
    const info = await pedido(ctx, "secretaria", "GET", "/v1/configuracoes/logo");
    expect(info.json().logo).toMatchObject({ mime: "image/png", nome: "Logo ENA.png" });
    expect((await pedido(ctx, "comercial", "GET", "/v1/configuracoes/logo")).statusCode).toBe(403);
  });

  it("serve o logótipo com ETag e responde 304 quando não mudou", async () => {
    const r = await pedido(ctx, null, "GET", "/v1/public/entidade/logo");
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("image/png");
    expect(r.rawPayload.equals(PNG)).toBe(true);
    const etag = String(r.headers.etag);
    const de = await ctx.app.inject({ method: "GET", url: "/v1/public/entidade/logo", headers: { "if-none-match": etag } });
    expect(de.statusCode).toBe(304);
  });
});

describe("pagamentos: exportação para Excel", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });

  it("exporta só os pagamentos do filtro e neutraliza fórmulas", async () => {
    await novoPagamento(ctx, { nome: "=HYPERLINK(\"http://mal\")", valor: 90, estado: "Pago" });
    await novoPagamento(ctx, { nome: "Pessoa Pendente", valor: 40, estado: "Pendente" });
    const r = await pedido(ctx, "secretaria", "GET", "/v1/pagamentos/exportar?situacao=pago");
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("spreadsheetml");
    const livro = XLSX.read(r.rawPayload, { type: "buffer" });
    const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets.Pagamentos!, { defval: "" });
    const nomes = linhas.map(l => String(l.Pessoa));
    expect(nomes).toContain("'=HYPERLINK(\"http://mal\")");
    expect(nomes).not.toContain("Pessoa Pendente");
    expect(linhas.every(l => l.Estado === "Pago")).toBe(true);
    expect(Object.keys(linhas[0]!)).toEqual(expect.arrayContaining(["NIF", "Valor (€)", "Comprovativo", "Confirmado por"]));
    const celulas = Object.values(livro.Sheets.Pagamentos!).filter(c => c && typeof c === "object" && "f" in (c as object));
    expect(celulas).toHaveLength(0);
  });

  it("fica registado na auditoria e é recusado a quem não trata de pagamentos", async () => {
    const audit = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action = 'pagamento.exportar'");
    expect(Number(audit.rows[0]?.n)).toBeGreaterThan(0);
    for (const perfil of ["comercial", "financiada", "formador"] as const) {
      expect((await pedido(ctx, perfil, "GET", "/v1/pagamentos/exportar")).statusCode).toBe(403);
    }
  });
});

describe("pagamentos: recibos", () => {
  let ctx: Ctx;
  let pago1 = "";
  let pago2 = "";
  let pendente = "";
  const ano = new Date().getFullYear();
  beforeAll(async () => {
    ctx = await arrancar();
    pago1 = await novoPagamento(ctx, { nome: "Ana Recibo", valor: 125, estado: "Pago", email: "ana.recibo@exemplo.pt" });
    pago2 = await novoPagamento(ctx, { nome: "Rui Recibo", valor: 60.5, estado: "Pago" });
    pendente = await novoPagamento(ctx, { nome: "Sem Recibo", valor: 30, estado: "Pendente" });
  });

  it("só um pagamento confirmado tem recibo", async () => {
    const r = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pendente}/recibo`);
    expect(r.statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/pagamentos/${pendente}/recibo`)).statusCode).toBe(404);
  });

  it("numera em sequência e mantém o número ao gerar de novo", async () => {
    const a = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pago1}/recibo`);
    expect(a.statusCode).toBe(200);
    expect(a.json()).toMatchObject({ novo: true, recibo: { numero: `0001/${ano}` } });
    const b = await pedido(ctx, "admin", "POST", `/v1/pagamentos/${pago2}/recibo`);
    expect(b.json().recibo.numero).toBe(`0002/${ano}`);
    const denovo = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pago1}/recibo`);
    expect(denovo.json()).toMatchObject({ novo: false, recibo: { numero: `0001/${ano}` } });
    const estado = await pedido(ctx, "secretaria", "GET", `/v1/pagamentos/${pago1}/recibo/estado`);
    expect(estado.json().recibo.numero).toBe(`0001/${ano}`);
  });

  it("pagamento recebido não muda de valor e o recibo guarda os dados da emissão", async () => {
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${pago1}`, { valor: 999 })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${pago1}`, { nome: "Outra Pessoa" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${pago1}`, { valor: 125, referencia: "REF-1" })).statusCode).toBe(200);
    // O admin corrige (fica na auditoria), mas o recibo já emitido mantém o valor recebido.
    expect((await pedido(ctx, "admin", "PATCH", `/v1/pagamentos/${pago1}`, { valor: 999 })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pago1}/recibo`)).statusCode).toBe(200);
    const r = await ctx.db.query<{ dados: { valor: number } }>("SELECT dados FROM recibos WHERE pagamento_id = $1", [pago1]);
    expect(r.rows[0]!.dados.valor).toBe(125);
    await pedido(ctx, "admin", "PATCH", `/v1/pagamentos/${pago1}`, { valor: 125 });
  });

  it("o PDF abre e diz que não substitui a fatura", async () => {
    const r = await pedido(ctx, "secretaria", "GET", `/v1/pagamentos/${pago1}/recibo`);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(r.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(r.rawPayload);
    expect(doc.getTitle()).toBe(`Recibo 0001/${ano}`);
  });

  it("envia por email e regista o destinatário", async () => {
    const r = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pago1}/recibo/enviar`, {});
    expect(r.statusCode).toBe(200);
    expect(r.json().recibo).toMatchObject({ enviadoPara: "ana.recibo@exemplo.pt" });
  });

  it("perfis sem acesso a pagamentos não emitem nem descarregam", async () => {
    for (const perfil of ["comercial", "financiada", "formador", "formando"] as const) {
      expect((await pedido(ctx, perfil, "POST", `/v1/pagamentos/${pago2}/recibo`)).statusCode).toBe(403);
      expect((await pedido(ctx, perfil, "GET", `/v1/pagamentos/${pago2}/recibo`)).statusCode).toBe(403);
    }
    expect((await pedido(ctx, null, "GET", `/v1/pagamentos/${pago2}/recibo`)).statusCode).toBe(401);
  });
});

describe("pagamentos: pré-inscrição confirmada", () => {
  it("sem pré-inscrição ligada, só marca a Gold activa do mesmo email e curso (não a desistida nem a Financiada)", async () => {
    const ctx = await arrancar();
    const email = `lead.${Date.now()}@exemplo.pt`;
    const curso = `Curso Pago ${Date.now()}`;
    const criar = async (regime: "gold" | "fin") =>
      (await pedido(ctx, "secretaria", "POST", "/v1/preinscricoes", { nome: "Lia", email, curso, regime })).json().preinscricao.id as number;
    const desistiu = await criar("gold");
    await ctx.db.query("UPDATE preinscricoes SET estado = 'Desistiu', motivo_desistencia = 'Preço' WHERE id = $1", [desistiu]);
    const fin = await criar("fin");
    const ativa = await criar("gold");
    const outroCurso = (await pedido(ctx, "secretaria", "POST", "/v1/preinscricoes", { nome: "Lia", email, curso: `${curso} B`, regime: "gold" })).json().preinscricao.id as number;
    await novoPagamento(ctx, { nome: "Lia", valor: 10, estado: "Pago", email, curso });
    const r = await ctx.db.query<{ id: number; estado: string }>("SELECT id, estado FROM preinscricoes WHERE id IN ($1, $2, $3)", [desistiu, fin, ativa]);
    const estado = Object.fromEntries(r.rows.map(x => [x.id, x.estado]));
    expect(estado[desistiu]).toBe("Desistiu");
    expect(estado[fin]).not.toBe("Pago");
    expect(estado[ativa]).toBe("Pago");
    const outro = await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricoes WHERE id = $1", [outroCurso]);
    expect(outro.rows[0]!.estado).not.toBe("Pago");
  });
});
