import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

const plano = (ordem: number, gerais: string) => ({
  ordem, objetivosGerais: gerais, objetivosEspecificos: "",
  momentos: {
    introducao: { conteudo: "", atividades: "", metodos: "", avaliacao: "", recursos: "", materiais: "" },
    desenvolvimento: { conteudo: `Desenvolvimento ${ordem}`, atividades: "", metodos: "Expositivo", avaliacao: "", recursos: "", materiais: "" },
    conclusao: { conteudo: "", atividades: "", metodos: "", avaliacao: "", recursos: "", materiais: "" },
  },
  sumario: { conteudos: `Sumário padrão ${ordem}`, atividades: "" },
});

async function planosDaTurma(ctx: Ctx, turmaId: number) {
  const r = await ctx.db.query<{ sessao_n: number; plano: { objetivosGerais: string; momentos: { desenvolvimento: { conteudo: string } }; assinado?: boolean } | null; sumario: unknown }>(
    "SELECT sessao_n, plano, sumario FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 ORDER BY sessao_n", [turmaId]);
  return r.rows;
}

describe("planos de sessão do curso nas turmas", () => {
  it("todas as turmas do curso recebem os planos e os sumários da ficha, pela ordem das sessões lectivas; o que a turma alterou fica", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Planos");
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 });
    expect(c.statusCode, c.body).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;

    // Uma turma criada antes de haver planos; a sessão 2 é e-learning e não conta.
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-04-06", nome: unico("TPL"), curso,
      cronograma: [
        { id: "1", data: "2099-04-06", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
        { id: "2", data: "2099-04-07", horaInicio: "09:00", horaFim: "13:00", modalidade: "auto", formadores: [] },
        { id: "3", data: "2099-04-08", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", formadores: [] },
        { id: "4", data: "2099-04-09", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      ],
    });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    expect(await planosDaTurma(ctx, turmaId)).toEqual([]);

    // A sessão 3 já tem plano próprio: não se substitui.
    const proprio = { objetivosGerais: "Plano próprio", objetivosEspecificos: "", momentos: plano(3, "").momentos };
    expect((await pedido(ctx, "secretaria", "PUT", `/v1/turmas/gold/${turmaId}/sessoes/3`, { plano: proprio })).statusCode).toBe(200);

    // Gravar a ficha do curso (2 planos, um no formato antigo) leva-os às turmas abertas.
    const ficha = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [plano(1, "Gerais 1"), { ordem: 2, objetivosGerais: "Gerais 2", objetivosEspecificos: "", conteudo: "Conteúdo antigo" }, plano(3, "Gerais 3")] },
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    // Planos das sessões 1 e 2; sumários das sessões 1 e 3 (a 3 tem plano próprio, mas o sumário estava vazio).
    expect(ficha.json().planosImportados).toBe(4);
    let linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.map(l => [l.sessao_n, l.plano?.objetivosGerais])).toEqual([[1, "Gerais 1"], [2, "Gerais 2"], [3, "Plano próprio"]]);
    expect(linhas[1]!.plano!.momentos.desenvolvimento.conteudo).toBe("Conteúdo antigo");
    // Definido na ficha do curso: chega aprovado.
    expect(linhas[0]!.plano).toMatchObject({ estado: "aprovado", origem: "curso" });
    // O sumário padrão também passa a sumário da sessão (por assinar).
    const sumarios = linhas.map(l => (l.sumario as { conteudos?: string; assinado?: boolean } | null));
    expect(sumarios.map(x => x?.conteudos ?? null)).toEqual(["Sumário padrão 1", null, "Sumário padrão 3"]);
    expect(sumarios[0]!.assinado).toBe(false);

    // Botão: com substituir, a sessão 3 (não assinada) passa ao plano do curso. Há 3 sessões lectivas, todas com modelo.
    expect((await pedido(ctx, "formador", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true })).statusCode).toBe(403);
    const imp = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true });
    expect(imp.statusCode, imp.body).toBe(200);
    // Só se grava o que muda: as sessões 1 e 2 já tinham o plano do curso.
    expect(imp.json()).toMatchObject({ importados: 1, mantidos: 2, semModelo: 0 });
    linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.find(l => l.sessao_n === 3)!.plano!.objetivosGerais).toBe("Gerais 3");

    // Plano assinado nunca se substitui.
    await ctx.db.query("UPDATE turma_sessoes SET plano = plano || '{\"assinado\": true}'::jsonb WHERE regime = 'gold' AND turma_id = $1 AND sessao_n = 1", [turmaId]);
    const imp2 = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true });
    expect(imp2.json()).toMatchObject({ importados: 0, mantidos: 3 });

    // Mudar a ficha do curso chega às turmas que não alteraram nem assinaram; o que a turma alterou fica.
    const editado = { objetivosGerais: "Alterado na turma", objetivosEspecificos: "", momentos: plano(2, "").momentos };
    expect((await pedido(ctx, "secretaria", "PUT", `/v1/turmas/gold/${turmaId}/sessoes/2`, { plano: editado })).statusCode).toBe(200);
    const ficha2 = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [plano(1, "Gerais 1 v2"), plano(2, "Gerais 2 v2"), plano(3, "Gerais 3 v2")] },
    });
    expect(ficha2.statusCode, ficha2.body).toBe(200);
    linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.map(l => l.plano?.objetivosGerais)).toEqual(["Gerais 1", "Alterado na turma", "Gerais 3 v2"]);

    // Uma turma nova do curso já nasce com os planos.
    const t2 = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-05-04", nome: unico("TPL2"), curso,
      cronograma: [{ id: "1", data: "2099-05-04", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
    });
    expect(t2.statusCode, t2.body).toBe(200);
    expect((await planosDaTurma(ctx, t2.json().turma.id as number)).map(l => l.plano?.objetivosGerais)).toEqual(["Gerais 1 v2"]);

    // Turma nova (com a grelha que a criação gerar) a que depois se muda o cronograma no cockpit: as sessões recebem os planos.
    const t3 = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome: unico("TPL3"), curso });
    expect(t3.statusCode, t3.body).toBe(200);
    const t3Id = t3.json().turma.id as number;
    const cron = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${t3Id}`, {
      cronograma: [
        { id: "a", data: "2099-06-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
        { id: "b", data: "2099-06-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      ],
    });
    expect(cron.statusCode, cron.body).toBe(200);
    // (As sessões que saíram da grelha gerada ficam sem número.)
    expect((await planosDaTurma(ctx, t3Id)).filter(l => l.sessao_n != null).map(l => l.plano?.objetivosGerais)).toEqual(["Gerais 1 v2", "Gerais 2 v2"]);

    // Turma fechada: não se importa.
    await ctx.db.query("UPDATE turmas_gold SET fechada_em = now() WHERE id = $1", [turmaId]);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, {})).statusCode).toBe(409);
  });

  it("Financiada: uma turma nova do curso recebe os planos gravados na ficha do curso", async () => {
    const ctx = await arrancar();
    const nome = unico("UFCD Planos");
    const c = await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", { ufcdCod: "9998", ufcd: nome, nomeComercial: nome, regime: "Presencial", horas: 25 });
    expect(c.statusCode, c.body).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_fin WHERE nome_comercial = $1", [nome])).rows[0]!.id;
    const ficha = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/fin/${cursoId}/ficha`, { payload: { planosSessao: [plano(1, "Fin 1"), plano(2, "Fin 2")] } });
    expect(ficha.statusCode, ficha.body).toBe(200);
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
      dataInicio: "2099-07-01", nome: unico("TFP"), curso: nome, horas: 25,
      cronograma: [
        { id: "1", data: "2099-07-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
        { id: "2", data: "2099-07-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      ],
    });
    expect(t.statusCode, t.body).toBe(200);
    const r = await ctx.db.query<{ plano: { objetivosGerais: string } | null }>(
      "SELECT plano FROM turma_sessoes WHERE regime = 'fin' AND turma_id = $1 ORDER BY sessao_n", [t.json().turma.id]);
    expect(r.rows.map(x => x.plano?.objetivosGerais)).toEqual(["Fin 1", "Fin 2"]);
  });
});
