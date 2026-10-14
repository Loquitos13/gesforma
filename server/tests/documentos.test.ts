import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

async function clienteComProposta(ctx: Ctx) {
  const cli = await pedido(ctx, "secretaria", "POST", "/v1/crm/clientes", { nome: unico("Cliente Doc"), email: `doc${Date.now()}${seq}@exemplo.pt` });
  expect(cli.statusCode, cli.body).toBe(200);
  const clienteId = (cli.json().cliente?.id ?? cli.json().id) as number;
  const p = await pedido(ctx, "comercial", "POST", `/v1/crm/clientes/${clienteId}/propostas`, { curso: "Excel", valor: 900, corpo: "<p>Versão 1</p>" });
  expect(p.statusCode, p.body).toBe(200);
  return { clienteId, propostaId: (p.json().proposta?.id ?? p.json().id) as number };
}

describe("propostas: texto editável", () => {
  it("o PATCH grava o corpo e fica na auditoria; com contrato assinado o texto fica fixo", async () => {
    const ctx = await arrancar();
    const { clienteId, propostaId } = await clienteComProposta(ctx);
    const r = await pedido(ctx, "comercial", "PATCH", `/v1/equipa/propostas/${propostaId}`, { corpo: "<p>Versão 2</p>" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().proposta.corpo).toBe("<p>Versão 2</p>");
    const audit = await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action = 'proposta.update' AND entity_id = $1", [String(propostaId)],
    );
    expect(audit.rows[0]!.n).toBeGreaterThan(0);

    const k = await pedido(ctx, "secretaria", "POST", "/v1/crm/contratos", { clienteNome: "Cliente", clienteId, propostaId });
    expect(k.statusCode, k.body).toBe(200);
    await ctx.db.query("UPDATE contratos_comerciais SET estado = 'Assinado' WHERE id = $1", [k.json().contrato.id]);
    const fixo = await pedido(ctx, "comercial", "PATCH", `/v1/equipa/propostas/${propostaId}`, { corpo: "<p>Versão 3</p>" });
    expect(fixo.statusCode).toBe(409);
    const notas = await pedido(ctx, "comercial", "PATCH", `/v1/equipa/propostas/${propostaId}`, { notas: "segue" });
    expect(notas.statusCode, notas.body).toBe(200);
  });
});

describe("documentos grandes", () => {
  it("propostas, contratos e modelos aceitam corpos grandes; o resto mantém o limite global", async () => {
    const ctx = await arrancar();
    const grande = `<p>${"Cláusula longa com texto. ".repeat(6000)}</p>`; // ~160 000 caracteres
    expect(grande.length).toBeGreaterThan(100_000);
    const k = await pedido(ctx, "secretaria", "POST", "/v1/crm/contratos", { clienteNome: "Grande, Lda", corpo: grande });
    expect(k.statusCode, k.body.slice(0, 200)).toBe(200);
    const m = await pedido(ctx, "secretaria", "POST", "/v1/crm/modelos/contrato", { nome: unico("Modelo grande"), corpo: grande });
    expect(m.statusCode, m.body.slice(0, 200)).toBe(200);
    const demasiado = await pedido(ctx, "secretaria", "POST", "/v1/crm/contratos", { clienteNome: "X", corpo: "a".repeat(210_000) });
    expect(demasiado.statusCode).toBe(400);
    const fora = await pedido(ctx, "secretaria", "POST", "/v1/crm/clientes", { nome: "Cliente", notas: "x".repeat(40_000) });
    expect(fora.statusCode).toBe(413);
  });
});

describe("campos do contrato", () => {
  it("os valores entram escapados no HTML e o PDF lê-os como texto", async () => {
    await arrancar();
    const { textoDoContrato } = await import("../src/assinaturas/comum.js");
    const { analisar } = await import("../src/assinaturas/pdfHtmlParse.js");
    const nome = `<script>alert(1)</script> <b>Ana</b> & Filhos`;
    const contrato = { corpo: "<p>Contrato com {{cliente}}, NIF {{nif}}.</p>", valor: 100, curso: "Excel" } as never;
    const sig = { nome, email: "a@exemplo.pt", nif: "123456789", nifOrigem: "ficha", formando: null, clienteId: null } as never;
    const html = textoDoContrato(contrato, sig);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    const nos = analisar(html);
    const p = nos[0] as { tag: string; filhos: { texto?: string; tag?: string }[] };
    expect(p.filhos.every(f => f.tag === undefined)).toBe(true);
    expect(p.filhos.map(f => f.texto).join("")).toContain(nome);

    // Texto simples antigo: o valor fica tal como está (o escape acontece ao converter para HTML).
    const simples = textoDoContrato({ corpo: "Contrato com {{cliente}}.", valor: 0, curso: "" } as never, sig);
    expect(simples).toBe(`Contrato com ${nome}.`);
  });
});

