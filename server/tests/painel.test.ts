import { describe, expect, it, beforeAll } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Curso só destes testes: os filtros isolam-no dos dados de demonstração do seed.
const CURSO = "Painel Teste Estatisticas";
const Q = `curso=${encodeURIComponent(CURSO)}&de=2026-03-01&ate=2026-03-31`;

type Painel = {
  kpis: { id: string; valor: number | null; anterior: number | null }[];
  serie: { chave: string; valor: number; stats: { id: string; valor: number }[]; porCurso: { nome: string; valor: number }[]; conheceu: { rotulo: string; n: number }[] }[];
  funil: { principal: { id: string; n: number }[] };
  conheceu: { rotulo: string; n: number }[];
  proximasTurmas: { id: number; ocupadas: number; reservas: number; capacidade: number }[];
  desagregacao: { eixo: string; linhas: { chave: string; pre: number; formandos: number; receita: number }[] };
  metodos: { metodo: string; valor: number }[] | null;
  porReceber: { valor: number; n: number } | null;
  aTratar: { id: string; n: number }[];
  turmasEmCurso: unknown[] | null;
};

let ctx: Ctx;

async function lead(id: number, inscrito: string, extra: Record<string, unknown> = {}) {
  const d = { regime: "gold", origem: "Google", estado: "Não contactado", contactado_em: null, validada_em: null, turma_escolhida_id: null, ...extra };
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, origem, regime, contactado_em, validada_em, turma_escolhida_id, local, horario)
     VALUES ($1, $2, 'Teste', $3, $4, $5, $6, $7, $8, $9, $10, 'Porto', 'Pós-laboral')`,
    [id, inscrito, `lead${id}@exemplo.pt`, CURSO, d.estado, d.origem, d.regime, d.contactado_em, d.validada_em, d.turma_escolhida_id],
  );
}

async function pagamento(id: string, data: string, valor: number, estado = "Pago") {
  await ctx.db.query(
    "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email) VALUES ($1, 'Teste', $2, 'Transferência', $3, $4, $5, '')",
    [id, valor, CURSO, data, estado],
  );
}

beforeAll(async () => {
  ctx = await arrancar();
  // Pré-inscrições Gold: 3 no período, 2 no período anterior, 1 no mesmo mês do ano passado, 1 fora da janela de 24 meses.
  await lead(990001, "2026-03-02 10:00", { contactado_em: "2026-03-03T10:00:00Z" });
  await lead(990002, "2026-03-10 10:00");
  await lead(990003, "2026-03-20 10:00", { origem: "Instagram" });
  await lead(990004, "2026-02-05 10:00");
  await lead(990005, "2026-02-20 10:00");
  await lead(990006, "2025-03-15 10:00", { origem: "Facebook" });
  await lead(990007, "2024-03-15 10:00");
  // Financiada com o mesmo curso: não pode aparecer no painel Gold.
  await lead(990011, "2026-03-04 10:00", { regime: "fin", origem: "IEFP", validada_em: "2026-03-12T10:00:00Z" });
  await lead(990012, "2026-03-06 10:00", { regime: "fin", origem: "IEFP" });

  await ctx.db.query(
    `INSERT INTO formandos_gold (id, nome, email, inscrito, curso, local, estado) VALUES
       (990101, 'F1', 'f1@exemplo.pt', '2026-03-05 10:00', $1, 'Porto', 'Formando'),
       (990102, 'F2', 'f2@exemplo.pt', '2026-02-15 10:00', $1, 'Porto', 'Formando')`,
    [CURSO],
  );
  await pagamento("pt-1", "2026-03-10", 100);
  await pagamento("pt-2", "2026-03-20", 50);
  await pagamento("pt-3", "2026-02-20", 80);
  await pagamento("pt-4", "2025-03-15", 40);
  await pagamento("pt-5", "2026-03-22", 30, "Pendente");

  // Próxima turma: 1 formando e 1 reserva (pré-inscrição validada sem ficha).
  await ctx.db.query(
    `INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario, vagas, estado) VALUES (990201, '2099-01-10', 'Turma Painel', $1, 'Porto', 'Pós-laboral', 10, 'Ativa')`,
    [CURSO],
  );
  await ctx.db.query(
    "INSERT INTO formandos_gold (id, nome, email, inscrito, curso, turma_id, estado) VALUES (990103, 'F3', 'f3@exemplo.pt', '2024-01-05', $1, 990201, 'Formando')",
    [CURSO],
  );
  await lead(990008, "2024-01-05 10:00", { validada_em: "2024-01-10T10:00:00Z", turma_escolhida_id: 990201, estado: "Pago" });
});

describe("GET /v1/painel/:regime", () => {
  it("indicadores Gold com o período anterior equivalente", async () => {
    const r = await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?${Q}`);
    expect(r.statusCode).toBe(200);
    const p = r.json() as Painel;
    const kpi = (id: string) => p.kpis.find(k => k.id === id)!;
    expect(kpi("pre")).toMatchObject({ valor: 3, anterior: 2 });
    expect(kpi("formandos")).toMatchObject({ valor: 1, anterior: 1 });
    expect(kpi("receita")).toMatchObject({ valor: 150, anterior: 80 });
    expect(kpi("conversao").valor).toBeCloseTo(33.3, 1);
    expect(kpi("conversao").anterior).toBe(50);
  });

  it("série de 24 meses com detalhe por curso e por origem", async () => {
    const p = (await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?${Q}`)).json() as Painel;
    expect(p.serie).toHaveLength(24);
    expect(p.serie[0]!.chave).toBe("2024-04");
    const marco = p.serie[23]!;
    expect(marco.chave).toBe("2026-03");
    expect(marco.valor).toBe(150);
    expect(marco.stats.find(s => s.id === "pre")!.valor).toBe(3);
    expect(marco.porCurso).toEqual([{ nome: CURSO, valor: 150 }]);
    expect(marco.conheceu).toEqual([{ rotulo: "Google", n: 2 }, { rotulo: "Instagram", n: 1 }]);
    const anoPassado = p.serie[11]!;
    expect(anoPassado.chave).toBe("2025-03");
    expect(anoPassado.valor).toBe(40);
    expect(anoPassado.conheceu).toEqual([{ rotulo: "Facebook", n: 1 }]);
    // A pré-inscrição de 2024-03 fica fora da janela.
    expect(p.serie.reduce((s, m) => s + (m.stats.find(x => x.id === "pre")?.valor ?? 0), 0)).toBe(6);
  });

  it("funil, origens, métodos e por receber", async () => {
    const p = (await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?${Q}`)).json() as Painel;
    expect(p.funil.principal.find(e => e.id === "pre")!.n).toBe(3);
    expect(p.funil.principal.find(e => e.id === "contactadas")!.n).toBe(1);
    expect(p.conheceu.map(c => [c.rotulo, c.n])).toEqual([["Google", 2], ["Instagram", 1]]);
    expect(p.metodos).toEqual([{ metodo: "Transferência", valor: 150, n: 2 }]);
    expect(p.porReceber).toEqual({ valor: 30, n: 1 });
  });

  it("desagregação por local junta pré-inscrições, formandos e receita", async () => {
    const p = (await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?${Q}&eixo=local`)).json() as Painel;
    expect(p.desagregacao.eixo).toBe("local");
    expect(p.desagregacao.linhas.find(l => l.chave === "Porto")).toMatchObject({ pre: 3, formandos: 1 });
  });

  it("próximas turmas contam formandos e reservas; a tratar hoje", async () => {
    const p = (await pedido(ctx, "secretaria", "GET", `/v1/painel/gold?${Q}`)).json() as Painel;
    expect(p.proximasTurmas.find(t => t.id === 990201)).toMatchObject({ ocupadas: 1, reservas: 1, capacidade: 10 });
    const tarefa = (id: string) => p.aTratar.find(t => t.id === id)!.n;
    expect(tarefa("contactar")).toBe(6);
    expect(tarefa("semFicha")).toBe(1);
  });

  it("os regimes não se misturam", async () => {
    const rf = await pedido(ctx, "financiada", "GET", `/v1/painel/fin?${Q}`);
    expect(rf.statusCode).toBe(200);
    const fin = rf.json() as Painel;
    expect(fin.kpis.find(k => k.id === "pre")!.valor).toBe(2);
    expect(fin.kpis.find(k => k.id === "validadas")!.valor).toBe(1);
    expect(fin.serie[23]!.valor).toBe(1);
    expect(fin.conheceu).toEqual([{ rotulo: "IEFP", n: 2, convertidas: 1 }]);
    expect(fin.metodos).toBeNull();
    expect(Array.isArray(fin.turmasEmCurso)).toBe(true);
  });

  it("datas inválidas dão 400", async () => {
    const r = await pedido(ctx, "secretaria", "GET", "/v1/painel/gold?de=13-03-2026");
    expect(r.statusCode).toBe(400);
  });

  it("cada perfil só vê o painel do seu trabalho", async () => {
    const estado = async (perfil: Parameters<typeof pedido>[1], regime: string) =>
      (await pedido(ctx, perfil, "GET", `/v1/painel/${regime}`)).statusCode;
    expect(await estado("admin", "gold")).toBe(200);
    expect(await estado("admin", "fin")).toBe(200);
    expect(await estado("secretaria", "fin")).toBe(200);
    expect(await estado("comercial", "gold")).toBe(200);
    expect(await estado("comercial", "fin")).toBe(403);
    expect(await estado("financiada", "fin")).toBe(200);
    expect(await estado("financiada", "gold")).toBe(403);
    expect(await estado("formador", "gold")).toBe(403);
    expect(await estado("formando", "gold")).toBe(403);
    expect(await estado(null, "gold")).toBe(401);
  });
});

describe("notificações", () => {
  it("lista e marca como lidas", async () => {
    const r = await pedido(ctx, "secretaria", "GET", "/v1/notificacoes");
    expect(r.statusCode).toBe(200);
    const { notificacoes } = r.json() as { notificacoes: { chave: string; lida: boolean }[] };
    const pend = notificacoes.find(n => n.chave.startsWith("pagamentos-pendentes-"));
    expect(pend).toBeTruthy();
    expect((await pedido(ctx, "secretaria", "POST", "/v1/notificacoes/lidas", { chaves: [pend!.chave] })).statusCode).toBe(200);
    const depois = (await pedido(ctx, "secretaria", "GET", "/v1/notificacoes")).json() as { notificacoes: { chave: string; lida: boolean }[] };
    expect(depois.notificacoes.find(n => n.chave === pend!.chave)!.lida).toBe(true);
  });

  it("o formador não vê avisos de pagamentos", async () => {
    const r = await pedido(ctx, "formador", "GET", "/v1/notificacoes");
    expect(r.statusCode).toBe(200);
    const { notificacoes } = r.json() as { notificacoes: { view: string }[] };
    expect(notificacoes.some(n => n.view === "pagamentos")).toBe(false);
  });

  it("pedido inválido dá 400", async () => {
    expect((await pedido(ctx, "secretaria", "POST", "/v1/notificacoes/lidas", { chaves: "x" })).statusCode).toBe(400);
  });
});

