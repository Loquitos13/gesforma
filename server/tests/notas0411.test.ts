// Notas de 03-11 e 04-11: disponibilidade do formador por dia e datas indisponíveis (Bárbara); a ação de formação no
// pagamento (Lisete); «Enviar ligação por email» na ficha da pré-inscrição (Aguiar).
import { describe, expect, it } from "vitest";
import {
  alternarSlotNoDia, comDatasIndisponiveis, dataIndisponivel, entradaDisponibilidadeValida, sessaoCabeNoSlot, slotNoDia, slotsDoFormador,
} from "../../src/partilhado/disponibilidade.js";
import { arrancar, pedido } from "./helpers.js";

describe("disponibilidade do formador", () => {
  it("blocos por dia da semana e datas indisponíveis", () => {
    // Todos os blocos; desligar o laboral à terça deixa os outros quatro dias.
    let d = alternarSlotNoDia(null, "laboral", 2);
    expect(d).toEqual(expect.arrayContaining(["laboral@1", "laboral@3", "laboral@4", "laboral@5", "pos-laboral", "sabado-manha", "sabado-tarde"]));
    expect(d).not.toContain("laboral");
    expect(slotNoDia(d, "laboral", 2)).toBe(false);
    expect(slotNoDia(d, "laboral", 3)).toBe(true);
    // Voltar a ligar a terça junta os cinco dias no bloco inteiro.
    d = alternarSlotNoDia(d, "laboral", 2);
    expect(d).toContain("laboral");
    expect(d.some(v => v.startsWith("laboral@"))).toBe(false);

    // Só segunda e quarta no laboral (nota da Bárbara).
    let s: string[] = ["sabado-manha"];
    s = alternarSlotNoDia(s, "laboral", 1);
    s = alternarSlotNoDia(s, "laboral", 3);
    expect(slotsDoFormador(s)).toEqual(["laboral", "sabado-manha"]);
    // 2026-12-07 é segunda; 2026-12-08 terça.
    expect(sessaoCabeNoSlot("2026-12-07", "09:00", "13:00", s)).toBe(true);
    expect(sessaoCabeNoSlot("2026-12-08", "09:00", "13:00", s)).toBe(false);

    // Dia 10 de dezembro indisponível (e um período).
    s = comDatasIndisponiveis(s, [{ de: "2026-12-10", ate: "2026-12-10" }, { de: "2026-12-14", ate: "2026-12-16" }]);
    expect(s).toEqual(expect.arrayContaining(["fora:2026-12-10", "fora:2026-12-14..2026-12-16"]));
    expect(dataIndisponivel(s, "2026-12-10")).toBe(true);
    expect(dataIndisponivel(s, "2026-12-15")).toBe(true);
    expect(dataIndisponivel(s, "2026-12-17")).toBe(false);
    expect(sessaoCabeNoSlot("2026-12-14", "09:00", "13:00", s)).toBe(false);
    for (const v of s) expect(entradaDisponibilidadeValida(v)).toBe(true);
    expect(entradaDisponibilidadeValida("laboral@7")).toBe(false);
  });

  it("o servidor grava e filtra a disponibilidade nova", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", {
      nome: `Formador Disp ${Date.now()}`, email: "", regimes: ["gold"], disponibilidade: ["laboral@1", "laboral@3", "fora:2026-12-10"],
    });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formador.id as number;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${id}`, { disponibilidade: ["laboral@9"] })).statusCode).toBe(400);
    const lista = (await pedido(ctx, "secretaria", "GET", "/v1/formadores?disponibilidade=laboral&porPagina=200")).json();
    const linhas = (lista.formadores ?? lista.linhas ?? lista.items) as { id: number }[];
    expect(linhas.some(x => x.id === id)).toBe(true);
  });
});

describe("pagamento com a ação de formação e «Enviar ligação por email»", () => {
  it("o pagamento mostra a turma (local, horário, início); o comercial envia a ligação atual", async () => {
    const ctx = await arrancar();
    const curso = `Curso Notas ${Date.now()}`;
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 165, regime: "Presencial", horas: 8 })).statusCode).toBe(200);
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-12-21", nome: `CCP-LX-PL-${Date.now()}`, curso, local: "Lisboa", horario: "Pós-Laboral", vagas: 10, estado: "Ativa",
      cronograma: [{ id: "s1", data: "2099-12-21", horaInicio: "18:00", horaFim: "22:00", modalidade: "presencial", formadores: [] }],
    });
    expect(t.statusCode, t.body).toBe(200);
    const turma = t.json().turma as { id: number; nome: string };
    const email = `lisete.${Date.now()}@exemplo.pt`;
    expect((await ctx.app.inject({ method: "POST", url: "/v1/public/preinscricoes", payload: { nome: "Leonor", email, curso, turmaId: turma.id, consentimento: true } })).statusCode).toBe(200);
    const lead = (await ctx.db.query<{ id: number }>("SELECT id FROM preinscricoes WHERE email = $1", [email])).rows[0]!.id;

    // Pagamento ligado à pré-inscrição: a lista e o detalhe trazem a ação de formação.
    const pag = `PT-${Date.now()}`;
    await ctx.db.query("INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email) VALUES ($1, 'Leonor', 165, 'Transferência bancária', $2, '2026-11-03', 'Pendente', $3)", [pag, curso, email]);
    await ctx.db.query("UPDATE preinscricoes SET pagamento_id = $2, pagamento_turma_id = $3, pagamento_pedido_em = now() WHERE id = $1", [lead, pag, turma.id]);
    const det = (await pedido(ctx, "contabilidade", "GET", `/v1/pagamentos/${pag}`)).json().pagamento;
    expect(det).toMatchObject({ turma_nome: turma.nome, turma_local: "Lisboa", turma_horario: "Pós-Laboral" });
    expect(det.turma_inicio.slice(0, 10)).toBe("2099-12-21");

    // «Enviar ligação por email»: a mesma ligação (não muda) e fica no histórico.
    const antes = (await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [lead])).rows[0]!.docs_token;
    const r = await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${lead}/enviar-ligacao`);
    expect(r.statusCode, r.body).toBe(200);
    expect((await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [lead])).rows[0]!.docs_token).toBe(antes);
  });
});
