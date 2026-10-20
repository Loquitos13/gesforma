import { afterEach, describe, expect, it, vi } from "vitest";
import { periodo } from "../src/repos/sql.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

async function cursoGold(ctx: Ctx, nome = unico("Curso Aud")) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "T", tipo: "Pré-inscrição", preco: 0, regime: "Presencial", horas: 4 });
  expect(r.statusCode).toBe(200);
  return { id: (r.json() as { curso: { id: number } }).curso.id, nome };
}

async function turmaGold(ctx: Ctx, curso: string, cronograma: { data: string }[] = [{ data: "2030-05-06" }], dataInicio = "2030-05-06") {
  const nome = unico("TA");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio, nome, curso, local: "Porto", horario: "Laboral Manhã", vagas: 5, estado: "Ativa",
    cronograma: cronograma.map(s => ({ id: unico("s"), data: s.data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] })),
  });
  expect(r.statusCode).toBe(200);
  return { id: (r.json() as { turma: { id: number } }).turma.id, nome, curso };
}

async function inquerito(ctx: Ctx, regime: "gold" | "fin") {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO catalog_items (id, kind, regime, payload)
     VALUES ((SELECT coalesce(max(id), 0) + 1 FROM catalog_items), 'inqueritos', $1, $2::jsonb) RETURNING id`,
    [regime, { titulo: unico("Satisfação"), publico: "formando", perguntas: [{ id: 1, tipo: "escala", texto: "Gostou?" }] }],
  );
  return r.rows[0]!.id;
}

describe("inquéritos: resposta associada à turma da ligação", () => {
  it("guarda a turma_id da ligação, recusa turmas a que não foi enviado e mantém as respostas antigas pelo nome", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const t = await turmaGold(ctx, curso.nome);
    const outra = await turmaGold(ctx, curso.nome);
    const id = await inquerito(ctx, "gold");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${t.id}/inqueritos/enviar`)).statusCode).toBe(200);
    const token = (await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${id}/publico`)).json().token as string;

    // A ligação da turma identifica-a; uma turma a que o inquérito não foi enviado não.
    const aberto = await ctx.app.inject({ method: "GET", url: `/v1/public/inqueritos/${token}?turma=${t.id}` });
    expect(aberto.json().turma).toEqual({ id: t.id, nome: t.nome });
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/inqueritos/${token}?turma=${outra.id}` })).json().turma).toBeNull();

    const responder = (body: Record<string, unknown>) =>
      ctx.app.inject({ method: "POST", url: `/v1/public/inqueritos/${token}/respostas`, payload: { formando: "", respostas: { 1: 5 }, ...body } });
    // Texto livre errado não importa: conta a turma da ligação.
    expect((await responder({ turma: "escrevi outra coisa", turmaId: t.id })).statusCode).toBe(200);
    expect((await responder({ turma: "", turmaId: outra.id })).statusCode).toBe(400);
    // Resposta antiga (sem turma_id), cruzada pelo nome escrito.
    expect((await responder({ turma: ` ${t.nome.toUpperCase()} ` })).statusCode).toBe(200);

    const gravada = await ctx.db.query<{ turma_id: number | null; turma: string }>(
      "SELECT turma_id, turma FROM inquerito_respostas WHERE inquerito_id = $1 ORDER BY id", [id]);
    expect(gravada.rows[0]).toMatchObject({ turma_id: t.id, turma: t.nome });
    expect(gravada.rows[1]!.turma_id).toBeNull();

    const res = (await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${id}/resultados?turma=${encodeURIComponent(t.nome)}`)).json() as {
      resumo: { respostas: number }; turmas: { turmaId: number | null; respostas: number }[];
    };
    expect(res.turmas).toHaveLength(1);
    expect(res.turmas[0]).toMatchObject({ turmaId: t.id, respostas: 2 });
    expect(res.resumo.respostas).toBe(2);

    // Mudar o nome da turma não perde as respostas com turma_id.
    await ctx.db.query("UPDATE turmas_gold SET nome = $2 WHERE id = $1", [t.id, `${t.nome} renomeada`]);
    const depois = (await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${id}/resultados`)).json() as { turmas: { turmaId: number | null; respostas: number }[] };
    expect(depois.turmas.find(x => x.turmaId === t.id)?.respostas).toBe(1);
  });
});

