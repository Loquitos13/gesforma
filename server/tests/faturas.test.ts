// Fatura de cada pagamento: a contabilidade anexa o PDF depois de confirmar o pagamento e a fatura segue, em anexo, para
// o email da faturação e para o da pessoa. A coordenação Gold vê a fatura e os dados de faturação, mas não a anexa.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

type Enviado = { to: string; subject: string; text: string; anexos: string[] };
const enviados = vi.hoisted(() => [] as Enviado[]);
vi.mock("../src/mailer.js", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/mailer.js")>()),
  sendMail: async (_db: unknown, m: { to: string; subject: string; text: string; anexos?: { nome: string }[] }) => {
    enviados.push({ to: m.to, subject: m.subject, text: m.text, anexos: (m.anexos ?? []).map(a => a.nome) });
    return "teste";
  },
}));

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
let ctx: Ctx;
let seq = 0;
beforeAll(async () => { ctx = await arrancar(); });

/** Pré-inscrição Gold com o pagamento pedido e o comprovativo anexado; os dados de faturação confirmados (empresa). */
async function compraComComprovativo() {
  const email = `fatura.${randomUUID().slice(0, 8)}@exemplo.pt`;
  const pag = `PT-${randomUUID().slice(0, 8)}`;
  await ctx.db.query(
    `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia)
     VALUES ($1, 'Rui Costa', 250, 'Transferência bancária', 'CCP', '2026-11-01 10:00', 'Pendente', $2, '')`, [pag, email]);
  const id = 950000 + Math.floor(Math.random() * 9000) * 10 + (++seq % 10);
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, preco, estado, regime, pagamento_id, pagamento_pedido_em)
     VALUES ($1, '2026-11-01', 'Rui', 'Costa', $2, 'CCP', 250, '2º Contacto', 'gold', $3, now())`, [id, email, pag]);
  await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, 'comprovativo', 'comprovativo.pdf', 'pendente')", [id]);
  const { gravarFaturacaoDoPercurso } = await import("../src/faturacao.js");
  await gravarFaturacaoDoPercurso(ctx.db, id, { nome: "Costa & Filhos, Lda", nif: "509999999", moradaFiscal: "Rua Nova, 5, Porto", codigoPostal: "4000-002", email: "contas@costa.pt" });
  return { id, email, pag };
}

function anexar(perfil: "contabilidade" | "secretaria" | "admin", pag: string, bytes: Buffer, campos: Record<string, string>) {
  const boundary = "----fatura";
  const partes = Object.entries(campos).map(([k, v]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  const body = Buffer.concat([
    ...partes,
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="FT 2026-15.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/pagamentos/${pag}/fatura`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, cookie: ctx.cookie[perfil], "x-gesforma-client": "web" },
  });
}

describe("fatura do pagamento", () => {
  it("anexa-se depois de confirmar; segue para o email da faturação e o da pessoa; a coordenação só vê", async () => {
    const c = await compraComComprovativo();
    // Antes de o pagamento estar confirmado, não.
    expect((await anexar("contabilidade", c.pag, PDF, { numero: "FT 2026/15", enviar: "1" })).statusCode).toBe(409);
    expect((await pedido(ctx, "contabilidade", "POST", `/v1/pagamentos/${c.pag}/confirmar`)).statusCode).toBe(200);

    // O detalhe leva os dados de faturação confirmados e para onde vai a fatura.
    const det = (await pedido(ctx, "contabilidade", "GET", `/v1/pagamentos/${c.pag}`)).json();
    expect(det.faturacao).toMatchObject({ confirmado: true, dados: { nome: "Costa & Filhos, Lda", nif: "509999999" } });
    expect(det.destinosFatura).toEqual(["contas@costa.pt", c.email]);
    expect(det.fatura).toBeNull();
    expect(det.pagamento.fatura_em).toBeNull();

    expect((await anexar("secretaria", c.pag, PDF, { numero: "FT 2026/15", enviar: "1" })).statusCode).toBe(403);
    expect((await anexar("contabilidade", c.pag, Buffer.from("não é um pdf"), { numero: "FT 2026/15", enviar: "1" })).statusCode).toBe(400);

    const antes = enviados.length;
    const r = await anexar("contabilidade", c.pag, PDF, { numero: "FT 2026/15", enviar: "1" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().enviadaPara).toEqual(["contas@costa.pt", c.email]);
    const mails = enviados.slice(antes);
    expect(mails.map(m => m.to)).toEqual(["contas@costa.pt", c.email]);
    for (const m of mails) {
      expect(m.subject).toBe("A sua fatura n.º FT 2026/15 · CCP");
      expect(m.text).toContain("250,00");
      expect(m.anexos).toHaveLength(1);
      expect(m.anexos[0]).toMatch(/^Fatura FT 2026-15 - Rui Costa/);
    }

    // A coordenação Gold não abre os pagamentos; a contabilidade vê a fatura.
    expect((await pedido(ctx, "secretaria", "GET", `/v1/pagamentos/${c.pag}`)).statusCode).toBe(403);
    const visto = (await pedido(ctx, "contabilidade", "GET", `/v1/pagamentos/${c.pag}`)).json();
    expect(visto.fatura).toMatchObject({ numero: "FT 2026/15", enviadaPara: `contas@costa.pt, ${c.email}` });
    expect(visto.pagamento.fatura_em).toBeTruthy();
    expect((await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${c.pag}/fatura/enviar`)).statusCode).toBe(403);

    // Enviar de novo (lê o PDF guardado).
    const total = enviados.length;
    const reenvio = await pedido(ctx, "contabilidade", "POST", `/v1/pagamentos/${c.pag}/fatura/enviar`);
    expect(reenvio.statusCode, reenvio.body).toBe(200);
    expect(enviados.slice(total).map(m => m.anexos.length)).toEqual([1, 1]);
  });

  it("o filtro «por emitir» mostra os pagos sem fatura; a exportação também filtra", async () => {
    const a = await compraComComprovativo();
    const b = await compraComComprovativo();
    for (const c of [a, b]) expect((await pedido(ctx, "contabilidade", "POST", `/v1/pagamentos/${c.pag}/confirmar`)).statusCode).toBe(200);
    expect((await anexar("contabilidade", a.pag, PDF, { numero: "", enviar: "0" })).statusCode).toBe(200);
    expect(enviados.some(m => m.subject.startsWith("A sua fatura") && m.to === a.email)).toBe(false);

    const ids = async (fatura: string) =>
      ((await pedido(ctx, "contabilidade", "GET", `/v1/pagamentos?fatura=${fatura}&porPagina=100`)).json().linhas as { id: string }[]).map(l => l.id);
    expect(await ids("por_emitir")).toContain(b.pag);
    expect(await ids("por_emitir")).not.toContain(a.pag);
    expect(await ids("emitida")).toContain(a.pag);
    expect(await ids("emitida")).not.toContain(b.pag);
    expect((await pedido(ctx, "contabilidade", "GET", "/v1/pagamentos/exportar?fatura=emitida")).statusCode).toBe(200);
  });
});
