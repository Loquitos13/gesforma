import { describe, expect, it } from "vitest";
import { calcularMes, presencasNoMes, regrasEfetivas, sessoesDaTurma, validarIban } from "../src/apoios.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const TURMA = 990001;
const A = 990101;
const B = 990102;
const MES = "2026-03";

const sessao = (id: string, data: string, horaInicio: string, horaFim: string) =>
  ({ id, data, horaInicio, horaFim, modalidade: "presencial", formadores: [] });

/** Março: dia 2 (4h + 3h), dia 3 (3h), dia 4 (4h); abril: dia 1 (4h). */
const CRONOGRAMA = [
  sessao("s1", "2026-03-02", "09:00", "13:00"),
  sessao("s2", "2026-03-02", "14:00", "17:00"),
  sessao("s3", "2026-03-03", "09:00", "12:00"),
  sessao("s4", "2026-03-04", "09:00", "13:00"),
  sessao("s5", "2026-04-01", "09:00", "13:00"),
];

/**
 * A: dia 2 presente 7h, dia 3 atraso de 60 min (2h), dia 4 falta justificada → 9h de 14h (64,3%).
 * B: dia 2 só de manhã (4h), dia 3 3h, dia 4 4h → 11h de 14h (78,6%). B não tem IBAN.
 */
const FOLHAS: [number, unknown[]][] = [
  [1, [{ id: A, estado: "presente" }, { id: B, estado: "presente" }]],
  [2, [{ id: A, estado: "presente" }, { id: B, estado: "falta_injustificada" }]],
  [3, [{ id: A, estado: "atraso", minutos: 60 }, { id: B, estado: "presente" }]],
  [4, [{ id: A, estado: "falta_justificada" }, { id: B, estado: "presente" }]],
];

let preparado: Promise<Ctx> | null = null;

function preparar() {
  preparado ??= (async () => {
    const ctx = await arrancar();
    await ctx.db.query(
      `INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma)
       VALUES ($1, '2026-03-02', 'Turma Apoios', 'UFCD Teste', 'IEFP-Teste', $2::jsonb)`,
      [TURMA, JSON.stringify(CRONOGRAMA)],
    );
    await ctx.db.query(
      `INSERT INTO formandos_fin (id, nome, apelido, turma, curso, estado, turma_id)
       VALUES ($1, 'Ana', 'Apoio', 'Turma Apoios', 'UFCD Teste', 'Formando', $3),
              ($2, 'Bruno', 'Apoio', 'Turma Apoios', 'UFCD Teste', 'Formando', $3)`,
      [A, B, TURMA],
    );
    for (const [n, presencas] of FOLHAS) {
      await ctx.db.query(
        "INSERT INTO turma_sessoes (regime, turma_id, sessao_n, presencas) VALUES ('fin', $1, $2, $3::jsonb)",
        [TURMA, n, JSON.stringify(presencas)],
      );
    }
    return ctx;
  })();
  return preparado;
}

const REGRAS_GERAIS = [{ tipo: "alimentacao", modo: "dia", valor: 6, minHorasDia: 3 }];
const REGRAS_FINANCIADOR = [
  { tipo: "bolsa", modo: "hora", valor: 1.5, tetoMensal: 12 },
  { tipo: "transporte", modo: "mes", valor: 20, assiduidadeMinima: 70, requerIban: false },
];

async function configurar(ctx: Ctx) {
  expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", { financiador: "", regras: REGRAS_GERAIS })).statusCode).toBe(200);
  expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", { financiador: "IEFP-Teste", regras: REGRAS_FINANCIADOR })).statusCode).toBe(200);
}

