import { describe, expect, it } from "vitest";
import { labelsDePayload, modulosDaFicha } from "../src/programaCurso.js";
import { casarModulo } from "../../src/partilhado/turmaModel.js";
import { arrancar, pedido } from "./helpers.js";

const topicos = [
  { id: "t-a", titulo: "Atendimento", horas: "10h" },
  { id: "t-b", titulo: "Comunicação escrita", horas: "" },
  { id: "t-c", titulo: "Excel", horas: "15h" },
];

describe("programa do curso: modular ou livre", () => {
  it("modular numera M1, M2…; livre não tem código (nem C1, C2…)", () => {
    expect(labelsDePayload({ organizacaoPrograma: "modular", topicosPrograma: topicos }))
      .toEqual(["M1 · Atendimento · 10h", "M2 · Comunicação escrita", "M3 · Excel · 15h"]);
    expect(labelsDePayload({ organizacaoPrograma: "livre", topicosPrograma: topicos }))
      .toEqual(["Atendimento · 10h", "Comunicação escrita", "Excel · 15h"]);
    // Sem tipo gravado (fichas antigas, incluindo as da Financiada) continua modular.
    expect(labelsDePayload({ topicosPrograma: topicos })[0]).toBe("M1 · Atendimento · 10h");
  });

  it("a ordem gravada é a ordem do programa (os códigos M seguem a posição)", () => {
    const reordenados = [topicos[2], topicos[0], topicos[1]];
    expect(labelsDePayload({ organizacaoPrograma: "modular", topicosPrograma: reordenados }))
      .toEqual(["M1 · Excel · 15h", "M2 · Atendimento · 10h", "M3 · Comunicação escrita"]);
  });

  it("sessões com rótulos antigos casam pelo título depois de reordenar ou de passar a livre", () => {
    const modular = ["M1 · Excel · 15h", "M2 · Atendimento · 10h", "M3 · Comunicação escrita"];
    // Antes da reordenação, Atendimento era o M1: casa pelo título, não pelo código.
    expect(casarModulo("M1 · Atendimento · 10h", modular)).toBe("M2 · Atendimento · 10h");
    // Rótulo antigo «C1 · …» de um programa livre casa com o rótulo sem código.
    const livre = ["Excel · 15h", "Atendimento · 10h", "Comunicação escrita"];
    expect(casarModulo("C2 · Atendimento · 8h", livre)).toBe("Atendimento · 10h");
    expect(casarModulo("Comunicação escrita", livre)).toBe("Comunicação escrita");
    // Título que não existe e código que já não há: sem correspondência.
    expect(casarModulo("C9 · Outro", livre)).toBeNull();
    // Título diferente com o mesmo código continua a casar pelo código (rótulos escritos de outra maneira).
    expect(casarModulo("M1 · Folha de cálculo", modular)).toBe("M1 · Excel · 15h");
  });

  it("Financiada: programa livre e regime síncrono/assíncrono gravados na ficha e no site", async () => {
    const ctx = await arrancar();
    const nome = `UFCD Programa Livre ${Date.now()}`;
    const c = await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", { ufcdCod: "8995", ufcd: nome, nomeComercial: nome, regime: "Online", horas: 25 });
    expect(c.statusCode, c.body).toBe(200);
    const id = (c.json() as { curso: { id: number } }).curso.id;
    const url = `/v1/cursos/fin/${id}/ficha`;
    const payload = { titulo: nome, regime: "Online", organizacaoPrograma: "livre", topicosPrograma: topicos, regimeSincronia: "assincrono" };

    expect((await pedido(ctx, "financiada", "PUT", url, { payload: { ...payload, regimeSincronia: "hibrido" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "PUT", url, { payload: { ...payload, organizacaoPrograma: "capitulos" } })).statusCode).toBe(400);
    const gravada = await pedido(ctx, "financiada", "PUT", url, { payload });
    expect(gravada.statusCode, gravada.body).toBe(200);

    const lida = (await pedido(ctx, "financiada", "GET", url)).json() as { ficha: { payload: Record<string, unknown> } };
    expect(lida.ficha.payload.regimeSincronia).toBe("assincrono");
    expect(lida.ficha.payload.organizacaoPrograma).toBe("livre");

    // A Financiada deixa de ser sempre modular: o cronograma recebe os capítulos sem código.
    expect(await modulosDaFicha(ctx.db, "fin", nome)).toEqual(["Atendimento · 10h", "Comunicação escrita", "Excel · 15h"]);

    const cat = (await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json() as {
      cursos: { titulo: string; organizacao: string; sincronia: string; programa: { titulo: string; horas: string }[] }[];
    };
    const curso = cat.cursos.find(x => x.titulo === nome)!;
    expect(curso.organizacao).toBe("livre");
    expect(curso.sincronia).toBe("Assíncrono");
    expect(curso.programa.map(p => p.titulo)).toEqual(["Atendimento", "Comunicação escrita", "Excel"]);
    expect(curso.programa.some(p => /^C\d/.test(p.titulo))).toBe(false);

    // Sem regime escolhido: vazio no site; sem tipo de programa: modular.
    await pedido(ctx, "financiada", "PUT", url, { payload: { titulo: nome, regime: "Online", topicosPrograma: topicos, regimeSincronia: "" } });
    const depois = ((await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json() as typeof cat).cursos.find(x => x.titulo === nome)!;
    expect(depois.sincronia).toBe("");
    expect(depois.organizacao).toBe("modular");
    expect(await modulosDaFicha(ctx.db, "fin", nome)).toEqual(["M1 · Atendimento · 10h", "M2 · Comunicação escrita", "M3 · Excel · 15h"]);
  });
});
