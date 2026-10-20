import { describe, expect, it } from "vitest";
import { numeroPt } from "../../src/partilhado/despesas.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Auditoria do dinheiro: pagamentos sem duplicados, apoios só a quem tem direito, recibos imutáveis,
// webhook atómico, ficha «Pago» a acompanhar os pagamentos, números à portuguesa e dados de faturação no recibo.

const CHAVE_WEBHOOK = "segredo-auditoria";

async function criarGold(ctx: Ctx, corpo: Record<string, unknown>) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", corpo);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { formando: { id: number } }).formando.id;
}

const fichaPaga = async (ctx: Ctx, id: number) =>
  (await ctx.db.query<{ pago: boolean }>("SELECT pago FROM formandos_gold WHERE id = $1", [id])).rows[0]!.pago;

async function ligarWebhook(ctx: Ctx) {
  await ctx.db.query(
    `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET values = app_settings.values || EXCLUDED.values`,
    [{ "Chave webhook pagamentos": CHAVE_WEBHOOK }],
  );
}

const webhook = (ctx: Ctx, id: string) =>
  ctx.app.inject({ method: "POST", url: "/v1/public/pagamentos/webhook", payload: { chave: CHAVE_WEBHOOK, id } });

describe("registo manual de pagamentos sem duplicados", () => {
  it("a mesma chave devolve o mesmo pagamento (corpo ou cabeçalho Idempotency-Key)", async () => {
    const ctx = await arrancar();
    const corpo = { nome: "Duplo Clique", valor: 80, metodo: "Numerário", email: "duplo@exemplo.pt", estado: "Pago", chave: "form-abc-12345678" };
    const [a, b] = await Promise.all([
      pedido(ctx, "secretaria", "POST", "/v1/pagamentos", corpo),
      pedido(ctx, "secretaria", "POST", "/v1/pagamentos", corpo),
    ]);
    expect(a.statusCode, a.body).toBe(200);
    expect(b.statusCode, b.body).toBe(200);
    expect(a.json().pagamento.id).toBe(b.json().pagamento.id);
    const n = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM pagamentos WHERE chave_idempotencia = $1", [corpo.chave]);
    expect(n.rows[0]!.n).toBe(1);

    const semChave = { nome: "Cabecalho", valor: 15, metodo: "Numerário", email: "cab@exemplo.pt", estado: "Pendente" };
    const h = (k: string) => ctx.app.inject({
      method: "POST", url: "/v1/pagamentos", payload: semChave,
      headers: { "x-gesforma-client": "web", cookie: ctx.cookie.secretaria, "idempotency-key": k },
    });
    const h1 = await h("cabecalho-0001");
    const h2 = await h("cabecalho-0001");
    expect(h2.json().pagamento.id).toBe(h1.json().pagamento.id);
    expect(h2.json().repetido).toBe(true);
  });

  it("sem chave, um pagamento igual registado há instantes é recusado; ficha já paga também", async () => {
    const ctx = await arrancar();
    const corpo = { nome: "Sem Chave", valor: 42.5, metodo: "Numerário", email: "semchave@exemplo.pt", estado: "Pendente" };
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", corpo)).statusCode).toBe(200);
    const dup = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", corpo);
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toMatch(/igual/);
    // Outro valor já é outro pagamento.
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { ...corpo, valor: 43 })).statusCode).toBe(200);

    const f = await criarGold(ctx, { nome: "Rosa", apelido: "Paga", email: "rosa.paga@exemplo.pt", curso: "Curso Dup", valor: 100, pago: true, metodo: "Numerário" });
    const outro = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { nome: "Rosa Paga", valor: 100, metodo: "Numerário", estado: "Pago", formandoId: f, chave: "ficha-paga-0001" });
    expect(outro.statusCode).toBe(409);
    expect(outro.json().error).toMatch(/já está paga/);
  });

  it("valida o pedido manual: email, data e cêntimos", async () => {
    const ctx = await arrancar();
    const base = { nome: "Validar", valor: 10, metodo: "Numerário", estado: "Pendente" };
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { ...base, email: "não é email" })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { ...base, data: "amanhã" })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { ...base, valor: 10.555 })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { ...base, chave: "x" })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { ...base, data: "2026-10-01", email: "ok@exemplo.pt" })).statusCode).toBe(200);
  });
});

