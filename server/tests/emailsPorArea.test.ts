// Emails por área: a coordenação Gold, a coordenação Financiada e a contabilidade editam e acrescentam os seus; a
// administração vê todos, com a área. Um envio da Financiada sai com o modelo e a regra da Financiada.
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

type Modelo = { id: number; tipo: string; area: string; personalizado?: boolean };
const modelos = async (ctx: Awaited<ReturnType<typeof arrancar>>, perfil: "admin" | "secretaria" | "financiada" | "contabilidade" | "comercial") =>
  (await pedido(ctx, perfil, "GET", "/v1/email/templates")).json().templates as Modelo[];

describe("emails por área", () => {
  it("cada perfil vê e edita só os da sua área; a administração vê todos", async () => {
    const ctx = await arrancar();
    const areas = async (perfil: Parameters<typeof modelos>[1]) => [...new Set((await modelos(ctx, perfil)).map(m => m.area))].sort();
    expect(await areas("admin")).toEqual(["contabilidade", "fin", "gold"]);
    expect(await areas("secretaria")).toEqual(["gold"]);
    expect(await areas("comercial")).toEqual(["gold"]);
    expect(await areas("financiada")).toEqual(["fin"]);
    expect(await areas("contabilidade")).toEqual(["contabilidade"]);
    // Os automáticos existem nas duas coordenações; o do comprovativo para a contabilidade é da contabilidade.
    const todos = await modelos(ctx, "admin");
    const welcome = todos.filter(m => m.tipo === "welcome").map(m => m.area).sort();
    expect(welcome).toEqual(["fin", "gold"]);
    expect(todos.filter(m => m.tipo === "comprovativo_contabilidade").map(m => m.area)).toEqual(["contabilidade"]);

    const fin = todos.find(m => m.tipo === "welcome" && m.area === "fin")!;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/email/templates/${fin.id}`, { assunto: "Gold não mexe" })).statusCode).toBe(404);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/email/templates/${fin.id}`, { assunto: "Bem-vindo à Financiada {{curso}}" })).statusCode).toBe(200);

    // As regras também: cada coordenação só as suas.
    const regras = async (perfil: Parameters<typeof modelos>[1]) =>
      [...new Set(((await pedido(ctx, perfil, "GET", "/v1/email/regras")).json().rules as { area: string }[]).map(r => r.area))].sort();
    expect(await regras("secretaria")).toEqual(["gold"]);
    expect(await regras("financiada")).toEqual(["fin"]);
  });

  it("um envio da Financiada sai com o modelo e a regra da Financiada; o da Gold com os da Gold", async () => {
    const ctx = await arrancar();
    await ctx.db.query("UPDATE email_templates SET assunto = 'Financiada · {{curso}}' WHERE tipo = 'welcome' AND area = 'fin'");
    await ctx.db.query("UPDATE email_templates SET assunto = 'Gold · {{curso}}' WHERE tipo = 'welcome' AND area = 'gold'");
    const { ingestEvent } = await import("../src/automations.js");
    const stamp = Date.now();
    const assunto = async (email: string) =>
      (await ctx.db.query<{ subject: string }>("SELECT subject FROM email_jobs WHERE to_email = $1", [email])).rows.map(r => r.subject);
    await ingestEvent(ctx.db, "preinscricao.created", { email: `fin.${stamp}@exemplo.pt`, nome: "Ana", curso: "UFCD 1", regime: "fin" }, `area-fin-${stamp}`);
    await ingestEvent(ctx.db, "preinscricao.created", { email: `gold.${stamp}@exemplo.pt`, nome: "Rui", curso: "CCP", regime: "gold" }, `area-gold-${stamp}`);
    expect(await assunto(`fin.${stamp}@exemplo.pt`)).toEqual(["Financiada · UFCD 1"]);
    expect(await assunto(`gold.${stamp}@exemplo.pt`)).toEqual(["Gold · CCP"]);
  });

  it("as coordenações e a contabilidade criam emails na sua área; só esses se apagam", async () => {
    const ctx = await arrancar();
    const corpo = { nome: "Aviso de fecho de turma", assunto: "A turma {{turma}} terminou", body_xml: "<email>\n  <p>Obrigado por ter participado.</p>\n</email>" };
    const r = await pedido(ctx, "financiada", "POST", "/v1/email/templates", { ...corpo, area: "gold" });
    expect(r.statusCode).toBe(403);
    const novo = await pedido(ctx, "financiada", "POST", "/v1/email/templates", corpo);
    expect(novo.statusCode, novo.body).toBe(200);
    const m = novo.json().template as Modelo;
    expect(m).toMatchObject({ area: "fin" });
    expect(m.tipo.startsWith("personalizado_")).toBe(true);
    expect((await modelos(ctx, "secretaria")).some(x => x.id === m.id)).toBe(false);

    // Numa regra não se apaga; sem regra, sim. Os automáticos nunca.
    const regra = await pedido(ctx, "financiada", "POST", "/v1/email/rules", {
      nome: "Fecho", gatilho: "Formando marcado como concluído", templateTipo: m.tipo, atraso: "Imediatamente",
    });
    expect(regra.statusCode, regra.body).toBe(200);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/email/templates/${m.id}`)).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/email/rules/${regra.json().id}`)).statusCode).toBe(404);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/email/rules/${regra.json().id}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/email/templates/${m.id}`)).statusCode).toBe(200);
    const automatico = (await modelos(ctx, "financiada")).find(x => x.tipo === "welcome")!;
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/email/templates/${automatico.id}`)).statusCode).toBe(409);

    // A administração escolhe a área; a contabilidade cria na sua.
    const adm = await pedido(ctx, "admin", "POST", "/v1/email/templates", { ...corpo, area: "contabilidade" });
    expect(adm.json().template).toMatchObject({ area: "contabilidade" });
    const cont = await pedido(ctx, "contabilidade", "POST", "/v1/email/templates", corpo);
    expect(cont.json().template).toMatchObject({ area: "contabilidade" });
  });
});
