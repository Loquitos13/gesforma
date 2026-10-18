import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

type Contacto = { local: string; telemovel: string; telefone: string; email: string; whatsapp: string };

describe("contactos dos locais na página do curso", () => {
  it("vêm de Locais; a ficha do curso muda-os só para esse curso e só enquanto o local lhe estiver atribuído", async () => {
    const ctx = await arrancar();
    const novo = await pedido(ctx, "admin", "POST", "/v1/catalog/locais", {
      regime: "gold", payload: { nome: "Porto Teste", morada: "Rua A", telemovel: "912 000 111", email: "porto@ena.pt", status: "Ativo" },
    });
    expect(novo.statusCode, novo.body).toBeLessThan(300);
    expect((await pedido(ctx, "admin", "POST", "/v1/catalog/locais", { regime: "gold", payload: { nome: "Mau", email: "sem-arroba" } })).statusCode).toBe(400);

    const cursos = (await pedido(ctx, "admin", "GET", "/v1/cursos/gold")).json().cursos as { id: number; nome: string }[];
    const ccp = cursos.find(c => c.nome === "Formação de Formadores - CCP")!;
    const payload = ((await pedido(ctx, "admin", "GET", `/v1/cursos/gold/${ccp.id}/ficha`)).json().ficha?.payload ?? {}) as Record<string, unknown>;
    const locais = [...(Array.isArray(payload.locais) ? payload.locais as string[] : []), "Porto Teste"];
    const gravar = (extra: Record<string, unknown>) => pedido(ctx, "admin", "PUT", `/v1/cursos/gold/${ccp.id}/ficha`, { payload: { ...payload, ...extra } });
    const contactos = async () => {
      const cat = (await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json().cursos as { titulo: string; contactosLocais: Contacto[] }[];
      return cat.find(c => c.titulo === ccp.nome)!.contactosLocais.find(c => c.local === "Porto Teste");
    };

    expect((await gravar({ locais, contactosLocais: {} })).statusCode).toBe(200);
    expect(await contactos()).toMatchObject({ telemovel: "912 000 111", email: "porto@ena.pt", telefone: "" });

    // Campo a campo: o telemóvel da ficha ganha, o email continua a vir de Locais.
    await gravar({ locais, contactosLocais: { "Porto Teste": { telemovel: "933 222 333", telefone: "", email: "", whatsapp: "912 999 000" } } });
    expect(await contactos()).toMatchObject({ telemovel: "933 222 333", email: "porto@ena.pt", whatsapp: "912 999 000" });

    // Sem o local atribuído ao curso, os contactos da ficha deixam de contar (e o local sai da página).
    await gravar({ locais: locais.filter(l => l !== "Porto Teste"), contactosLocais: { "Porto Teste": { telemovel: "933 222 333", telefone: "", email: "", whatsapp: "" } } });
    expect(await contactos()).toBeUndefined();
  });
});
