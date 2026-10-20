import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agoraLisboa, diaDeCarimbo, diaLisboa, fmtDataHoraLisboa, fmtDataLisboa, fmtStampLisboa, hojeLisboa, horaLisboa,
  inicioMes, instanteLisboa, lerInstante, mesLisboa, somarDias, stampLisboa,
} from "../src/datas.js";
import { periodo } from "../src/repos/sql.js";
import { sumarioComRegras } from "../src/sessaoRegras.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Verão: 23:30 UTC de 31/07 já é 00:30 de 01/08 em Lisboa (UTC+1).
const VERAO = new Date("2026-07-31T23:30:00Z");
// Inverno: Lisboa = UTC; 23:30 UTC de 31/01 ainda é 31/01.
const INVERNO = new Date("2026-01-31T23:30:00Z");

describe("hora de Lisboa: ajudantes", () => {
  it("dia, mês e hora de Lisboa à volta da meia-noite, no verão e no inverno", () => {
    expect(hojeLisboa(VERAO)).toBe("2026-08-01");
    expect(mesLisboa(VERAO)).toBe("2026-08");
    expect(horaLisboa(VERAO)).toBe("00:30");
    expect(agoraLisboa(VERAO)).toBe("2026-08-01 00:30");
    expect(hojeLisboa(INVERNO)).toBe("2026-01-31");
    expect(mesLisboa(INVERNO)).toBe("2026-01");
    expect(horaLisboa(INVERNO)).toBe("23:30");
    // Passagem de ano em UTC+0.
    expect(hojeLisboa(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12-31");
    expect(hojeLisboa(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
  });

  it("não dependem do fuso do processo", () => {
    const antes = process.env.TZ;
    try {
      for (const tz of ["UTC", "Pacific/Kiritimati", "America/Los_Angeles", "Europe/Lisbon"]) {
        process.env.TZ = tz;
        expect(hojeLisboa(VERAO)).toBe("2026-08-01");
        expect(horaLisboa(VERAO)).toBe("00:30");
        expect(somarDias("2026-03-28", 1)).toBe("2026-03-29");
        expect(somarDias("2026-10-24", 2)).toBe("2026-10-26");
        expect(instanteLisboa("2026-08-01", "00:30").toISOString()).toBe(VERAO.toISOString());
      }
    } finally {
      if (antes === undefined) delete process.env.TZ;
      else process.env.TZ = antes;
    }
  });

  it("contas de calendário e instantes de uma hora de parede em Lisboa", () => {
    expect(somarDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(inicioMes("2026-08-17")).toBe("2026-08-01");
    expect(inicioMes("2026-01-17", -2)).toBe("2025-11-01");
    expect(instanteLisboa("2026-01-15", "09:00").toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(instanteLisboa("2026-07-15", "09:00").toISOString()).toBe("2026-07-15T08:00:00.000Z");
    // Dia da mudança para a hora de verão (29/03/2026, 01:00 UTC).
    expect(instanteLisboa("2026-03-29", "12:00").toISOString()).toBe("2026-03-29T11:00:00.000Z");
  });

  it("formata instantes e carimbos na hora de Lisboa", () => {
    expect(fmtDataLisboa(VERAO)).toBe("01/08/2026");
    expect(fmtDataHoraLisboa(VERAO)).toBe("01/08/2026 00:30");
    expect(fmtDataLisboa(INVERNO)).toBe("31/01/2026");
    // Texto de um timestamptz do Postgres, com o desvio sem minutos (nem todos os motores o lêem).
    expect(lerInstante("2026-07-31 23:30:00.123+00").toISOString()).toBe("2026-07-31T23:30:00.123Z");
    expect(lerInstante("2026-08-01 00:30:00+01").toISOString()).toBe("2026-07-31T23:30:00.000Z");
    expect(diaLisboa("2026-07-31 23:30:00+00")).toBe("2026-08-01");
    expect(stampLisboa("2026-07-31T23:30:00Z")).toBe("2026-08-01 00:30");
    expect(stampLisboa("não é data")).toBe("");
    // Carimbo sem fuso: o GesForma grava-os em UTC.
    expect(fmtStampLisboa("2026-07-31 23:30")).toBe("01/08/2026 00:30");
    expect(diaDeCarimbo("2026-07-31 23:30")).toBe("2026-08-01");
    expect(diaDeCarimbo("2026-07-31")).toBe("2026-07-31");
    expect(diaDeCarimbo("31/07/2026")).toBe("");
  });

  it("período do painel: «este mês» e «hoje» são os de Lisboa", () => {
    const p = periodo(undefined, undefined, VERAO);
    expect(p.de).toBe("2026-08-01");
    expect(p.ate).toBe("2026-08-01");
    expect(p.anterior).toEqual({ de: "2026-07-01", ate: "2026-07-01" });
    const w = periodo(undefined, undefined, INVERNO);
    expect(w.de).toBe("2026-01-01");
    expect(w.ate).toBe("2026-01-31");
  });

  it("o formador pode assinar a sessão de hoje logo depois da meia-noite de Lisboa", () => {
    const sumario = { conteudos: "x", atividades: "y", observacoes: "", assinado: true };
    expect(sumarioComRegras("formador", null, sumario, "2026-08-01", VERAO).ok).toBe(true);
    expect(sumarioComRegras("formador", null, sumario, "2026-08-02", VERAO).ok).toBe(false);
    expect(sumarioComRegras("formador", null, sumario, "2026-02-01", INVERNO).ok).toBe(false);
  });
});

describe("hora de Lisboa: API e base de dados", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });
  afterEach(() => { vi.useRealTimers(); });

  it("as consultas correm com o fuso de Lisboa (current_date, ::date de um timestamptz)", async () => {
    const r = (await ctx.db.query<{ tz: string; dia: string; hoje: string; hoje_lisboa: string }>(
      `SELECT current_setting('TimeZone') AS tz, ('2026-07-31T23:30:00Z'::timestamptz)::date::text AS dia,
              current_date::text AS hoje, (now() AT TIME ZONE 'Europe/Lisbon')::date::text AS hoje_lisboa`,
    )).rows[0]!;
    expect(r.tz).toBe("Europe/Lisbon");
    expect(r.dia).toBe("2026-08-01");
    expect(r.hoje).toBe(r.hoje_lisboa);
    expect(await ctx.db.tx(async q => (await q<{ tz: string }>("SELECT current_setting('TimeZone') AS tz")).rows[0]!.tz)).toBe("Europe/Lisbon");
  });

  it("filtro de/até dos pagamentos conta o dia de Lisboa do pagamento (verão e inverno)", async () => {
    await ctx.db.query(
      `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, pago_em) VALUES
         ('TZ-VERAO', 'Fuso Verao', 10, 'Numerário', 'Curso Fuso Lisboa', '2026-08-01', 'Pago', '', '2026-07-31T23:30:00Z'),
         ('TZ-INVERNO', 'Fuso Inverno', 10, 'Numerário', 'Curso Fuso Lisboa', '2026-01-31', 'Pago', '', '2026-01-31T23:30:00Z')`,
    );
    const ids = async (de: string, ate: string) => {
      const r = await pedido(ctx, "admin", "GET", `/v1/pagamentos?q=Fuso&de=${de}&ate=${ate}`);
      expect(r.statusCode, r.body).toBe(200);
      return (r.json() as { linhas: { id: string }[] }).linhas.map(l => l.id).sort();
    };
    expect(await ids("2026-08-01", "2026-08-01")).toEqual(["TZ-VERAO"]);
    expect(await ids("2026-07-31", "2026-07-31")).toEqual([]);
    expect(await ids("2026-01-31", "2026-01-31")).toEqual(["TZ-INVERNO"]);
    expect(await ids("2026-02-01", "2026-02-01")).toEqual([]);
  });

  it("à meia-noite e meia de Lisboa (verão), o pagamento registado e a exportação ficam com o dia de Lisboa", async () => {
    const criado = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", {
      nome: "Rita", apelido: "Fuso", email: "rita.fuso@exemplo.pt", curso: "Curso Fuso Lisboa", valor: 40,
    });
    expect(criado.statusCode, criado.body).toBe(200);
    const id = (criado.json() as { formando: { id: number } }).formando.id;

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(VERAO);
    const r = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/registar-pagamento`, { metodo: "Numerário", valor: 40 });
    expect(r.statusCode, r.body).toBe(200);
    const p = (await ctx.db.query<{ data: string; dia: string }>(
      "SELECT data, (pago_em AT TIME ZONE 'Europe/Lisbon')::date::text AS dia FROM pagamentos WHERE formando_id = $1", [id],
    )).rows[0]!;
    expect(p.data).toBe("2026-08-01");
    expect(p.dia).toBe("2026-08-01");

    const x = await pedido(ctx, "admin", "GET", "/v1/pagamentos/exportar?q=Fuso");
    expect(x.statusCode, x.body).toBe(200);
    expect(String(x.headers["content-disposition"])).toContain("pagamentos-2026-08-01.xlsx");
  });

  it("no inverno, 23:30 UTC ainda é o próprio dia em Lisboa", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INVERNO);
    const x = await pedido(ctx, "admin", "GET", "/v1/pagamentos/exportar?q=Fuso");
    expect(x.statusCode, x.body).toBe(200);
    expect(String(x.headers["content-disposition"])).toContain("pagamentos-2026-01-31.xlsx");
  });
});
