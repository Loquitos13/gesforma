// Email do registo no Netforce (CCP): sai quando o formando é inserido numa turma do curso, do email do local, com o
// guia em PDF anexado à regra; regras com vários cursos; documentos anexados à regra.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

type Enviado = { to: string; subject: string; text: string; anexos: string[] };
const enviados = vi.hoisted(() => [] as Enviado[]);
vi.mock("../src/mailer.js", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/mailer.js")>()),
  sendMail: async (_db: unknown, m: { to: string; subject: string; text: string; anexos?: { nome: string }[] }) => {
    enviados.push({ to: m.to, subject: m.subject, text: m.text, anexos: (m.anexos ?? []).map(a => a.nome) });
    return "teste";
  },
}));

const CCP = "Formação de Formadores - CCP";
let ctx: Ctx;
let seq = 0;
beforeAll(async () => { ctx = await arrancar(); });

async function turma(curso: string) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2099-03-02", nome: `NF ${Date.now()}-${++seq}`, curso, local: "Porto", horario: "Laboral", vagas: 10,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().turma.id as number;
}

async function formando(turmaId: number) {
  const email = `netforce.${Date.now()}.${++seq}@exemplo.pt`;
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Rui", apelido: "Pinto", email, turmaId, metodo: "Oferta" });
  expect(r.statusCode, r.body).toBe(200);
  return email;
}

async function correr() {
  const { avisarEntradasNaTurma } = await import("../src/entradasTurma.js");
  const { processDueJobs } = await import("../src/automations.js");
  const r = await avisarEntradasNaTurma(ctx.db);
  await processDueJobs(ctx.db);
  return r;
}

describe("email do Netforce", () => {
  it("a regra vem ligada ao CCP, com o guia em PDF", async () => {
    const regras = (await pedido(ctx, "admin", "GET", "/v1/email/rules")).json().rules as
      { evento: string; template: string; cursos: string[]; ativo: boolean; anexos: { nome: string }[] }[];
    const r = regras.find(x => x.template === "registo_netforce")!;
    expect(r).toMatchObject({ evento: "formando.inserido_turma", cursos: [CCP], ativo: true });
    expect(r.anexos.map(a => a.nome)).toEqual(["Registo_Netforce.pdf"]);
  });

  it("inserido numa turma do CCP: o email sai uma vez, sem «Olá», com o PDF; noutro curso não sai", async () => {
    const email = await formando(await turma(CCP));
    const outro = await formando(await turma("Excel do Básico ao Avançado"));
    enviados.length = 0;
    await correr();
    const meus = enviados.filter(e => e.to === email);
    expect(meus).toHaveLength(1);
    expect(meus[0]!.subject).toBe(`Registo obrigatório no portal Netforce · ${CCP}`);
    expect(meus[0]!.text.startsWith("Caro(a) Formando(a)")).toBe(true);
    expect(meus[0]!.text).toContain("http://netforce.iefp.pt");
    expect(meus[0]!.anexos).toEqual(["Registo_Netforce.pdf"]);
    expect(enviados.some(e => e.to === outro)).toBe(false);
    // Outra volta: não repete.
    await correr();
    expect(enviados.filter(e => e.to === email)).toHaveLength(1);
  });

  it("regras com vários cursos e documentos anexados à regra", async () => {
    const regras = (await pedido(ctx, "admin", "GET", "/v1/email/rules")).json().rules as { id: number; template: string }[];
    const r = regras.find(x => x.template === "registo_netforce")!;
    expect((await pedido(ctx, "admin", "PATCH", `/v1/email/rules/${r.id}`, { cursos: [CCP, "Excel do Básico ao Avançado"] })).statusCode).toBe(200);
    const email = await formando(await turma("Excel do Básico ao Avançado"));
    enviados.length = 0;
    await correr();
    expect(enviados.filter(e => e.to === email)).toHaveLength(1);

    // Anexar e tirar um documento da regra.
    const boundary = "----regra";
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Horario.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from("%PDF-1.4\n%%EOF\n"), Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const up = await ctx.app.inject({
      method: "POST", url: `/v1/email/rules/${r.id}/anexos`, payload: body,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, cookie: ctx.cookie.admin, "x-gesforma-client": "web" },
    });
    expect(up.statusCode, up.body).toBe(200);
    const anexoId = up.json().id as number;
    const depois = (await pedido(ctx, "admin", "GET", "/v1/email/rules")).json().rules.find((x: { id: number }) => x.id === r.id);
    expect(depois.anexos.map((a: { nome: string }) => a.nome)).toEqual(["Registo_Netforce.pdf", "Horario.pdf"]);
    expect((await pedido(ctx, "admin", "DELETE", `/v1/email/rules/${r.id}/anexos/${anexoId}`)).statusCode).toBe(200);
    await pedido(ctx, "admin", "PATCH", `/v1/email/rules/${r.id}`, { cursos: [CCP] });
  });
});
