import { describe, expect, it } from "vitest";
import { estadoDoPlano, planoComRegras } from "../src/sessaoRegras.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

const sessao = (id: string, data: string, formadores: string[]) => ({
  id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores,
});

const PLANO = { objetivosGerais: "Rever a matéria", objetivosEspecificos: "", momentos: { introducao: {}, desenvolvimento: {}, conclusao: {} } };

async function fichaDoFormador(ctx: Ctx) {
  const conta = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
  await ctx.db.query("UPDATE formadores SET user_id = NULL, email = '' WHERE user_id = $1", [ctx.userId.formador]);
  const nome = unico("Formador Plano");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome, email: conta.rows[0]!.email, regimes: ["gold"] });
  expect(r.statusCode, r.body).toBe(200);
  return nome;
}

async function turmaGold(ctx: Ctx, cronograma: unknown[]) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome: unico("PA"), curso: "Curso Sem Ficha", vagas: 10, cronograma });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().turma.id as number;
}

describe("regras da aprovação do plano de sessão", () => {
  it("o formador submete mas não aprova; a coordenação aprova e devolve com comentários", () => {
    expect(estadoDoPlano({ assinado: true })).toBe("aprovado");
    expect(estadoDoPlano(null)).toBe("rascunho");
    expect(planoComRegras("formador", "F", null, { estado: "aprovado" })).toMatchObject({ ok: false, codigo: 403 });
    const sub = planoComRegras("formador", "F", null, { estado: "submetido", assinado: true });
    expect(sub).toMatchObject({ ok: true, submetido: true, plano: { estado: "submetido", assinado: false } });
    // Gravar sem estado mantém o devolvido; o comentário da coordenação não muda.
    const dev = planoComRegras("formador", "F", { estado: "devolvido", comentario: "Falta a avaliação" }, { comentario: "apagado" });
    expect(dev).toMatchObject({ ok: true, plano: { estado: "devolvido", comentario: "Falta a avaliação" } });
    expect(planoComRegras("secretaria", "Coord", { estado: "submetido" }, { estado: "devolvido" })).toMatchObject({ ok: false, codigo: 400 });
    const ap = planoComRegras("financiada", "Coord", { estado: "submetido" }, { estado: "aprovado" });
    expect(ap).toMatchObject({ ok: true, revisto: "aprovado", plano: { estado: "aprovado", assinado: true, revistoPor: "Coord" } });
    // A coordenação edita um plano aprovado sem mudar o estado: continua aprovado e não volta a avisar.
    expect(planoComRegras("admin", "Coord", { estado: "aprovado", assinado: true }, {})).toMatchObject({ ok: true, revisto: null, plano: { estado: "aprovado", assinado: true } });
  });
});

