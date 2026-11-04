// Avisos da plataforma à equipa: só em horário laboral (segunda a sábado, 8:30–19:00, Lisboa); fora disso ficam
// guardados e saem no início do horário seguinte. Os administradores não recebem avisos. O resto sai logo.
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, type Ctx } from "./helpers.js";

let ctx: Ctx;
beforeAll(async () => { ctx = await arrancar(); process.env.AVISOS_HORARIO = ""; });
afterEach(() => { vi.useRealTimers(); });

async function utilizador(role: string) {
  const email = `aviso.${role}.${randomUUID().slice(0, 8)}@exemplo.pt`;
  await ctx.db.query("INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, $2, $3, 'x', $4, true)", [randomUUID(), `Aviso ${role}`, email, role]);
  return email;
}

describe("avisos à equipa em horário laboral", () => {
  it("horário: segunda a sábado, 8:30–19:00 de Lisboa", async () => {
    const { emHorarioLaboral } = await import("../src/mailer.js");
    // 04-11-2026 é quarta-feira; Lisboa está em UTC+0 em novembro.
    expect(emHorarioLaboral(new Date("2026-11-04T08:29:00Z"))).toBe(false);
    expect(emHorarioLaboral(new Date("2026-11-04T08:30:00Z"))).toBe(true);
    expect(emHorarioLaboral(new Date("2026-11-04T18:59:00Z"))).toBe(true);
    expect(emHorarioLaboral(new Date("2026-11-04T19:00:00Z"))).toBe(false);
    expect(emHorarioLaboral(new Date("2026-11-07T10:00:00Z"))).toBe(true); // sábado
    expect(emHorarioLaboral(new Date("2026-11-08T10:00:00Z"))).toBe(false); // domingo
    // Verão (UTC+1): 07:45 UTC são 8:45 em Lisboa.
    expect(emHorarioLaboral(new Date("2026-07-01T07:45:00Z"))).toBe(true);
  });

  it("fora de horas: o aviso à equipa fica guardado e sai depois; admin não recebe; formando e emails urgentes saem logo", async () => {
    const { sendMail, enviarAvisosAdiados } = await import("../src/mailer.js");
    const equipa = await utilizador("comercial");
    const admin = await utilizador("admin");
    const formando = await utilizador("formando");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T22:00:00Z")); // quarta, 22h

    expect(await sendMail(ctx.db, { to: equipa, name: "E", subject: "Aviso", text: "t", aviso: true })).toMatch(/^adiado:/);
    expect(await sendMail(ctx.db, { to: admin, name: "A", subject: "Aviso", text: "t", aviso: true })).toBe("sem-envio:administrador");
    expect(await sendMail(ctx.db, { to: formando, name: "F", subject: "Aviso", text: "t", aviso: true })).toMatch(/^log:/);
    // Sem «aviso» (ex.: recuperar a palavra-passe): sai logo, mesmo à equipa.
    expect(await sendMail(ctx.db, { to: equipa, name: "E", subject: "Código", text: "t" })).toMatch(/^log:/);

    const pendentes = async () => Number((await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM emails_equipa_adiados WHERE para = $1 AND enviado_em IS NULL", [equipa])).rows[0]!.n);
    expect(await pendentes()).toBe(1);
    expect((await enviarAvisosAdiados(ctx.db, new Date("2026-11-05T06:00:00Z"))).enviados).toBe(0); // 6h: ainda não
    expect(await pendentes()).toBe(1);
    vi.setSystemTime(new Date("2026-11-05T08:31:00Z"));
    expect((await enviarAvisosAdiados(ctx.db)).enviados).toBeGreaterThanOrEqual(1);
    expect(await pendentes()).toBe(0);
  });
});
