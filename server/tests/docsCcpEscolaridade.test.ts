// Gatilhos dos documentos da pré-inscrição: pedidos só a quem cumpre (escolaridade, nacionalidade, local, horário).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const ids = (l: { id: string; required: boolean }[]) => l.filter(d => d.id !== "comprovativo").map(d => `${d.id}:${d.required ? 1 : 0}`);

describe("gatilhos dos documentos", () => {
  it("escolaridade, nacionalidade e local: cumpre → obrigatório; não cumpre → não se pede; sem dado → opcional", async () => {
    const ctx = await arrancar();
    const nome = `Formação de Formadores - CCP ${Date.now()}`;
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "CCP", tipo: "Pré-inscrição", preco: 100, regime: "B-learning", horas: 90 })).statusCode).toBe(200);
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [nome])).rows[0]!.id;
    const { docsDoCurso, gravarDocsPreinscricao } = await import("../src/docsCurso.js");
    await gravarDocsPreinscricao(ctx.db, "gold", cursoId, {
      ocultos: ["contrato", "regulamento", "pip"],
      extra: [{ id: "cert-hab", label: "Certificado de habilitações", required: true }, { id: "residencia", label: "Título de residência", required: false }],
      condicoes: { exp: { escolaridade: ["12.º ano"] }, residencia: { nacionalidade: ["Estrangeira"], local: ["Lisboa"] } },
    });
    const docs = async (p?: Record<string, string>) => ids(await docsDoCurso(ctx.db, nome, "gold", p));

    expect(await docs({ escolaridade: "12.º ano", nacionalidade: "Portugal", local: "Porto" })).toEqual(["cc:1", "exp:1", "cert-hab:1"]);
    expect(await docs({ escolaridade: "Licenciatura", nacionalidade: "Portugal", local: "Porto" })).toEqual(["cc:1", "cert-hab:1"]);
    // Estrangeiro em Lisboa: o título de residência passa a obrigatório; em Portugal ou noutro local não se pede.
    expect(await docs({ escolaridade: "Mestrado", nacionalidade: "Brasil", local: "lisboa" })).toEqual(["cc:1", "cert-hab:1", "residencia:1"]);
    expect(await docs({ escolaridade: "Mestrado", nacionalidade: "Brasil", local: "Porto" })).toEqual(["cc:1", "cert-hab:1"]);
    // Pedido antigo (sem dados): os documentos com gatilho ficam opcionais.
    expect(await docs({})).toEqual(["cc:1", "exp:0", "cert-hab:1", "residencia:0"]);
    // Sem pessoa: a lista da ficha, como está.
    expect(ids(await docsDoCurso(ctx.db, nome, "gold"))).toEqual(["cc:1", "exp:0", "cert-hab:1", "residencia:0"]);
  });

  it("a ficha do curso lê e grava o gatilho de cada documento", async () => {
    const ctx = await arrancar();
    const nome = `Curso Gatilho ${Date.now()}`;
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "T", tipo: "Pré-inscrição", preco: 50, regime: "Presencial", horas: 8 });
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [nome])).rows[0]!.id;
    const url = `/v1/cursos/gold/${cursoId}/docs-preinscricao`;
    const r = await pedido(ctx, "secretaria", "PUT", url, {
      ocultos: [], condicoes: { exp: { escolaridade: ["12.º ano", "inventado"] } },
      extra: [{ label: "Declaração da entidade empregadora", required: false, gatilho: { horario: ["Pós-laboral"] } }],
    });
    expect(r.statusCode, r.body).toBe(200);
    const lidos = (await pedido(ctx, "secretaria", "GET", url)).json() as { docs: { id: string; label: string; gatilho: unknown }[] };
    expect(lidos.docs.find(d => d.id === "exp")?.gatilho).toEqual({ escolaridade: ["12.º ano"] });
    expect(lidos.docs.find(d => d.label.startsWith("Declaração"))?.gatilho).toEqual({ horario: ["Pós-laboral"] });
  });

  it("migração: o CCP passa a pedir o comprovativo de experiência só com o 12.º ano", async () => {
    const ctx = await arrancar();
    const nome = `Formação de Formadores - CCP mig ${Date.now()}`;
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "CCP", tipo: "Pré-inscrição", preco: 100, regime: "B-learning", horas: 90 });
    await ctx.db.query("UPDATE cursos_gold SET docs_preinscricao = $2::jsonb WHERE nome = $1", [nome, JSON.stringify({ ocultos: ["exp", "pip"], extra: [] })]);
    const sql = readFileSync(new URL("../src/db/migrations/222_docs_gatilhos.sql", import.meta.url), "utf8");
    const update = sql.split(/;\s*\n/).find(p => p.includes("UPDATE cursos_gold"))!;
    await ctx.db.query(update.slice(update.indexOf("UPDATE")));
    const cfg = (await ctx.db.query<{ docs_preinscricao: { ocultos: string[]; condicoes: Record<string, unknown> } }>(
      "SELECT docs_preinscricao FROM cursos_gold WHERE nome = $1", [nome])).rows[0]!.docs_preinscricao;
    expect(cfg.ocultos).toEqual(["pip"]);
    expect(cfg.condicoes.exp).toEqual({ escolaridade: ["12.º ano"] });
  });
});
