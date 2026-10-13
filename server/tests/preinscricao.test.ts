import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const FALSO = Buffer.from("MZ\x90\x00 isto não é um pdf");

let seq = 0;
function unico(prefixo: string) {
  seq += 1;
  return `${prefixo}-${Date.now()}-${seq}`;
}

async function cursoGold(ctx: Ctx, preco = 100) {
  const nome = unico("Curso Teste");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
    nome, categoria: "Teste", tipo: "Pré-inscrição", preco, regime: "Presencial", horas: 8,
  });
  expect(r.statusCode).toBe(200);
  return nome;
}

async function turmaGold(ctx: Ctx, curso: string, dataInicio: string, vagas = 5) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio, nome: unico("T"), curso, local: "Porto", horario: "Laboral Manhã", vagas, toleranciaVagas: 0, estado: "Ativa",
    cronograma: [{ id: unico("s"), data: dataInicio, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(r.statusCode).toBe(200);
  return r.json().turma as { id: number; nome: string };
}

function publico(ctx: Ctx, body: Record<string, unknown>) {
  return ctx.app.inject({ method: "POST", url: "/v1/public/preinscricoes", payload: body, remoteAddress: `10.0.${seq % 250}.${(seq * 7) % 250}` });
}

async function tokenDe(ctx: Ctx, id: number) {
  const r = await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id]);
  return r.rows[0]!.docs_token;
}

function upload(ctx: Ctx, token: string, tipo: string, nome: string, bytes: Buffer) {
  const boundary = "----gesforma";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/public/documentos/${token}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  });
}

async function validarDoc(ctx: Ctx, leadId: number, tipo: string) {
  const d = await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo]);
  const r = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${leadId}/documentos/${d.rows[0]!.id}/validar`);
  expect(r.statusCode).toBe(200);
}

describe("formulário público", () => {
  it("não devolve dados da ficha, ignora o preço do cliente e separa cursos", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 100);
    const email = `${unico("pub")}@exemplo.pt`;
    const r1 = await publico(ctx, { nome: "Ana", email, telf: "912345678", curso, preco: 1 });
    expect(r1.statusCode).toBe(200);
    const id = r1.json().preinscricao.id as number;
    const lead = await ctx.db.query<{ preco: unknown }>("SELECT preco FROM preinscricoes WHERE id = $1", [id]);
    expect(Number(lead.rows[0]!.preco)).toBe(100);

    await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${id}`, { nif: "123456789", notas: "nota interna" });
    const dup = await publico(ctx, { nome: "Outra pessoa", email, curso });
    expect(dup.json().duplicado).toBe(true);
    const texto = dup.body;
    expect(texto).not.toContain("912345678");
    expect(texto).not.toContain("123456789");
    expect(texto).not.toContain("nota interna");
    expect(Object.keys(dup.json().preinscricao).sort()).toEqual(["id", "ref"]);

    const outroCurso = await cursoGold(ctx, 50);
    const r3 = await publico(ctx, { nome: "Ana", email, curso: outroCurso });
    expect(r3.json().duplicado).toBe(false);
    expect(r3.json().preinscricao.id).not.toBe(id);

    const fora = await publico(ctx, { nome: "Rui", email: `${unico("fora")}@exemplo.pt`, curso: "Curso que não existe", preco: 999 });
    const lf = await ctx.db.query<{ preco: unknown }>("SELECT preco FROM preinscricoes WHERE id = $1", [fora.json().preinscricao.id]);
    expect(Number(lf.rows[0]!.preco)).toBe(0);
  });

  it("consentimento obrigatório quando o admin o activa", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    await pedido(ctx, "admin", "PUT", "/v1/settings/site", { values: { rgpdObrigatorio: "1", rgpdVersao: "v2" } });
    expect((await publico(ctx, { nome: "Sem", email: `${unico("c")}@exemplo.pt`, curso })).statusCode).toBe(400);
    const ok = await publico(ctx, { nome: "Com", email: `${unico("c")}@exemplo.pt`, curso, consentimento: true });
    expect(ok.statusCode).toBe(200);
    const row = await ctx.db.query<{ consentimento_versao: string; consentimento_em: unknown }>(
      "SELECT consentimento_versao, consentimento_em FROM preinscricoes WHERE id = $1", [ok.json().preinscricao.id],
    );
    expect(row.rows[0]).toMatchObject({ consentimento_versao: "v2" });
    expect(row.rows[0]!.consentimento_em).toBeTruthy();
    await pedido(ctx, "admin", "PUT", "/v1/settings/site", { values: {} });
  });
});