describe("inquéritos: Gold e Financiada separadas", () => {
  it("cada perfil só vê inquéritos, resultados, respostas e ligação do seu regime", async () => {
    const ctx = await arrancar();
    const gold = await inquerito(ctx, "gold");
    const fin = await inquerito(ctx, "fin");

    expect((await pedido(ctx, "financiada", "GET", "/v1/inqueritos?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "GET", "/v1/inqueritos?regime=fin")).statusCode).toBe(403);
    const daFin = await pedido(ctx, "financiada", "GET", "/v1/inqueritos?regime=fin");
    expect(daFin.statusCode).toBe(200);
    expect((daFin.json().inqueritos as { id: number }[]).map(i => i.id)).toContain(fin);

    for (const url of [`/v1/inqueritos/${gold}/resultados`, `/v1/inqueritos/${gold}/respostas`, `/v1/inqueritos/${gold}/publico`]) {
      expect((await pedido(ctx, "financiada", "GET", url)).statusCode).toBe(403);
    }
    expect((await pedido(ctx, "financiada", "POST", `/v1/inqueritos/${gold}/respostas`, { respostas: { 1: 3 } })).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "GET", `/v1/inqueritos/${fin}/resultados`)).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "GET", `/v1/inqueritos/${fin}/resultados`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${gold}/resultados`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${fin}/resultados`)).statusCode).toBe(200);
  });
});

