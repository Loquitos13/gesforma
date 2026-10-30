import { beforeAll, describe, expect, it } from "vitest";
import { areaCanonica } from "../../src/partilhado/areasFormacao.js";
import { arrancar, type Ctx } from "./helpers.js";

describe("Áreas de formação do site", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });

  it("as áreas antigas da Gold passam para as 7 do site", () => {
    expect(areaCanonica("Saúde e bem estar")).toBe("Saúde e Bem Estar");
    expect(areaCanonica("Desenvolvimento Pessoal")).toBe("Gestão de Pessoas e Desenvolvimento");
    expect(areaCanonica("Boas práticas pedagógicas")).toBe("CCP e Gestão da Formação");
    expect(areaCanonica("Informática e IA")).toBe("Informática e IA");
  });

  it("depois da migração só ficam ativas as áreas do site", async () => {
    const { rows } = await ctx.db.query<{ nome: string }>(
      `SELECT payload->>'nome' AS nome FROM catalog_items
        WHERE kind = 'areas' AND regime = 'gold' AND coalesce(payload->>'status', payload->>'estado', 'Ativo') NOT IN ('Inativo', 'Inactivo')`);
    expect(rows.map(r => r.nome).sort()).toEqual([
      "CCP e Gestão da Formação", "Gestão de Pessoas e Desenvolvimento", "Informática e IA",
      "Marketing, Business e Comunicação", "Saúde e Bem Estar", "Seguros e Fundos de Pensões",
    ].sort());
  });
});