describe("opções em lote", () => {
  it("devolve várias listas num pedido, iguais às do pedido individual", async () => {
    const ctx = await arrancar();
    const lote = await pedido(ctx, "secretaria", "GET", "/v1/opcoes?kinds=cursos,turmas,locais&regime=gold");
    expect(lote.statusCode, lote.body).toBe(200);
    const corpo = lote.json().opcoes as Record<string, unknown[]>;
    expect(Object.keys(corpo).sort()).toEqual(["cursos", "locais", "turmas"]);
    const cursos = await pedido(ctx, "secretaria", "GET", "/v1/opcoes/cursos?regime=gold");
    expect(corpo.cursos).toEqual(cursos.json().opcoes);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/opcoes?kinds=inventado")).statusCode).toBe(400);
    expect((await pedido(ctx, null, "GET", "/v1/opcoes?kinds=cursos")).statusCode).toBe(401);
  });
});

describe("certificados da Financiada em lote", () => {
  it("dá o mesmo que o cálculo por turma", async () => {
    const ctx = await arrancar();
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
      dataInicio: "2026-01-05", nome: unico("TF-Cert"), curso: "UFCD Certificados", capacidade: 10,
      cronograma: [
        { id: "c1", data: "2026-01-05", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
        { id: "c2", data: "2026-01-06", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] },
      ],
    });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    const vazia = (await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2026-02-02", nome: unico("TF-Vazia"), curso: "UFCD Certificados", capacidade: 5 })).json().turma.id as number;

    const ids: number[] = [];
    for (const nome of ["Ana", "Bruno", "Carla"]) {
      const f = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { nome: unico(nome), email: `cert${Date.now()}${seq}@exemplo.pt`, turmaId });
      expect(f.statusCode, f.body).toBe(200);
      ids.push((f.json().formando?.id ?? f.json().id) as number);
    }
    const [a, b, c] = ids as [number, number, number];
    const base = `/v1/turmas/fin/${turmaId}`;
    for (const n of [1, 2]) {
      const r = await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/${n}`, {
        presencas: [{ id: a, nome: "Ana", presente: true }, { id: b, nome: "Bruno", presente: true }, { id: c, nome: "Carla", presente: n === 1 }],
      });
      expect(r.statusCode, r.body).toBe(200);
    }
    for (const [id, ficheiro] of [[a, "drive-a"], [b, ""], [c, "drive-c"]] as const) {
      await ctx.db.query(
        "INSERT INTO turma_certificados (regime, turma_id, formando_id, emitido, elearning, ficheiro_id) VALUES ('fin', $1, $2, $3, 90, $4)",
        [turmaId, id, ficheiro !== "", ficheiro],
      );
    }

    const { contagemCertificadosFin, contagemCertificadosFinLote } = await import("../src/dossieGerado.js");
    const { formandosFinComContacto } = await import("../src/repos/dossieGerado.js");
    const turmas = [];
    for (const id of [turmaId, vazia]) {
      const row = (await ctx.db.query<{ nome: string; curso: string }>("SELECT nome, curso FROM turmas_fin WHERE id = $1", [id])).rows[0]!;
      const fs = await formandosFinComContacto(ctx.db, id, row.nome, row.curso);
      turmas.push({ id, formandoIds: fs.map(f => Number(f.id)) });
    }
    const lote = await contagemCertificadosFinLote(ctx.db, turmas);
    for (const { id } of turmas) expect(lote.get(id)).toEqual(await contagemCertificadosFin(ctx.db, id));
    expect(lote.get(turmaId)).toEqual({ done: 1, total: 2 });
    expect(lote.get(vazia)).toEqual({ done: 0, total: 0 });
  });
});
