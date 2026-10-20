import { describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Segunda auditoria: regressões das correções anteriores. Apoios aprovados pagam-se pelo direito do mês (não pelo
// estado de hoje), a Financiada trabalha nos formadores partilhados com a Gold, fichas antigas sem conta gravam,
// a reentrega do webhook não conclui a inscrição duas vezes, o painel Fin filtra os dossiês com bloqueantes e a
// chave do webhook não vai no endereço de um POST.

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;
const emailUnico = (p: string) => `${p}.${Date.now()}.${++seq}@exemplo.pt`;
const CHAVE_WEBHOOK = "segredo-auditoria-2";

async function fichaFormador(ctx: Ctx, regimes: string[], extra: { userId?: string; email?: string } = {}) {
  const nome = unico("Formador Regressao");
  const r = await ctx.db.query<{ id: number }>(
    "INSERT INTO formadores (id, nome, email, regimes, user_id) VALUES (nextval('ops_id_seq')::int, $1, $2, $3::jsonb, $4) RETURNING id",
    [nome, extra.email ?? "", JSON.stringify(regimes), extra.userId ?? null],
  );
  return { id: r.rows[0]!.id, nome };
}

const regimesDe = async (ctx: Ctx, id: number) =>
  (await ctx.db.query<{ regimes: string[] }>("SELECT regimes FROM formadores WHERE id = $1", [id])).rows[0]?.regimes;

describe("apoios aprovados: o direito é o do mês, não o estado de hoje", () => {
  const MES = "2026-03";
  let base = 994000;

  /** Turma com duas sessões em março, dois formandos presentes, regra e IBAN; devolve os apoios aprovados. */
  async function turmaAprovada(ctx: Ctx) {
    const turma = ++base;
    const [a, b] = [++base, ++base];
    const financiador = unico("Fin-Mes");
    const cron = [
      { id: "s1", data: "2026-03-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      { id: "s2", data: "2026-03-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
    ];
    await ctx.db.query(
      "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES ($1, '2026-03-02', $2, 'UFCD M', $3, $4::jsonb)",
      [turma, unico("Turma Mes"), financiador, JSON.stringify(cron)],
    );
    await ctx.db.query(
      `INSERT INTO formandos_fin (id, nome, apelido, turma, curso, estado, turma_id)
       VALUES ($1, 'Ana', 'Mes', 'Turma Mes', 'UFCD M', 'A frequentar', $3), ($2, 'Rui', 'Mes', 'Turma Mes', 'UFCD M', 'A frequentar', $3)`,
      [a, b, turma],
    );
    for (const n of [1, 2]) {
      await ctx.db.query("INSERT INTO turma_sessoes (regime, turma_id, sessao_n, presencas) VALUES ('fin', $1, $2, $3::jsonb)",
        [turma, n, JSON.stringify([{ id: a, estado: "presente" }, { id: b, estado: "presente" }])]);
    }
    expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", {
      financiador, regras: [{ tipo: "alimentacao", modo: "dia", valor: 5, minHorasDia: 3, requerIban: true }],
    })).statusCode).toBe(200);
    for (const id of [a, b]) {
      expect((await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${id}/apoios/iban`, { iban: "PT50000201231234567890154" })).statusCode).toBe(200);
    }
    const url = `/v1/apoios/turmas/${turma}`;
    expect((await pedido(ctx, "financiada", "POST", `${url}/processar`, { mes: MES, confirmar: true })).json().contagem.criado).toBe(2);
    expect((await pedido(ctx, "financiada", "POST", `${url}/estado`, { mes: MES, de: "calculado", para: "aprovado" })).json().alterados).toBe(2);
    const registos = (await pedido(ctx, "financiada", "GET", `${url}?mes=${MES}`)).json().registos as { id: number; formandoId: number }[];
    return { turma, a, b, financiador, url, apoioDe: (f: number) => registos.find(r => r.formandoId === f)!.id };
  }

  it("quem desistiu ou mudou de turma depois do mês é pago pelo que frequentou", async () => {
    const ctx = await arrancar();
    const t = await turmaAprovada(ctx);
    await ctx.db.query("UPDATE formandos_fin SET estado = 'Desistiu' WHERE id = $1", [t.a]);
    const um = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${t.apoioDe(t.a)}`, { estado: "pago", pagoEm: "2026-11-05" });
    expect(um.statusCode, um.body).toBe(200);
    expect(um.json().apoio.estado).toBe("pago");

    // Mudou de turma: as presenças de março são as das folhas desta turma.
    await ctx.db.query("UPDATE formandos_fin SET turma_id = NULL WHERE id = $1", [t.b]);
    const lote = await pedido(ctx, "financiada", "POST", `${t.url}/estado`, { mes: MES, de: "aprovado", para: "pago", pagoEm: "2026-11-05" });
    expect(lote.json()).toMatchObject({ alterados: 1, semDireito: [] });
  });

  it("uma regra desativada ou apagada depois da aprovação não bloqueia; sem presenças no mês e indeferido bloqueiam", async () => {
    const ctx = await arrancar();
    const t = await turmaAprovada(ctx);
    // Regra desativada depois da aprovação.
    expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", {
      financiador: t.financiador, regras: [{ tipo: "alimentacao", ativo: false, modo: "dia", valor: 5, minHorasDia: 3, requerIban: true }],
    })).statusCode).toBe(200);
    const a = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${t.apoioDe(t.a)}`, { estado: "pago", pagoEm: "2026-11-05" });
    expect(a.statusCode, a.body).toBe(200);

    // Indeferido nunca teve direito; a regra apagada já não serve para recalcular, mas sem presenças não se paga.
    expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", { financiador: t.financiador, regras: [] })).statusCode).toBe(200);
    await ctx.db.query("UPDATE formandos_fin SET estado = 'Indeferido' WHERE id = $1", [t.b]);
    const b = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${t.apoioDe(t.b)}`, { estado: "pago", pagoEm: "2026-11-05" });
    expect(b.statusCode).toBe(409);
    expect(b.json().error).toMatch(/indeferido/);
    await ctx.db.query("UPDATE formandos_fin SET estado = 'A frequentar' WHERE id = $1", [t.b]);
    await ctx.db.query("UPDATE turma_sessoes SET presencas = $2::jsonb WHERE regime = 'fin' AND turma_id = $1",
      [t.turma, JSON.stringify([{ id: t.b, estado: "falta_injustificada" }])]);
    const b2 = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${t.apoioDe(t.b)}`, { estado: "pago", pagoEm: "2026-11-05" });
    expect(b2.statusCode).toBe(409);
    expect(b2.json().error).toMatch(/Sem presenças/);
  });
});

describe("formadores partilhados entre Gold e Financiada", () => {
  it("a Financiada altera a ficha partilhada, só junta ou retira o seu regime e não a apaga", async () => {
    const ctx = await arrancar();
    const misto = await fichaFormador(ctx, ["gold", "fin"]);
    const gold = await fichaFormador(ctx, ["gold"]);

    const tel = await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${misto.id}`, { telf: "912345678", regimes: ["gold", "fin"] });
    expect(tel.statusCode, tel.body).toBe(200);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${misto.id}`, { regimes: ["fin"] })).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${gold.id}`, { telf: "912345679" })).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${gold.id}`, { regimes: ["gold", "fin"] })).statusCode).toBe(403);

    const apagar = await pedido(ctx, "financiada", "DELETE", `/v1/formadores/${misto.id}`);
    expect(apagar.statusCode).toBe(403);
    expect(apagar.json().error).toMatch(/retire o seu regime/);
    // Retirar a Financiada da ficha: a Gold fica com ela.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${misto.id}`, { regimes: ["gold"] })).statusCode).toBe(200);
    expect(await regimesDe(ctx, misto.id)).toEqual(["gold"]);
  });

  it("criar na Financiada com o email de um formador da Gold aponta para a ficha e junta-se o regime", async () => {
    const ctx = await arrancar();
    const email = emailUnico("partilhado");
    const criado = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: unico("Formador Gold"), email, regimes: ["gold"] });
    expect(criado.statusCode, criado.body).toBe(200);
    const id = criado.json().formador.id as number;

    const nomeFin = unico("Formador Fin");
    const r = await pedido(ctx, "financiada", "POST", "/v1/formadores", { nome: nomeFin, email: email.toUpperCase(), regimes: ["fin"] });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ fichaExistente: id });
    expect(r.json().error).toMatch(/junte o regime/);
    expect((await ctx.db.query("SELECT 1 FROM formadores WHERE nome = $1", [nomeFin])).rows).toHaveLength(0);

    // Só com o email da ficha e só o regime de quem pede.
    expect((await pedido(ctx, "financiada", "POST", `/v1/formadores/${id}/regimes`, { regime: "fin", email: "outro@exemplo.pt" })).statusCode).toBe(404);
    expect((await pedido(ctx, "financiada", "POST", `/v1/formadores/${id}/regimes`, { regime: "gold", email })).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "POST", `/v1/formadores/${id}/regimes`, { regime: "gold", email })).statusCode).toBe(403);
    const junta = await pedido(ctx, "financiada", "POST", `/v1/formadores/${id}/regimes`, { regime: "fin", email: ` ${email.toUpperCase()} ` });
    expect(junta.statusCode, junta.body).toBe(200);
    expect(junta.json().formador.regimes).toEqual(["gold", "fin"]);
    expect(await regimesDe(ctx, id)).toEqual(["gold", "fin"]);
    // Repetir não duplica.
    expect((await pedido(ctx, "financiada", "POST", `/v1/formadores/${id}/regimes`, { regime: "fin", email })).statusCode).toBe(200);
    expect(await regimesDe(ctx, id)).toEqual(["gold", "fin"]);
    // Agora a Financiada edita-a.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${id}`, { telf: "913000000" })).statusCode).toBe(200);
  });

  it("uma ficha antiga sem conta grava sem mexer no email; só um email novo tenta ligar a conta", async () => {
    const ctx = await arrancar();
    // Email de uma conta da equipa (não liga) numa ficha antiga, sem conta.
    const equipa = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.secretaria])).rows[0]!.email;
    const antiga = await fichaFormador(ctx, ["gold"], { email: equipa });
    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${antiga.id}`, { telf: "914000000", email: equipa, especialidade: "Informática" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().acesso).toBeNull();
    const depois = (await ctx.db.query<{ telf: string; user_id: string | null }>("SELECT telf, user_id FROM formadores WHERE id = $1", [antiga.id])).rows[0]!;
    expect(depois).toMatchObject({ telf: "914000000", user_id: null });

    // Email novo e livre: cria a conta.
    const novo = emailUnico("antiga.nova");
    const r2 = await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${antiga.id}`, { email: novo });
    expect(r2.statusCode, r2.body).toBe(200);
    expect(r2.json().acesso).toMatchObject({ email: novo, criado: true });

    // Email novo que é de outro formador: continua 409 e nada fica gravado.
    const outra = await fichaFormador(ctx, ["gold"]);
    const r3 = await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${outra.id}`, { email: novo, telf: "915000000" });
    expect(r3.statusCode).toBe(409);
    expect((await ctx.db.query<{ telf: string }>("SELECT telf FROM formadores WHERE id = $1", [outra.id])).rows[0]!.telf).not.toBe("915000000");
  });
});

describe("webhook: reentrega de um pagamento já pago", () => {
  async function ligarWebhook(ctx: Ctx) {
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = app_settings.values || EXCLUDED.values`,
      [{ "Chave webhook pagamentos": CHAVE_WEBHOOK }],
    );
  }

  /** Pré-inscrição Gold validada, com pagamento pedido no percurso e já Pago (a inscrição ficou por concluir). */
  async function inscricaoPorConcluir(ctx: Ctx) {
    const curso = unico("Curso Webhook");
    const email = emailUnico("webhook.reentrega");
    const turma = (await ctx.db.query<{ id: number }>(
      "INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario) VALUES (nextval('ops_id_seq')::int, '2026-12-01', $1, $2, 'Lisboa', 'laboral') RETURNING id",
      [unico("Turma Webhook"), curso],
    )).rows[0]!.id;
    const pagId = `PW${Date.now()}${++seq}`;
    await ctx.db.query(
      "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email) VALUES ($1, 'Rita Reentrega', 120, 'Multibanco', $2, '2026-10-20', 'Pago', $3)",
      [pagId, curso, email],
    );
    const lead = (await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, preco, estado, regime, validada_em, turma_escolhida_id, pagamento_id, pagamento_pedido_em)
       VALUES (nextval('ops_id_seq')::int, '2026-10-01 10:00', 'Rita', 'Reentrega', $1, $2, 120, 'Pago', 'gold', now(), $3, $4, now()) RETURNING id`,
      [email, curso, turma, pagId],
    )).rows[0]!.id;
    return { email, turma, pagId, lead };
  }

  it("duas reentregas ao mesmo tempo concluem a inscrição uma vez e a palavra-passe enviada é a gravada", async () => {
    const ctx = await arrancar();
    await ligarWebhook(ctx);
    const i = await inscricaoPorConcluir(ctx);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const entrega = () => ctx.app.inject({
        method: "POST", url: "/v1/public/pagamentos/webhook", headers: { "x-webhook-key": CHAVE_WEBHOOK }, payload: { id: i.pagId },
      });
      const rs = await Promise.all([entrega(), entrega(), entrega()]);
      for (const r of rs) expect(r.statusCode, r.body).toBe(200);
      const fichas = await ctx.db.query("SELECT id FROM formandos_gold WHERE lower(email) = $1", [i.email]);
      expect(fichas.rows).toHaveLength(1);
      const contas = await ctx.db.query("SELECT id FROM users WHERE lower(email) = $1", [i.email]);
      expect(contas.rows).toHaveLength(1);
      const acessos = log.mock.calls.filter(c => String(c[0]).includes(`para=${i.email}`) && String(c[0]).includes("acesso"));
      expect(acessos).toHaveLength(1);
      // Reserva libertada; já concluída, a reentrega seguinte não repete nada.
      expect((await ctx.db.query<{ r: string | null }>("SELECT conclusao_reservada_em AS r FROM preinscricoes WHERE id = $1", [i.lead])).rows[0]!.r).toBeNull();
      expect((await entrega()).statusCode).toBe(200);
      expect((await ctx.db.query("SELECT id FROM formandos_gold WHERE lower(email) = $1", [i.email])).rows).toHaveLength(1);
      expect(log.mock.calls.filter(c => String(c[0]).includes(`para=${i.email}`) && String(c[0]).includes("acesso"))).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });

  it("com a conclusão reservada por outro pedido, não faz nada; uma reserva esquecida expira", async () => {
    const ctx = await arrancar();
    const i = await inscricaoPorConcluir(ctx);
    const { aposPagamentoConfirmado } = await import("../src/inscricaoPaga.js");
    const { reservarConclusao } = await import("../src/repos/formandosInscricao.js");
    expect(await reservarConclusao(ctx.db, i.lead)).toBe(true);
    const r = await aposPagamentoConfirmado(ctx.db, i.pagId);
    expect(r).toMatchObject({ erro: expect.stringMatching(/a ser concluída/) });
    expect((await ctx.db.query("SELECT id FROM formandos_gold WHERE lower(email) = $1", [i.email])).rows).toHaveLength(0);

    await ctx.db.query("UPDATE preinscricoes SET conclusao_reservada_em = now() - interval '11 minutes' WHERE id = $1", [i.lead]);
    const r2 = await aposPagamentoConfirmado(ctx.db, i.pagId);
    expect(r2 && "formandoId" in r2).toBe(true);
  });

  it("gerarAcessoFormando ao mesmo tempo: só devolve a palavra-passe que ficou gravada", async () => {
    const ctx = await arrancar();
    const { gerarAcessoFormando } = await import("../src/areaFormando.js");
    const { verifyPassword } = await import("../src/security.js");
    const email = emailUnico("acesso.corrida");
    const criado = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Corrida", apelido: "Acesso", email, curso: "Curso Corrida", valor: 10 });
    expect(criado.statusCode, criado.body).toBe(200);
    const id = criado.json().formando.id as number;
    const rs = await Promise.all([1, 2, 3].map(() => gerarAcessoFormando(ctx.db, "gold", id, false)));
    const comPalavra = rs.filter(r => "password" in r && r.password);
    expect(comPalavra).toHaveLength(1);
    const hash = (await ctx.db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE lower(email) = $1", [email])).rows[0]!.password_hash;
    expect(await verifyPassword((comPalavra[0] as { password: string }).password, hash)).toBe(true);
  });
});

describe("webhook: a chave não vai no endereço de um POST", () => {
  it("POST com ?chave= é recusado; cabeçalho e corpo servem; o GET dos gateways continua", async () => {
    const ctx = await arrancar();
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = app_settings.values || EXCLUDED.values`,
      [{ "Chave webhook pagamentos": CHAVE_WEBHOOK }],
    );
    const url = "/v1/public/pagamentos/webhook";
    const naQuery = await ctx.app.inject({ method: "POST", url: `${url}?chave=${CHAVE_WEBHOOK}&id=NAOEXISTE` });
    expect(naQuery.statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "POST", url: `${url}?key=${CHAVE_WEBHOOK}`, payload: { id: "NAOEXISTE" } })).statusCode).toBe(400);
    // Autenticado (404 = referência desconhecida, depois de aceitar a chave).
    expect((await ctx.app.inject({ method: "POST", url, headers: { "x-webhook-key": CHAVE_WEBHOOK }, payload: { id: "NAOEXISTE" } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "POST", url, payload: { chave: CHAVE_WEBHOOK, id: "NAOEXISTE" } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "POST", url, headers: { "x-webhook-key": "errada" }, payload: { id: "NAOEXISTE" } })).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: "GET", url: `${url}?chave=${CHAVE_WEBHOOK}&id=NAOEXISTE` })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "GET", url: `${url}?id=NAOEXISTE`, headers: { "x-webhook-key": CHAVE_WEBHOOK } })).statusCode).toBe(404);

    const { urlSemSegredos } = await import("../src/logCompacto.js");
    expect(urlSemSegredos(`${url}?chave=abc&ref=1&KEY=def`)).toBe(`${url}?chave=***&ref=1&KEY=***`);
    expect(urlSemSegredos("/v1/turmas?keyword=x")).toBe("/v1/turmas?keyword=x");
  });
});