describe("webhook e confirmação atómicos; ficha «Pago» acompanha os pagamentos", () => {
  it("falha a meio não deixa o pagamento Pago com a ficha por pagar; a reentrega conclui", async () => {
    const ctx = await arrancar();
    await ligarWebhook(ctx);
    // Ficha sem email: o pagamento ligado à ficha marca-a paga na mesma (antes só acontecia com email).
    const f = await criarGold(ctx, { nome: "Tiago", apelido: "Semmail", email: "", curso: "Curso Webhook", valor: 60 });
    const r = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { nome: "Tiago Semmail", valor: 60, metodo: "Transferência bancária", estado: "Pendente", formandoId: f });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().pagamento.id as string;

    // A ficha recusa ser alterada: a confirmação falha e nada fica meio feito.
    await ctx.db.query(
      `CREATE OR REPLACE FUNCTION teste_falha_ficha() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha simulada'; END $$`,
    );
    await ctx.db.query(`CREATE TRIGGER teste_falha_ficha BEFORE UPDATE ON formandos_gold FOR EACH ROW WHEN (OLD.id = ${f}) EXECUTE FUNCTION teste_falha_ficha()`);
    expect((await webhook(ctx, id)).statusCode).toBe(500);
    const meio = await ctx.db.query<{ estado: string }>("SELECT estado FROM pagamentos WHERE id = $1", [id]);
    expect(meio.rows[0]!.estado).toBe("Pendente");
    expect(await fichaPaga(ctx, f)).toBe(false);

    await ctx.db.query("DROP TRIGGER teste_falha_ficha ON formandos_gold");
    const ok = await webhook(ctx, id);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().pagamento.estado).toBe("Pago");
    expect(await fichaPaga(ctx, f)).toBe(true);
    // Reentrega: 200, sem repetir efeitos.
    expect((await webhook(ctx, id)).statusCode).toBe(200);
  });

  it("cancelado não volta a Pago pelo webhook", async () => {
    const ctx = await arrancar();
    await ligarWebhook(ctx);
    const r = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { nome: "Cancelada", valor: 20, metodo: "Numerário", estado: "Pendente", email: "cancelada@exemplo.pt" });
    const id = r.json().pagamento.id as string;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${id}`, { estado: "Cancelado" })).statusCode).toBe(200);
    expect((await webhook(ctx, id)).statusCode).toBe(409);
  });

  it("pagamento que deixa de estar recebido (correção do admin ou apagado) tira o «Pago» da ficha", async () => {
    const ctx = await arrancar();
    const f = await criarGold(ctx, { nome: "Vera", apelido: "Sync", email: "vera.sync@exemplo.pt", curso: "Curso Sync", valor: 30 });
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${f}/registar-pagamento`, { metodo: "Numerário", valor: 30 })).statusCode).toBe(200);
    expect(await fichaPaga(ctx, f)).toBe(true);
    const mov = (await ctx.db.query<{ id: string }>("SELECT id FROM pagamentos WHERE formando_id = $1", [f])).rows[0]!.id;
    expect((await pedido(ctx, "admin", "PATCH", `/v1/pagamentos/${mov}`, { estado: "Cancelado" })).statusCode).toBe(200);
    expect(await fichaPaga(ctx, f)).toBe(false);

    const g = await criarGold(ctx, { nome: "Rui", apelido: "Apagado", email: "rui.apagado@exemplo.pt", curso: "Curso Sync", valor: 30 });
    await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${g}/registar-pagamento`, { metodo: "Numerário", valor: 30 });
    const movG = (await ctx.db.query<{ id: string }>("SELECT id FROM pagamentos WHERE formando_id = $1", [g])).rows[0]!.id;
    expect((await pedido(ctx, "admin", "DELETE", `/v1/pagamentos/${movG}`)).statusCode).toBe(200);
    expect(await fichaPaga(ctx, g)).toBe(false);
  });
});

describe("recibo emitido não muda", () => {
  it("os dados ficam gravados na emissão e a base recusa alterá-los", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { nome: "Recibo Fixo", valor: 70, metodo: "Numerário", estado: "Pago", email: "fixo@exemplo.pt" });
    const id = r.json().pagamento.id as string;
    const em = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${id}/recibo`);
    expect(em.statusCode, em.body).toBe(200);
    const antes = (await ctx.db.query<{ dados: { numero: string; valor: number } }>("SELECT dados FROM recibos WHERE pagamento_id = $1", [id])).rows[0]!.dados;
    expect(antes.valor).toBe(70);
    expect(antes.numero).toBe(em.json().recibo.numero);

    await expect(ctx.db.query("UPDATE recibos SET dados = jsonb_set(dados, '{valor}', '999') WHERE pagamento_id = $1", [id])).rejects.toThrow(/já emitido/);
    await expect(ctx.db.query("UPDATE recibos SET numero = numero + 1 WHERE pagamento_id = $1", [id])).rejects.toThrow(/já emitido/);

    // O admin corrige o pagamento; o recibo emitido e gerado de novo continua com o valor recebido.
    expect((await pedido(ctx, "admin", "PATCH", `/v1/pagamentos/${id}`, { valor: 75 })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${id}/recibo`)).statusCode).toBe(200);
    const depois = (await ctx.db.query<{ dados: { valor: number } }>("SELECT dados FROM recibos WHERE pagamento_id = $1", [id])).rows[0]!.dados;
    expect(depois.valor).toBe(70);
  });

  it("recibo de pagamento registado na ficha leva os dados de faturação da empresa e o formando", async () => {
    const ctx = await arrancar();
    const { encryptJson } = await import("../src/fieldCrypto.js");
    const email = "marta.empresa@exemplo.pt";
    const curso = "Curso Faturado";
    const lead = await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, estado, regime) VALUES ($3, '2026-10-01', 'Marta', 'Empresa', $1, $2, 'Formando', 'gold') RETURNING id`,
      [email, curso, 993501],
    );
    const empresa = { nome: "Empresa Faturada, Lda", nif: "509999999", moradaFiscal: "Rua das Flores, 10", codigoPostal: "4000-001", email: "faturas@empresa.pt" };
    await ctx.db.query("INSERT INTO preinscricao_faturacao (preinscricao_id, token, dados_enc, preenchido_em) VALUES ($1, $2, $3, now())",
      [lead.rows[0]!.id, `tok-${Date.now()}-faturacao-teste`, encryptJson(empresa)]);
    const f = await criarGold(ctx, { nome: "Marta", apelido: "Empresa", email, curso, valor: 200 });
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${f}/registar-pagamento`, { metodo: "Transferência bancária", valor: 200 })).statusCode).toBe(200);
    const mov = (await ctx.db.query<{ id: string }>("SELECT id FROM pagamentos WHERE formando_id = $1", [f])).rows[0]!.id;
    expect((await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${mov}/recibo`)).statusCode).toBe(200);
    const dados = (await ctx.db.query<{ dados: { pagador: { nome: string; nif: string }; formando?: string } }>(
      "SELECT dados FROM recibos WHERE pagamento_id = $1", [mov])).rows[0]!.dados;
    expect(dados.pagador).toMatchObject({ nome: "Empresa Faturada, Lda", nif: "509999999" });
    expect(dados.formando).toBe("Marta Empresa");
    const pdf = await pedido(ctx, "secretaria", "GET", `/v1/pagamentos/${mov}/recibo`);
    expect(pdf.statusCode).toBe(200);
  });

  it("dados de faturação: NIF com dígito de controlo e código postal português", async () => {
    const { dadosFaturacaoSchema, nifValido } = await import("../src/faturacao.js");
    expect(nifValido("509999999")).toBe(true);
    expect(nifValido("123456789")).toBe(true);
    expect(nifValido("123456788")).toBe(false);
    expect(nifValido("409999999")).toBe(false);
    const base = { nome: "Empresa X", moradaFiscal: "Rua A, 1", codigoPostal: "4000-001", email: "fat@exemplo.pt" };
    expect(dadosFaturacaoSchema.safeParse({ ...base, nif: "PT 509 999 999" }).success).toBe(true);
    expect(dadosFaturacaoSchema.safeParse({ ...base, nif: "509999998" }).success).toBe(false);
    expect(dadosFaturacaoSchema.safeParse({ ...base, nif: "509999999", codigoPostal: "4000" }).success).toBe(false);
  });
});

