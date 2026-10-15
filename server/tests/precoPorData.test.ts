import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

type Sessao = { data: string; local: string; horario: string; preco: number | null };

describe("catálogo público: preço de cada data", () => {
  it("segue as regras da ficha (local, horário e local + horário) e o preço base", async () => {
    const ctx = await arrancar();
    const nome = `Curso Preços ${Date.now()}`;
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
      nome, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8,
    });
    expect(c.statusCode, c.body).toBe(200);
    const id = c.json().curso.id as number;
    const ficha = await pedido(ctx, "admin", "PUT", `/v1/cursos/gold/${id}/ficha`, {
      payload: {
        precosOferta: [
          { local: "Lisboa", horario: "", preco: 150 },
          { local: "Lisboa", horario: "Laboral", preco: 170 },
          { local: "", horario: "Sábado", preco: 90 },
        ],
      },
      criterios: [],
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    for (const [local, horario, data] of [["Lisboa", "Pós Laboral", "2031-01-05"], ["Lisboa", "Laboral", "2031-01-06"], ["Porto", "Sábado", "2031-01-07"], ["Porto", "Laboral", "2031-01-08"]]) {
      const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: data, nome: `T ${local} ${horario} ${Date.now()}`, curso: nome, local, horario, vagas: 10 });
      expect(t.statusCode, t.body).toBe(200);
    }
    const cat = (await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json() as { cursos: { titulo: string; sessoes: Sessao[] }[] };
    const sessoes = cat.cursos.find(x => x.titulo === nome)?.sessoes ?? [];
    const preco = (local: string, horario: string) => sessoes.find(s => s.local === local && s.horario === horario)?.preco;
    expect(preco("Lisboa", "Pós Laboral")).toBe(150);
    expect(preco("Lisboa", "Laboral")).toBe(170);
    expect(preco("Porto", "Sábado")).toBe(90);
    expect(preco("Porto", "Laboral")).toBe(100);
  });
});
