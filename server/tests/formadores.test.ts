import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

function daquiA(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function novoFormador(ctx: Ctx, corpo: Record<string, unknown>) {
  const res = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { regimes: ["gold"], ...corpo });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { formador: { id: number; nome: string }; acesso: { email: string; password?: string; criado: boolean } | null };
}

type Linha = { id: number; horasDadas: number; horasPendentes: number; turmasAtivas: number; docsEmFalta: number; ccpAExpirar: boolean };

describe("formadores", () => {
  it("lista com horas, documentos e CCP a expirar", async () => {
    const ctx = await arrancar();
    const nome = unico("Formador Horas");
    const { formador, acesso } = await novoFormador(ctx, { nome, email: `fh${Date.now()}@exemplo.pt`, ccpValidade: daquiA(30), custoHora: 20 });
    expect(acesso?.criado).toBe(true);
    expect(acesso?.password).toBeTruthy();
    const turma = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2020-03-02", nome: unico("TF"), curso: "Curso Formador", formador: nome,
      cronograma: [
        { id: "1", data: "2020-03-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [nome] },
        { id: "2", data: "2099-03-02", horaInicio: "19:00", horaFim: "22:00", modalidade: "presencial", formadores: [nome] },
        { id: "3", data: "2099-03-09", horaInicio: "19:00", horaFim: "22:00", modalidade: "assincrona", formadores: [nome] },
      ],
      valoresHoraFormador: { [nome]: 25 },
    });
    expect(turma.statusCode, turma.body).toBe(200);

    const lista = await pedido(ctx, "secretaria", "GET", `/v1/formadores?regime=gold&q=${encodeURIComponent(nome)}`);
    expect(lista.statusCode, lista.body).toBe(200);
    const linha = (lista.json().linhas as Linha[])[0]!;
    expect(linha).toMatchObject({ id: formador.id, horasDadas: 4, horasPendentes: 3, turmasAtivas: 1, docsEmFalta: 5, ccpAExpirar: true });
    expect(lista.json().kpis.ccpAExpirar).toBeGreaterThan(0);

    const porAlerta = await pedido(ctx, "secretaria", "GET", "/v1/formadores?regime=gold&alerta=ccp&porPagina=200");
    expect((porAlerta.json().linhas as Linha[]).some(l => l.id === formador.id)).toBe(true);
    const fin = await pedido(ctx, "financiada", "GET", `/v1/formadores?regime=fin&q=${encodeURIComponent(nome)}`);
    expect(fin.json().total).toBe(0);

    const docs = await pedido(ctx, "secretaria", "PUT", `/v1/formadores/${formador.id}/docs`, {
      docs: [{ id: "cc", uploaded: true, fileName: "cc.pdf" }, { id: "ccp", uploaded: true, fileName: "ccp.pdf" }],
    });
    expect(docs.statusCode, docs.body).toBe(200);

    const ficha = await pedido(ctx, "secretaria", "GET", `/v1/formadores/${formador.id}`);
    expect(ficha.statusCode, ficha.body).toBe(200);
    const f = ficha.json();
    expect(f.turmas).toHaveLength(1);
    expect(f.turmas[0]).toMatchObject({ horasDadas: 4, horasPendentes: 3, valorHora: 25, valorDado: 100, responsavel: true });
    expect(f.totais).toMatchObject({ horasDadas: 4, docsEmFalta: 3 });
    expect(f.sessoes).toHaveLength(2);
    expect(f.acesso?.email).toBeTruthy();
  });

  it("guarda e limpa a validade do CCP, com auditoria", async () => {
    const ctx = await arrancar();
    const { formador } = await novoFormador(ctx, { nome: unico("Formador CCP") });
    const ok = await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${formador.id}`, { ccpValidade: "2031-06-30" });
    expect(ok.json().formador.ccpValidade).toBe("2031-06-30");
    const limpo = await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${formador.id}`, { ccpValidade: "" });
    expect(limpo.json().formador.ccpValidade).toBe("");
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formadores/${formador.id}`, { ccpValidade: "30/06/2031" })).statusCode).toBe(400);
    const audit = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'formador.alterar' AND entity_id = $1", [String(formador.id)]);
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it("o formador só vê a própria ficha e não a lista", async () => {
    const ctx = await arrancar();
    const conta = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
    const meu = await novoFormador(ctx, { nome: unico("Eu Formador"), email: conta.rows[0]!.email });
    const outro = await novoFormador(ctx, { nome: unico("Outro Formador") });
    expect((await pedido(ctx, "formador", "GET", "/v1/formadores?regime=gold")).statusCode).toBe(403);
    const eu = await pedido(ctx, "formador", "GET", "/v1/formadores/eu");
    expect(eu.json().id).toBe(meu.formador.id);
    expect((await pedido(ctx, "formador", "GET", `/v1/formadores/${meu.formador.id}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "GET", `/v1/formadores/${outro.formador.id}`)).statusCode).toBe(403);
    const disp = await pedido(ctx, "formador", "PATCH", `/v1/formadores/${meu.formador.id}`, { disponibilidade: ["laboral"] });
    expect(disp.statusCode, disp.body).toBe(200);
    expect((await pedido(ctx, "formador", "PATCH", `/v1/formadores/${outro.formador.id}`, { disponibilidade: ["laboral"] })).statusCode).toBe(403);
  });
});
