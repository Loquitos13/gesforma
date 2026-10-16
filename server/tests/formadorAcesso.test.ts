import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aplicarEvento, buildLinha, moverEvento, upsertCell } from "../../src/partilhado/cronogramaGrelha.js";
import type { SessaoCronograma } from "../../src/partilhado/turmaModel.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

const sessao = (id: string, data: string, formadores: string[]) => ({
  id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores,
});

/** Ficha de formador ligada à conta de teste "formador" (pelo email). */
async function fichaDoFormador(ctx: Ctx) {
  const conta = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
  const nome = unico("Formador Eu");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome, email: conta.rows[0]!.email, regimes: ["gold"] });
  expect(r.statusCode, r.body).toBe(200);
  return nome;
}

async function turmaGold(ctx: Ctx, cronograma: unknown[], curso = "Curso Sem Ficha") {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome: unico("FA"), curso, vagas: 10, cronograma });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().turma.id as number;
}

async function formando(ctx: Ctx, turmaId: number) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: unico("Rita"), email: `fa.${Date.now()}.${++seq}@exemplo.pt`, turmaId });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().formando.id as number;
}

describe("o formador com pedidos reais", () => {
  it("só mexe nas suas sessões e só vê as turmas atribuídas", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const outro = unico("Outro Formador");
    const minha = await turmaGold(ctx, [sessao("m1", "2099-06-01", [eu]), sessao("m2", "2099-06-02", [outro])]);
    const alheia = await turmaGold(ctx, [sessao("a1", "2099-06-03", [outro])]);
    const f = await formando(ctx, minha);
    const base = `/v1/turmas/gold/${minha}`;

    expect((await pedido(ctx, "formador", "GET", base)).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "GET", `/v1/turmas/gold/${alheia}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", `/v1/turmas/gold/${alheia}/pedagogia`)).statusCode).toBe(403);

    // Sessão 1 é dele; a 2 é de outro formador (só leitura).
    const plano = { objetivosGerais: "x", objetivosEspecificos: "", momentos: { introducao: {}, desenvolvimento: {}, conclusao: {} } };
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, { plano })).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/2`, { plano })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/2`, { presencas: [{ id: f, nome: "Rita", presente: true }] })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/2`, {
      sumario: { conteudos: "x", atividades: "", observacoes: "", assinado: false },
    })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", `${base}/pedagogia`)).statusCode).toBe(200);

    // Mudar a data de uma sessão (mesmo a sua) não é marcar início/fim.
    const mudado = [{ ...sessao("m1", "2099-06-05", [eu]) }, sessao("m2", "2099-06-02", [outro])];
    expect((await pedido(ctx, "formador", "PATCH", `/v1/turmas-gold/${minha}`, { cronograma: mudado })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "POST", `${base}/cronograma/publicar`, { sessoes: mudado })).statusCode).toBe(403);

    // Notas: só nas turmas atribuídas.
    const nota = { notas: [{ formandoId: f, moduloId: "", parametroId: "p1", nota: 12 }] };
    expect((await pedido(ctx, "formador", "PUT", `/v1/turmas/gold/${alheia}/avaliacao`, nota)).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", `/v1/turmas/gold/${alheia}/avaliacao`)).statusCode).toBe(403);
    // Na turma dele as notas são só leitura.
    expect((await pedido(ctx, "formador", "PUT", `${base}/avaliacao`, nota)).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", `${base}/avaliacao`)).statusCode).toBe(200);

    // Sumário e folha de presenças da sua sessão: sim.
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, {
      sumario: { conteudos: "x", atividades: "", observacoes: "", assinado: false },
    })).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, { presencas: [{ id: f, nome: "Rita", presente: true }] })).statusCode).toBe(200);

    // Nem as marcas de início/fim da sua própria sessão: o cronograma é só leitura.
    const marcado = [{ ...sessao("m1", "2099-06-01", [eu]), iniciadaEm: "2099-06-01T09:00" }, sessao("m2", "2099-06-02", [outro])];
    expect((await pedido(ctx, "formador", "PATCH", `/v1/turmas-gold/${minha}`, { cronograma: marcado })).statusCode).toBe(403);

    // Fecho, certificados, dossiê, documentos, importar planos e inscrições: fechado.
    expect((await pedido(ctx, "formador", "POST", `${base}/fecho`)).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/certificados/${f}`, { emitido: true })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/dtp/cronograma`, { estado: "ok" })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/documentos`, { grupoId: "g", label: "l", estado: "ok" })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "POST", `${base}/planos/importar`, {})).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "POST", "/v1/formandos-gold", { nome: "Novo", turmaId: minha })).statusCode).toBe(403);
  });

  it("plano da sua sessão: só quando o curso não o define", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const curso = unico("Curso Com Planos");
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 })).statusCode).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    const ficha = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { planosSessao: [{ ordem: 1, objetivosGerais: "Do curso", objetivosEspecificos: "", momentos: {} }] },
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    const id = await turmaGold(ctx, [sessao("c1", "2099-11-02", [eu]), sessao("c2", "2099-11-03", [eu])], curso);
    const base = `/v1/turmas/gold/${id}`;
    expect((await pedido(ctx, "formador", "GET", `${base}/pedagogia`)).json().planosDoCurso).toEqual([1]);
    const plano = { objetivosGerais: "meu", objetivosEspecificos: "", momentos: { introducao: {}, desenvolvimento: {}, conclusao: {} } };
    const recusado = await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, { plano });
    expect(recusado.statusCode).toBe(403);
    expect(recusado.json().error).toContain("ficha do curso");
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/2`, { plano })).statusCode).toBe(200);
    // A equipa continua a poder ajustar o plano vindo do curso.
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/1`, { plano })).statusCode).toBe(200);
  });
});

describe("sessões ligadas pelo id", () => {
  it("reordenar leva os dados com cada sessão; remover uma sessão com dados é recusado", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const outro = unico("Outro Formador");
    const cron = [sessao("s1", "2099-07-01", [eu]), sessao("s2", "2099-07-02", [outro]), sessao("s3", "2099-07-03", [])];
    const id = await turmaGold(ctx, cron);
    const base = `/v1/turmas/gold/${id}`;
    const sumario = (txt: string) => ({ sumario: { conteudos: txt, atividades: "", observacoes: "", assinado: false } });
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, sumario("da s1"))).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/2`, sumario("da s2"))).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/9`, sumario("x"))).statusCode).toBe(404);

    // Troca a ordem de s1 e s2: os números mudam, os sumários ficam com a sua sessão.
    const patch = (cronograma: unknown[]) => pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { cronograma });
    expect((await patch([cron[1], cron[0], cron[2]])).statusCode).toBe(200);
    const ped = (await pedido(ctx, "secretaria", "GET", `${base}/pedagogia`)).json().sessoes as { n: number; sessaoId: string; sumario: { conteudos: string } }[];
    expect(ped.map(s => [s.n, s.sessaoId, s.sumario.conteudos]).sort()).toEqual([[1, "s2", "da s2"], [2, "s1", "da s1"]]);

    // O formador continua a gravar a sua sessão (agora a 2.ª) e não a do outro, por n ou por id.
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/2`, sumario("ainda minha"))).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, sumario("não"))).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/2`, { sessaoId: "s2", ...sumario("não") })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", `${base}/sessoes/1`, { sessaoId: "s1", ...sumario("por id") })).statusCode).toBe(200);
    const s1 = await ctx.db.query<{ sessao_n: number; sumario: { conteudos: string } }>(
      "SELECT sessao_n, sumario FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 AND sessao_id = 's1'", [id]);
    expect(s1.rows[0]).toMatchObject({ sessao_n: 2, sumario: { conteudos: "por id" } });

    // Remover, ou passar a não lectiva, uma sessão com sumário: 409. Remover uma sem dados passa.
    expect((await patch([cron[1], cron[2]])).statusCode).toBe(409);
    expect((await patch([cron[1], { ...cron[0], modalidade: "auto" }, cron[2]])).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "POST", `${base}/cronograma/publicar`, { sessoes: [cron[0], cron[2]] })).statusCode).toBe(409);
    expect((await patch([cron[1], { ...cron[0], data: "2099-07-09" }])).statusCode).toBe(200);
  });

  it("a migração liga as linhas antigas ao id da sessão na sua posição e deixa as órfãs sem sessão", async () => {
    const ctx = await arrancar();
    const id = await turmaGold(ctx, [sessao("a", "2099-08-01", [])]);
    // Estado antigo: cronograma com uma sessão lectiva sem id e linhas só com sessao_n.
    const antigo = [
      { data: "2099-08-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial" },
      { id: "x", data: "2099-08-02", modalidade: "auto" },
      { id: "b", data: "2099-08-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "sincrona" },
    ];
    await ctx.db.query("UPDATE turmas_gold SET cronograma = $2::jsonb WHERE id = $1", [id, JSON.stringify(antigo)]);
    await ctx.db.query("DELETE FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1", [id]);
    for (const n of [1, 2, 5]) {
      await ctx.db.query(
        "INSERT INTO turma_sessoes (regime, turma_id, sessao_n, sumario) VALUES ('gold', $1, $2, $3::jsonb)",
        [id, n, JSON.stringify({ conteudos: `n${n}` })],
      );
    }
    const sql = readFileSync(fileURLToPath(new URL("../src/db/migrations/123_sessoes_por_id.sql", import.meta.url)), "utf8");
    for (const parte of sql.split(/;\s*\n/).map(x => x.trim()).filter(Boolean)) await ctx.db.query(parte);

    const cronograma = (await ctx.db.query<{ cronograma: { id: string }[] }>("SELECT cronograma FROM turmas_gold WHERE id = $1", [id])).rows[0]!.cronograma;
    expect(cronograma[0]!.id).toBe(`mig-${id}-1`);
    const linhas = await ctx.db.query<{ sessao_id: string | null; sessao_n: number | null; sessao_n_orfa: number | null; sumario: { conteudos: string } }>(
      "SELECT sessao_id, sessao_n, sessao_n_orfa, sumario FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 ORDER BY sumario->>'conteudos'", [id]);
    expect(linhas.rows.map(r => [r.sumario.conteudos, r.sessao_id, r.sessao_n, r.sessao_n_orfa])).toEqual([
      ["n1", `mig-${id}-1`, 1, null], ["n2", "b", 2, null], ["n5", null, null, 5],
    ]);
  });
});

describe("grelha do cronograma", () => {
  it("a grelha substitui e move sessões no mesmo lugar", () => {
    const manha = buildLinha("presencial", "09:00", "13:00");
    const tarde = buildLinha("presencial", "14:00", "18:00");
    const s = (id: string, data: string): SessaoCronograma => ({ id, data, horaInicio: "09:00", horaFim: "13:00", modulos: [], formadores: [], modalidade: "presencial" });
    const lista = [s("a", "2099-01-05"), s("b", "2099-01-06"), s("c", "2099-01-07")];
    expect(upsertCell(lista, "2099-01-05", manha, { modulos: ["M1"] }).map(x => x.id)).toEqual(["a", "b", "c"]);
    expect(moverEvento(lista, "2099-01-05", manha, "2099-01-09", tarde).map(x => [x.id, x.data, x.horaInicio])).toEqual([
      ["a", "2099-01-09", "14:00"], ["b", "2099-01-06", "09:00"], ["c", "2099-01-07", "09:00"],
    ]);
    expect(aplicarEvento(lista, "2099-01-06", tarde, { modulos: [] }, manha).map(x => [x.id, x.horaInicio])).toEqual([
      ["a", "09:00"], ["b", "14:00"], ["c", "09:00"],
    ]);
  });
});

describe("notas da turma", () => {
  it("gravar parte da grelha não apaga as outras; null apaga só essa célula", async () => {
    const ctx = await arrancar();
    const id = await turmaGold(ctx, [sessao("n1", "2099-08-01", [])]);
    const f = await formando(ctx, id);
    const url = `/v1/turmas/gold/${id}/avaliacao`;
    const cel = (parametroId: string, nota: number | null) => ({ formandoId: f, moduloId: "", parametroId, nota });
    expect((await pedido(ctx, "secretaria", "PUT", url, { notas: [cel("p1", 12), cel("p2", 14)] })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", url, { notas: [cel("p3", 9)] })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", url, { notas: [cel("p2", null), cel("p1", 13)] })).statusCode).toBe(200);
    const notas = (await pedido(ctx, "secretaria", "GET", url)).json().notas as { parametroId: string; nota: number }[];
    expect(notas.map(n => [n.parametroId, n.nota]).sort()).toEqual([["p1", 13], ["p3", 9]]);
    // Escala por omissão: 0 a 20.
    expect((await pedido(ctx, "secretaria", "PUT", url, { notas: [cel("p1", 21)] })).statusCode).toBe(400);
  });

  it("valida contra a escala do curso (0 a 100 %)", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Percentagem");
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 })).statusCode).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [curso])).rows[0]!.id;
    const ficha = await pedido(ctx, "secretaria", "PUT", `/v1/cursos/gold/${cursoId}/ficha`, {
      payload: { avaliacaoCurso: { modo: "final", escalaMin: 0, escalaMax: 100, unidade: "%", minimoAprovacao: 50, pesosEquitativos: true, parametros: [{ id: "p1", label: "Teste", peso: 1 }] } },
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    const id = await turmaGold(ctx, [sessao("e1", "2099-09-01", [])], curso);
    const f = await formando(ctx, id);
    const url = `/v1/turmas/gold/${id}/avaliacao`;
    expect((await pedido(ctx, "secretaria", "PUT", url, { notas: [{ formandoId: f, moduloId: "", parametroId: "p1", nota: 85 }] })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", url, { notas: [{ formandoId: f, moduloId: "", parametroId: "p1", nota: 101 }] })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "PUT", `/v1/turmas/gold/${id}/certificados/${f}`, { nota: 120 })).statusCode).toBe(400);
  });
});

describe("PDFs gerados do dossiê", () => {
  it("gerar de novo substitui a cópia anterior em vez de acumular", async () => {
    const ctx = await arrancar();
    const nome = unico("FIN-PDF");
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
      dataInicio: "2099-10-05", nome, curso: "UFCD Teste", horas: 3,
      cronograma: [{ id: "f1", data: "2099-10-05", horaInicio: "19:00", horaFim: "22:00", modalidade: "presencial", formadores: [] }],
    });
    expect(t.statusCode, t.body).toBe(200);
    const id = t.json().turma.id as number;
    for (let i = 0; i < 2; i++) expect((await pedido(ctx, "secretaria", "GET", `/v1/turmas/fin/${id}/relatorio-final`)).statusCode).toBe(200);
    const n = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM drive_files WHERE turma = $1 AND label = 'relatorio'", [nome]);
    expect(n.rows[0]!.n).toBe(1);
  });
});
