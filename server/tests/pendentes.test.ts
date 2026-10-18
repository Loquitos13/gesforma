import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;
const sessao = (id: string, data: string) => ({ id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] });

async function turmaGold(ctx: Ctx, cronograma: unknown[], curso: string) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome: unico("TP"), curso, vagas: 10, cronograma });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().turma.id as number;
}

describe("Pedidos de proposta no backoffice", () => {
  it("ficam numa lista com estado, só para a administração, e avisam no sino enquanto estão por tratar", async () => {
    const ctx = await arrancar();
    const email = `compras.${Date.now()}@empresa.pt`;
    expect((await ctx.app.inject({ method: "POST", url: "/v1/public/pedidos-proposta", payload: { nome: "Rui", empresa: "Empresa P", email, servico: "Formação à medida" } })).statusCode).toBe(200);
    const novos = (await pedido(ctx, "admin", "GET", "/v1/pedidos-proposta?estado=novo")).json().pedidos as { id: number; email: string; clienteId: number | null }[];
    const meu = novos.find(p => p.email === email)!;
    expect(meu.clienteId).toBeTruthy();
    expect((await pedido(ctx, "admin", "GET", "/v1/notificacoes")).json().notificacoes.some((n: { titulo: string }) => /pedido\(s\) de proposta/.test(n.titulo))).toBe(true);
    expect((await pedido(ctx, "comercial", "GET", "/v1/pedidos-proposta")).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "PATCH", `/v1/pedidos-proposta/${meu.id}`, { estado: "contactado" })).statusCode).toBe(200);
    expect(((await pedido(ctx, "admin", "GET", "/v1/pedidos-proposta?estado=contactado")).json().pedidos as { id: number }[]).some(p => p.id === meu.id)).toBe(true);
    expect((await pedido(ctx, "admin", "PATCH", `/v1/pedidos-proposta/${meu.id}`, { estado: "inventado" })).statusCode).toBe(400);
  });
});

describe("CRM › Clientes por período", () => {
  it("filtra pela data em que o cliente entrou", async () => {
    const ctx = await arrancar();
    const nome = unico("Cliente Antigo");
    await ctx.db.query("INSERT INTO crm_clientes (nome, created_at) VALUES ($1, '2020-01-15')", [nome]);
    const ver = async (q: string) => ((await pedido(ctx, "admin", "GET", `/v1/crm/clientes?q=${encodeURIComponent(nome)}${q}`)).json().linhas as { nome: string }[]).length;
    expect(await ver("&de=2020-01-01&ate=2020-01-31")).toBe(1);
    expect(await ver("&ate=2020-01-15")).toBe(1);
    expect(await ver("&de=2021-01-01")).toBe(0);
    expect((await pedido(ctx, "admin", "GET", "/v1/crm/clientes?de=ontem")).statusCode).toBe(400);
  });
});

describe("Turma padrão", () => {
  it("copia de outra turma do mesmo curso os planos e os sumários (conteúdos e atividades), sem assinaturas nem observações", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Padrão");
    const padrao = await turmaGold(ctx, [sessao("a1", "2099-07-01"), sessao("a2", "2099-07-02")], curso);
    const nova = await turmaGold(ctx, [sessao("b1", "2099-08-01"), sessao("b2", "2099-08-02")], curso);
    const outroCurso = await turmaGold(ctx, [sessao("c1", "2099-08-01")], unico("Outro Curso"));
    const plano = { objetivosGerais: "Conhecer o tema", objetivosEspecificos: "", momentos: { introducao: {}, desenvolvimento: { conteudo: "Exposição" }, conclusao: {} } };
    const base = `/v1/turmas/gold/${padrao}`;
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/1`, { plano })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/1`, { sumario: { conteudos: "Tema 1", atividades: "Exercício", observacoes: "Só desta turma", assinado: true } })).statusCode).toBe(200);

    const origens = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${nova}/planos/origens`)).json().turmas as { id: number }[];
    expect(origens.map(t => t.id)).toContain(padrao);
    expect(origens.map(t => t.id)).not.toContain(outroCurso);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${nova}/planos/importar`, { origemTurmaId: outroCurso })).statusCode).toBe(400);

    const r = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${nova}/planos/importar`, { origemTurmaId: padrao });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ importados: 1, sumarios: 1 });
    const sessoes = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${nova}/pedagogia`)).json().sessoes as { sessaoId: string; plano: { objetivosGerais: string } | null; sumario: { conteudos: string; atividades: string; observacoes?: string; assinado: boolean } | null }[];
    const b1 = sessoes.find(s => s.sessaoId === "b1")!;
    expect(b1.plano?.objetivosGerais).toBe("Conhecer o tema");
    expect(b1.sumario).toMatchObject({ conteudos: "Tema 1", atividades: "Exercício", assinado: false });
    expect(b1.sumario?.observacoes ?? "").toBe("");
  });
});

describe("Cronograma público", () => {
  it("leva a «Data de fim» da turma, mesmo depois da última sessão", async () => {
    const ctx = await arrancar();
    const id = await turmaGold(ctx, [sessao("s1", "2099-07-01"), { id: "fim-cronograma", data: "2099-12-23", horaInicio: "", horaFim: "", modulos: [], formadores: [], modalidade: "auto" }], unico("Curso Fim"));
    const r = (await ctx.app.inject({ method: "GET", url: `/v1/public/cronograma/gold/${id}` })).json();
    expect(r.fim).toBe("2099-12-23");
    expect(r.sessoes).toHaveLength(1);
  });
});
