// Comprovativo na ligação pessoal → dados de faturação (passo seguinte) → contabilidade: o email à contabilidade
// espera pelos dados (sai logo que chegam, ou no fim do prazo com os da ficha), e a pessoa recebe um lembrete.
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
const CONTAS = "contas@exemplo.pt";
let ctx: Ctx;
let seq = 0;

beforeAll(async () => {
  ctx = await arrancar();
  const r = await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "ENA", iban: "PT50 0002 0123 1234 5678 9015 4", emailContabilidade: CONTAS } });
  expect(r.statusCode, r.body).toBe(200);
});

/** Pré-inscrição Gold com o pagamento pedido pela secretaria (passo de pagamento aberto) e a sua ligação pessoal. */
async function leadComPagamentoPedido() {
  const email = `fat.${randomUUID().slice(0, 8)}@exemplo.pt`;
  const pag = `PT-${randomUUID().slice(0, 8)}`;
  await ctx.db.query(
    `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia)
     VALUES ($1, 'Rita Sousa', 125, 'Transferência bancária', 'CCP', '2026-11-01 10:00', 'Pendente', $2, '')`, [pag, email]);
  const id = 960000 + Math.floor(Math.random() * 9000) * 10 + (++seq % 10);
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, preco, estado, regime, pagamento_id, pagamento_pedido_em)
     VALUES ($1, '2026-11-01', 'Rita', 'Sousa', $2, 'CCP', 125, '2º Contacto', 'gold', $3, now())`, [id, email, pag]);
  const { ensureDocsToken } = await import("../src/docsLink.js");
  return { id, email, pag, token: await ensureDocsToken(ctx.db, id) };
}

function upload(token: string, tipo: string, nome: string) {
  const boundary = "----gesforma";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`),
    PDF,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/public/documentos/${token}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  });
}