describe("ligação pessoal até à validação", () => {
  it("percurso completo, pagamento, reserva de vaga, fecho da ligação e ligação ao formando", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 100);
    const passada = await turmaGold(ctx, curso, "2026-01-05");
    const turma = await turmaGold(ctx, curso, "2030-03-04", 1);
    const email = `${unico("ana")}@exemplo.pt`;
    const id = (await publico(ctx, { nome: "Ana", apelido: "Lima", email, curso })).json().preinscricao.id as number;
    const token = await tokenDe(ctx, id);

    const vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.precisaPagamento).toBe(true);
    expect(vista.tipos.map((t: { id: string }) => t.id)).toContain("comprovativo");
    expect(vista.turmas.map((t: { id: number }) => t.id)).not.toContain(passada.id);

    expect((await upload(ctx, token, "cc", "cc.pdf", FALSO)).statusCode).toBe(400);
    for (const tipo of ["cc", "contrato", "regulamento"]) {
      const up = await upload(ctx, token, tipo, `${tipo}.pdf`, PDF);
      expect(up.statusCode, up.body).toBe(200);
    }
    const lead = await ctx.db.query<{ pagamento_id: string }>("SELECT pagamento_id FROM preinscricoes WHERE id = $1", [id]);
    expect(lead.rows[0]!.pagamento_id).toBeTruthy();

    await validarDoc(ctx, id, "cc");
    expect((await upload(ctx, token, "cc", "cc.pdf", PDF)).statusCode).toBe(409);
    await validarDoc(ctx, id, "contrato");
    await validarDoc(ctx, id, "regulamento");

    expect((await upload(ctx, token, "comprovativo", "pag.pdf", PDF)).statusCode).toBe(200);
    await validarDoc(ctx, id, "comprovativo");
    const pag = await ctx.db.query<{ estado: string }>("SELECT estado FROM pagamentos WHERE id = $1", [lead.rows[0]!.pagamento_id]);
    expect(pag.rows[0]!.estado).toBe("Pago");

    const passadaRes = await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/turma`, payload: { turmaId: passada.id } });
    expect(passadaRes.statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/turma`, payload: { turmaId: turma.id } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(200);
    const val = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/validar-preinscricao`, {});
    expect(val.statusCode).toBe(200);

    // Ligação fechada: sem dados pessoais nem envios.
    const fechada = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(fechada).toMatchObject({ encerrada: true, motivo: "validada" });
    expect(JSON.stringify(fechada)).not.toContain("Lima");
    expect((await upload(ctx, token, "cc", "cc.pdf", PDF)).statusCode).toBe(410);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/nova-ligacao`)).statusCode).toBe(409);

    // A vaga única fica reservada: outra pessoa já não a pode escolher.
    const outro = (await publico(ctx, { nome: "Rui", email: `${unico("rui")}@exemplo.pt`, curso })).json().preinscricao.id as number;
    const tokenOutro = await tokenDe(ctx, outro);
    const vistaOutro = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${tokenOutro}` })).json();
    expect(vistaOutro.turmas.map((t: { id: number }) => t.id)).not.toContain(turma.id);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Intruso", email: `${unico("x")}@exemplo.pt`, turmaId: turma.id })).statusCode).toBe(409);

    // A secretaria converte a reserva em formando: o lead passa a Formando e o pagamento fica ligado.
    const f = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Ana", apelido: "Lima", email, turmaId: turma.id });
    expect(f.statusCode).toBe(200);
    const depois = await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricoes WHERE id = $1", [id]);
    expect(depois.rows[0]!.estado).toBe("Formando");
    const ficha = await ctx.db.query<{ pago: boolean }>("SELECT pago FROM formandos_gold WHERE id = $1", [f.json().formando.id]);
    expect(ficha.rows[0]!.pago).toBe(true);
    const docs = await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM formando_docs WHERE regime = 'gold' AND formando_id = $1 AND estado = 'validado'", [f.json().formando.id],
    );
    expect(docs.rows[0]!.n).toBe(3);
  });

  it("nova ligação invalida a antiga; desistência fecha a ligação", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const id = (await publico(ctx, { nome: "Rita", email: `${unico("rita")}@exemplo.pt`, curso })).json().preinscricao.id as number;
    const antigo = await tokenDe(ctx, id);
    const r = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/nova-ligacao`);
    expect(r.statusCode).toBe(200);
    const novo = await tokenDe(ctx, id);
    expect(novo).not.toBe(antigo);
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${antigo}` })).statusCode).toBe(404);
    await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${id}`, { estado: "Desistiu", motivoDesistencia: "Mudou de ideias" });
    const v = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${novo}` })).json();
    expect(v).toMatchObject({ encerrada: true, motivo: "desistiu" });
  });

  it("comercial não marca Pago; secretaria regista o pagamento", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 80);
    const id = (await publico(ctx, { nome: "Paulo", email: `${unico("paulo")}@exemplo.pt`, curso })).json().preinscricao.id as number;
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/preinscricoes/${id}`, { estado: "Pago" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${id}`, { estado: "Pago" })).statusCode).toBe(200);
    const pag = await ctx.db.query<{ estado: string; valor: unknown }>(
      "SELECT p.estado, p.valor FROM pagamentos p JOIN preinscricoes l ON l.pagamento_id = p.id WHERE l.id = $1", [id],
    );
    expect(pag.rows[0]).toMatchObject({ estado: "Pago" });
    expect(Number(pag.rows[0]!.valor)).toBe(80);
  });
});

describe("lembretes", () => {
  it("não saem para quem desistiu e param no máximo", async () => {
    const ctx = await arrancar();
    const { enviarLembretesPreinscricao } = await import("../src/lembretePre.js");
    const curso = await cursoGold(ctx);
    const aberto = (await publico(ctx, { nome: "Lia", email: `${unico("lia")}@exemplo.pt`, curso })).json().preinscricao.id as number;
    const desistiu = (await publico(ctx, { nome: "Zé", email: `${unico("ze")}@exemplo.pt`, curso })).json().preinscricao.id as number;
    await ctx.db.query("UPDATE preinscricoes SET estado = 'Desistiu' WHERE id = $1", [desistiu]);
    await ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() - interval '3 days', lembretes_enviados = 0 WHERE id = ANY($1::int[])", [`{${aberto},${desistiu}}`]);
    await ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() WHERE NOT (id = ANY($1::int[]))", [`{${aberto},${desistiu}}`]);
    await enviarLembretesPreinscricao(ctx.db);
    const r = await ctx.db.query<{ id: number; lembretes_enviados: number }>(
      "SELECT id, lembretes_enviados FROM preinscricoes WHERE id = ANY($1::int[]) ORDER BY id", [`{${aberto},${desistiu}}`],
    );
    const por = new Map(r.rows.map(x => [x.id, x.lembretes_enviados]));
    expect(por.get(aberto)).toBe(1);
    expect(por.get(desistiu)).toBe(0);
    await ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() - interval '3 days', lembretes_enviados = 5 WHERE id = $1", [aberto]);
    await enviarLembretesPreinscricao(ctx.db);
    const fim = await ctx.db.query<{ lembretes_enviados: number }>("SELECT lembretes_enviados FROM preinscricoes WHERE id = $1", [aberto]);
    expect(fim.rows[0]!.lembretes_enviados).toBe(5);
  });
});