describe("apoios só a quem ainda tem direito", () => {
  const TURMA = 993001;
  const A = 993101;
  const B = 993102;
  const MES = "2026-03";

  it("quem perdeu o direito ao mês (presenças corrigidas) ou ficou sem IBAN depois da aprovação não é pago", async () => {
    const ctx = await arrancar();
    const cron = [
      { id: "s1", data: "2026-03-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      { id: "s2", data: "2026-03-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
    ];
    await ctx.db.query(
      "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES ($1, '2026-03-02', 'Turma Direito', 'UFCD D', 'Fin-Direito', $2::jsonb)",
      [TURMA, JSON.stringify(cron)],
    );
    await ctx.db.query(
      `INSERT INTO formandos_fin (id, nome, apelido, turma, curso, estado, turma_id)
       VALUES ($1, 'Ana', 'Direito', 'Turma Direito', 'UFCD D', 'Formando', $3), ($2, 'Beto', 'Direito', 'Turma Direito', 'UFCD D', 'Formando', $3)`,
      [A, B, TURMA],
    );
    for (const n of [1, 2]) {
      await ctx.db.query("INSERT INTO turma_sessoes (regime, turma_id, sessao_n, presencas) VALUES ('fin', $1, $2, $3::jsonb)",
        [TURMA, n, JSON.stringify([{ id: A, estado: "presente" }, { id: B, estado: "presente" }])]);
    }
    expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", {
      financiador: "Fin-Direito", regras: [{ tipo: "alimentacao", modo: "dia", valor: 5, minHorasDia: 3, requerIban: true }],
    })).statusCode).toBe(200);
    for (const id of [A, B]) {
      expect((await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${id}/apoios/iban`, { iban: "PT50000201231234567890154" })).statusCode).toBe(200);
    }
    const base = `/v1/apoios/turmas/${TURMA}`;
    expect((await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES, confirmar: true })).json().contagem.criado).toBe(2);
    expect((await pedido(ctx, "financiada", "POST", `${base}/estado`, { mes: MES, de: "calculado", para: "aprovado" })).json().alterados).toBe(2);
    const registos = (await pedido(ctx, "financiada", "GET", `${base}?mes=${MES}`)).json().registos as { id: number; formandoId: number }[];
    const deA = registos.find(r => r.formandoId === A)!;

    // Depois da aprovação: as folhas de março passam A a faltas (perdeu o direito ao mês), B fica sem IBAN.
    // (Desistir depois do mês não tira o direito: ver auditoria2Regressoes.test.ts.)
    await ctx.db.query("UPDATE turma_sessoes SET presencas = $2::jsonb WHERE regime = 'fin' AND turma_id = $1",
      [TURMA, JSON.stringify([{ id: A, estado: "falta_injustificada" }, { id: B, estado: "presente" }])]);
    const um = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${deA.id}`, { estado: "pago", pagoEm: "2026-04-05" });
    expect(um.statusCode).toBe(409);
    expect(um.json().error).toMatch(/Sem sessões|Nenhum dia|Sem direito/);
    await ctx.db.query("DELETE FROM formando_apoio_dados WHERE formando_id = $1", [B]);
    const lote = await pedido(ctx, "financiada", "POST", `${base}/estado`, { mes: MES, de: "aprovado", para: "pago", pagoEm: "2026-04-05" });
    expect(lote.statusCode).toBe(200);
    expect(lote.json().alterados).toBe(0);
    expect((lote.json().semDireito as { formandoId: number; motivo: string }[]).map(x => x.formandoId).sort()).toEqual([A, B]);
    const estados = await ctx.db.query<{ estado: string }>("SELECT estado FROM apoios WHERE turma_id = $1", [TURMA]);
    expect(estados.rows.every(r => r.estado === "aprovado")).toBe(true);

    // Com o IBAN de volta, B é pago; A continua bloqueado.
    await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${B}/apoios/iban`, { iban: "PT50000201231234567890154" });
    const lote2 = await pedido(ctx, "financiada", "POST", `${base}/estado`, { mes: MES, de: "aprovado", para: "pago", pagoEm: "2026-04-05" });
    expect(lote2.json().alterados).toBe(1);
    expect(lote2.json().semDireito).toHaveLength(1);
  });
});

describe("números à portuguesa e acesso do formando", () => {
  it("«1.234,56 €» é 1234,56 e uma quantidade com vírgula volta igual", async () => {
    expect(numeroPt("1.234,56")).toBe(1234.56);
    expect(numeroPt("1.234,56 €")).toBe(1234.56);
    expect(numeroPt("1 234,56")).toBe(1234.56);
    // O formulário mostra os números gravados com vírgula: 1,234 (quantidade) continua 1,234.
    expect(numeroPt(String(1.234).replace(".", ","))).toBe(1.234);
    const ctx = await arrancar();
    const t = await ctx.db.query<{ id: number }>("INSERT INTO turmas_fin (id, data_inicio, nome, curso) VALUES (993002, '2026-03-02', 'Turma Despesas Pt', 'UFCD') RETURNING id");
    const r = await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId: t.rows[0]!.id, dados: { descricao: "Material", totalDocDespesa: "1.234,56 €", quantidade: "1,234" } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().despesa.dados).toMatchObject({ totalDocDespesa: 1234.56, quantidade: 1.234 });
  });

  it("o comercial não gera nem vê a palavra-passe do formando", async () => {
    const ctx = await arrancar();
    const f = await criarGold(ctx, { nome: "Pedro", apelido: "Acesso", email: "pedro.acesso@exemplo.pt", curso: "Curso Acesso", valor: 10 });
    const r = await pedido(ctx, "comercial", "POST", `/v1/formandos/gold/${f}/acesso`, { enviarEmail: false });
    expect(r.statusCode).toBe(403);
    expect(r.body).not.toMatch(/password/);
  });
});