const vista = async (token: string) => (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
const faturacao = (token: string, dados: Record<string, string>) =>
  ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/faturacao`, payload: dados });
const paraContabilidade = () => enviados.filter(e => e.to === CONTAS);
/** O comprovativo chegou há `horas` (para a espera e o lembrete sem esperar de verdade). */
const recuar = (id: number, horas: number) =>
  ctx.db.query(`UPDATE comprovativo_contabilidade SET recebido_em = now() - ($2::float8 * interval '1 hour') WHERE preinscricao_id = $1`, [id, horas]);

const EMPRESA = { nome: "Empresa X, Lda", nif: "509 999 999", moradaFiscal: "Rua das Flores, 10, Porto", codigoPostal: "4000-001", email: "Faturas@Exemplo.pt" };

describe("dados de faturação depois do comprovativo", () => {
  it("o passo pede os dados (os da ficha, editáveis); a contabilidade recebe o comprovativo com os dados confirmados", async () => {
    const l = await leadComPagamentoPedido();
    const antes = paraContabilidade().length;
    expect((await upload(l.token, "comprovativo", "pag.pdf")).statusCode).toBe(200);
    // Sem os dados de faturação, o email à contabilidade espera.
    expect(paraContabilidade().length).toBe(antes);
    const v = await vista(l.token);
    expect(v.pagamento.faturacao).toEqual({
      confirmado: false,
      dados: { nome: "Rita Sousa", nif: "", moradaFiscal: "", codigoPostal: "", email: l.email },
    });

    const mau = await faturacao(l.token, { ...EMPRESA, nif: "123" });
    expect(mau.statusCode).toBe(400);
    expect(mau.json().campos.map((c: { campo: string }) => c.campo)).toContain("nif");
    const ok = await faturacao(l.token, EMPRESA);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().faturacao).toMatchObject({ confirmado: true, dados: { nif: "509999999", email: "faturas@exemplo.pt" } });

    const mail = paraContabilidade().at(-1)!;
    expect(paraContabilidade().length).toBe(antes + 1);
    expect(mail.subject).toContain("Rita Sousa");
    expect(mail.anexos).toHaveLength(1);
    for (const t of ["confirmados pela pessoa", "Empresa X, Lda", "509999999", "Rua das Flores, 10, Porto", "4000-001", "faturas@exemplo.pt", "125,00"]) {
      expect(mail.text).toContain(t);
    }
    // Os dados ficam cifrados (o histórico não os leva).
    const cifrado = await ctx.db.query<{ dados_enc: string }>("SELECT dados_enc FROM preinscricao_faturacao WHERE preinscricao_id = $1", [l.id]);
    expect(cifrado.rows[0]!.dados_enc).not.toContain("509999999");
    expect((await vista(l.token)).pagamento.faturacao.confirmado).toBe(true);

    // Outro comprovativo (os dados já estão confirmados): segue logo.
    expect((await upload(l.token, "comprovativo", "pag2.pdf")).statusCode).toBe(200);
    expect(paraContabilidade().length).toBe(antes + 2);
  });

  it("sem os dados: lembrete à pessoa; no fim da espera segue com os da ficha (por confirmar) e, confirmados, outra vez", async () => {
    const { enviarComprovativosPendentes } = await import("../src/comprovativoContabilidade.js");
    const l = await leadComPagamentoPedido();
    expect((await upload(l.token, "comprovativo", "pag.pdf")).statusCode).toBe(200);
    const antes = paraContabilidade().length;

    // Ainda dentro da primeira hora: nada.
    await enviarComprovativosPendentes(ctx.db);
    expect(enviados.filter(e => e.to === l.email && e.subject.includes("dados de faturação"))).toHaveLength(0);

    // Uma hora depois: o lembrete à pessoa (uma só vez); a contabilidade continua à espera (24 horas).
    await recuar(l.id, 2);
    await enviarComprovativosPendentes(ctx.db);
    await enviarComprovativosPendentes(ctx.db);
    const lembretes = enviados.filter(e => e.to === l.email && e.subject.includes("dados de faturação"));
    expect(lembretes).toHaveLength(1);
    expect(lembretes[0]!.subject).toBe("Confirme os dados de faturação · CCP");
    expect(lembretes[0]!.text).toContain(`/documentos/${l.token}`);
    expect(paraContabilidade().length).toBe(antes);

    // Fim da espera: segue com os dados da ficha, marcados como por confirmar.
    await recuar(l.id, 25);
    await enviarComprovativosPendentes(ctx.db);
    expect(paraContabilidade().length).toBe(antes + 1);
    expect(paraContabilidade().at(-1)!.text).toContain("por confirmar");
    await enviarComprovativosPendentes(ctx.db);
    expect(paraContabilidade().length).toBe(antes + 1);

    // A pessoa confirma depois: a contabilidade recebe os dados confirmados.
    expect((await faturacao(l.token, EMPRESA)).statusCode).toBe(200);
    expect(paraContabilidade().length).toBe(antes + 2);
    expect(paraContabilidade().at(-1)!.text).toContain("confirmados pela pessoa");
  });

  it("a espera é configurável; com o pagamento já confirmado não sai nada", async () => {
    const { enviarComprovativosPendentes } = await import("../src/comprovativoContabilidade.js");
    expect((await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { emailContabilidade: CONTAS, esperaFaturacaoHoras: "999" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { emailContabilidade: CONTAS, esperaFaturacaoHoras: "2" } })).statusCode).toBe(200);

    const a = await leadComPagamentoPedido();
    expect((await upload(a.token, "comprovativo", "pag.pdf")).statusCode).toBe(200);
    const antes = paraContabilidade().length;
    await recuar(a.id, 3);
    await enviarComprovativosPendentes(ctx.db);
    expect(paraContabilidade().length).toBe(antes + 1);

    // Pagamento confirmado pela contabilidade antes do fim da espera: o email já não sai, nem o lembrete.
    const b = await leadComPagamentoPedido();
    expect((await upload(b.token, "comprovativo", "pag.pdf")).statusCode).toBe(200);
    expect((await pedido(ctx, "contabilidade", "POST", `/v1/pagamentos/${b.pag}/confirmar`)).statusCode).toBe(200);
    await recuar(b.id, 30);
    const total = enviados.length;
    await enviarComprovativosPendentes(ctx.db);
    expect(enviados.slice(total).filter(e => e.to === CONTAS || e.subject.includes("dados de faturação"))).toHaveLength(0);
    // E o passo de faturação da ligação fecha com o pagamento.
    expect((await faturacao(b.token, EMPRESA)).statusCode).not.toBe(200);
  });
});
