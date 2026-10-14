import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;

const sessao = (id: string, data: string, formador: string) => ({
  id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [formador],
});

async function turmaGold(ctx: Ctx, opts: { formador: string; cronograma: unknown[]; dataInicio: string; vagas?: number }) {
  const nome = unico("TT");
  const res = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: opts.dataInicio, nome, curso: "Curso Lista", local: "Porto", horario: "", vagas: opts.vagas ?? 10,
    formador: opts.formador, cronograma: opts.cronograma,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().turma as { id: number; nome: string };
}

type Linha = {
  id: number; nome: string; fase: string; inscritos: number; reservas: number; livres: number; capacidade: number;
  sessoes: number; realizadas: number; sumariosEmFalta: number; docsEmFalta: number; docsCompletos: number;
};

async function listar(ctx: Ctx, perfil: Parameters<typeof pedido>[1], query: string) {
  const res = await pedido(ctx, perfil, "GET", `/v1/turmas?${query}`);
  return res;
}

describe("lista de turmas", () => {
  it("conta ocupação, sessões, sumários e documentos no servidor", async () => {
    const ctx = await arrancar();
    const formador = unico("Formador Lista");
    const t = await turmaGold(ctx, {
      formador,
      dataInicio: "2020-01-06",
      cronograma: [sessao("a", "2020-01-06", formador), sessao("b", "2020-01-13", formador), sessao("c", "2099-01-05", formador)],
    });
    // Sessão 1 com sumário assinado; a sessão 2 já passou e não tem sumário.
    await ctx.db.query(
      "INSERT INTO turma_sessoes (regime, turma_id, sessao_n, sumario) VALUES ('gold', $1, 1, $2::jsonb)",
      [t.id, JSON.stringify({ conteudos: "x", atividades: "", observacoes: "", assinado: true })],
    );
    for (const email of ["l1@exemplo.pt", "l2@exemplo.pt"]) {
      const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Ana", apelido: email, email, turmaId: t.id });
      expect(r.statusCode, r.body).toBe(200);
    }
    const f1 = await ctx.db.query<{ id: number }>("SELECT id FROM formandos_gold WHERE turma_id = $1 AND email = 'l1@exemplo.pt'", [t.id]);
    for (const doc of ["cc", "contrato", "regulamento"]) {
      await ctx.db.query(
        `INSERT INTO formando_docs (regime, formando_id, doc_id, ok) VALUES ('gold', $1, $2, true)
         ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET ok = true`,
        [f1.rows[0]!.id, doc],
      );
    }

    const res = await listar(ctx, "secretaria", `regime=gold&q=${encodeURIComponent(t.nome)}`);
    expect(res.statusCode, res.body).toBe(200);
    const corpo = res.json() as { total: number; linhas: Linha[]; resumo: { porFase: Record<string, number> } };
    expect(corpo.total).toBe(1);
    const linha = corpo.linhas[0]!;
    expect(linha).toMatchObject({
      id: t.id, fase: "decorrer", inscritos: 2, capacidade: 10, livres: 8,
      sessoes: 3, realizadas: 2, sumariosEmFalta: 1, docsEmFalta: 3, docsCompletos: 1,
    });
    expect(corpo.resumo.porFase.decorrer).toBe(1);

    const outraFase = await listar(ctx, "secretaria", `regime=gold&fase=abrir&q=${encodeURIComponent(t.nome)}`);
    expect(outraFase.json().total).toBe(0);
    const porFormador = await listar(ctx, "secretaria", `regime=gold&formador=${encodeURIComponent(formador)}`);
    expect((porFormador.json().linhas as Linha[]).map(l => l.id)).toEqual([t.id]);
  });

  it("separa as fases e respeita o regime de cada perfil", async () => {
    const ctx = await arrancar();
    const formador = unico("Formador Fase");
    const futura = await turmaGold(ctx, { formador, dataInicio: "2099-03-02", cronograma: [sessao("f", "2099-03-02", formador)] });
    const terminada = await turmaGold(ctx, { formador, dataInicio: "2020-02-03", cronograma: [sessao("p", "2020-02-03", formador)] });
    const res = await listar(ctx, "admin", `regime=gold&formador=${encodeURIComponent(formador)}&porPagina=50`);
    const fases = Object.fromEntries((res.json().linhas as Linha[]).map(l => [l.id, l.fase]));
    expect(fases[futura.id]).toBe("abrir");
    expect(fases[terminada.id]).toBe("por_fechar");

    expect((await listar(ctx, "financiada", "regime=gold")).statusCode).toBe(403);
    expect((await listar(ctx, "comercial", "regime=fin")).statusCode).toBe(403);
    expect((await listar(ctx, "financiada", "regime=fin")).statusCode).toBe(200);
    expect((await listar(ctx, "secretaria", "regime=xpto")).statusCode).toBe(400);
  });

  it("o formador só vê as turmas onde dá aulas", async () => {
    const ctx = await arrancar();
    const conta = await ctx.db.query<{ email: string; name: string }>("SELECT email, name FROM users WHERE id = $1", [ctx.userId.formador]);
    const nomeFormador = unico("Formadora Conta");
    await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: nomeFormador, email: conta.rows[0]!.email, regimes: ["gold"] });
    const minha = await turmaGold(ctx, { formador: nomeFormador, dataInicio: "2099-04-06", cronograma: [sessao("m", "2099-04-06", nomeFormador)] });
    const outro = unico("Outro Formador");
    const alheia = await turmaGold(ctx, { formador: outro, dataInicio: "2099-04-13", cronograma: [sessao("o", "2099-04-13", outro)] });
    const res = await listar(ctx, "formador", "regime=gold&porPagina=200");
    expect(res.statusCode, res.body).toBe(200);
    const ids = (res.json().linhas as Linha[]).map(l => l.id);
    expect(ids).toContain(minha.id);
    expect(ids).not.toContain(alheia.id);
  });

  it("não baixa a capacidade abaixo dos inscritos e audita a alteração", async () => {
    const ctx = await arrancar();
    const formador = unico("Formador Cap");
    const t = await turmaGold(ctx, { formador, dataInicio: "2099-05-04", vagas: 3, cronograma: [sessao("x", "2099-05-04", formador)] });
    for (const email of ["c1@exemplo.pt", "c2@exemplo.pt"]) {
      await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Rui", apelido: email, email, turmaId: t.id });
    }
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${t.id}`, { vagas: 1 })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${t.id}`, { vagas: 5 })).statusCode).toBe(200);
    const audit = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'turma.alterar' AND entity_id = $1", [String(t.id)]);
    expect(audit.rows.length).toBeGreaterThan(0);
  });
});
