// Formandos › Nova ficha (Gold e Financiada): os documentos são os da ficha do curso no momento da criação (obrigatórios
// como no curso; opcionais e condicionais como opcionais; os desmarcados no curso ficam de fora). Mudar depois o curso
// não mexe nas fichas já guardadas. A equipa pode anexar outros documentos (vão para a Drive).
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
let ctx: Ctx;
beforeAll(async () => { ctx = await arrancar(); });

function carregar(regime: "gold" | "fin", id: number, docId: string, rotulo = "") {
  const boundary = "----doc";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    PDF, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/formandos/${regime}/${id}/documentos/${docId}/ficheiro${rotulo ? `?rotulo=${encodeURIComponent(rotulo)}` : ""}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, cookie: ctx.cookie.admin, "x-gesforma-client": "web" },
  });
}
const ficha = async (regime: "gold" | "fin", id: number) => (await pedido(ctx, "admin", "GET", `/v1/formandos/${regime}/${id}`)).json().ficha as {
  documentos: { id: string; label: string; required: boolean; estado: string }[];
};

describe("nova ficha com os documentos do curso", () => {
  it("Financiada: desmarcados ficam de fora, condicionais opcionais, e a ficha guardada não muda com o curso", async () => {
    const curso = (await ctx.db.query<{ id: number; nome_comercial: string; ufcd: string }>("SELECT id, nome_comercial, ufcd FROM cursos_fin ORDER BY id LIMIT 1")).rows[0]!;
    const nomeCurso = curso.nome_comercial || curso.ufcd;
    // No curso: «Comprovativo de morada» desmarcado; «Curriculum vitae» só para estrangeiros (condicional).
    const put = await pedido(ctx, "admin", "PUT", `/v1/cursos/fin/${curso.id}/docs-preinscricao`, {
      ocultos: ["morada"], extra: [], condicoes: { cu: { nacionalidade: ["Estrangeira"] } },
    });
    expect(put.statusCode, put.body).toBe(200);
    const lista = (await pedido(ctx, "admin", "GET", `/v1/formandos/fin/docs-do-curso?curso=${encodeURIComponent(nomeCurso)}`)).json().documentos as { id: string; required: boolean; condicional: boolean }[];
    expect(lista.some(d => d.id === "morada")).toBe(false);
    expect(lista.find(d => d.id === "cu")).toMatchObject({ required: false, condicional: true });
    expect(lista.find(d => d.id === "cc")).toMatchObject({ required: true });

    const r = await pedido(ctx, "admin", "POST", "/v1/formandos-fin", { nome: "Nova", apelido: "Ficha", email: `nova.${randomUUID().slice(0, 8)}@exemplo.pt`, curso: nomeCurso, semEmails: true, docsCurso: true });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formando.id as number;
    let f = await ficha("fin", id);
    expect(f.documentos.map(d => d.id)).toEqual(lista.map(d => d.id));
    expect(f.documentos.find(d => d.id === "cu")!.required).toBe(false);

    // O curso muda depois: a morada volta a ser pedida e o CV deixa de ser condicional. A ficha guardada fica igual.
    await pedido(ctx, "admin", "PUT", `/v1/cursos/fin/${curso.id}/docs-preinscricao`, { ocultos: [], extra: [], condicoes: {} });
    f = await ficha("fin", id);
    expect(f.documentos.some(d => d.id === "morada")).toBe(false);
    expect(f.documentos.find(d => d.id === "cu")!.required).toBe(false);

    // Outros documentos: com nome, vão para a ficha (opcionais) e ficam validados.
    expect((await carregar("fin", id, "outro-sem-nome1")).statusCode).toBe(400);
    const up = await carregar("fin", id, "outro-abc123-x", "Declaração da junta");
    expect(up.statusCode, up.body).toBe(200);
    f = await ficha("fin", id);
    expect(f.documentos.find(d => d.id === "outro-abc123-x")).toMatchObject({ label: "Declaração da junta", required: false, estado: "validado" });
    // Documento de fora da lista da ficha: recusado.
    expect((await carregar("fin", id, "morada")).statusCode).toBe(404);
  });

  it("Gold: curso sem lista própria usa os documentos da ficha Gold; fichas antigas ficam como estavam", async () => {
    const lista = (await pedido(ctx, "admin", "GET", `/v1/formandos/gold/docs-do-curso?curso=${encodeURIComponent("Formação de Formadores - CCP")}`)).json().documentos as { id: string; required: boolean }[];
    expect(lista.find(d => d.id === "cc")).toMatchObject({ required: true });
    const r = await pedido(ctx, "admin", "POST", "/v1/formandos-gold", { nome: "Nova", apelido: "Gold", email: `gold.${randomUUID().slice(0, 8)}@exemplo.pt`, curso: "Formação de Formadores - CCP", valor: 125, semEmails: true, docsCurso: true });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formando.id as number;
    expect((await carregar("gold", id, "cc")).statusCode).toBe(200);
    expect((await ficha("gold", id)).documentos.find(d => d.id === "cc")!.estado).toBe("validado");
    const antiga = await pedido(ctx, "admin", "POST", "/v1/formandos-gold", { nome: "Antiga", email: `ant.${randomUUID().slice(0, 8)}@exemplo.pt`, curso: "Formação de Formadores - CCP", valor: 125 });
    const fa = await ficha("gold", antiga.json().formando.id);
    expect(fa.documentos.map(d => d.id)).toEqual(lista.map(d => d.id));
  });
});