describe("apoios: cálculo puro", () => {
  it("valida IBAN pelo mod-97", () => {
    expect(validarIban("PT50 0002 0123 1234 5678 9015 4")).toEqual({ ok: true, iban: "PT50000201231234567890154" });
    expect(validarIban("PT50000201231234567890155").ok).toBe(false);
    expect(validarIban("123").ok).toBe(false);
  });

  it("regra da turma ganha à do financiador, que ganha à geral", () => {
    const base = { ativo: true, modo: "dia", valor: 1, min_horas_dia: 0, teto_mensal: null, assiduidade_minima: null, requer_iban: true, notas: "", updated_at: "" };
    const linhas = [
      { ...base, id: 1, financiador: "", turma_id: null, tipo: "alimentacao", valor: 5 },
      { ...base, id: 2, financiador: "X", turma_id: null, tipo: "alimentacao", valor: 6 },
      { ...base, id: 3, financiador: "", turma_id: 7, tipo: "alimentacao", valor: 7 },
      { ...base, id: 4, financiador: "Y", turma_id: null, tipo: "bolsa", valor: 9 },
    ] as never[];
    expect(regrasEfetivas(linhas, 7, "X").map(r => [r.tipo, r.valor])).toEqual([["alimentacao", 7]]);
    expect(regrasEfetivas(linhas, 8, "X").map(r => [r.tipo, r.valor])).toEqual([["alimentacao", 6]]);
    expect(regrasEfetivas(linhas, 8, "Z").map(r => [r.tipo, r.valor])).toEqual([["alimentacao", 5]]);
  });

  it("alimentação só conta dias com o mínimo de horas; bolsa respeita o teto; assiduidade mínima exclui", () => {
    const sessoes = sessoesDaTurma(CRONOGRAMA, FOLHAS.map(([sessao_n, presencas]) => ({ sessao_n, presencas })));
    const dias = presencasNoMes(sessoes, { id: A }, MES);
    expect(dias).toEqual([
      { data: "2026-03-02", horasPrevistas: 7, horasPresente: 7 },
      { data: "2026-03-03", horasPrevistas: 3, horasPresente: 2 },
      { data: "2026-03-04", horasPrevistas: 4, horasPresente: 0 },
    ]);
    const regra = (o: object) => ({ ativo: true, minHorasDia: 0, tetoMensal: null, assiduidadeMinima: null, requerIban: true, notas: "", ambito: "geral" as const, ...o });
    const calc = calcularMes([
      regra({ tipo: "alimentacao", modo: "dia", valor: 6, minHorasDia: 3 }),
      regra({ tipo: "bolsa", modo: "hora", valor: 1.5, tetoMensal: 12 }),
      regra({ tipo: "transporte", modo: "mes", valor: 20, assiduidadeMinima: 70 }),
    ] as never, dias, MES, true);
    expect(calc.assiduidade).toBe(64.3);
    expect(calc.linhas.find(l => l.tipo === "alimentacao")).toMatchObject({ dias: 1, valor: 6 });
    expect(calc.linhas.find(l => l.tipo === "bolsa")).toMatchObject({ horas: 9, valorBruto: 13.5, valor: 12, aplicadoTeto: true });
    expect(calc.linhas.find(l => l.tipo === "transporte")).toMatchObject({ valor: 0 });
    expect(calc.linhas.find(l => l.tipo === "transporte")?.exclusao).toContain("abaixo do mínimo");
    expect(calc.total).toBe(18);
  });
});

