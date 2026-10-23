import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;
let ids = 997000;
const novoId = () => ++ids;

type Sessao = { id: string; data: string; horaInicio: string; horaFim: string; modalidade: string; formadores: string[] };
const sessao = (id: string, modalidade = "presencial", data = "2026-01-05"): Sessao =>
  ({ id, data, horaInicio: "09:00", horaFim: "13:00", modalidade, formadores: [] });

async function turmaGold(ctx: Ctx, cronograma: Sessao[], extra: { formador?: string; formadores?: string[] } = {}) {
  const nome = unico("TDE");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2026-01-05", nome, curso: "Curso Sem Ficha", vagas: 10, cronograma });
  expect(r.statusCode, r.body).toBe(200);
  const id = (r.json().turma as { id: number }).id;
  await ctx.db.query("UPDATE turmas_gold SET formador = $2, formadores = $3::jsonb WHERE id = $1", [id, extra.formador ?? "", JSON.stringify(extra.formadores ?? [])]);
  return { id, nome };
}

async function turmaFin(ctx: Ctx, cronograma: Sessao[] = []) {
  const id = novoId();
  const nome = unico("TFE");
  await ctx.db.query(
    "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES ($1, '2026-01-05', $2, 'UFCD Teste DTP', 'X', $3::jsonb)",
    [id, nome, JSON.stringify(cronograma)],
  );
  return { id, nome };
}

async function formandoGold(ctx: Ctx, turma: { id: number; nome: string }, estado = "Formando", email = `${unico("f")}@exemplo.pt`) {
  const id = novoId();
  await ctx.db.query(
    "INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id, estado) VALUES ($1, 'Ana', $2, $3, 'Curso Sem Ficha', $4, $5, $6)",
    [id, unico("A"), email, turma.nome, turma.id, estado],
  );
  return id;
}

async function formandoFin(ctx: Ctx, turma: { id: number }, estado = "Elegível") {
  const id = novoId();
  await ctx.db.query(
    "INSERT INTO formandos_fin (id, nome, apelido, turma, curso, turma_id, estado) VALUES ($1, 'Bia', $2, '', 'UFCD Teste DTP', $3, $4)",
    [id, unico("B"), turma.id, estado],
  );
  return id;
}

