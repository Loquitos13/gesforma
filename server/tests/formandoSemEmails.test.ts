// Inscrição feita pela equipa (ex.: vinda da plataforma antiga): ficha sem emails de documentos nem de pagamento; a equipa
// carrega os documentos na ficha (ficam validados) e o formando não recebe pedidos, lembretes, recusas nem confirmações.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const enviados = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("../src/mailer.js", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/mailer.js")>()),
  sendMail: async (_db: unknown, m: { to: string; subject: string }) => {
    enviados.push({ to: m.to, subject: m.subject });
    return "teste";
  },
}));

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
let ctx: Ctx;
beforeAll(async () => {
  ctx = await arrancar();
  await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "ENA", iban: "PT50 0002 0123 1234 5678 9015 4" } });
});

const emailNovo = () => `sem.${randomUUID().slice(0, 8)}@exemplo.pt`;
const paraFormando = (email: string) => enviados.filter(e => e.to === email);
const jobsPara = async (email: string) =>
  (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM email_jobs WHERE to_email = $1", [email])).rows[0]!.n;

function carregar(regime: "gold" | "fin", id: number, docId: string, bytes = PDF) {
  const boundary = "----doc";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/formandos/${regime}/${id}/documentos/${docId}/ficheiro`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, cookie: ctx.cookie[regime === "gold" ? "secretaria" : "financiada"], "x-gesforma-client": "web" },
  });
}

const ficha = async (regime: "gold" | "fin", id: number) =>
  (await pedido(ctx, regime === "gold" ? "secretaria" : "financiada", "GET", `/v1/formandos/${regime}/${id}`)).json().ficha;

describe("ficha sem emails de documentos nem de pagamento", () => {
  it("Gold: a equipa carrega os documentos (validados) e o pagamento não se pede por email nem se confirma por email", async () => {
    const email = emailNovo();
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Maria", apelido: "Antiga", email, curso: "CCP", valor: 300, semEmails: true });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formando.id as number;
    const f = await ficha("gold", id);
    expect(f.semEmails).toBe(true);

    // Documento carregado pela equipa: validado, com o ficheiro, e sem email.
    expect((await carregar("gold", id, "nao-existe")).statusCode).toBe(404);
    expect((await carregar("gold", id, "cc", Buffer.from("MZ não é um pdf"))).statusCode).toBe(400);
    const up = await carregar("gold", id, "cc");
    expect(up.statusCode, up.body).toBe(200);
    const doc = (await ficha("gold", id)).documentos.find((d: { id: string }) => d.id === "cc");
    expect(doc).toMatchObject({ estado: "validado" });
    expect(doc.fileName).toMatch(/Cartão de Cidadão/);

    // Pedir o pagamento por email: bloqueado.
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/pedir-pagamento`)).statusCode).toBe(409);
    expect(paraFormando(email)).toHaveLength(0);

    // Com a opção desligada, o pedido sai; ligada de novo, a confirmação do pagamento (Pagamentos) não sai.
    expect((await pedido(ctx, "secretaria", "PUT", `/v1/formandos/gold/${id}/sem-emails`, { ativo: false })).json()).toMatchObject({ semEmails: false });
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/pedir-pagamento`)).statusCode).toBe(200);
    expect(paraFormando(email)).toHaveLength(1);
    expect((await pedido(ctx, "secretaria", "PUT", `/v1/formandos/gold/${id}/sem-emails`, { ativo: true })).statusCode).toBe(200);
    const pag = await ctx.db.query<{ id: string }>("SELECT id FROM pagamentos WHERE formando_id = $1 AND estado = 'Pendente'", [id]);
    expect((await pedido(ctx, "contabilidade", "POST", `/v1/pagamentos/${pag.rows[0]!.id}/confirmar`)).statusCode).toBe(200);
    expect(await jobsPara(email)).toBe(0);
    expect(paraFormando(email)).toHaveLength(1);
  });

  it("Gold sem a opção: a confirmação do pagamento sai (como sempre)", async () => {
    const email = emailNovo();
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Rui", apelido: "Novo", email, curso: "CCP", valor: 300 });
    const id = r.json().formando.id as number;
    expect((await ficha("gold", id)).semEmails).toBe(false);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/pedir-pagamento`)).statusCode).toBe(200);
    const pag = await ctx.db.query<{ id: string }>("SELECT id FROM pagamentos WHERE formando_id = $1 AND estado = 'Pendente'", [id]);
    expect((await pedido(ctx, "contabilidade", "POST", `/v1/pagamentos/${pag.rows[0]!.id}/confirmar`)).statusCode).toBe(200);
    expect(await jobsPara(email)).toBeGreaterThan(0);
  });

  it("Financiada: documentos carregados pela equipa; recusa e lembrete sem email", async () => {
    const email = emailNovo();
    const r = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { nome: "Ana", apelido: "Antiga", email, curso: "UFCD 1", semEmails: true });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formando.id as number;
    expect((await carregar("fin", id, "ch")).statusCode).toBe(200);
    const docs = (await ficha("fin", id)).documentos as { id: string; estado: string }[];
    expect(docs.find(d => d.id === "ch")?.estado).toBe("validado");

    // Recusar um documento carregado: fica na ficha, sem email ao formando.
    const recusa = await pedido(ctx, "financiada", "POST", `/v1/formandos/fin/${id}/documentos/ch/recusar`, { observacao: "Ilegível" });
    expect(recusa.statusCode, recusa.body).toBe(200);
    // O lembrete manual também não sai.
    expect((await pedido(ctx, "financiada", "POST", `/v1/formandos-fin/${id}/lembrete-documentos`)).statusCode).toBe(400);
    const { enviarAvisosDocumentos } = await import("../src/avisosDocumentos.js");
    await enviarAvisosDocumentos(ctx.db);
    expect(paraFormando(email)).toHaveLength(0);
  });
});
