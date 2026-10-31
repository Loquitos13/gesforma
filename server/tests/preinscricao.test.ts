import { describe, expect, it } from "vitest";
import { arrancar, pedido, preinscricaoDoEmail, type Ctx } from "./helpers.js";

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

/** Envia o formulário público e devolve o id gravado (lido na base: a resposta não o leva). */
async function idPublico(ctx: Ctx, body: Record<string, unknown>) {
  const r = await publico(ctx, body);
  expect(r.statusCode, r.body).toBe(200);
  return preinscricaoDoEmail(ctx, String(body.email));
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
    const id = await preinscricaoDoEmail(ctx, email);
    const lead = await ctx.db.query<{ preco: unknown }>("SELECT preco FROM preinscricoes WHERE id = $1", [id]);
    expect(Number(lead.rows[0]!.preco)).toBe(100);

    await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${id}`, { nif: "123456789", notas: "nota interna" });
    await ctx.db.query("UPDATE preinscricoes SET inscrito = '2026-01-05T10:00:00.000Z' WHERE id = $1", [id]);
    const dup = await publico(ctx, { nome: "Outra pessoa", email, curso, local: "Lisboa" });
    // O pedido repetido passa a contar como recente e fica com o local escolhido agora; o primeiro fica no histórico.
    const renovado = (await ctx.db.query<{ inscrito: string; local: string }>("SELECT inscrito::text AS inscrito, local FROM preinscricoes WHERE id = $1", [id])).rows[0]!;
    expect(renovado.inscrito.startsWith("2026-01-05")).toBe(false);
    expect(renovado.local).toBe("Lisboa");
    const hist = await ctx.db.query<{ detalhe: string }>("SELECT detalhe FROM lead_eventos WHERE lead_id = $1 AND titulo = 'Novo pedido no site'", [id]);
    expect(hist.rows[0]!.detalhe).toContain("Primeiro pedido: 05-01-2026");
    // Pedido repetido: a mesma resposta de um pedido novo (sem id, referência nem «duplicado»).
    expect(dup.json()).toEqual(r1.json());
    expect(Object.keys(dup.json()).sort()).toEqual(["aviso", "ok"]);
    const texto = dup.body;
    expect(texto).not.toContain("912345678");
    expect(texto).not.toContain("123456789");
    expect(texto).not.toContain("nota interna");
    expect(await preinscricaoDoEmail(ctx, email)).toBe(id);

    const outroCurso = await cursoGold(ctx, 50);
    const r3 = await publico(ctx, { nome: "Ana", email, curso: outroCurso });
    expect(r3.json()).toEqual(r1.json());
    expect(await preinscricaoDoEmail(ctx, email)).not.toBe(id);

    const emailFora = `${unico("fora")}@exemplo.pt`;
    await publico(ctx, { nome: "Rui", email: emailFora, curso: "Curso que não existe", preco: 999 });
    const lf = await ctx.db.query<{ preco: unknown }>("SELECT preco FROM preinscricoes WHERE id = $1", [await preinscricaoDoEmail(ctx, emailFora)]);
    expect(Number(lf.rows[0]!.preco)).toBe(0);
  });

  it("consentimento obrigatório quando o admin o activa", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    await pedido(ctx, "admin", "PUT", "/v1/settings/site", { values: { rgpdObrigatorio: "1", rgpdVersao: "v2" } });
    expect((await publico(ctx, { nome: "Sem", email: `${unico("c")}@exemplo.pt`, curso })).statusCode).toBe(400);
    const emailOk = `${unico("c")}@exemplo.pt`;
    const ok = await publico(ctx, { nome: "Com", email: emailOk, curso, consentimento: true });
    expect(ok.statusCode).toBe(200);
    const row = await ctx.db.query<{ consentimento_versao: string; consentimento_em: unknown }>(
      "SELECT consentimento_versao, consentimento_em FROM preinscricoes WHERE id = $1", [await preinscricaoDoEmail(ctx, emailOk)],
    );
    expect(row.rows[0]).toMatchObject({ consentimento_versao: "v2" });
    expect(row.rows[0]!.consentimento_em).toBeTruthy();
    await pedido(ctx, "admin", "PUT", "/v1/settings/site", { values: {} });
  });
});

describe("ligação pessoal até à validação", () => {
  it("sem passo de pagamento antes de a secretaria o pedir", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 100);
    const id = await idPublico(ctx, { nome: "Eva", email: `${unico("eva")}@exemplo.pt`, curso });
    const token = await tokenDe(ctx, id);
    const vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.precisaPagamento).toBe(false);
    expect(vista.pagamento).toBeNull();
    for (const tipo of ["cc", "contrato", "regulamento"]) expect((await upload(ctx, token, tipo, `${tipo}.pdf`, PDF)).statusCode).toBe(200);
    // Sem pedido de pagamento: nem pagamento criado, nem comprovativo aceite, nem pedido antes de validar os documentos.
    const lead = await ctx.db.query<{ pagamento_id: string | null }>("SELECT pagamento_id FROM preinscricoes WHERE id = $1", [id]);
    expect(lead.rows[0]!.pagamento_id).toBeFalsy();
    expect((await upload(ctx, token, "comprovativo", "pag.pdf", PDF)).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/pedir-pagamento`)).statusCode).toBe(409);
  });

  it("documentos e turma → secretaria valida e pede o pagamento → comprovativo validado → ficha, conta e acesso", async () => {
    const ctx = await arrancar();
    await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "ENA", iban: "PT50 0002 0123 1234 5678 9015 4", titularConta: "ENA Formação" } });
    const curso = await cursoGold(ctx, 100);
    const passada = await turmaGold(ctx, curso, "2026-01-05");
    const turma = await turmaGold(ctx, curso, "2030-03-04", 1);
    const email = `${unico("ana")}@exemplo.pt`;
    const id = await idPublico(ctx, { nome: "Ana", apelido: "Lima", email, curso });
    const token = await tokenDe(ctx, id);

    const vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.turmas.map((t: { id: number }) => t.id)).not.toContain(passada.id);

    expect((await upload(ctx, token, "cc", "cc.pdf", FALSO)).statusCode).toBe(400);
    for (const tipo of ["cc", "contrato", "regulamento"]) {
      const up = await upload(ctx, token, tipo, `${tipo}.pdf`, PDF);
      expect(up.statusCode, up.body).toBe(200);
    }
    await validarDoc(ctx, id, "cc");
    expect((await upload(ctx, token, "cc", "cc.pdf", PDF)).statusCode).toBe(409);
    await validarDoc(ctx, id, "contrato");
    await validarDoc(ctx, id, "regulamento");

    const passadaRes = await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/turma`, payload: { turmaId: passada.id } });
    expect(passadaRes.statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/turma`, payload: { turmaId: turma.id } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(200);

    // Curso pago: a validação manual fica à espera do pagamento.
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/validar-preinscricao`, {})).statusCode).toBe(400);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/pedir-pagamento`)).statusCode).toBe(403);
    const pedidoPag = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/pedir-pagamento`);
    expect(pedidoPag.statusCode, pedidoPag.body).toBe(200);
    expect(pedidoPag.json()).toMatchObject({ estadoPagamento: "pedido" });

    const comPag = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(comPag.precisaPagamento).toBe(true);
    expect(comPag.pagamento).toMatchObject({ valor: 100, iban: "PT50 0002 0123 1234 5678 9015 4", titular: "ENA Formação" });
    expect(JSON.stringify(comPag)).not.toContain("referencia");

    // Concluir a inscrição à mão só depois de o pagamento estar confirmado.
    const cedo = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/concluir-inscricao`);
    expect(cedo.statusCode, cedo.body).toBe(409);
    // O comercial só mexe nas suas pré-inscrições: dá-se-lhe esta para provar a regra do perfil.
    await ctx.db.query("UPDATE preinscricoes SET comercial_id = $1 WHERE id = $2", [ctx.userId.comercial, id]);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/concluir-inscricao`)).statusCode).toBe(403);

    expect((await upload(ctx, token, "comprovativo", "pag.pdf", PDF)).statusCode).toBe(200);
    await validarDoc(ctx, id, "comprovativo");
    // Já concluída: repetir não cria nada de novo.
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/concluir-inscricao`)).statusCode).toBe(409);

    // Pagamento confirmado: pré-inscrição validada, ficha de formando na turma e conta criada.
    const lead = await ctx.db.query<{ estado: string; pagamento_id: string }>("SELECT estado, pagamento_id FROM preinscricoes WHERE id = $1", [id]);
    expect(lead.rows[0]!.estado).toBe("Formando");
    const pag = await ctx.db.query<{ estado: string }>("SELECT estado FROM pagamentos WHERE id = $1", [lead.rows[0]!.pagamento_id]);
    expect(pag.rows[0]!.estado).toBe("Pago");
    const ficha = await ctx.db.query<{ id: number; pago: boolean; turma_id: number; user_id: string | null }>(
      "SELECT id, pago, turma_id, user_id::text AS user_id FROM formandos_gold WHERE lower(email) = $1", [email],
    );
    expect(ficha.rows).toHaveLength(1);
    expect(ficha.rows[0]).toMatchObject({ pago: true, turma_id: turma.id });
    expect(ficha.rows[0]!.user_id).toBeTruthy();
    const conta = await ctx.db.query<{ role: string; must_change_password: boolean }>("SELECT role, must_change_password FROM users WHERE lower(email) = $1", [email]);
    expect(conta.rows[0]).toMatchObject({ role: "formando", must_change_password: true });
    const docs = await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM formando_docs WHERE regime = 'gold' AND formando_id = $1 AND estado = 'validado'", [ficha.rows[0]!.id],
    );
    expect(docs.rows[0]!.n).toBe(3);

    // Ligação fechada: sem dados pessoais nem envios.
    const fechada = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(fechada).toMatchObject({ encerrada: true });
    expect(JSON.stringify(fechada)).not.toContain("Lima");
    expect((await upload(ctx, token, "cc", "cc.pdf", PDF)).statusCode).toBe(410);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/nova-ligacao`)).statusCode).toBe(409);

    // Inscrição concluída: segue o pedido dos dados de faturação (ligação própria, dados cifrados).
    const fat = await ctx.db.query<{ token: string; dados_enc: string | null }>("SELECT token, dados_enc FROM preinscricao_faturacao WHERE preinscricao_id = $1", [id]);
    expect(fat.rows).toHaveLength(1);
    const fatToken = fat.rows[0]!.token;
    const vistaFat = (await ctx.app.inject({ method: "GET", url: `/v1/public/faturacao/${fatToken}` })).json();
    expect(vistaFat).toMatchObject({ curso, preenchido: false });
    const mau = await ctx.app.inject({ method: "POST", url: `/v1/public/faturacao/${fatToken}`, payload: { nome: "Empresa X", nif: "12", moradaFiscal: "Rua A, 1", codigoPostal: "4000-001", email: "fat@exemplo.pt" } });
    expect(mau.statusCode).toBe(400);
    const dadosFat = { nome: "Empresa X, Lda", nif: "509 999 999", moradaFiscal: "Rua das Flores, 10, Porto", codigoPostal: "4000-001", email: "Faturas@Exemplo.pt" };
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/faturacao/${fatToken}`, payload: dadosFat })).statusCode).toBe(200);
    const cifrado = await ctx.db.query<{ dados_enc: string }>("SELECT dados_enc FROM preinscricao_faturacao WHERE preinscricao_id = $1", [id]);
    expect(cifrado.rows[0]!.dados_enc).not.toContain("509999999");
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${id}/faturacao`)).statusCode).toBe(403);
    const contab = await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}/faturacao`);
    expect(contab.statusCode, contab.body).toBe(200);
    expect(contab.json()).toMatchObject({ pedido: true, dados: { nome: "Empresa X, Lda", nif: "509999999", email: "faturas@exemplo.pt" } });
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/faturacao/naoexistemesmonaoexiste123" })).statusCode).toBe(404);

    // A vaga única ficou ocupada: outra pessoa já não a pode escolher.
    const outro = await idPublico(ctx, { nome: "Rui", email: `${unico("rui")}@exemplo.pt`, curso });
    const vistaOutro = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${await tokenDe(ctx, outro)}` })).json();
    expect(vistaOutro.turmas.map((t: { id: number }) => t.id)).not.toContain(turma.id);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Intruso", email: `${unico("x")}@exemplo.pt`, turmaId: turma.id })).statusCode).toBe(409);

    // Repetir a confirmação (webhook em duplicado) não cria outra ficha.
    const { confirmarPagamento } = await import("../src/ops.js");
    const pagRow = (await ctx.db.query("SELECT * FROM pagamentos WHERE id = $1", [lead.rows[0]!.pagamento_id])).rows[0] as Record<string, unknown>;
    await confirmarPagamento(ctx.db, pagRow);
    const fichas = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM formandos_gold WHERE lower(email) = $1", [email]);
    expect(fichas.rows[0]!.n).toBe(1);
    await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "ENA" } });
  });

  it("nova ligação invalida a antiga; desistência fecha a ligação", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const id = await idPublico(ctx, { nome: "Rita", email: `${unico("rita")}@exemplo.pt`, curso });
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
    const id = await idPublico(ctx, { nome: "Paulo", email: `${unico("paulo")}@exemplo.pt`, curso });
    await ctx.db.query("UPDATE preinscricoes SET comercial_id = $1 WHERE id = $2", [ctx.userId.comercial, id]);
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
    const aberto = await idPublico(ctx, { nome: "Lia", email: `${unico("lia")}@exemplo.pt`, curso });
    const desistiu = await idPublico(ctx, { nome: "Zé", email: `${unico("ze")}@exemplo.pt`, curso });
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

  it("cada lembrete conta como contacto; com 3 contactos sai o último lembrete e param", async () => {
    const ctx = await arrancar();
    const { enviarLembretesPreinscricao } = await import("../src/lembretePre.js");
    const curso = await cursoGold(ctx);
    const id = await idPublico(ctx, { nome: "Rui", email: `${unico("rui")}@exemplo.pt`, curso });
    await ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id <> $1", [id]);
    const vencer = () => ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() - interval '3 days' WHERE id = $1", [id]);
    const contactos = async () => (await ctx.db.query<{ nota: string }>(
      "SELECT nota FROM preinscricao_contactos WHERE preinscricao_id = $1 ORDER BY id", [id])).rows.map(r => r.nota);

    await vencer();
    await enviarLembretesPreinscricao(ctx.db);
    const depois1 = await contactos();
    expect(depois1.at(-1)).toMatch(/^Lembrete automático · documentação pendente/);

    // Mais contactos até 3: o próximo é o último lembrete e não sai mais nenhum.
    while ((await contactos()).length < 3) {
      await ctx.db.query("INSERT INTO preinscricao_contactos (preinscricao_id, nota) VALUES ($1, 'telefonema')", [id]);
    }
    await vencer();
    await enviarLembretesPreinscricao(ctx.db);
    expect((await contactos()).at(-1)).toMatch(/^Último lembrete automático/);
    const n = (await contactos()).length;
    await vencer();
    await enviarLembretesPreinscricao(ctx.db);
    expect((await contactos()).length).toBe(n);
  });

  it("os emails da documentação listam os documentos e os telefones por zona", async () => {
    const ctx = await arrancar();
    const { renderModelo, telefonesPorZona } = await import("../src/automations.js");
    const { buildCtaVars } = await import("../src/emailCta.js");
    const { modeloEmail } = await import("../src/repos/emails.js");
    const linhas = "223781100 se pretende realizar o curso no Porto/Gaia\r\n\r\n223781101 se pretende realizar o curso em Braga ou Aveiro\n223781102 se pretende realizar o curso em Lisboa";
    expect((await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", { values: { nome: "ENA", telefonesZona: linhas } })).statusCode).toBe(200);
    const telefones = await telefonesPorZona(ctx.db);
    expect(telefones).toHaveLength(3);
    expect(telefones[0]).toMatch(/^223781100 /);
    for (const tipo of ["welcome", "lembrete_docs", "lembrete_docs_final"]) {
      const m = await modeloEmail(ctx.db, tipo);
      expect(m, tipo).toBeTruthy();
      const vars = buildCtaVars({
        nome: "Ana", email: "ana@exemplo.pt", curso: "Curso X", turma: "-", documentosUrl: "https://x.pt/documentos/t",
        documentosItens: ["Cartão de Cidadão", "Certificado de habilitações"], emFaltaItens: ["Certificado de habilitações"],
        telefonesItens: telefones,
      });
      const mail = renderModelo({ ...m!, template_tipo: m!.tipo }, "Ana", vars);
      expect(mail.subject).toMatch(/ENA/);
      expect(mail.html).toContain("• Certificado de habilitações");
      expect(mail.html).toContain("• 223781102 se pretende realizar o curso em Lisboa");
      expect(mail.html).not.toContain("&lt;br");
      expect(mail.text).toContain("\n• 223781100 se pretende realizar o curso no Porto/Gaia");
      expect(mail.html).toContain('href="https://x.pt/documentos/t"');
    }
  });
});

describe("financiada: só documentos, a secretaria coloca na turma", () => {
  it("sem escolha de turma na ligação; a validação exige a turma de destino e cria a ficha", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Fin");
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-fin", {
      ufcdCod: unico("U").slice(0, 18), ufcd: curso, nomeComercial: curso, regime: "Presencial", horas: 25,
    })).statusCode).toBe(200);
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
      dataInicio: "2030-06-03", nome: unico("TF"), curso, local: "Porto", horario: "Laboral Manhã", alunosTotal: 5, estado: "A montar",
      cronograma: [{ id: unico("s"), data: "2030-06-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
    });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    const email = `${unico("fin")}@exemplo.pt`;
    // O site manda "gold" por engano: o curso é financiado, por isso fica nas financiadas.
    const r = await publico(ctx, { nome: "Luís", email, curso, regime: "gold", turmaId });
    expect(r.statusCode, r.body).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    const lead = await ctx.db.query<{ turma_id: number | null; regime: string }>("SELECT turma_id, regime FROM preinscricoes WHERE id = $1", [id]);
    expect(lead.rows[0]).toMatchObject({ regime: "fin", turma_id: null });

    const token = await tokenDe(ctx, id);
    const vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.escolheTurma).toBe(false);
    expect(vista.turmas).toEqual([]);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/turma`, payload: { turmaId } })).statusCode).toBe(400);

    // Antes dos documentos, a ligação da financiada pede a morada, a identificação e os termos (sem eles, recusa concluir).
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(409);
    const validade = `${new Date().getUTCFullYear() + 5}-01-01`;
    for (const [passo, corpo] of [
      ["morada", { morada: "Rua das Flores, 12", localidade: "Porto", codigoPostal: "4000-123", concelho: "Porto" }],
      ["identificacao", {
        tipoDocumento: "Cartão de Cidadão", numeroDocumento: "12345678", validadeDocumento: validade, nif: "123456789",
        niss: "12345678901", iban: "PT50000201231234567890154", situacaoEmprego: "Inativo(a) (estudante, reformado(a), doméstico(a)…)",
      }],
      ["termos", { termos: true, dados: true }],
    ] as const) {
      const r = await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/dados/${passo}`, payload: corpo });
      expect(r.statusCode, r.body).toBe(200);
    }
    // Documentos entregues e validados (os modelos com consentimento entram como ficheiro já validado).
    for (const tipo of ["cc", "ch", "cu", "morada", "ci", "ce", "contrato", "rgpd"]) {
      await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, $2, $3, 'validado')", [id, tipo, `${tipo}.pdf`]);
    }
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(200);

    const sem = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/validar-preinscricao`, {});
    expect(sem.statusCode).toBe(400);
    expect(sem.json().error).toMatch(/turma/i);
    const ok = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/validar-preinscricao`, { turmaId });
    expect(ok.statusCode, ok.body).toBe(200);
    const ficha = await ctx.db.query<{ turma_id: number; user_id: string | null }>("SELECT turma_id, user_id::text AS user_id FROM formandos_fin WHERE lower(email) = $1", [email]);
    expect(Number(ficha.rows[0]?.turma_id)).toBe(turmaId);
    expect(ficha.rows[0]?.user_id).toBeTruthy();
  });
});

describe("ficha manual pela secretaria", () => {
  it("oferta fica a 0 € e paga; o acesso usa o email e segue por email sem trocar contas existentes", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 150);
    const turma = await turmaGold(ctx, curso, "2030-09-02");
    const email = `${unico("oferta")}@exemplo.pt`;
    const f = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", {
      nome: "Inês", apelido: "Sá", email, turmaId: turma.id, estado: "Formando", pago: false, valor: 0, metodo: "Oferta",
    });
    expect(f.statusCode, f.body).toBe(200);
    const id = f.json().formando.id as number;
    const ficha = await ctx.db.query<{ valor: unknown; pago: boolean; metodo: string }>("SELECT valor, pago, metodo FROM formandos_gold WHERE id = $1", [id]);
    expect(Number(ficha.rows[0]!.valor)).toBe(0);
    expect(ficha.rows[0]).toMatchObject({ pago: true, metodo: "Oferta" });

    // Por pagar: o valor vem do preço do curso.
    const outra = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", {
      nome: "Rui", email: `${unico("rui")}@exemplo.pt`, turmaId: turma.id, valor: 0, metodo: "-",
    });
    expect(Number(outra.json().formando.valor)).toBe(150);

    expect((await pedido(ctx, "formador", "POST", `/v1/formandos/gold/${id}/acesso`, { enviarEmail: true })).statusCode).toBe(403);
    const acesso = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/acesso`, { enviarEmail: true });
    expect(acesso.statusCode, acesso.body).toBe(200);
    expect(acesso.json().acesso).toMatchObject({ email, criado: true, emailEnviado: true });
    expect(acesso.json().acesso.password).toBeTruthy();
    const conta = await ctx.db.query<{ must_change_password: boolean }>("SELECT must_change_password FROM users WHERE lower(email) = $1", [email]);
    expect(conta.rows[0]!.must_change_password).toBe(true);

    // Segunda ficha da mesma pessoa noutra turma: liga à conta, sem trocar a palavra-passe.
    const hash = (await ctx.db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE lower(email) = $1", [email])).rows[0]!.password_hash;
    const t2 = await turmaGold(ctx, curso, "2030-10-07");
    const f2 = (await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Inês", email, turmaId: t2.id, metodo: "Oferta" })).json().formando.id as number;
    const ac2 = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${f2}/acesso`, { enviarEmail: true });
    expect(ac2.json().acesso.password).toBeUndefined();
    const depois = (await ctx.db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE lower(email) = $1", [email])).rows[0]!.password_hash;
    expect(depois).toBe(hash);
  });
});

describe("turma escolhida no site", () => {
  it("fica como turma do percurso: a ligação pessoal não volta a pedir o cronograma, salvo turma cheia", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const turma = await turmaGold(ctx, curso, "2031-02-03");
    const email = `${unico("sofia")}@exemplo.pt`;
    const r = await publico(ctx, { nome: "Sofia", email, curso, turmaId: turma.id });
    expect(r.statusCode, r.body).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    const token = await tokenDe(ctx, id);
    const vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.turmaEscolhida?.id).toBe(turma.id);
    expect(vista.turmaCheia).toBe(false);

    // A secretaria dá a turma como cheia: volta a escolha, com as outras turmas.
    const cheia = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/turma-cheia`, {});
    expect(cheia.statusCode, cheia.body).toBe(200);
    const depois = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(depois.turmaEscolhida).toBeNull();
    expect(depois.turmaCheia).toBe(true);
  });

  it("recusa uma turma sem vagas", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const turma = await turmaGold(ctx, curso, "2031-03-03", 1);
    await ctx.db.query("UPDATE turmas_gold SET vagas_anunciadas = 0 WHERE id = $1", [turma.id]);
    await ctx.db.query("UPDATE turmas_gold SET vagas = 0 WHERE id = $1", [turma.id]);
    const r = await publico(ctx, { nome: "Rita", email: `${unico("rita")}@exemplo.pt`, curso, turmaId: turma.id });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/vagas/);
  });
});
