import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
function unico(prefixo: string) {
  seq += 1;
  return `${prefixo}-${Date.now()}-${seq}`;
}

async function novoLead(ctx: Ctx, body: Record<string, unknown>, perfil: "secretaria" | "comercial" | "financiada" = "secretaria") {
  const r = await pedido(ctx, perfil, "POST", "/v1/preinscricoes", { nome: "Teste", ...body });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().preinscricao.id as number;
}

type Lista = {
  items: { id: number; nome: string; estado: string; origem: string; campanha: string }[];
  total: number; page: number; perPage: number;
  counts: Record<string, number>;
  facets: { cursos: string[]; locais: string[]; origens: string[]; campanhas: string[] };
};

async function lista(ctx: Ctx, qs: string) {
  const r = await pedido(ctx, "secretaria", "GET", `/v1/crm/leads?${qs}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Lista;
}

describe("CRM: lista, filtros e filas", () => {
  it("filtra por curso, local, origem, estado e pesquisa, e pagina", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso CRM");
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) {
      ids.push(await novoLead(ctx, {
        nome: `Pessoa${i}`, apelido: unico("ap"), telf: `91${String(1000000 + seq * 13 + i).slice(-7)}`,
        curso, local: i % 2 ? "Porto" : "Gaia", origem: i % 3 === 0 ? "Instagram" : "Google", regime: "gold",
      }));
    }
    const todos = await lista(ctx, `regime=gold&curso=${encodeURIComponent(curso)}&perPage=10&page=1`);
    expect(todos.total).toBe(12);
    expect(todos.items).toHaveLength(10);
    const p2 = await lista(ctx, `regime=gold&curso=${encodeURIComponent(curso)}&perPage=10&page=2`);
    expect(p2.items).toHaveLength(2);
    expect(new Set([...todos.items, ...p2.items].map(i => i.id)).size).toBe(12);

    const porto = await lista(ctx, `regime=gold&curso=${encodeURIComponent(curso)}&local=Porto`);
    expect(porto.total).toBe(6);
    const insta = await lista(ctx, `regime=gold&curso=${encodeURIComponent(curso)}&origem=Instagram`);
    expect(insta.total).toBe(4);
    expect(insta.items.every(i => i.origem === "Instagram")).toBe(true);
    expect(todos.facets.origens).toEqual(expect.arrayContaining(["Instagram", "Google"]));

    const pesquisa = await lista(ctx, `regime=gold&q=Pessoa11`);
    expect(pesquisa.items.map(i => i.id)).toContain(ids[11]);

    // Ordenação por nome ascendente.
    const ord = await lista(ctx, `regime=gold&curso=${encodeURIComponent(curso)}&sort=nome&dir=asc&perPage=50`);
    const nomes = ord.items.map(i => i.nome);
    expect([...nomes].sort((a, b) => a.localeCompare(b))).toEqual(nomes);
  });

  it("filas e contagens: por contactar, contactados, atrasados; datas", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Fila");
    const a = await novoLead(ctx, { telf: "912000001", curso, regime: "gold" });
    const b = await novoLead(ctx, { telf: "912000002", curso, regime: "gold" });
    const antes = await lista(ctx, "regime=gold&fila=contactar&perPage=100");
    expect(antes.items.map(i => i.id)).toEqual(expect.arrayContaining([a, b]));
    const c = await pedido(ctx, "secretaria", "POST", `/v1/preinscricoes/${a}/contactar`, { nota: "Ligou", meio: "Telefone" });
    expect(c.statusCode, c.body).toBe(200);
    expect(c.json().preinscricao.estado).toBe("1º Contacto");
    const depois = await lista(ctx, "regime=gold&fila=contactar&perPage=100");
    expect(depois.items.map(i => i.id)).not.toContain(a);
    expect(depois.counts.porContactar).toBe(antes.counts.porContactar - 1);

    await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${b}`, { proximoContacto: "2020-01-02" });
    const atrasados = await lista(ctx, "regime=gold&fila=atrasados&perPage=100");
    expect(atrasados.items.map(i => i.id)).toContain(b);
    expect(atrasados.counts.atrasados).toBeGreaterThanOrEqual(1);

    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
    const intervalo = await lista(ctx, `regime=gold&de=${hoje}&ate=${hoje}&curso=${encodeURIComponent(curso)}`);
    expect(intervalo.total).toBe(2);
    const fora = await lista(ctx, `regime=gold&de=2001-01-01&ate=2001-01-31&curso=${encodeURIComponent(curso)}`);
    expect(fora.total).toBe(0);

    // Filtro inválido dá 400 e não 500.
    expect((await pedido(ctx, "secretaria", "GET", "/v1/crm/leads?de=ontem")).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/crm/leads?fila=qualquer")).statusCode).toBe(400);
  });

  it("origem fica sempre um valor da lista e a campanha liga por id", async () => {
    const ctx = await arrancar();
    const nomeCampanha = unico("Campanha");
    const camp = await ctx.db.query<{ id: number }>("INSERT INTO campanhas (id, nome, data, curso) VALUES ((SELECT COALESCE(max(id), 0) + 1 FROM campanhas), $1, '2026-10-01', '') RETURNING id", [nomeCampanha]);
    const campanhaId = camp.rows[0]!.id;
    const id = await novoLead(ctx, { telf: "913000001", origem: "Vi no TikTok", campanha: nomeCampanha });
    const row = await ctx.db.query<{ origem: string; campanha_id: number | null; campanha: string }>(
      "SELECT origem, campanha_id, campanha FROM preinscricoes WHERE id = $1", [id]);
    const lista = await ctx.db.query<{ nome: string }>(
      "SELECT payload->>'nome' AS nome FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = 'origens'");
    if (lista.rows.length) expect(lista.rows.map(r => r.nome)).toContain(row.rows[0]!.origem);
    expect(row.rows[0]).toMatchObject({ campanha_id: campanhaId, campanha: nomeCampanha });

    const porCampanha = await pedido(ctx, "secretaria", "GET", `/v1/crm/leads?campanhaId=${campanhaId}`);
    expect(porCampanha.json().items.map((i: { id: number }) => i.id)).toEqual([id]);

    // O formulário público também guarda a campanha pelo nome da ligação.
    const pub = await ctx.app.inject({
      method: "POST", url: "/v1/public/preinscricoes", remoteAddress: "10.9.9.9",
      payload: { nome: "Site", email: `${unico("site")}@exemplo.pt`, origem: "Instagram", campanha: nomeCampanha },
    });
    expect(pub.statusCode, pub.body).toBe(200);
    const p = await ctx.db.query<{ campanha_id: number | null }>("SELECT campanha_id FROM preinscricoes WHERE id = $1", [pub.json().preinscricao.id]);
    expect(p.rows[0]!.campanha_id).toBe(campanhaId);
  });

  it("acções em lote e exportação CSV sem fórmulas", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Lote");
    const a = await novoLead(ctx, { nome: "=HYPERLINK(1)", telf: "914000001", curso });
    const b = await novoLead(ctx, { telf: "914000002", curso });
    const r = await pedido(ctx, "secretaria", "POST", "/v1/crm/lote", { ids: [a, b], acao: "adiar", dias: 3 });
    expect(r.json().updated).toBe(2);
    const prox = await ctx.db.query<{ proximo_contacto: string }>("SELECT proximo_contacto FROM preinscricoes WHERE id IN ($1, $2)", [a, b]);
    expect(prox.rows.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.proximo_contacto))).toBe(true);

    const csv = await pedido(ctx, "secretaria", "GET", `/v1/crm/export?curso=${encodeURIComponent(curso)}`);
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain("'=HYPERLINK(1)");
  });
});

