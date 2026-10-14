import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

describe("lista de formandos com telefone", () => {
  it("devolve o telefone decifrado a quem vê a lista e recusa ao formador", async () => {
    const ctx = await arrancar();
    const email = `telf${Date.now()}@exemplo.pt`;
    const criado = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: unico("Tel"), email, telf: "912345678" });
    expect(criado.statusCode, criado.body).toBe(200);
    const id = criado.json().formando.id as number;
    const guardado = await ctx.db.query<{ telf: string; pii_enc: string }>("SELECT telf, pii_enc FROM formandos_gold WHERE id = $1", [id]);
    expect(guardado.rows[0]!.pii_enc).not.toBe("");

    const lista = await pedido(ctx, "secretaria", "GET", `/v1/formandos?regime=gold&q=${encodeURIComponent(email)}&separador=todos`);
    expect(lista.statusCode, lista.body).toBe(200);
    const linha = (lista.json().linhas as { id: number; telf: string }[]).find(l => l.id === id);
    expect(linha?.telf).toBe("912345678");
    expect((await pedido(ctx, "formador", "GET", "/v1/formandos?regime=gold")).statusCode).toBe(403);
  });
});

describe("ocupação do formador", () => {
  it("devolve só as sessões presenciais e síncronas dentro do período", async () => {
    const ctx = await arrancar();
    const nome = unico("Formador Ocupado");
    const f = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome, regimes: ["gold"] });
    expect(f.statusCode, f.body).toBe(200);
    const id = f.json().formador.id as number;
    const turma = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-01-05", nome: unico("TO"), curso: "Curso Ocupação", formador: nome,
      cronograma: [
        { id: "1", data: "2099-01-05", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [nome] },
        { id: "2", data: "2099-01-06", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", formadores: [nome] },
        { id: "3", data: "2099-01-07", horaInicio: "19:00", horaFim: "22:00", modalidade: "auto", formadores: [nome] },
        { id: "4", data: "2099-03-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [nome] },
      ],
    });
    expect(turma.statusCode, turma.body).toBe(200);

    const r = await pedido(ctx, "secretaria", "GET", `/v1/formadores/${id}/ocupacao?de=2099-01-01&ate=2099-01-31`);
    expect(r.statusCode, r.body).toBe(200);
    const sessoes = r.json().sessoes as { data: string; horaInicio: string }[];
    expect(sessoes.map(s => s.data)).toEqual(["2099-01-05", "2099-01-06"]);

    expect((await pedido(ctx, "secretaria", "GET", `/v1/formadores/${id}/ocupacao?de=2099-02-01&ate=2099-01-01`)).statusCode).toBe(400);
    expect((await pedido(ctx, "formador", "GET", `/v1/formadores/${id}/ocupacao?de=2099-01-01&ate=2099-01-31`)).statusCode).toBe(403);
    expect((await pedido(ctx, null, "GET", `/v1/formadores/${id}/ocupacao?de=2099-01-01&ate=2099-01-31`)).statusCode).toBe(401);
  });
});

describe("entidade nas páginas públicas", () => {
  it("o cronograma público e /v1/public/entidade trazem os contactos, sem NIF nem IBAN", async () => {
    const ctx = await arrancar();
    const gravar = await pedido(ctx, "admin", "PUT", "/v1/settings/entidade", {
      values: { nome: "Escola Teste", morada: "Rua A, 1", codigoPostal: "4000-001", localidade: "Porto", telefone: "220000000", email: "geral@exemplo.pt", nif: "500000000", iban: "PT50000000000000000000000" },
    });
    expect(gravar.statusCode, gravar.body).toBe(200);

    const pub = await pedido(ctx, null, "GET", "/v1/public/entidade");
    expect(pub.statusCode, pub.body).toBe(200);
    expect(pub.json().entidade).toMatchObject({ nome: "Escola Teste", localidade: "Porto", telefone: "220000000" });
    expect(JSON.stringify(pub.json())).not.toContain("PT500000");
    expect(JSON.stringify(pub.json())).not.toContain("500000000");

    const turma = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-02-02", nome: unico("TP"), curso: "Curso Público",
      cronograma: [{ id: "1", data: "2099-02-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
    });
    expect(turma.statusCode, turma.body).toBe(200);
    const turmaId = turma.json().turma.id as number;
    await ctx.db.query("UPDATE turmas_gold SET cronograma_publicado_em = now() WHERE id = $1", [turmaId]);
    const cron = await pedido(ctx, null, "GET", `/v1/public/cronograma/gold/${turmaId}`);
    expect(cron.statusCode, cron.body).toBe(200);
    expect(cron.json().entidade.nome).toBe("Escola Teste");
    expect(cron.json().entidade.iban).toBeUndefined();
  });
});

describe("transferir formando de turma", () => {
  it("Gold e Financiada: o formando passa para a turma de destino", async () => {
    const ctx = await arrancar();
    const nova = async (regime: "gold" | "fin") => {
      const r = await pedido(ctx, "secretaria", "POST", `/v1/turmas-${regime}`, {
        dataInicio: "2099-04-06", nome: unico(`TT-${regime}`), curso: regime === "gold" ? "Curso Transferência" : "UFCD Transferência", capacidade: 10,
      });
      expect(r.statusCode, r.body).toBe(200);
      return r.json().turma.id as number;
    };
    const [ga, gb, fa, fb] = [await nova("gold"), await nova("gold"), await nova("fin"), await nova("fin")];

    const g = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: unico("Gold"), email: `tg${Date.now()}@exemplo.pt`, turmaId: ga });
    expect(g.statusCode, g.body).toBe(200);
    const gid = g.json().formando.id as number;
    const mg = await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${gid}`, { turmaId: gb });
    expect(mg.statusCode, mg.body).toBe(200);
    const rg = await ctx.db.query<{ turma_id: number }>("SELECT turma_id FROM formandos_gold WHERE id = $1", [gid]);
    expect(Number(rg.rows[0]!.turma_id)).toBe(gb);

    const f = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { nome: unico("Fin"), email: `tf${Date.now()}@exemplo.pt`, turmaId: fa });
    expect(f.statusCode, f.body).toBe(200);
    const fid = (f.json().formando?.id ?? f.json().id) as number;
    const mf = await pedido(ctx, "financiada", "PATCH", `/v1/formandos-fin/${fid}`, { turmaId: fb });
    expect(mf.statusCode, mf.body).toBe(200);
    const rf = await ctx.db.query<{ turma_id: number }>("SELECT turma_id FROM formandos_fin WHERE id = $1", [fid]);
    expect(Number(rf.rows[0]!.turma_id)).toBe(fb);
  });
});

describe("listas com parâmetros em array", () => {
  it("comerciais activos para o CRM respondem sem erro", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "secretaria", "GET", "/v1/crm/comerciais?regime=gold");
    expect(r.statusCode, r.body).toBe(200);
  });
});