describe("aprovação do plano de sessão com pedidos reais", () => {
  it("formador preenche e submete; coordenação devolve, formador corrige, coordenação aprova e o formador deixa de alterar", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const turma = await turmaGold(ctx, [sessao("p1", "2099-06-01", [eu])]);
    const url = `/v1/turmas/gold/${turma}/sessoes/1`;
    const plano = async () => (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${turma}/pedagogia`)).json().sessoes[0].plano;

    expect((await pedido(ctx, "formador", "PUT", url, { plano: PLANO })).statusCode).toBe(200);
    expect((await plano()).estado).toBe("rascunho");
    expect((await pedido(ctx, "formador", "PUT", url, { plano: { ...PLANO, estado: "aprovado" } })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", url, { plano: { ...PLANO, estado: "submetido" } })).statusCode).toBe(200);
    expect(await plano()).toMatchObject({ estado: "submetido", assinado: false, assinaturaFormador: { nome: expect.any(String), em: expect.any(String) } });
    // Uma assinatura enviada pelo cliente não conta: só a do servidor ao submeter.
    expect((await pedido(ctx, "formador", "PUT", url, { plano: { ...PLANO, estado: "submetido", assinaturaFormador: { nome: "Outro", em: "2020-01-01" } } })).statusCode).toBe(200);
    expect((await plano()).assinaturaFormador.nome).not.toBe("Outro");

    // A coordenação vê o aviso no sino.
    const sino = (await pedido(ctx, "secretaria", "GET", "/v1/notificacoes")).json().notificacoes as { chave: string; tab?: string }[];
    expect(sino.some(n => n.chave.startsWith(`planos-submetido-gold-${turma}-`) && n.tab === "sessoes")).toBe(true);

    expect((await pedido(ctx, "secretaria", "PUT", url, { plano: { ...PLANO, estado: "devolvido" } })).statusCode).toBe(400);
    const devolvido = await pedido(ctx, "secretaria", "PUT", url, { plano: { ...PLANO, estado: "devolvido", comentario: "Falta a avaliação" } });
    expect(devolvido.statusCode, devolvido.body).toBe(200);
    expect(await plano()).toMatchObject({ estado: "devolvido", comentario: "Falta a avaliação", assinado: false });
    const auditoria = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'turma.plano_devolvido' AND entity_id = $1", [String(turma)]);
    expect(auditoria.rows.length).toBe(1);
    const doFormador = (await pedido(ctx, "formador", "GET", "/v1/notificacoes")).json().notificacoes as { chave: string }[];
    expect(doFormador.some(n => n.chave.startsWith(`planos-devolvido-gold-${turma}-`))).toBe(true);

    // O formador corrige: gravar sem estado mantém «devolvido»; submeter volta a «submetido».
    expect((await pedido(ctx, "formador", "PUT", url, { plano: { ...PLANO, objetivosEspecificos: "Avaliação formativa" } })).statusCode).toBe(200);
    expect((await plano()).estado).toBe("devolvido");
    expect((await pedido(ctx, "formador", "PUT", url, { plano: { ...PLANO, objetivosEspecificos: "Avaliação formativa", estado: "submetido" } })).statusCode).toBe(200);

    // A coordenação edita e aprova.
    expect((await pedido(ctx, "secretaria", "PUT", url, { plano: { ...PLANO, objetivosGerais: "Rever (revisto)", estado: "aprovado" } })).statusCode).toBe(200);
    expect(await plano()).toMatchObject({ estado: "aprovado", assinado: true, objetivosGerais: "Rever (revisto)" });
    expect((await pedido(ctx, "formador", "PUT", url, { plano: PLANO })).statusCode).toBe(403);
  });

  it("folha de presenças: estados, tempo de ausência e horas T/P; a coordenação valida e o formador deixa de alterar", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const turma = await turmaGold(ctx, [sessao("f1", "2099-06-01", [eu])]);
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: unico("Rita"), email: `pa.${Date.now()}.${++seq}@exemplo.pt`, turmaId: turma });
    const f = r.json().formando.id as number;
    const url = `/v1/turmas/gold/${turma}/sessoes/1`;
    const presencas = [{ id: f, nome: "Rita", presente: true, estado: "atraso", minutos: 30 }];
    expect((await pedido(ctx, "formador", "PUT", url, { presencas, folha: { teoricas: 3, praticas: 1 }, assinarFolha: true })).statusCode).toBe(200);
    const assinada = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${turma}/pedagogia`)).json().sessoes[0].folha;
    expect(assinada).toMatchObject({ assinadaPor: expect.any(String), assinadaEm: expect.any(String) });
    // Alterar depois de assinar tira a assinatura; volta a assinar.
    expect((await pedido(ctx, "formador", "PUT", url, { folha: { praticas: 1 } })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${turma}/pedagogia`)).json().sessoes[0].folha.assinadaPor).toBeNull();
    expect((await pedido(ctx, "formador", "PUT", url, { assinarFolha: true })).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "PUT", url, { validarPresencas: true })).statusCode).toBe(403);
    const v = await pedido(ctx, "secretaria", "PUT", url, { validarPresencas: true, presencas: [{ id: f, nome: "Rita", presente: false, estado: "falta_justificada", justificacao: "Doença" }] });
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json().sessao).toMatchObject({
      sumario: { presencasValidadas: true },
      folha: { teoricas: 3, praticas: 1, validadaPor: expect.any(String) },
      presencas: [{ estado: "falta_justificada", presente: false, justificacao: "Doença" }],
    });
    expect((await pedido(ctx, "formador", "PUT", url, { folha: { teoricas: 4 } })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "PUT", url, { presencas })).statusCode).toBe(403);
    // A coordenação ainda corrige depois de validada.
    expect((await pedido(ctx, "secretaria", "PUT", url, { assinarFolha: true })).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "PUT", url, { folha: { teoricas: 2, praticas: 2 } })).statusCode).toBe(200);
  });
});