describe("CRM: lote, completar e edição", () => {
  it("lote: «Pago» recusado, «Desistiu» exige motivo, «Pré-inscrição» envia a ligação pessoal", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Lote2");
    const email = `${unico("lote")}@exemplo.pt`;
    const a = await novoLead(ctx, { telf: "914100001", email, curso, regime: "gold" });
    const b = await novoLead(ctx, { telf: "914100002", curso, regime: "gold" });
    expect((await pedido(ctx, "secretaria", "POST", "/v1/crm/lote", { ids: [a, b], acao: "estado", estado: "Pago" })).statusCode).toBe(409);
    const pagos = await ctx.db.query("SELECT 1 FROM preinscricoes WHERE id IN ($1, $2) AND estado = 'Pago'", [a, b]);
    expect(pagos.rows).toHaveLength(0);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/crm/lote", { ids: [b], acao: "estado", estado: "Desistiu" })).statusCode).toBe(400);
    const desistiu = await pedido(ctx, "secretaria", "POST", "/v1/crm/lote", { ids: [b], acao: "estado", estado: "Desistiu", motivoDesistencia: "Preço" });
    expect(desistiu.json().updated).toBe(1);
    const rb = await ctx.db.query<{ estado: string; motivo_desistencia: string }>("SELECT estado, motivo_desistencia FROM preinscricoes WHERE id = $1", [b]);
    expect(rb.rows[0]).toMatchObject({ estado: "Desistiu", motivo_desistencia: "Preço" });
    const pre = await pedido(ctx, "secretaria", "POST", "/v1/crm/lote", { ids: [a], acao: "estado", estado: "Pré-inscrição" });
    expect(pre.json().updated).toBe(1);
    const ligacao = await ctx.db.query("SELECT 1 FROM preinscricao_contactos WHERE preinscricao_id = $1 AND nota LIKE 'Ligação pessoal%'", [a]);
    expect(ligacao.rows).toHaveLength(1);
  });

  it("completar NIF e morada: cifra, valida antes de gravar e não recua etapas", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Completar");
    const dados = { nome: "Rita", apelido: "Sousa", telf: "914200001", email: `${unico("comp")}@exemplo.pt`, concelho: "Porto",
      curso, local: "Porto", horario: "Laboral", inicioCurso: "2026-11-02", regime: "gold" };
    const id = await novoLead(ctx, dados);
    // Já tem PII cifrada (telefone): o NIF novo junta-se à cifra em vez de ficar em claro.
    const falta = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/completar`, { nif: "509999999" });
    expect(falta.statusCode).toBe(400);
    expect((await ctx.db.query<{ nif: string }>("SELECT nif FROM preinscricoes WHERE id = $1", [id])).rows[0]!.nif).toBe("");
    const ok = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/completar`, { nif: "509 999 999", moradaFiscal: "Rua das Flores, 10" });
    expect(ok.statusCode, ok.body).toBe(200);
    const row = (await ctx.db.query<{ nif: string; morada_fiscal: string; pii_enc: string; estado: string }>(
      "SELECT nif, morada_fiscal, pii_enc, estado FROM preinscricoes WHERE id = $1", [id])).rows[0]!;
    expect(row).toMatchObject({ nif: "", morada_fiscal: "", estado: "Pré-inscrição" });
    expect(row.pii_enc).not.toContain("509999999");
    const { readPreinscricaoPii } = await import("../src/pii.js");
    expect(readPreinscricaoPii(row)).toMatchObject({ nif: "509999999", moradaFiscal: "Rua das Flores, 10", telf: "914200001" });

    // Uma inscrição paga não volta a «Pré-inscrição» ao completar.
    const pago = await novoLead(ctx, { ...dados, email: `${unico("comp")}@exemplo.pt`, telf: "914200002" });
    await ctx.db.query("UPDATE preinscricoes SET estado = 'Pago' WHERE id = $1", [pago]);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${pago}/completar`, { nif: "509999999", moradaFiscal: "Rua das Flores, 10" })).statusCode).toBe(200);
    expect((await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricoes WHERE id = $1", [pago])).rows[0]!.estado).toBe("Pago");
  });

  it("editar recusa email inválido", async () => {
    const ctx = await arrancar();
    const id = await novoLead(ctx, { telf: "914300001" });
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${id}`, { email: "nao-e-email" })).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${id}`, { email: " Ok@Exemplo.pt " })).statusCode).toBe(200);
  });
});

describe("CRM: permissões", () => {
  it("sem sessão 401; formador e formando não vêem o CRM; comercial não apaga nem valida", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, null, "GET", "/v1/crm/leads")).statusCode).toBe(401);
    expect((await pedido(ctx, "formador", "GET", "/v1/crm/leads")).statusCode).toBe(403);
    expect((await pedido(ctx, "formando", "GET", "/v1/crm/leads")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "POST", "/v1/preinscricoes", { nome: "X", telf: "915000000" })).statusCode).toBe(403);
    const id = await novoLead(ctx, { telf: "915000001" }, "comercial");
    expect((await pedido(ctx, "comercial", "DELETE", `/v1/preinscricoes/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/validar-preinscricao`, {})).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/pedir-pagamento`)).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${id}`)).statusCode).toBe(200);
    // Comercial é sempre Gold; a financiada regista na Financiada.
    const fin = await novoLead(ctx, { telf: "915000002", regime: "gold" }, "financiada");
    const r = await ctx.db.query<{ regime: string }>("SELECT regime FROM preinscricoes WHERE id = $1", [fin]);
    expect(r.rows[0]!.regime).toBe("fin");
    // Apagar fica auditado.
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/preinscricoes/${id}`)).statusCode).toBe(200);
    const audit = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'preinscricao.apagar' AND entity_id = $1", [String(id)]);
    expect(audit.rows).toHaveLength(1);
  });
});