describe("cursos: renomear só no regime, sem nomes repetidos", () => {
  it("renomear um curso Gold não toca nos registos da Financiada com o mesmo nome", async () => {
    const ctx = await arrancar();
    const nome = unico("Partilhado");
    const g = await cursoGold(ctx, nome);
    const f = await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", { ufcdCod: "9999", ufcd: nome, nomeComercial: nome, regime: "Presencial", horas: 25 });
    expect(f.statusCode).toBe(200);
    await ctx.db.query("INSERT INTO turmas_fin (id, nome, curso, data_inicio) VALUES ((SELECT coalesce(max(id), 0) + 1 FROM turmas_fin), $1, $2, '2030-01-01')", [unico("TF"), nome]);
    const tg = await turmaGold(ctx, nome);
    await ctx.db.query("INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado) VALUES ($1, 'X', 1, 'MB', $2, '2026-01-01', 'Pago')", [unico("pg"), nome]);
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime) VALUES
         ((SELECT coalesce(max(id), 0) + 1 FROM preinscricoes), '2026-01-01 10:00', 'G', 'g@exemplo.pt', $1, 'Não contactado', 'gold')`, [nome]);
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime) VALUES
         ((SELECT coalesce(max(id), 0) + 1 FROM preinscricoes), '2026-01-01 10:00', 'F', 'f@exemplo.pt', $1, 'Não contactado', 'fin')`, [nome]);

    const novo = unico("Renomeado");
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/cursos-gold/${g.id}`, { nome: novo })).statusCode).toBe(200);

    const curso = async (sql: string) => (await ctx.db.query<{ curso: string }>(sql, [nome, novo])).rows.map(r => r.curso);
    expect((await ctx.db.query<{ curso: string }>("SELECT curso FROM turmas_gold WHERE id = $1", [tg.id])).rows[0]!.curso).toBe(novo);
    expect(await curso("SELECT curso FROM turmas_fin WHERE curso IN ($1, $2)")).toEqual([nome]);
    expect(await curso("SELECT curso FROM preinscricoes WHERE regime = 'gold' AND curso IN ($1, $2)")).toEqual([novo]);
    expect(await curso("SELECT curso FROM preinscricoes WHERE regime = 'fin' AND curso IN ($1, $2)")).toEqual([nome]);
    // Pagamento sem regime e nome também da Financiada: não se sabe de quem é, fica como estava.
    expect(await curso("SELECT curso FROM pagamentos WHERE curso IN ($1, $2)")).toEqual([nome]);
  });

  it("renomear para um nome que já existe no regime é recusado e nada muda", async () => {
    const ctx = await arrancar();
    const a = await cursoGold(ctx);
    const b = await cursoGold(ctx);
    const t = await turmaGold(ctx, a.nome);
    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/cursos-gold/${a.id}`, { nome: ` ${b.nome.toLowerCase()} `, horas: 9 });
    expect(r.statusCode).toBe(409);
    const linha = await ctx.db.query<{ nome: string; horas: number }>("SELECT nome, horas FROM cursos_gold WHERE id = $1", [a.id]);
    expect(linha.rows[0]).toMatchObject({ nome: a.nome, horas: 4 });
    expect((await ctx.db.query<{ curso: string }>("SELECT curso FROM turmas_gold WHERE id = $1", [t.id])).rows[0]!.curso).toBe(a.nome);

    const f1 = unico("UFCD Aud");
    const f2 = unico("UFCD Aud");
    const fa = await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", { ufcdCod: "1", ufcd: f1, nomeComercial: f1, regime: "Presencial", horas: 25 });
    await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", { ufcdCod: "2", ufcd: f2, nomeComercial: f2, regime: "Presencial", horas: 25 });
    const idFin = (fa.json() as { curso: { id: number } }).curso.id;
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/cursos-fin/${idFin}`, { nomeComercial: f2 })).statusCode).toBe(409);
  });
});

describe("cursos: criar sem duplicados", () => {
  it("o mesmo nome no mesmo regime dá 409, mesmo com dois pedidos ao mesmo tempo", async () => {
    const ctx = await arrancar();
    const nome = unico("Duplicado");
    const corpo = { nome, categoria: "T", tipo: "Pré-inscrição", preco: 0, regime: "Presencial", horas: 4 };
    const [r1, r2] = await Promise.all([
      pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", corpo),
      pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", corpo),
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409]);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { ...corpo, nome: ` ${nome.toUpperCase()}` })).statusCode).toBe(409);
    const n = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM cursos_gold WHERE lower(trim(nome)) = lower($1)", [nome]);
    expect(n.rows[0]!.n).toBe(1);

    // Noutro regime o nome pode existir; repetido na Financiada não.
    const fin = { ufcdCod: "3", ufcd: nome, nomeComercial: nome, regime: "Presencial", horas: 25 };
    expect((await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", fin)).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", fin)).statusCode).toBe(409);
  });
});

describe("listas: renomear tipo, modalidade ou categoria muda também a ficha do curso", () => {
  it("a ficha gravada (que manda no editor) acompanha a tabela", async () => {
    const ctx = await arrancar();
    const tipo = unico("Tipo Ficha");
    const opcao = (await pedido(ctx, "secretaria", "POST", "/v1/listas/tipos_curso", { nome: tipo })).json() as { opcao: { id: number } };
    const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: unico("Curso Ficha"), categoria: "T", tipo, preco: 0, regime: "Presencial", horas: 4 });
    const id = (r.json() as { curso: { id: number } }).curso.id;
    await ctx.db.query("INSERT INTO curso_fichas (regime, curso_id, payload) VALUES ('gold', $1, $2::jsonb)", [id, { titulo: "X", tipo }]);
    const novo = unico("Tipo Novo");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/listas/tipos_curso/${opcao.opcao.id}/renomear`, { nome: novo })).statusCode).toBe(200);
    const ficha = await ctx.db.query<{ tipo: string }>("SELECT payload->>'tipo' AS tipo FROM curso_fichas WHERE regime = 'gold' AND curso_id = $1", [id]);
    expect(ficha.rows[0]!.tipo).toBe(novo);
  });
});