describe("apoios: API", () => {
  it("só a equipa da Financiada mexe em apoios", async () => {
    const ctx = await preparar();
    for (const perfil of ["comercial", "formador", "formando"] as const) {
      expect((await pedido(ctx, perfil, "GET", "/v1/apoios/regras")).statusCode).toBe(403);
      expect((await pedido(ctx, perfil, "PUT", "/v1/apoios/regras", { financiador: "", regras: [] })).statusCode).toBe(403);
      expect((await pedido(ctx, perfil, "GET", `/v1/formandos/fin/${A}/apoios`)).statusCode).toBe(403);
      expect((await pedido(ctx, perfil, "POST", `/v1/apoios/turmas/${TURMA}/processar`, { mes: MES })).statusCode).toBe(403);
    }
    expect((await pedido(ctx, null, "GET", "/v1/apoios/regras")).statusCode).toBe(401);
  });

  it("regras: configuração validada e listada por âmbito", async () => {
    const ctx = await preparar();
    const dup = await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", {
      financiador: "", regras: [{ tipo: "bolsa", modo: "hora", valor: 1 }, { tipo: "bolsa", modo: "dia", valor: 2 }],
    });
    expect(dup.statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", { financiador: "", regras: [{ tipo: "bolsa", modo: "hora", valor: -1 }] })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "PUT", "/v1/apoios/regras", { financiador: "", turmaId: 123456789, regras: [] })).statusCode).toBe(404);
    await configurar(ctx);
    const r = (await pedido(ctx, "secretaria", "GET", "/v1/apoios/regras")).json();
    expect(r.financiadores).toContain("IEFP-Teste");
    expect(r.regras.filter((x: { financiador: string }) => x.financiador === "IEFP-Teste")).toHaveLength(2);
    expect(r.tipos).toHaveLength(5);
  });

  it("IBAN do formando: validado, cifrado e mostrado mascarado", async () => {
    const ctx = await preparar();
    expect((await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${A}/apoios/iban`, { iban: "PT50000201231234567890155" })).statusCode).toBe(400);
    const ok = await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${A}/apoios/iban`, { iban: "PT50 0002 0123 1234 5678 9015 4", titular: "Ana Apoio" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().iban.mascarado).toMatch(/^PT50 •/);
    const guardado = await ctx.db.query<{ iban_enc: string }>("SELECT iban_enc FROM formando_apoio_dados WHERE formando_id = $1", [A]);
    expect(guardado.rows[0]!.iban_enc).not.toContain("0002");
  });

  it("simulação, processamento idempotente, IBAN em falta bloqueia e estados", async () => {
    const ctx = await preparar();
    await configurar(ctx);
    await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${A}/apoios/iban`, { iban: "PT50000201231234567890154" });

    const ficha = (await pedido(ctx, "financiada", "GET", `/v1/formandos/fin/${A}/apoios?mes=${MES}`)).json();
    expect(ficha.meses).toEqual(["2026-04", "2026-03"]);
    expect(ficha.simulacao.total).toBe(18);
    expect(ficha.iban.tem).toBe(true);

    const base = `/v1/apoios/turmas/${TURMA}`;
    const previa = (await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES })).json();
    expect(previa.confirmado).toBe(false);
    const bruno = previa.formandos.find((f: { formandoId: number }) => f.formandoId === B);
    expect(bruno.linhas.filter((l: { bloqueadoIban: boolean }) => l.bloqueadoIban).map((l: { tipo: string }) => l.tipo).sort()).toEqual(["alimentacao", "bolsa"]);
    expect((await pedido(ctx, "financiada", "GET", `${base}?mes=${MES}`)).json().registos).toHaveLength(0);

    const p1 = (await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES, confirmar: true })).json();
    expect(p1.contagem).toMatchObject({ criado: 3, semIban: 2, semDireito: 1 });
    const p2 = (await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES, confirmar: true })).json();
    expect(p2.contagem).toMatchObject({ criado: 0, atualizado: 3 });
    const turma = (await pedido(ctx, "financiada", "GET", `${base}?mes=${MES}`)).json();
    expect(turma.registos).toHaveLength(3);
    expect(turma.totais.calculado).toEqual({ n: 3, valor: 38 });

    // Sem IBAN no recálculo: o registo "calculado" antigo é anulado (não segue para pagamento); com IBAN volta.
    const deA = (turma.registos as { formandoId: number }[]).filter(r => r.formandoId === A).length;
    expect(deA).toBeGreaterThan(0);
    await ctx.db.query("DELETE FROM formando_apoio_dados WHERE formando_id = $1", [A]);
    const semIbanA = (await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES, confirmar: true })).json();
    expect(semIbanA.contagem).toMatchObject({ criado: 0, atualizado: 3 });
    const anulados = (await pedido(ctx, "financiada", "GET", `${base}?mes=${MES}`)).json();
    expect(anulados.totais.calculado.n).toBe(3 - deA);
    expect((anulados.registos as { formandoId: number; estado: string }[]).filter(r => r.formandoId === A).every(r => r.estado === "anulado")).toBe(true);
    await pedido(ctx, "financiada", "PUT", `/v1/formandos/fin/${A}/apoios/iban`, { iban: "PT50000201231234567890154" });
    const reposto = (await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES, confirmar: true })).json();
    expect(reposto.contagem).toMatchObject({ criado: 0, atualizado: 3 });
    expect((await pedido(ctx, "financiada", "GET", `${base}?mes=${MES}`)).json().totais.calculado).toEqual({ n: 3, valor: 38 });

    // Aprovados não voltam a ser recalculados, mesmo que a regra mude.
    expect((await pedido(ctx, "financiada", "POST", `${base}/estado`, { mes: MES, de: "calculado", para: "aprovado" })).json().alterados).toBe(3);
    await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", { financiador: "", turmaId: TURMA, regras: [{ tipo: "alimentacao", modo: "dia", valor: 7, minHorasDia: 3 }] });
    const p3 = (await pedido(ctx, "financiada", "POST", `${base}/processar`, { mes: MES, confirmar: true })).json();
    expect(p3.contagem).toMatchObject({ criado: 0, atualizado: 0, mantido: 3 });

    const reg = (await pedido(ctx, "financiada", "GET", `${base}?mes=${MES}`)).json().registos as { id: number; tipo: string; formandoId: number; valor: number }[];
    const alim = reg.find(r => r.formandoId === A && r.tipo === "alimentacao")!;
    expect(alim.valor).toBe(6);

    // Pagar exige data; pago não passa a anulado; não se ajusta um apoio pago.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${alim.id}`, { estado: "pago" })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${alim.id}`, { ajuste: 2 })).statusCode).toBe(400);
    const aj = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${alim.id}`, { ajuste: 2, motivoAjuste: "Dia de exame contado" });
    expect(aj.json().apoio.valor).toBe(8);
    const pago = await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${alim.id}`, { estado: "pago", pagoEm: "2026-04-05", referencia: "TRF-0423" });
    expect(pago.json().apoio).toMatchObject({ estado: "pago", pagoEm: "2026-04-05", referencia: "TRF-0423" });
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${alim.id}`, { estado: "anulado" })).statusCode).toBe(409);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/apoios/${alim.id}`, { ajuste: 5, motivoAjuste: "x" })).statusCode).toBe(409);

    // Pagamento em lote dos restantes aprovados.
    expect((await pedido(ctx, "financiada", "POST", `${base}/estado`, { mes: MES, de: "aprovado", para: "pago" })).statusCode).toBe(400);
    const lote = await pedido(ctx, "financiada", "POST", `${base}/estado`, { mes: MES, de: "aprovado", para: "pago", pagoEm: "2026-04-06", referencia: "LOTE-1" });
    expect(lote.json().alterados).toBe(2);
    const fichaA = (await pedido(ctx, "financiada", "GET", `/v1/formandos/fin/${A}/apoios?mes=${MES}`)).json();
    expect(fichaA.totais.pago).toBe(20);

    // Lote para as transferências: IBAN completo só para a equipa da Financiada, com registo na auditoria.
    expect((await pedido(ctx, "comercial", "GET", `${base}/lote?mes=${MES}`)).statusCode).toBe(403);
    const transf = (await pedido(ctx, "financiada", "GET", `${base}/lote?mes=${MES}`)).json();
    expect(transf.registos).toHaveLength(3);
    expect(transf.bancos[A]).toEqual({ iban: "PT50000201231234567890154", titular: "" });

    const audit = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action LIKE 'apoios.%'");
    expect(audit.rows[0]!.n).toBeGreaterThan(5);
    const viuLote = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action = 'apoios.lote'");
    expect(viuLote.rows[0]!.n).toBe(1);

    // PDF do processamento do subsídio de alimentação (dossiê): só a equipa; IBAN completo; auditado.
    expect((await pedido(ctx, "comercial", "GET", `${base}/subsidio-alimentacao?mes=${MES}`)).statusCode).toBe(403);
    const pdf = await pedido(ctx, "financiada", "GET", `${base}/subsidio-alimentacao?mes=${MES}`);
    expect(pdf.statusCode, pdf.body.slice(0, 200)).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect((await pedido(ctx, "financiada", "GET", `${base}/subsidio-alimentacao`)).statusCode).toBe(200);
    const viuPdf = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action = 'apoios.subsidio_pdf'");
    expect(viuPdf.rows[0]!.n).toBe(2);
  });

  it("painel da Financiada mostra os apoios por aprovar ou pagar", async () => {
    const ctx = await preparar();
    await ctx.db.query("UPDATE apoios SET estado = 'calculado' WHERE turma_id = $1 AND estado = 'pago' AND tipo = 'transporte'", [TURMA]);
    const p = (await pedido(ctx, "financiada", "GET", "/v1/painel/fin")).json() as { aTratar: { id: string; n: number; detalhe: string }[] };
    const t = p.aTratar.find(x => x.id === "apoios")!;
    expect(t.n).toBeGreaterThanOrEqual(1);
    expect(t.detalhe).toContain("por aprovar");
  });

  it("turma sem regras ativas não processa", async () => {
    const ctx = await preparar();
    await ctx.db.query(
      "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES (990002, '2026-03-02', 'Sem Regras', 'UFCD', 'Outro', '[]'::jsonb)",
    );
    await pedido(ctx, "financiada", "PUT", "/v1/apoios/regras", { financiador: "", regras: [] });
    const r = await pedido(ctx, "financiada", "POST", "/v1/apoios/turmas/990002/processar", { mes: MES });
    expect(r.statusCode).toBe(409);
  });
});
