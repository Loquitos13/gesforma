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
  it("a turma recebe os planos do curso pela ordem das sessões lectivas, sem tocar nos que já têm plano", async () => {
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
    expect(ficha.json().planosImportados).toBe(2);
    let linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.map(l => [l.sessao_n, l.plano?.objetivosGerais])).toEqual([[1, "Gerais 1"], [2, "Gerais 2"], [3, "Plano próprio"]]);
    expect(linhas[1]!.plano!.momentos.desenvolvimento.conteudo).toBe("Conteúdo antigo");
    // O sumário padrão não se grava como sumário.
    expect(linhas.every(l => l.sumario == null)).toBe(true);

    // Botão: com substituir, a sessão 3 (não assinada) passa ao plano do curso. Há 3 sessões lectivas, todas com modelo.
    expect((await pedido(ctx, "formador", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true })).statusCode).toBe(403);
    const imp = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true });
    expect(imp.statusCode, imp.body).toBe(200);
    expect(imp.json()).toMatchObject({ importados: 3, mantidos: 0, semModelo: 0 });
    linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.find(l => l.sessao_n === 3)!.plano!.objetivosGerais).toBe("Gerais 3");

    // Plano assinado nunca se substitui.
    await ctx.db.query("UPDATE turma_sessoes SET plano = plano || '{\"assinado\": true}'::jsonb WHERE regime = 'gold' AND turma_id = $1 AND sessao_n = 1", [turmaId]);
    const imp2 = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true });
    expect(imp2.json()).toMatchObject({ importados: 2, mantidos: 1 });

    // Uma turma nova do curso já nasce com os planos.
    const t2 = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-05-04", nome: unico("TPL2"), curso,
      cronograma: [{ id: "1", data: "2099-05-04", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
    });
    expect(t2.statusCode, t2.body).toBe(200);
    expect((await planosDaTurma(ctx, t2.json().turma.id as number)).map(l => l.plano?.objetivosGerais)).toEqual(["Gerais 1"]);

    // Turma fechada: não se importa.
    await ctx.db.query("UPDATE turmas_gold SET fechada_em = now() WHERE id = $1", [turmaId]);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, {})).statusCode).toBe(409);
  });
});