describe("painel Fin: dossiês com bloqueantes com os filtros do painel", () => {
  it("o financiador (e o resto dos filtros) também restringe «Com bloqueantes»", async () => {
    const ctx = await arrancar();
    const [finA, finB] = [unico("Financiador A"), unico("Financiador B")];
    const ids: number[] = [];
    for (const fin of [finA, finB]) {
      const r = await ctx.db.query<{ id: number }>(
        "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador) VALUES (nextval('ops_id_seq')::int, '2026-09-01', $1, 'UFCD Painel', $2) RETURNING id",
        [unico("Turma Painel"), fin],
      );
      ids.push(r.rows[0]!.id);
    }
    const { turmasFinEmCurso } = await import("../src/repos/painelFin.js");
    const filtro = { regime: "fin" as const, de: "2026-10-01", ate: "2026-10-31", anterior: { de: "2026-09-01", ate: "2026-09-30" } };
    const todos = (await turmasFinEmCurso(ctx.db, filtro)).comBloqueantes.map(t => t.id);
    // Sem filtros, as duas turmas novas (sem nada no dossiê) têm bloqueantes.
    expect(todos).toEqual(expect.arrayContaining(ids));
    const soA = (await turmasFinEmCurso(ctx.db, { ...filtro, financiador: finA })).comBloqueantes.map(t => t.id);
    expect(soA).toEqual([ids[0]]);
    const outroCurso = (await turmasFinEmCurso(ctx.db, { ...filtro, financiador: finA, curso: "Outro curso" })).comBloqueantes;
    expect(outroCurso).toEqual([]);
  });
});
