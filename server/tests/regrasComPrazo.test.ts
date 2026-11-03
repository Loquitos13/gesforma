// Regras com prazo (dias configuráveis em cada regra) e avisos internos: põem na fila o email certo, uma só vez.
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daqui = (dias: number) => iso(new Date(Date.now() + dias * 86_400_000));

describe("regras com prazo", () => {
  it("matrícula, pagamento sem comprovativo e integração: cada pessoa recebe uma vez; os dias vêm da regra", async () => {
    const ctx = await arrancar();
    const { enviarRegrasComPrazo } = await import("../src/regrasAgendadas.js");
    const filaDe = async (chave: string) => (await ctx.db.query<{ to_email: string }>(
      `SELECT j.to_email FROM email_jobs j JOIN email_rules r ON r.id = j.rule_id WHERE r.trigger_key = $1 ORDER BY j.created_at`, [chave])).rows.map(r => r.to_email);

    // Turma com a matrícula daqui a 5 dias; a regra passa a 5 dias (por omissão eram 2).
    const turma = ((await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: daqui(12), nome: `PRAZO ${Date.now()}`, curso: "Curso Prazo", local: "Porto", horario: "Laboral", vagas: 10,
    })).json() as { turma: { id: number } }).turma.id;
    await ctx.db.query("UPDATE turmas_gold SET cronograma = $2::jsonb WHERE id = $1", [turma, JSON.stringify([
      { id: "matricula", data: daqui(5), modalidade: "matricula", horaInicio: "", horaFim: "", modulos: [], formadores: [] },
      { id: "s1", data: daqui(12), horaInicio: "09:00", horaFim: "13:00", modulos: [], formadores: [] },
    ])]);
    await ctx.db.query("UPDATE email_rules SET dias = 5 WHERE trigger_key = 'matricula.antes_limite'");
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, turma_id)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Rui', 'rui.prazo@exemplo.pt', 'Curso Prazo', 'Não contactado', 'gold', $1)`, [turma]);
    // Pagamento pedido há 3 dias, sem comprovativo.
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, pagamento_pedido_em)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Eva', 'eva.paga@exemplo.pt', 'Curso Prazo', 'Pré-inscrição', 'gold', now() - interval '3 days')`);

    await enviarRegrasComPrazo(ctx.db);
    await enviarRegrasComPrazo(ctx.db);
    expect(await filaDe("matricula.antes_limite")).toEqual(["rui.prazo@exemplo.pt"]);
    expect(await filaDe("pagamento.sem_comprovativo")).toEqual(["eva.paga@exemplo.pt"]);
  });

  it("formador atribuído a uma turma recebe o aviso uma vez", async () => {
    const ctx = await arrancar();
    const email = `formador.aviso.${Date.now()}@exemplo.pt`;
    await ctx.db.query("INSERT INTO formadores (id, nome, email) VALUES (nextval('ops_id_seq')::int, 'Formador Aviso', $1)", [email]);
    const criar = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: daqui(30), nome: `AVISO ${Date.now()}`, curso: "Curso Aviso", local: "Porto", horario: "Laboral", vagas: 10,
    });
    const id = (criar.json() as { turma: { id: number } }).turma.id;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { formadores: ["Formador Aviso"] })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { formadores: ["Formador Aviso"] })).statusCode).toBe(200);
    const jobs = (await ctx.db.query("SELECT 1 FROM email_jobs WHERE to_email = $1", [email])).rows;
    expect(jobs.length).toBe(1);
  });
});
