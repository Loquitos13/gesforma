// Mensagens e menu do assistente de WhatsApp editáveis (administração e coordenações): textos, nome/ordem/visibilidade
// das opções e perguntas frequentes com resposta fixa.
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const tel = () => `3519${String(10_000_000 + Math.floor(Math.random() * 89_000_000)).slice(0, 8)}`;

describe("assistente de WhatsApp configurável", () => {
  it("só a administração e as coordenações editam; o bot usa o menu e os textos guardados", async () => {
    const ctx = await arrancar();
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const g = await pedido(ctx, "financiada", "GET", "/v1/crm/whatsapp/assistente");
    expect(g.statusCode).toBe(200);
    const { menu } = g.json().assistente as { menu: { acao: string; titulo: string; ativo: boolean }[] };
    expect(menu.map(m => m.acao)).toEqual(["preinscricao", "estado", "cursos", "equipa"]);
    expect((await pedido(ctx, "comercial", "GET", "/v1/crm/whatsapp/assistente")).statusCode).toBe(403);
    expect((await pedido(ctx, "contabilidade", "PUT", "/v1/crm/whatsapp/assistente", { textos: {}, menu })).statusCode).toBe(403);

    // Erros: apagar uma opção de origem, pergunta sem resposta, nome comprido.
    const put = (role: "admin" | "secretaria", body: unknown) => pedido(ctx, role, "PUT", "/v1/crm/whatsapp/assistente", body);
    expect((await put("secretaria", { textos: {}, menu: menu.slice(1) })).statusCode).toBe(400);
    expect((await put("secretaria", { textos: {}, menu: [...menu, { acao: "faq", titulo: "Horários", ativo: true }] })).statusCode).toBe(400);
    expect((await put("secretaria", { textos: {}, menu: [{ ...menu[0]!, titulo: "x".repeat(25) }, ...menu.slice(1)] })).statusCode).toBe(400);

    // Lista de cursos escondida, «Falar com a equipa» primeiro e uma pergunta frequente.
    const novo = [
      { ...menu[3]!, titulo: "Falar connosco" }, menu[0]!, menu[1]!, { ...menu[2]!, ativo: false },
      { acao: "faq", titulo: "Onde ficam?", ativo: true, resposta: "Estamos em Lisboa e no Porto." },
    ];
    const r = await put("secretaria", { textos: { boasVindas: "Bem-vindo à ENA!", semPedido: "Ainda não tem pedido." }, menu: novo });
    expect(r.statusCode, r.body).toBe(200);

    const t = tel();
    const m = await handleWhatsappText(ctx.db, t, "menu");
    expect(m.replies[0]).toContain("Bem-vindo à ENA!");
    expect(m.replies[0]).toContain("1 · Falar connosco");
    expect(m.replies[0]).toContain("4 · Onde ficam?");
    expect(m.replies[0]).not.toContain("Lista de cursos");
    expect((await handleWhatsappText(ctx.db, t, "4")).replies[0]).toContain("Estamos em Lisboa e no Porto.");
    // Estado do pedido (agora 3): o texto guardado e o número certo da pré-inscrição (2).
    expect((await handleWhatsappText(ctx.db, t, "3")).replies[0]).toBe("Ainda não tem pedido. Escreva *2* para se pré-inscrever ou contacte a secretaria.");
    // Escondida: «cursos» já não abre a lista.
    expect((await handleWhatsappText(ctx.db, t, "cursos")).replies[0]).toContain("Bem-vindo à ENA!");
    // 1 é agora falar com a equipa.
    const h = await handleWhatsappText(ctx.db, t, "1");
    expect(h.humano).toBe(true);
  });
});
