import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;

async function turmaGold(ctx: Ctx) {
  const curso = unico("Curso Inq");
  expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "T", tipo: "Pré-inscrição", preco: 0, regime: "Presencial", horas: 4 })).statusCode).toBe(200);
  const nome = unico("TI");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2030-05-06", nome, curso, local: "Porto", horario: "Laboral Manhã", vagas: 5, estado: "Ativa",
    cronograma: [{ id: unico("s"), data: "2030-05-06", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(r.statusCode).toBe(200);
  return { ...(r.json().turma as { id: number }), nome, curso };
}

async function formando(ctx: Ctx, turma: { id: number; nome: string; curso: string }, email: string) {
  await ctx.db.query(
    `INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id)
     VALUES ((SELECT coalesce(max(id), 0) + 1 FROM formandos_gold), 'Ana', 'Teste', $1, $2, $3, $4)`,
    [email, turma.curso, turma.nome, turma.id],
  );
}

async function inquerito(ctx: Ctx, regime: "gold" | "fin") {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO catalog_items (id, kind, regime, payload)
     VALUES ((SELECT coalesce(max(id), 0) + 1 FROM catalog_items), 'inqueritos', $1, $2::jsonb) RETURNING id`,
    [regime, { titulo: unico("Satisfação"), publico: "formando", perguntas: [
      { id: 1, tipo: "escala", texto: "Gostou?" },
      { id: 2, tipo: "simnao", texto: "Recomenda?" },
      { id: 3, tipo: "multipla", texto: "Melhor parte", opcoes: ["Prática", "Teoria"] },
    ] }],
  );
  return r.rows[0]!.id;
}

describe("dossiê: vista geral por regime", () => {
  it("devolve a matriz turma × secção (6 pastas Gold, 14 tópicos Fin) e fecha ao formador", async () => {
    const ctx = await arrancar();
    const t = await turmaGold(ctx);
    const gold = await pedido(ctx, "secretaria", "GET", "/v1/dtp/gold/resumo");
    expect(gold.statusCode).toBe(200);
    const corpo = gold.json() as { seccoes: { id: string }[]; turmas: { id: number; pct: number; celulas: { estado: string }[]; emFalta: unknown[] }[] };
    expect(corpo.seccoes).toHaveLength(6);
    const linha = corpo.turmas.find(x => x.id === t.id);
    expect(linha).toBeTruthy();
    expect(linha!.celulas).toHaveLength(6);
    expect(typeof linha!.pct).toBe("number");
    expect(linha!.emFalta.length).toBeGreaterThan(0);

    const fin = await pedido(ctx, "financiada", "GET", "/v1/dtp/fin/resumo");
    expect(fin.statusCode).toBe(200);
    expect((fin.json() as { seccoes: unknown[] }).seccoes).toHaveLength(14);

    expect((await pedido(ctx, "formador", "GET", "/v1/dtp/gold/resumo")).statusCode).toBe(403);
    expect((await pedido(ctx, null, "GET", "/v1/dtp/gold/resumo")).statusCode).toBe(401);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/dtp/xpto/resumo")).statusCode).toBe(400);
  });
});

describe("inquéritos: taxa de resposta por turma e resumo por pergunta", () => {
  it("conta destinatários no envio e cruza com as respostas da turma", async () => {
    const ctx = await arrancar();
    const t = await turmaGold(ctx);
    await formando(ctx, t, `${unico("ana")}@exemplo.pt`);
    await formando(ctx, t, `${unico("rui")}@exemplo.pt`);
    const id = await inquerito(ctx, "gold");

    const env = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${t.id}/inqueritos/enviar`);
    expect(env.statusCode).toBe(200);
    expect(env.json().enviados).toBe(2);

    const pub = await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${id}/publico`);
    const token = pub.json().token as string;
    const responder = (respostas: Record<string, unknown>) =>
      ctx.app.inject({ method: "POST", url: `/v1/public/inqueritos/${token}/respostas`, payload: { turma: t.nome, formando: "", respostas } });
    expect((await responder({ 1: 4, 2: "Sim", 3: "Prática" })).statusCode).toBe(200);

    const lista = await pedido(ctx, "secretaria", "GET", "/v1/inqueritos?regime=gold");
    expect(lista.statusCode).toBe(200);
    const item = (lista.json().inqueritos as { id: number; destinatarios: number; respostas: number; taxa: number; turmas: number }[]).find(i => i.id === id)!;
    expect(item).toMatchObject({ destinatarios: 2, respostas: 1, taxa: 50, turmas: 1 });

    const res = await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${id}/resultados?turma=${encodeURIComponent(t.nome)}`);
    expect(res.statusCode).toBe(200);
    const r = res.json() as { turmas: { turmaId: number; enviados: number; respostas: number; taxa: number }[]; perguntas: { id: number; media: number | null; pctSim: number | null; contagens: Record<string, number> }[] };
    expect(r.turmas[0]).toMatchObject({ turmaId: t.id, enviados: 2, respostas: 1, taxa: 50 });
    expect(r.perguntas.find(p => p.id === 1)?.media).toBe(4);
    expect(r.perguntas.find(p => p.id === 2)?.pctSim).toBe(100);
    expect(r.perguntas.find(p => p.id === 3)?.contagens).toEqual({ Prática: 1, Teoria: 0 });

    expect((await pedido(ctx, "formador", "GET", "/v1/inqueritos?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/inqueritos/999999/resultados")).statusCode).toBe(404);
  });
});
