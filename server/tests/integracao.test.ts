import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p}${Date.now().toString(36)}${++seq}`;

type Matriz = { turmas: { id: number; pct: number; ok: number; emFalta: { id: string; estado: string }[] }[] };

async function turmaGold(ctx: Ctx) {
  const curso = unico("Curso Int ");
  expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "T", tipo: "Pré-inscrição", preco: 0, regime: "Presencial", horas: 4 })).statusCode).toBe(200);
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2030-05-06", nome: unico("TInt"), curso, local: "Porto", horario: "Laboral Manhã", vagas: 5, estado: "Ativa",
    cronograma: [{ id: unico("s"), data: "2030-05-06", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(r.statusCode).toBe(200);
  return r.json().turma as { id: number };
}

describe("pesquisa global", () => {
  it("encontra formandos Gold avulsos (sem turma) e abre a ficha", async () => {
    const ctx = await arrancar();
    const nome = unico("Zacarias");
    await ctx.db.query(
      `INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id)
       VALUES ((SELECT coalesce(max(id), 0) + 1 FROM formandos_gold), $1, 'Avulso', $2, 'Excel', '', NULL)`,
      [nome, `${nome.toLowerCase()}@exemplo.pt`],
    );
    const r = await pedido(ctx, "secretaria", "GET", `/v1/search?q=${encodeURIComponent(nome)}`);
    expect(r.statusCode).toBe(200);
    const itens = (r.json() as { groups: { grupo: string; items: { tipo: string; view: string; formandoOrigem?: string }[] }[] })
      .groups.flatMap(g => g.items);
    const hit = itens.find(i => i.tipo === "Formando Gold avulso");
    expect(hit).toBeTruthy();
    expect(hit!.view).toBe("gold-formando-ficha");
    expect(hit!.formandoOrigem).toBe("gold-avulso");
  });
});

describe("WhatsApp: consentimento antes de gravar", () => {
  async function conversa(ctx: Ctx, telefone: string, recusar: boolean) {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const { listOfertaGold } = await import("../src/ofertaGold.js");
    const turma = (await listOfertaGold(ctx.db))[0];
    expect(turma, "o seed de demonstração tem turmas Gold activas").toBeTruthy();
    const email = `${unico("wa")}@exemplo.pt`;
    const passos = ["menu", "1", "Rita", "Lopes", email, "Porto", turma!.curso, turma!.local, turma!.horario, turma!.dataInicio];
    let ultimo: Awaited<ReturnType<typeof handleWhatsappText>> | null = null;
    for (const t of passos) ultimo = await handleWhatsappText(ctx.db, telefone, t);
    expect(ultimo!.passo).toBe("consentimento");
    expect(ultimo!.replies.join("\n")).toMatch(/sim/i);
    const fim = await handleWhatsappText(ctx.db, telefone, recusar ? "não" : "sim");
    const lead = await ctx.db.query<{ id: number; consentimento_em: unknown; consentimento_ip: string }>(
      "SELECT id, consentimento_em, consentimento_ip FROM preinscricoes WHERE lower(email) = $1", [email]);
    return { fim, lead: lead.rows[0] ?? null };
  }

  it("sem aceitação não cria a pré-inscrição", async () => {
    const ctx = await arrancar();
    const { fim, lead } = await conversa(ctx, "351910000101", true);
    expect(lead).toBeNull();
    expect(fim.passo).toBe("menu");
  });

  it("com aceitação cria a pré-inscrição e regista o consentimento", async () => {
    const ctx = await arrancar();
    const { fim, lead } = await conversa(ctx, "351910000102", false);
    expect(lead).not.toBeNull();
    expect(lead!.consentimento_em).toBeTruthy();
    expect(lead!.consentimento_ip).toBe("WhatsApp");
    expect(fim.leadId).toBe(lead!.id);
  });
});

describe("Dossiê TP: vista geral em cache", () => {
  it("reflecte uma alteração logo a seguir à escrita", async () => {
    const ctx = await arrancar();
    const turma = await turmaGold(ctx);
    const antes = (await pedido(ctx, "secretaria", "GET", "/v1/dtp/gold/resumo")).json() as Matriz;
    const linha = antes.turmas.find(t => t.id === turma.id)!;
    expect(linha).toBeTruthy();
    const item = linha.emFalta[0]!;
    // Leitura repetida devolve o mesmo resultado (servido da cache).
    const outra = (await pedido(ctx, "secretaria", "GET", "/v1/dtp/gold/resumo")).json() as Matriz;
    expect(outra.turmas.find(t => t.id === turma.id)!.ok).toBe(linha.ok);

    const w = await pedido(ctx, "secretaria", "PUT", `/v1/turmas/gold/${turma.id}/dtp/${encodeURIComponent(item.id)}`, { estado: "ok" });
    expect(w.statusCode).toBe(200);

    const depois = (await pedido(ctx, "secretaria", "GET", "/v1/dtp/gold/resumo")).json() as Matriz;
    const nova = depois.turmas.find(t => t.id === turma.id)!;
    expect(nova.ok).toBe(linha.ok + 1);
    expect(nova.emFalta.some(i => i.id === item.id)).toBe(false);
    const pct = (await pedido(ctx, "secretaria", "GET", "/v1/dtp/gold")).json() as { pct: Record<string, number> };
    expect(pct.pct[String(turma.id)]).toBe(nova.pct);
  });
});