describe("painel: comparação com o mesmo intervalo do mês anterior", () => {
  it("«este mês» até dia 19 compara com 1 a 19 do mês anterior; o mês inteiro corta no fim do mês", () => {
    expect(periodo("2026-10-01", "2026-10-19").anterior).toEqual({ de: "2026-09-01", ate: "2026-09-19" });
    expect(periodo("2026-03-01", "2026-03-31").anterior).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
    expect(periodo("2026-03-01", "2026-03-30").anterior).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
    expect(periodo("2026-01-01", "2026-01-15").anterior).toEqual({ de: "2025-12-01", ate: "2025-12-15" });
    // Um intervalo livre continua a comparar com os dias imediatamente antes.
    expect(periodo("2026-10-05", "2026-10-19").anterior).toEqual({ de: "2026-09-20", ate: "2026-10-04" });
    // Sem datas: mês corrente até hoje.
    expect(periodo(null, null, new Date("2026-10-19T12:00:00Z"))).toMatchObject({ de: "2026-10-01", ate: "2026-10-19", anterior: { de: "2026-09-01", ate: "2026-09-19" } });
  });

  it("os indicadores contam só 1 a 19 de setembro", async () => {
    const ctx = await arrancar();
    const curso = unico("Painel Setembro");
    const lead = async (inscrito: string) => ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, origem, regime)
       VALUES ((SELECT coalesce(max(id), 0) + 1 FROM preinscricoes), $1, 'L', 'l@exemplo.pt', $2, 'Não contactado', 'Google', 'gold')`,
      [inscrito, curso]);
    await lead("2026-10-05 10:00");
    await lead("2026-09-10 10:00");
    await lead("2026-09-25 10:00");
    const r = await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?curso=${encodeURIComponent(curso)}&de=2026-10-01&ate=2026-10-19`);
    expect(r.statusCode).toBe(200);
    const p = r.json() as { periodo: { anterior: { de: string; ate: string } }; kpis: { id: string; valor: number; anterior: number }[] };
    expect(p.periodo.anterior).toEqual({ de: "2026-09-01", ate: "2026-09-19" });
    expect(p.kpis.find(k => k.id === "pre")).toMatchObject({ valor: 1, anterior: 1 });
  });
});

describe("painel: turmas a decorrer como na lista de turmas", () => {
  it("as turmas por fechar (última sessão já passou) não contam como a decorrer", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    await turmaGold(ctx, curso.nome, [{ data: "2020-01-10" }, { data: "2099-01-10" }], "2020-01-10");
    await turmaGold(ctx, curso.nome, [{ data: "2020-01-10" }], "2020-01-10");
    const p = (await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?curso=${encodeURIComponent(curso.nome)}`)).json() as { kpis: { id: string; valor: number }[] };
    const lista = (await pedido(ctx, "secretaria", "GET", `/v1/turmas?regime=gold&curso=${encodeURIComponent(curso.nome)}`)).json() as { resumo: { porFase: Record<string, number> } };
    expect(lista.resumo.porFase).toMatchObject({ decorrer: 1, por_fechar: 1 });
    expect(p.kpis.find(k => k.id === "turmas")!.valor).toBe(1);
  });
});

describe("datas em hora de Lisboa", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("formandos inscritos perto da meia-noite (hora de verão) contam no dia de Lisboa", async () => {
    const ctx = await arrancar();
    const curso = unico("Painel Lisboa");
    const formando = async (inscrito: string) => ctx.db.query(
      `INSERT INTO formandos_gold (id, nome, email, inscrito, curso, estado)
       VALUES ((SELECT coalesce(max(id), 0) + 1 FROM formandos_gold), 'F', 'f@exemplo.pt', $1, $2, 'Formando')`,
      [inscrito, curso]);
    await formando("2026-07-31 23:30"); // UTC → 1 de agosto, 00:30 em Lisboa
    await formando("2026-08-31 23:10"); // UTC → 1 de setembro em Lisboa
    await formando("2026-08-15"); // só a data: é o dia escrito
    await formando("2026-07-10 10:00");
    const r = await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?curso=${encodeURIComponent(curso)}&de=2026-08-01&ate=2026-08-31`);
    expect(r.statusCode).toBe(200);
    const p = r.json() as { kpis: { id: string; valor: number; anterior: number }[] };
    expect(p.kpis.find(k => k.id === "formandos")).toMatchObject({ valor: 2, anterior: 1 });
  });

  it("uma inscrição financiada criada às 23:30 UTC de 31 de julho fica com o dia 1 de agosto", async () => {
    const ctx = await arrancar();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-31T23:30:00Z") });
    const email = `${unico("fin").replace(/\s+/g, "")}@exemplo.pt`;
    const r = await pedido(ctx, "financiada", "POST", "/v1/inscricoes-fin", { nome: "Ana", email, curso: unico("UFCD Lisboa") });
    vi.useRealTimers();
    expect(r.statusCode).toBe(200);
    const id = (r.json() as { id: number }).id;
    const linha = await ctx.db.query<{ inscrito: string }>("SELECT payload->>'inscrito' AS inscrito FROM catalog_items WHERE id = $1", [id]);
    expect(linha.rows[0]!.inscrito).toBe("2026-08-01");
  });
});
