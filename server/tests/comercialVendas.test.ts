import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { podeAceder } from "../src/permissoes.js";
import { menuDoPerfil, vistaNoMenuDoPerfil } from "../../src/gesforma/shell/navegacao.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

/**
 * O comercial só vende: pré-inscrições (e os seus documentos), clientes, parceiros, contratos, campanhas,
 * equipa, blog, painel de vendas e os cronogramas das turmas (só leitura). Turmas, cursos, formandos,
 * formadores, dossiê, inquéritos e listas de opções ficam fora — no menu e no servidor.
 */
let ctx: Ctx;

beforeAll(async () => {
  ctx = await arrancar();
});

afterAll(async () => {
  await ctx.app.close();
});

const TURMA = 993101;
const TURMA_ACABADA = 993102;
const TURMA_FECHADA = 993103;

async function prepararTurmas() {
  const cronograma = [
    { id: "s1", data: "2099-03-02", horaInicio: "19:00", horaFim: "22:00", modalidade: "presencial", modulos: ["M2 · Avançado", "M1 · Base"], formadores: ["Rui Formador"] },
    { id: "s2", data: "2099-03-04", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", modulos: ["M3 · Prática"], formadores: ["Rui Formador"] },
    { id: "fim-cronograma", data: "2099-03-31" },
  ];
  await ctx.db.query(
    `INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario, vagas, total_alunos, estado, formador, cronograma,
                              custo_hora_sala, valores_hora_formador, vagas_anunciadas)
     VALUES ($1, '2099-03-02', 'CV Vendas 01', 'Curso Vendas CV', 'Lisboa', 'Pós-laboral', 12, 4, 'Ativa', 'Rui Formador', $2::jsonb,
             35, '{"Rui Formador": 40}'::jsonb, 3)
     ON CONFLICT (id) DO NOTHING`,
    [TURMA, JSON.stringify(cronograma)],
  );
  await ctx.db.query(
    `INSERT INTO turmas_gold (id, data_inicio, nome, curso, estado, cronograma)
     VALUES ($1, '2001-01-10', 'CV Acabada', 'Curso Vendas CV', 'Ativa', '[{"id":"a","data":"2001-01-10","horaInicio":"09:00","horaFim":"13:00"}]'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [TURMA_ACABADA],
  );
  await ctx.db.query(
    "INSERT INTO turmas_gold (id, data_inicio, nome, curso, estado) VALUES ($1, '2099-05-01', 'CV Fechada', 'Curso Vendas CV', 'Fechada') ON CONFLICT (id) DO NOTHING",
    [TURMA_FECHADA],
  );
  await ctx.db.query(
    "INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id) VALUES (993111, 'Ana', 'Formanda', 'ana.cv@exemplo.pt', 'Curso Vendas CV', 'CV Vendas 01', $1) ON CONFLICT (id) DO NOTHING",
    [TURMA],
  );
}

async function leadDoComercial() {
  const r = await pedido(ctx, "comercial", "POST", "/v1/preinscricoes", {
    nome: "Lead", apelido: "Vendas", email: `lead.cv.${Date.now()}@exemplo.pt`, telf: "912345678", curso: "Curso Vendas CV",
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().preinscricao.id as number;
}

describe("menu do comercial", () => {
  it("só vendas: painel, CRM, equipa, campanhas e cronogramas", () => {
    const menu = menuDoPerfil("comercial");
    const vistas = menu.flatMap(g => g.items.flatMap(i => [i.view, ...(i.children ?? []).map(c => c.view)]).filter(Boolean));
    expect(menu.map(g => g.group)).toEqual(["Gold"]);
    expect(vistas).toEqual([
      "gold-painel", "gold-preinscricoes", "gold-crm-clientes", "gold-crm-parceiros", "gold-crm-contratos",
      "gold-equipa", "gold-campanhas", "gold-cronogramas",
    ]);
  });

  it("pelo endereço também não abre turmas, cursos, formandos, formadores, dossiê nem listas", () => {
    for (const v of ["gold-turmas", "gold-cockpit-turma", "gold-cursos", "gold-curso-ficha", "gold-modulos", "gold-datas", "gold-locais",
      "gold-horarios", "gold-areas-tematicas", "gold-conteudos", "gold-formandos-turmas", "gold-formandos-gold", "gold-formando-ficha",
      "gold-formadores", "formador-ficha", "formadores", "gold-dtp", "gold-inqueritos", "listas-opcoes", "empresas-servicos",
      "fin-painel", "pagamentos", "configuracoes", "blog-posts", "blog-tematicas"] as const) {
      expect(vistaNoMenuDoPerfil("comercial", v), v).toBe(false);
    }
    for (const v of ["gold-painel", "painel", "gold-preinscricoes", "equipa", "gold-cronogramas", "notificacoes"] as const) {
      expect(vistaNoMenuDoPerfil("comercial", v), v).toBe(true);
    }
  });

  it("os outros perfis não mudam; os Cronogramas só estão no menu do comercial", () => {
    const vistas = (role: string) => menuDoPerfil(role).flatMap(g => g.items.flatMap(i => [i.view, ...(i.children ?? []).map(c => c.view)]));
    expect(vistas("secretaria")).toContain("gold-turmas");
    expect(vistas("secretaria")).toContain("listas-opcoes");
    expect(vistas("secretaria")).not.toContain("gold-cronogramas");
    expect(vistas("admin")).toContain("gold-formadores");
    expect(vistas("financiada")).toContain("fin-turmas");
    expect(vistaNoMenuDoPerfil("secretaria", "gold-cronogramas")).toBe(true);
    expect(vistaNoMenuDoPerfil("financiada", "gold-cronogramas")).toBe(false);
    expect(vistaNoMenuDoPerfil("secretaria", "gold-cockpit-turma")).toBe(true);
  });
});

describe("servidor: o comercial não chega à gestão", () => {
  it("matriz: 403 nas rotas de turmas, cursos, formandos, formadores, dossiê, inquéritos e listas", () => {
    const bloqueadas: [string, string][] = [
      ["GET", "/v1/turmas?regime=gold"], ["GET", "/v1/turmas/gold/1"], ["POST", "/v1/turmas-gold"], ["PATCH", "/v1/turmas-gold/1"],
      ["DELETE", "/v1/turmas-gold/1"], ["GET", "/v1/turmas/gold/1/pedagogia"], ["GET", "/v1/turmas/gold/1/avaliacao"],
      ["GET", "/v1/turmas/gold/1/horas-formador"], ["PUT", "/v1/turmas/gold/1/sessoes/1"], ["POST", "/v1/turmas/gold/1/fecho"],
      ["GET", "/v1/turmas/gold/1/dossie/x"], ["POST", "/v1/turmas/gold/1/cronograma/publicar"],
      ["GET", "/v1/cursos/gold"], ["GET", "/v1/cursos/gold/1"], ["POST", "/v1/cursos-gold"], ["PATCH", "/v1/cursos-gold/1"],
      ["PUT", "/v1/cursos/gold/1/ficha"], ["POST", "/v1/cursos/gold/1/imagem/capa"], ["PUT", "/v1/cursos/gold/1/docs-preinscricao"],
      ["GET", "/v1/catalogos/datas"], ["POST", "/v1/catalog/datas"], ["PATCH", "/v1/catalog/locais/1"], ["DELETE", "/v1/catalog/modulos/1"],
      ["GET", "/v1/formadores"], ["GET", "/v1/formadores/1"], ["PATCH", "/v1/formadores/1"], ["GET", "/v1/formadores/1/ocupacao"],
      ["GET", "/v1/formandos?regime=gold"], ["GET", "/v1/formandos/gold/1"], ["POST", "/v1/formandos-gold"], ["PATCH", "/v1/formandos-gold/1"],
      ["GET", "/v1/dtp/gold"], ["GET", "/v1/dtp/gold/resumo"], ["GET", "/v1/dtp/gold/1/export"],
      ["GET", "/v1/inqueritos"], ["GET", "/v1/inqueritos/1/resultados"],
      ["GET", "/v1/blog"], ["POST", "/v1/blog"], ["GET", "/v1/catalogos/blog_tematicas"],
      ["GET", "/v1/listas"], ["POST", "/v1/listas/origens"], ["GET", "/v1/turma-regras"],
      ["GET", "/v1/opcoes/formadores"], ["GET", "/v1/opcoes/modulos"], ["GET", "/v1/opcoes/conteudos"],
      ["GET", "/v1/settings"], ["GET", "/v1/pagamentos"],
    ];
    for (const [m, p] of bloqueadas) expect(podeAceder("comercial", m, p), `${m} ${p}`).toBe(false);
    // A secretaria continua a chegar lá.
    for (const [m, p] of bloqueadas.filter(([, p]) => !p.startsWith("/v1/turma-regras") && !p.startsWith("/v1/settings"))) {
      expect(podeAceder("secretaria", m, p), `secretaria ${m} ${p}`).toBe(true);
    }
  });

  it("pedidos reais: 403 em gestão de turmas, cursos, formadores, formandos, dossiê e listas", async () => {
    await prepararTurmas();
    const pedidos: [Parameters<typeof pedido>[2], string, unknown?][] = [
      ["GET", "/v1/turmas?regime=gold"],
      ["GET", `/v1/turmas/gold/${TURMA}`],
      ["PATCH", `/v1/turmas-gold/${TURMA}`, { vagasAnunciadas: 2 }],
      ["POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome: "CV nova", curso: "Curso Vendas CV", vagas: 10 }],
      ["GET", `/v1/turmas/gold/${TURMA}/pedagogia`],
      ["GET", `/v1/turmas/gold/${TURMA}/horas-formador`],
      ["GET", "/v1/cursos/gold"],
      ["POST", "/v1/cursos-gold", { nome: "Curso CV novo" }],
      ["GET", "/v1/formadores?regime=gold"],
      ["GET", "/v1/formandos?regime=gold"],
      ["GET", "/v1/formandos/gold/993111"],
      ["GET", "/v1/dtp/gold/resumo"],
      ["GET", "/v1/inqueritos?regime=gold"],
      ["GET", "/v1/listas"],
      ["GET", "/v1/catalogos/locais?regime=gold"],
    ];
    for (const [m, url, body] of pedidos) {
      expect((await pedido(ctx, "comercial", m, url, body)).statusCode, `${m} ${url}`).toBe(403);
    }
    const t = await ctx.db.query<{ vagas_anunciadas: number }>("SELECT vagas_anunciadas FROM turmas_gold WHERE id = $1", [TURMA]);
    expect(t.rows[0]!.vagas_anunciadas).toBe(3);
  });

  it("opções em lote: só as que os formulários de venda usam", async () => {
    const r = await pedido(ctx, "comercial", "GET", "/v1/opcoes?kinds=cursos,turmas,locais,horarios,formadores,modulos&regime=gold");
    expect(r.statusCode, r.body).toBe(200);
    expect(Object.keys(r.json().opcoes).sort()).toEqual(["cursos", "horarios", "locais", "turmas"]);
  });
});

describe("servidor: o que o comercial usa continua a funcionar", () => {
  it("pré-inscrições (lista, ficha, notas), clientes, contratos, propostas, campanhas, equipa e opções", async () => {
    const lead = await leadDoComercial();
    const ok: [Parameters<typeof pedido>[2], string, unknown?][] = [
      ["GET", "/v1/crm/leads?regime=gold"],
      ["GET", `/v1/crm/leads/${lead}`],
      ["POST", `/v1/crm/leads/${lead}/notas`, { nota: "Ligou a pedir o cronograma." }],
      ["PATCH", `/v1/preinscricoes/${lead}`, { local: "Lisboa", horario: "Pós-laboral" }],
      ["GET", "/v1/crm/etiquetas"],
      ["GET", "/v1/crm/comerciais?regime=gold"],
      ["GET", "/v1/crm/clientes"],
      ["GET", "/v1/crm/parceiros"],
      ["GET", "/v1/crm/contratos"],
      ["GET", "/v1/crm/propostas"],
      ["GET", "/v1/crm/search?q=Lead"],
      ["GET", "/v1/alertas/documentos"],
      ["GET", "/v1/campanhas"],
      ["GET", `/v1/equipa?regime=gold`],
      ["GET", `/v1/equipa/${ctx.userId.comercial}?regime=gold`],
      ["GET", "/v1/opcoes/cursos?regime=gold"],
      ["GET", "/v1/opcoes/turmas?regime=gold"],
      ["GET", "/v1/opcoes/locais?regime=gold"],
      ["GET", "/v1/opcoes/horarios?regime=gold"],
      ["GET", "/v1/opcoes/lista?lista=origens"],
      ["GET", "/v1/painel/gold"],
      ["GET", "/v1/cronogramas/gold"],
      ["GET", "/v1/notificacoes"],
      ["GET", "/v1/search?q=Lead"],
      ["GET", "/v1/drive/status"],
    ];
    for (const [m, url, body] of ok) {
      const r = await pedido(ctx, "comercial", m, url, body);
      expect(r.statusCode, `${m} ${url}: ${r.body.slice(0, 200)}`).toBe(200);
    }
  });

  it("documentos da pré-inscrição: vê os das suas; ficheiros de formandos e de outras pré-inscrições não", async () => {
    const meu = await leadDoComercial();
    const alheio = (await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, comercial_id)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Outro', 'outro.cv@exemplo.pt', 'Curso Vendas CV', 'Não contactado', 'gold', $1)
       RETURNING id`, [ctx.userId.admin])).rows[0]!.id;
    for (const [id, kind] of [["cv-doc-meu", "preinscricao-doc"], ["cv-doc-alheio", "preinscricao-doc"], ["cv-formando", "formando-doc"]] as const) {
      await ctx.db.query(
        "INSERT INTO drive_files (id, name, kind, regime, stored_in, local_path) VALUES ($1, $2, $3, 'gold', 'local', 'nao-existe.pdf') ON CONFLICT (id) DO NOTHING",
        [id, `${id}.pdf`, kind],
      );
    }
    await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, drive_file_id) VALUES ($1, 'cc', 'cc.pdf', 'cv-doc-meu'), ($2, 'cc', 'cc.pdf', 'cv-doc-alheio')", [meu, alheio]);

    const estado = async (perfil: "comercial" | "secretaria", id: string) => (await pedido(ctx, perfil, "GET", `/v1/drive/files/${id}`)).statusCode;
    expect(await estado("comercial", "cv-doc-meu")).toBe(200);
    expect(await estado("comercial", "cv-doc-alheio")).toBe(404);
    expect(await estado("comercial", "cv-formando")).toBe(404);
    expect((await pedido(ctx, "comercial", "GET", "/v1/drive/files/cv-formando/content")).statusCode).toBe(404);
    for (const id of ["cv-doc-meu", "cv-doc-alheio", "cv-formando"]) expect(await estado("secretaria", id)).toBe(200);

    const lista = (await pedido(ctx, "comercial", "GET", "/v1/drive/files?regime=gold")).json<{ files: { id: string }[] }>().files.map(f => f.id);
    expect(lista).toContain("cv-doc-meu");
    expect(lista).not.toContain("cv-doc-alheio");
    expect(lista).not.toContain("cv-formando");

    const ficha = (await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${meu}`)).json<{ documentos: { url: string }[] }>();
    expect(ficha.documentos.map(d => d.url)).toEqual(["/api/v1/drive/files/cv-doc-meu/content"]);
  });

  it("cronogramas: turmas Gold abertas com sessões, vagas e ligação pública, sem dados sensíveis", async () => {
    await prepararTurmas();
    const r = await pedido(ctx, "comercial", "GET", "/v1/cronogramas/gold");
    expect(r.statusCode, r.body).toBe(200);
    const turmas = r.json<{ turmas: Record<string, unknown>[] }>().turmas;
    const ids = turmas.map(t => t.turmaId);
    expect(ids).toContain(TURMA);
    expect(ids).not.toContain(TURMA_ACABADA);
    expect(ids).not.toContain(TURMA_FECHADA);
    const t = turmas.find(x => x.turmaId === TURMA)!;
    expect(t).toMatchObject({
      nome: "CV Vendas 01", curso: "Curso Vendas CV", local: "Lisboa", horario: "Pós-laboral",
      dataInicio: "2099-03-02", dataFim: "2099-03-31", fase: "por_comecar",
      vagasLivres: 8, vagasMostradas: 3, ligacaoPublica: `/cronograma/gold/${TURMA}`, publicadoEm: null,
    });
    expect(t.sessoes).toEqual([
      { data: "2099-03-02", horaInicio: "19:00", horaFim: "22:00", modalidade: "presencial", modulos: ["M1 · Base", "M2 · Avançado"], formadores: ["Rui Formador"] },
      { data: "2099-03-04", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", modulos: ["M3 · Prática"], formadores: ["Rui Formador"] },
    ]);
    // Só os campos de venda: nada de formandos, custos, valores por hora, contactos ou pastas.
    expect(Object.keys(t).sort()).toEqual([
      "curso", "dataFim", "dataInicio", "fase", "horario", "ligacaoPublica", "local", "nome", "preco", "publicadoEm",
      "sessoes", "turmaId", "vagasLivres", "vagasMostradas",
    ]);
    const texto = JSON.stringify(t);
    for (const proibido of ["custo", "valorHora", "valores_hora", "Ana", "ana.cv@exemplo.pt", "drive", "email", "telf", "nif"]) {
      expect(texto.includes(proibido), proibido).toBe(false);
    }
    // Secretaria e admin também lêem; a Financiada e o formador não.
    expect((await pedido(ctx, "secretaria", "GET", "/v1/cronogramas/gold")).statusCode).toBe(200);
    expect((await pedido(ctx, "admin", "GET", "/v1/cronogramas/gold")).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "GET", "/v1/cronogramas/gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", "/v1/cronogramas/gold")).statusCode).toBe(403);
  });

  it("painel Gold do comercial: só blocos de vendas", async () => {
    const com = (await pedido(ctx, "comercial", "GET", "/v1/painel/gold")).json();
    const sec = (await pedido(ctx, "secretaria", "GET", "/v1/painel/gold")).json();
    expect(com.kpis.map((k: { id: string }) => k.id)).toEqual(["pre", "contactar", "formandos", "conversao", "receita"]);
    expect(sec.kpis.map((k: { id: string }) => k.id)).toContain("turmas");
    expect(com.aTratar.map((t: { id: string }) => t.id)).toEqual(["contactar", "documentos", "secretaria"]);
    expect(sec.aTratar.map((t: { id: string }) => t.id)).toEqual(expect.arrayContaining(["pedirPagamento", "comprovativos", "semFicha"]));
    expect(com.metodos).toBeNull();
    expect(com.porReceber).toBeNull();
    expect(com.ticketMedio).toBeUndefined();
    expect(sec.metodos).not.toBeNull();
    expect(Array.isArray(com.proximasTurmas)).toBe(true);
    expect(com.funil.principal.length).toBeGreaterThan(0);
  });

  it("pesquisa global: só pré-inscrições; a secretaria continua a encontrar turmas", async () => {
    await prepararTurmas();
    const lead = await leadDoComercial();
    await ctx.db.query("UPDATE preinscricoes SET nome = 'Vendascv' WHERE id = $1", [lead]);
    await ctx.db.query("UPDATE turmas_gold SET nome = 'Vendascv Turma' WHERE id = $1", [TURMA]);
    const vistas = async (perfil: "comercial" | "secretaria") =>
      (await pedido(ctx, perfil, "GET", "/v1/search?q=Vendascv")).json<{ groups: { items: { view: string }[] }[] }>().groups.flatMap(g => g.items.map(i => i.view));
    const com = await vistas("comercial");
    expect(com).toContain("gold-preinscricoes");
    expect(com.every(v => v === "gold-preinscricoes")).toBe(true);
    expect(await vistas("secretaria")).toContain("gold-cockpit-turma");
  });

  it("notificações do comercial: nada de dossiê, pagamentos nem cockpit; as turmas abrem nos Cronogramas", async () => {
    await prepararTurmas();
    const r = await pedido(ctx, "comercial", "GET", "/v1/notificacoes");
    expect(r.statusCode).toBe(200);
    const notas = r.json<{ notificacoes: { view: string; tab?: string; turmaId?: number }[] }>().notificacoes;
    const permitidas = new Set(["gold-preinscricoes", "gold-cronogramas"]);
    for (const n of notas) {
      expect(permitidas.has(n.view), n.view).toBe(true);
      expect(n.tab).toBeUndefined();
      expect(n.turmaId).toBeUndefined();
    }
  });
});
