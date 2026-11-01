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

    // Gravar a ficha do curso NÃO mexe nas turmas que já existem (era isso que duplicava planos e módulos).
    const ficha = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [plano(1, "Gerais 1"), { ordem: 2, objetivosGerais: "Gerais 2", objetivosEspecificos: "", conteudo: "Conteúdo antigo" }, plano(3, "Gerais 3")] },
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    let linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.map(l => [l.sessao_n, l.plano?.objetivosGerais])).toEqual([[3, "Plano próprio"]]);

    // Na turma que já existia, só pelo botão «Importar planos do curso»: sessões sem plano recebem-no; o próprio fica.
    expect((await pedido(ctx, "formador", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, {})).statusCode).toBe(403);
    const imp0 = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, {});
    expect(imp0.statusCode, imp0.body).toBe(200);
    linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.map(l => [l.sessao_n, l.plano?.objetivosGerais])).toEqual([[1, "Gerais 1"], [2, "Gerais 2"], [3, "Plano próprio"]]);
    expect(linhas[1]!.plano!.momentos.desenvolvimento.conteudo).toBe("Conteúdo antigo");
    expect(linhas[0]!.plano).toMatchObject({ estado: "aprovado", origem: "curso" });
    const sumarios = linhas.map(l => (l.sumario as { conteudos?: string; assinado?: boolean } | null));
    expect(sumarios.map(x => x?.conteudos ?? null)).toEqual(["Sumário padrão 1", null, "Sumário padrão 3"]);
    expect(sumarios[0]!.assinado).toBe(false);

    // Com substituir, a sessão 3 (não assinada) passa ao plano do curso.
    const imp = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true });
    expect(imp.statusCode, imp.body).toBe(200);
    expect(imp.json()).toMatchObject({ importados: 1, mantidos: 2, semModelo: 0 });
    linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.find(l => l.sessao_n === 3)!.plano!.objetivosGerais).toBe("Gerais 3");

    // Plano assinado nunca se substitui.
    await ctx.db.query("UPDATE turma_sessoes SET plano = plano || '{\"assinado\": true}'::jsonb WHERE regime = 'gold' AND turma_id = $1 AND sessao_n = 1", [turmaId]);
    const imp2 = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${turmaId}/planos/importar`, { substituir: true });
    expect(imp2.json()).toMatchObject({ importados: 0, mantidos: 3 });

    // Mudar a ficha depois: a turma existente fica como estava; uma turma nova já nasce com os planos novos.
    const ficha2 = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [plano(1, "Gerais 1 v2"), plano(2, "Gerais 2 v2"), plano(3, "Gerais 3 v2")] },
    });
    expect(ficha2.statusCode, ficha2.body).toBe(200);
    linhas = await planosDaTurma(ctx, turmaId);
    expect(linhas.map(l => l.plano?.objetivosGerais)).toEqual(["Gerais 1", "Gerais 2", "Gerais 3"]);
    const t2 = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-05-04", nome: unico("TPL2"), curso,
      cronograma: [{ id: "1", data: "2099-05-04", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
    });
    expect(t2.statusCode, t2.body).toBe(200);
    expect((await planosDaTurma(ctx, t2.json().turma.id as number)).map(l => l.plano?.objetivosGerais)).toEqual(["Gerais 1 v2"]);

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

  it("planos ligados a um módulo vão para as sessões desse módulo, pela ordem", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Modulos");
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 });
    expect(c.statusCode, c.body).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    const comModulo = (ordem: number, gerais: string, modulo: string) => ({ ...plano(ordem, gerais), modulo });
    const ficha = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [comModulo(1, "M1 a", "M1 · Aprendizagem"), comModulo(2, "M1 b", "M1 · Aprendizagem"), comModulo(3, "M2 a", "M2 · Comunicação")] },
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    const s = (id: string, data: string, modulos: string[], modalidade = "presencial") => ({ id, data, horaInicio: "09:00", horaFim: "13:00", modalidade, modulos, formadores: [] });
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-08-01", nome: unico("TMOD"), curso,
      cronograma: [
        s("1", "2099-08-01", ["M2 · Comunicação e dinâmica de grupos · 20h"]),
        s("2", "2099-08-02", ["M1 · Aprendizagem e pedagogia · 20h"]),
        s("3", "2099-08-03", []),
        s("4", "2099-08-04", ["M1 · Aprendizagem e pedagogia · 20h"]),
      ],
    });
    expect(t.statusCode, t.body).toBe(200);
    const linhas = await planosDaTurma(ctx, t.json().turma.id as number);
    expect(linhas.filter(l => l.sessao_n != null).map(l => [l.sessao_n, l.plano?.objetivosGerais ?? null])).toEqual([[1, "M2 a"], [2, "M1 a"], [4, "M1 b"]]);
  });

  it("curso com planos: a turma nova começa sem sessões; cada sessão marcada com um plano recebe-o (as personalizadas não)", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Blearning");
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "B-learning", horas: 90 });
    expect(c.statusCode, c.body).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [{ ...plano(1, "P1"), modulos: ["M1 · X"], duracaoMin: 180 }, { ...plano(2, "P2"), modulos: ["M2 · Y"], duracaoMin: 240 }, plano(3, "P3")] },
    });
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-09-07", nome: unico("TBL"), curso, horario: "Pós Laboral" });
    expect(t.statusCode, t.body).toBe(200);
    const id = t.json().turma.id as number;
    expect(t.json().turma.cronograma).toEqual([]);
    const s = (sid: string, data: string, extra: Record<string, unknown> = {}) => ({ id: sid, data, horaInicio: "19:00", horaFim: "22:00", modalidade: "presencial", modulos: [], formadores: [], ...extra });
    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, {
      cronograma: [
        s("a", "2099-09-07", { planoOrdem: 2, modulos: ["M2 · Y"] }),
        s("b", "2099-09-08"),
        s("c", "2099-09-09", { planoOrdem: 1, modulos: ["M1 · X"] }),
        { id: "e", data: "2099-09-10", horaInicio: "", horaFim: "", modalidade: "auto", modulos: [], formadores: [] },
      ],
    });
    expect(r.statusCode, r.body).toBe(200);
    const linhas = await planosDaTurma(ctx, id);
    expect(linhas.filter(l => l.sessao_n != null && l.plano).map(l => [l.sessao_n, l.plano?.objetivosGerais ?? null])).toEqual([[1, "P2"], [3, "P1"]]);
  });

  it("turma nova com sessões sem módulo: cada sessão fica com o plano e o módulo do plano", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Herda Modulos");
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 });
    expect(c.statusCode, c.body).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    const comModulo = (ordem: number, gerais: string, modulo: string) => ({ ...plano(ordem, gerais), modulo });
    await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [comModulo(1, "P1", "M1 · Aprendizagem · 20h"), comModulo(2, "P2", "M2 · Comunicação · 20h"), comModulo(3, "P3", "M2 · Comunicação · 20h")] },
    });
    const s = (id: string, data: string, modalidade = "presencial") => ({ id, data, horaInicio: "09:00", horaFim: "13:00", modalidade, modulos: [], formadores: [] });
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-09-01", nome: unico("THM"), curso,
      cronograma: [s("1", "2099-09-01"), s("x", "2099-09-02", "auto"), s("2", "2099-09-03"), s("3", "2099-09-04"), s("4", "2099-09-05")],
    });
    expect(t.statusCode, t.body).toBe(200);
    const cron = t.json().turma.cronograma as { id: string; modalidade: string; modulos: string[] }[];
    expect(cron.filter(x => x.modalidade === "presencial").map(x => x.modulos)).toEqual([
      ["M1 · Aprendizagem · 20h"], ["M2 · Comunicação · 20h"], ["M2 · Comunicação · 20h"], [],
    ]);
    const linhas = await planosDaTurma(ctx, t.json().turma.id as number);
    expect(linhas.filter(l => l.sessao_n != null).map(l => [l.sessao_n, l.plano?.objetivosGerais ?? null])).toEqual([[1, "P1"], [2, "P2"], [3, "P3"]]);
  });

  it("auditoria: número antigo acertado, plano que sai fica sem plano e copiar de outra turma respeita os módulos", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Auditoria Planos");
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 });
    expect(c.statusCode, c.body).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, { payload: { planosSessao: [plano(1, "A1"), plano(2, "A2"), plano(3, "A3")] } });
    const s = (id: string, data: string, modulos: string[] = []) => ({ id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos, formadores: [] });
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-10-01", nome: unico("TAUD"), curso, cronograma: [s("a", "2099-10-01"), s("b", "2099-10-02"), s("c", "2099-10-03")] });
    const id = t.json().turma.id as number;
    const ns = async () => (await ctx.db.query<{ sessao_id: string; sessao_n: number | null; plano: { objetivosGerais?: string } | null }>(
      "SELECT sessao_id, sessao_n, plano FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 ORDER BY sessao_id", [id])).rows;

    // 1. Uma gravação com o número antigo (corrida com quem mexe na grelha) é acertada pela importação seguinte.
    await ctx.db.query("UPDATE turma_sessoes SET sessao_n = 1 WHERE regime = 'gold' AND turma_id = $1", [id]);
    await ctx.db.query("UPDATE turma_sessoes SET plano = plano || '{\"objetivosGerais\": \"mexido\"}'::jsonb WHERE regime = 'gold' AND turma_id = $1 AND sessao_id = 'c'", [id]);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${id}/planos/importar`, {})).statusCode).toBe(200);
    expect((await ns()).map(r => [r.sessao_id, r.sessao_n])).toEqual([["a", 1], ["b", 2], ["c", 3]]);

    // 4. Os planos passam a ir por módulo e a sessão «b» (sem módulo correspondente) deixa de ter plano: fica sem plano, não «{}».
    await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, { payload: { planosSessao: [{ ...plano(1, "A1"), modulo: "M1 · X" }] } });
    await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${id}/planos/importar`, {});
    const linhas = await ns();
    expect(linhas.find(r => r.sessao_id === "a")!.plano?.objetivosGerais).toBe("A1");
    expect(linhas.find(r => r.sessao_id === "b")!.plano).toBeNull();

    // 3. Copiar de outra turma: a sessão do M2 recebe o plano da sessão do M2 da origem, mesmo noutra posição.
    const origem = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-11-01", nome: unico("TORIG"), curso,
      cronograma: [s("o1", "2099-11-01", ["M2 · Y"]), s("o2", "2099-11-02", ["M1 · X"])],
    });
    const oId = origem.json().turma.id as number;
    await pedido(ctx, "secretaria", "PUT", `/v1/turmas/gold/${oId}/sessoes/1`, { plano: { objetivosGerais: "Plano do M2", objetivosEspecificos: "", momentos: plano(1, "").momentos } });
    const destino = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-12-01", nome: unico("TDEST"), curso,
      cronograma: [s("d1", "2099-12-01", ["M1 · X"]), s("d2", "2099-12-02", ["M2 · Y"])],
    });
    const dId = destino.json().turma.id as number;
    const imp = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${dId}/planos/importar`, { origemTurmaId: oId });
    expect(imp.statusCode, imp.body).toBe(200);
    const d = (await ctx.db.query<{ sessao_n: number; plano: { objetivosGerais?: string } | null }>(
      "SELECT sessao_n, plano FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 AND sessao_n IS NOT NULL ORDER BY sessao_n", [dId])).rows;
    expect(d.map(r => r.plano?.objetivosGerais ?? null)).toEqual(["A1", "Plano do M2"]);
  });

  it("a ficha com muitos planos grava (antes passava o limite de 32 KB com 4 ou 5 planos)", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Muitos Planos");
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 90 });
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    const texto = "Conteúdo da sessão com bastante texto. ".repeat(40);
    const planos = Array.from({ length: 30 }, (_, i) => {
      const p = plano(i + 1, `Objetivos ${i + 1} ${texto}`);
      p.momentos.desenvolvimento.conteudo = texto;
      return p;
    });
    const r = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, { payload: { planosSessao: planos } });
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
  });
});