async function gravarSessao(ctx: Ctx, regime: "gold" | "fin", turmaId: number, n: number, sessaoId: string, s: { plano?: unknown; sumario?: unknown; presencas?: unknown }) {
  await ctx.db.query(
    `INSERT INTO turma_sessoes (regime, turma_id, sessao_n, sessao_id, plano, sumario, presencas)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [regime, turmaId, n, sessaoId, JSON.stringify(s.plano ?? null), JSON.stringify(s.sumario ?? null), JSON.stringify(s.presencas ?? [])],
  );
}

async function dtp(ctx: Ctx, regime: "gold" | "fin", id: number) {
  const { carregarTurma } = await import("../src/repos/pedagogiaTurma.js");
  const { dtpForTurma } = await import("../src/pedagogia/dtp.js");
  const r = await dtpForTurma(ctx.db, regime, (await carregarTurma(ctx.db, regime, id))!);
  const item = (itemId: string) => r.items.find(i => i.id === itemId)!;
  return { ...r, item };
}

const PLANO = { objetivosGerais: "Objectivo", momentos: {} };
const FECHADA = { assinado: true, presencasValidadas: true };

describe("estado do Dossiê TP", () => {
  it("#1 só as sessões lectivas contam nos totais (a sessão autónoma não)", async () => {
    const ctx = await arrancar();
    const t = await turmaGold(ctx, [sessao("s1"), sessao("s2", "sincrona"), sessao("s3", "auto")]);
    for (const [n, id] of [[1, "s1"], [2, "s2"]] as const) await gravarSessao(ctx, "gold", t.id, n, id, { plano: PLANO, sumario: FECHADA, presencas: [{ id: 1, presente: true }] });
    const d = await dtp(ctx, "gold", t.id);
    expect(d.facts.planos).toEqual({ done: 2, total: 2 });
    for (const id of ["planos", "sumarios", "presencas"]) expect(d.item(id).estado).toBe("ok");

    const { finGruposDocumentosTurma } = await import("../../src/partilhado/finDossierUi.js");
    const grupos = finGruposDocumentosTurma({ formandos: [], facts: d.facts, cronograma: [sessao("s1"), sessao("s3", "auto")] as never });
    expect(grupos[0]!.items.find(i => i.dtpId === "cronograma")!.detalhe).toContain("1 sessões");
  });

  it("#11 a folha de presenças conta só com as presenças validadas (Financiada: também o sumário assinado)", async () => {
    const ctx = await arrancar();
    const g = await turmaGold(ctx, [sessao("g1")]);
    await gravarSessao(ctx, "gold", g.id, 1, "g1", { presencas: [{ id: 1, presente: true }], sumario: { assinado: true } });
    expect((await dtp(ctx, "gold", g.id)).item("presencas").estado).toBe("falta");

    const f = await turmaFin(ctx, [sessao("f1")]);
    await gravarSessao(ctx, "fin", f.id, 1, "f1", { presencas: [{ id: 1, presente: true }], sumario: { assinado: false, presencasValidadas: true } });
    expect((await dtp(ctx, "fin", f.id)).item("presencas").estado).toBe("falta");
    await ctx.db.query("UPDATE turma_sessoes SET sumario = $2::jsonb WHERE regime = 'fin' AND turma_id = $1", [f.id, JSON.stringify(FECHADA)]);
    expect((await dtp(ctx, "fin", f.id)).item("presencas").estado).toBe("ok");
  });

  it("#2 um anexo não fecha um item automático; sem sessões lectivas o item automático está em falta", async () => {
    const ctx = await arrancar();
    const t = await turmaGold(ctx, [sessao("a1", "auto")]);
    const base = `/v1/turmas/gold/${t.id}/dtp`;
    const anexo = { driveFileId: unico("drv"), fileName: "Planos.pdf" };
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/planos/anexo`, anexo)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/pauta/anexo`, { ...anexo, driveFileId: unico("drv") })).statusCode).toBe(200);
    const d = await dtp(ctx, "gold", t.id);
    expect(d.item("planos")).toMatchObject({ estado: "falta", origem: "auto" });
    expect(d.item("pauta").estado).toBe("falta");
    const manuais = await ctx.db.query("SELECT item_id FROM turma_dtp WHERE regime = 'gold' AND turma_id = $1", [t.id]);
    expect(manuais.rows).toEqual([]);

    // Item só manual: o anexo põe-no no dossiê.
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/ocorrencias/anexo`, { ...anexo, driveFileId: unico("drv") })).statusCode).toBe(200);
    expect((await dtp(ctx, "gold", t.id)).item("ocorrencias").estado).toBe("ok");

    // Financiada: fichas, pauta e entrega de certificados gerados não fecham sem dados.
    const f = await turmaFin(ctx);
    const { gravarAnexo } = await import("../src/repos/dtp.js");
    for (const item of ["fichas", "pauta", "entrega-certificados"]) await gravarAnexo(ctx.db, "fin", f.id, item, { id: unico("g"), nome: `${item}.pdf`, url: "" });
    const df = await dtp(ctx, "fin", f.id);
    for (const item of ["fichas", "pauta", "entrega-certificados"]) expect(df.item(item).estado).toBe("falta");
  });

  it("#3 desistentes (Gold) e indeferidos (Financiada) não contam", async () => {
    const ctx = await arrancar();
    const g = await turmaGold(ctx, [sessao("s1")]);
    const ativo = await formandoGold(ctx, g);
    await formandoGold(ctx, g, "Desistente");
    const dg = await dtp(ctx, "gold", g.id);
    expect(dg.facts.formandos).toBe(1);
    expect(dg.facts.contratos.total).toBe(1);

    const f = await turmaFin(ctx);
    const ok = await formandoFin(ctx, f);
    await formandoFin(ctx, f, "Indeferido");
    expect((await dtp(ctx, "fin", f.id)).facts.formandos).toBe(1);
    const { formandosFinComContacto } = await import("../src/repos/dossieGerado.js");
    expect((await formandosFinComContacto(ctx.db, f.id, f.nome)).map(x => Number(x.id))).toEqual([ok]);
    // A pertença à turma (notas, presenças) continua a incluir toda a gente.
    const { carregarTurma, formandosDaTurma } = await import("../src/repos/pedagogiaTurma.js");
    expect((await formandosDaTurma(ctx.db, "gold", (await carregarTurma(ctx.db, "gold", g.id))!)).map(x => x.id)).toContain(ativo);
    expect(await formandosDaTurma(ctx.db, "gold", (await carregarTurma(ctx.db, "gold", g.id))!)).toHaveLength(2);
  });

  it("#4 o certificado ignora o próprio item e a fase de fecho; o fecho ignora a pós-formação e o relatório que gera", async () => {
    const ctx = await arrancar();
    const f = await turmaFin(ctx);
    const { carregarTurma } = await import("../src/repos/pedagogiaTurma.js");
    const { dtpEmFalta } = await import("../src/pedagogia/dtp.js");
    const turma = (await carregarTurma(ctx.db, "fin", f.id))!;
    const cert = await dtpEmFalta(ctx.db, "fin", turma, "certificado");
    for (const label of ["Cópia dos certificados emitidos", "Comprovativo da entrega dos certificados", "Relatório final da ação", "Inquéritos pós-formação"]) {
      expect(cert).not.toContain(label);
    }
    expect(cert).toContain("Cronograma");
    const fecho = await dtpEmFalta(ctx.db, "fin", turma, "fecho");
    for (const label of ["Relatório final da ação", "Inquéritos pós-formação", "Relatório pós-formação", "Cópia dos certificados emitidos"]) {
      expect(fecho).not.toContain(label);
    }
    expect(fecho).toContain("Relatório final");
  });

  it("#5 percurso e ficha do formando juntam-se por formando", async () => {
    const ctx = await arrancar();
    const t = await turmaGold(ctx, [sessao("s1")]);
    const emailA = `${unico("a")}@exemplo.pt`;
    const emailB = `${unico("b")}@exemplo.pt`;
    const a = await formandoGold(ctx, t, "Formando", emailA);
    await formandoGold(ctx, t, "Formando", emailB);
    // A: contrato validado na ficha, mas no percurso ainda pendente. B: validado no percurso.
    await ctx.db.query("INSERT INTO formando_docs (regime, formando_id, doc_id, ok) VALUES ('gold', $1, 'contrato', true)", [a]);
    for (const [email, estado] of [[emailA, "pendente"], [emailB, "validado"]]) {
      const lead = novoId();
      await ctx.db.query("INSERT INTO preinscricoes (id, inscrito, nome, email, curso, regime) VALUES ($1, '2026-01-01', 'X', $2, 'Curso Sem Ficha', 'gold')", [lead, email]);
      await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, estado) VALUES ($1, 'contrato', $2)", [lead, estado]);
    }
    const item = (await dtp(ctx, "gold", t.id)).item("contratos-f");
    expect(item.estado).toBe("ok");
    expect(item.percurso).toMatchObject({ validados: 2, total: 2 });
  });

  it("#10 turma fechada não aceita alterações ao dossiê (só o admin); item desconhecido é recusado", async () => {
    const ctx = await arrancar();
    const t = await turmaGold(ctx, [sessao("s1")]);
    const base = `/v1/turmas/gold/${t.id}`;
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/dtp/xpto`, { estado: "ok" })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/dtp/xpto/anexo`, { driveFileId: "x" })).statusCode).toBe(400);
    await ctx.db.query("UPDATE turmas_gold SET fechada_em = now() WHERE id = $1", [t.id]);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/dtp/ocorrencias`, { estado: "ok" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/dtp/ocorrencias/anexo`, { driveFileId: "x" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "POST", `${base}/dtp/pdfs`)).statusCode).toBe(409);
    expect((await pedido(ctx, "admin", "PUT", `${base}/dtp/ocorrencias`, { estado: "ok" })).statusCode).toBe(200);
    const resumo = (await pedido(ctx, "secretaria", "GET", "/v1/dtp/gold/resumo")).json() as { turmas: { id: number; fechada: boolean }[] };
    expect(resumo.turmas.find(x => x.id === t.id)?.fechada).toBe(true);
  });

  it("#12 documentos do formador, pauta e satisfação (Gold) saem dos dados", async () => {
    const ctx = await arrancar();
    const nome = unico("Rui Formador");
    const fid = novoId();
    await ctx.db.query("INSERT INTO formadores (id, nome, ccp_validade) VALUES ($1, $2, '2025-12-31')", [fid, nome]);
    for (const doc of ["cv", "ccp"]) await ctx.db.query("INSERT INTO formador_docs (formador_id, doc_id, uploaded) VALUES ($1, $2, true)", [fid, doc]);
    const t = await turmaGold(ctx, [sessao("s1")], { formador: nome });
    const f = await formandoGold(ctx, t);
    await ctx.db.query("INSERT INTO turma_certificados (regime, turma_id, formando_id, emitido, elearning) VALUES ('gold', $1, $2, false, 90)", [t.id, f]);
    const inq = novoId();
    await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'inqueritos', 'gold', '{\"publico\":\"formando\"}'::jsonb)", [inq]);
    await ctx.db.query("INSERT INTO inquerito_envios (regime, turma_id, inquerito_id, publico) VALUES ('gold', $1, $2, 'formando')", [t.id, inq]);

    const d = await dtp(ctx, "gold", t.id);
    expect(d.item("cv-formador").estado).toBe("ok");
    // CCP carregado mas expirado antes do início da turma.
    expect(d.item("ccp-formador").estado).toBe("falta");
    expect(d.item("habil-formador").estado).toBe("falta");
    expect(d.item("pauta").estado).toBe("ok");
    expect(d.item("satisfacao").estado).toBe("ok");
    // Certificados: total = elegíveis (sem presenças o formando não é elegível).
    expect(d.facts.certificados).toEqual({ done: 0, total: 0 });
  });

  it("#13 o total dos inquéritos é o que foi enviado; o envio de fim de curso não leva os de pós-formação", async () => {
    const ctx = await arrancar();
    const f = await turmaFin(ctx);
    const novo = async (publico: string) => {
      const id = novoId();
      await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'inqueritos', 'fin', $2::jsonb)", [id, JSON.stringify({ titulo: unico("Inq"), publico })]);
      return id;
    };
    const f1 = await novo("formando");
    await novo("formando");
    const pos = await novo("pos");
    await ctx.db.query("INSERT INTO inquerito_envios (regime, turma_id, inquerito_id, publico) VALUES ('fin', $1, $2, 'formando')", [f.id, f1]);
    expect((await dtp(ctx, "fin", f.id)).item("inquerito-formandos").estado).toBe("ok");

    const f2 = await turmaFin(ctx);
    expect((await pedido(ctx, "admin", "POST", `/v1/turmas/fin/${f2.id}/inqueritos/enviar`)).statusCode).toBe(200);
    const enviados = await ctx.db.query<{ inquerito_id: number; publico: string }>("SELECT inquerito_id, publico FROM inquerito_envios WHERE regime = 'fin' AND turma_id = $1", [f2.id]);
    expect(enviados.rows.length).toBeGreaterThan(0);
    expect(enviados.rows.some(r => Number(r.inquerito_id) === pos || r.publico === "pos")).toBe(false);
  });
});
