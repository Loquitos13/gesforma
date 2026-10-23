import { describe, expect, it } from "vitest";
import { assiduidadeDoFormando, sessoesComHoras } from "../src/assiduidade.js";
import { feriadosNacionais, generateCronograma } from "../src/cronograma.js";
import { parseRegras, validarDefinicoes } from "../src/regrasConfig.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const cron = [
  { id: "a", data: "2026-01-05", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: ["Rui"] },
  { id: "x", data: "2026-01-06", horaInicio: "09:00", horaFim: "11:00", modalidade: "auto", formadores: [] },
  { id: "b", data: "2026-01-07", horaInicio: "09:00", horaFim: "15:00", modalidade: "presencial", formadores: ["Rui", "Ana"] },
];

describe("assiduidade em horas", () => {
  it("usa a sessão lectiva n e as horas da sessão", () => {
    const sessoes = sessoesComHoras(cron, [
      { sessao_n: 1, presencas: [{ id: 1, presente: true }] },
      { sessao_n: 2, presencas: [{ id: 1, presente: false, estado: "falta_justificada" }] },
    ]);
    expect(sessoes.map(s => s.horas)).toEqual([4, 6]);
    const sem = assiduidadeDoFormando({ id: 1 }, sessoes, { justificadasContam: false });
    expect(sem).toMatchObject({ horasPrevistas: 10, horasPresente: 4, horasFaltaJustificada: 6, pct: 40 });
    expect(assiduidadeDoFormando({ id: 1 }, sessoes, { justificadasContam: true }).pct).toBe(100);
  });

  it("atraso desconta minutos; folha antiga com boolean continua a valer", () => {
    const sessoes = sessoesComHoras(cron, [
      { sessao_n: 1, presencas: [{ id: 1, presente: true, estado: "atraso", minutos: 60 }] },
      { sessao_n: 2, presencas: [{ id: 1, presente: false }] },
    ]);
    const a = assiduidadeDoFormando({ id: 1 }, sessoes, { justificadasContam: false });
    expect(a.horasPresente).toBe(3);
    expect(a.horasFaltaInjustificada).toBe(7);
  });
});

describe("cronograma", () => {
  it("feriados nacionais, incluindo os móveis", () => {
    const f = feriadosNacionais(2026);
    expect(f.has("2026-04-03")).toBe(true); // Sexta-feira Santa
    expect(f.has("2026-06-04")).toBe(true); // Corpo de Deus
    expect(f.has("2026-12-25")).toBe(true);
  });

  it("gera as horas todas do curso e salta feriados", () => {
    const s = generateCronograma({ inicio: "2026-11-30", horario: "Pós Laboral", horas: 50, formador: "" });
    const minutos = s.reduce((acc, x) => {
      const [a, b] = [x.horaInicio, x.horaFim].map(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
      return acc + (b - a);
    }, 0);
    expect(minutos / 60).toBe(50);
    expect(s.some(x => x.data === "2026-12-01" || x.data === "2026-12-08")).toBe(false);
    expect(s.every(x => x.modulos.length === 0)).toBe(true);
  });
});

describe("regras configuráveis", () => {
  it("valores por omissão e validação", () => {
    expect(parseRegras({})).toMatchObject({ assiduidadeMinFin: 90, assiduidadeMinGold: 75 });
    expect(validarDefinicoes("regras_pedagogicas", { assiduidadeMinFin: "120" }).ok).toBe(false);
    expect(validarDefinicoes("entidade", { nif: "123" }).ok).toBe(false);
  });
});

async function preparar(ctx: Ctx) {
  const nome = `PED-${Date.now()}`;
  const turma = (await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2026-01-05", nome, curso: "Curso Sem Ficha", vagas: 10,
    cronograma: [
      { id: "p1", data: "2026-01-05", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      { id: "p2", data: "2026-01-06", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
    ],
  })).json().turma as { id: number };
  const f = (await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Rita", email: `rita.${Date.now()}@exemplo.pt`, turmaId: turma.id })).json().formando as { id: number };
  return { turma, f };
}

describe("certificado e fecho", () => {
  it("regras só para o admin", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "secretaria", "PUT", "/v1/settings/regras_pedagogicas", { values: { assiduidadeMinGold: "50" } })).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "PUT", "/v1/settings/regras_pedagogicas", { values: { assiduidadeMinGold: "150" } })).statusCode).toBe(400);
  });

  it("assiduidade insuficiente bloqueia o certificado; fecho exige sessões fechadas; turma fechada fica trancada", async () => {
    const ctx = await arrancar();
    await pedido(ctx, "admin", "PUT", "/v1/settings/regras_pedagogicas", { values: { justificadasContam: "0" } });
    const { turma, f } = await preparar(ctx);
    const base = `/v1/turmas/gold/${turma.id}`;
    await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/1`, { presencas: [{ id: f.id, nome: "Rita", presente: true }] });
    await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/2`, { presencas: [{ id: f.id, nome: "Rita", presente: false, estado: "falta_justificada" }] });

    const recusado = await pedido(ctx, "secretaria", "PUT", `${base}/certificados/${f.id}`, { emitido: true, elearning: 80 });
    expect(recusado.statusCode).toBe(409);
    expect(recusado.json().motivos.join(" ")).toContain("Assiduidade 50%");

    await pedido(ctx, "admin", "PUT", "/v1/settings/regras_pedagogicas", { values: { justificadasContam: "1" } });
    const res = (await pedido(ctx, "secretaria", "GET", `${base}/resultados`)).json();
    expect(res.formandos[0]).toMatchObject({ id: f.id, elegivel: true, aprovado: true });
    expect(res.fecho.pode).toBe(false);
    expect(res.fecho.falta.join(" ")).toContain("sumário por assinar");

    for (const n of [1, 2]) {
      const r = await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/${n}`, {
        sumario: { conteudos: "ok", atividades: "", observacoes: "", assinado: true, presencasValidadas: true },
      });
      expect(r.statusCode).toBe(200);
    }
    expect((await pedido(ctx, "secretaria", "POST", `${base}/fecho`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/1`, { presencas: [] })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Novo", turmaId: turma.id })).statusCode).toBe(409);
    // Turma fechada: só o administrador mexe nos certificados.
    expect((await pedido(ctx, "secretaria", "PUT", `${base}/certificados/${f.id}`, { emitido: true })).statusCode).toBe(409);
    expect((await pedido(ctx, "admin", "PUT", `${base}/certificados/${f.id}`, { emitido: true })).statusCode).toBe(200);

    expect((await pedido(ctx, "secretaria", "POST", `${base}/reabrir`, { motivo: "x" })).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "POST", `${base}/reabrir`, {})).statusCode).toBe(400);
    expect((await pedido(ctx, "admin", "POST", `${base}/reabrir`, { motivo: "Corrigir presença" })).statusCode).toBe(200);
    await pedido(ctx, "admin", "PUT", "/v1/settings/regras_pedagogicas", { values: {} });
  });
});
