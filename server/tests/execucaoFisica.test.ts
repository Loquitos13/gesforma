import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { CAMPOS_NAO_RECOLHIDOS, LISTAS_EXECUCAO, sessaoPosLaboral } from "../src/execucaoFisica.js";
import { writePreinscricaoPii } from "../src/pii.js";
import { conteudoZip, lerZip, serieExcel } from "../src/xlsxModelo.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const MODELO = readFileSync(fileURLToPath(new URL("../src/modelos/execucao-fisica.xlsx", import.meta.url)));
let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

const CRONOGRAMA = [
  { id: "s1", data: "2026-01-05", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos: [], formadores: [] },
  { id: "s2", data: "2026-01-06", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", modulos: [], formadores: [] },
  { id: "s3", data: "2026-01-10", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos: [], formadores: [] },
  { id: "s4", data: "2026-01-11", horaInicio: "10:00", horaFim: "12:00", modalidade: "auto", modulos: [], formadores: [] },
];

const marca = (id: number, nome: string, estado: string, minutos?: number) =>
  ({ id, nome, estado, presente: estado === "presente" || estado === "atraso", ...(minutos ? { minutos } : {}) });

type Turma = { id: number; nome: string; ana: number; bruno: number; carla: number };

async function turmaComFormandos(ctx: Ctx): Promise<Turma> {
  const local = unico("Local Reembolso");
  await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', 'fin', $2::jsonb)",
    [900000 + (++seq), JSON.stringify({ nome: local, morada: "Rua das Flores, 10, 1000-100 Lisboa" })]);
  const nome = unico("TF Reembolso");
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2026-01-05", nome, curso: "UFCD Reembolso", capacidade: 10, local, cronograma: CRONOGRAMA });
  expect(t.statusCode, t.body).toBe(200);
  const turmaId = t.json().turma.id as number;
  const ids: number[] = [];
  for (const [n, email] of [["Ana", `ana${Date.now()}${seq}@exemplo.pt`], ["Bruno", `bruno${Date.now()}${seq}@exemplo.pt`], ["Carla", ""]] as const) {
    const f = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { nome: n, apelido: "Silva", email, telf: n === "Carla" ? "" : "912 345 678", turmaId });
    expect(f.statusCode, f.body).toBe(200);
    ids.push(f.json().formando.id as number);
  }
  const [ana, bruno, carla] = ids as [number, number, number];
  // A Ana tem pré-inscrição com NIF e código postal (cifrados), o Bruno sem NIF, a Carla sem nada.
  const anaEmail = (await ctx.db.query<{ email: string }>("SELECT email FROM formandos_fin WHERE id = $1", [ana])).rows[0]!.email;
  const brunoEmail = (await ctx.db.query<{ email: string }>("SELECT email FROM formandos_fin WHERE id = $1", [bruno])).rows[0]!.email;
  for (const [email, pii, id] of [[anaEmail, { nif: "123456789", codigoPostal: "4000-123" }, 880000 + (++seq)], [brunoEmail, { codigoPostal: "2000-001" }, 880000 + (++seq)]] as const) {
    const c = writePreinscricaoPii(pii);
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, nif, morada_fiscal, codigo_postal, telf, pii_enc)
       VALUES ($1, '2025-12-15 10:30', 'X', $2, 'UFCD Reembolso', 0, 'Formando', 'fin', $3, $4, $5, $6, COALESCE($7, ''))`,
      [id, email, c.nif, c.morada_fiscal, c.codigo_postal, c.telf, c.pii_enc],
    );
  }
  const base = `/v1/turmas/fin/${turmaId}`;
  const folhas: Record<number, unknown[]> = {
    1: [marca(ana, "Ana Silva", "presente"), marca(bruno, "Bruno Silva", "presente"), marca(carla, "Carla Silva", "falta_injustificada")],
    2: [marca(ana, "Ana Silva", "atraso", 60), marca(bruno, "Bruno Silva", "presente")],
    3: [marca(ana, "Ana Silva", "presente")],
  };
  for (const [n, presencas] of Object.entries(folhas)) {
    const r = await pedido(ctx, "secretaria", "PUT", `${base}/sessoes/${n}`, { presencas });
    expect(r.statusCode, r.body).toBe(200);
  }
  return { id: turmaId, nome, ana, bruno, carla };
}

async function descarregar(ctx: Ctx, turmaId: number) {
  const r = await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${turmaId}/reembolso/execucao-fisica`);
  expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
  expect(r.headers["content-type"]).toContain("spreadsheetml");
  return r.rawPayload;
}

function linhasTemplate(bytes: Buffer) {
  const folha = XLSX.read(bytes, { type: "buffer", sheets: "Template", sheetRows: 12 }).Sheets.Template!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(folha, { header: "A", range: 2, raw: true, defval: null });
}

describe("execução física da turma (Financiada)", () => {
  it("as listas usadas pela plataforma existem no modelo (folha TD) e pós-laboral conta a partir das 18h e ao fim de semana", () => {
    const td = XLSX.read(MODELO, { type: "buffer", sheets: ["TD", "Referencias"] });
    const listaTd = new Set(XLSX.utils.sheet_to_json<unknown[]>(td.Sheets.TD!, { header: 1, raw: true }).map(l => String(l[2] ?? "")));
    for (const v of [...Object.values(LISTAS_EXECUCAO.situacao), LISTAS_EXECUCAO.paisPortugal]) expect(listaTd.has(v), v).toBe(true);
    const ref = XLSX.utils.sheet_to_json<unknown[]>(td.Sheets.Referencias!, { header: 1, raw: true }).map(l => String(l[0] ?? ""));
    expect(ref).toContain(LISTAS_EXECUCAO.gestaoRegisto);
    expect(sessaoPosLaboral("2026-01-06", "19:00")).toBe(true);
    expect(sessaoPosLaboral("2026-01-10", "09:00")).toBe(true);
    expect(sessaoPosLaboral("2026-01-05", "09:00")).toBe(false);
  });

  it("preenche uma linha por formando com os dados da plataforma e mantém o resto do modelo", async () => {
    const ctx = await arrancar();
    const t = await turmaComFormandos(ctx);
    const bytes = await descarregar(ctx, t.id);
    const linhas = linhasTemplate(bytes);
    const porNome = (n: string) => linhas.find(l => String(l.M ?? "").startsWith(n))!;
    expect(linhas.filter(l => l.A === "Inserir")).toHaveLength(3);
    // Depois dos formandos, o «Inserir» pré-escrito do modelo sai.
    expect(linhas.slice(3).every(l => l.A == null)).toBe(true);

    const ana = porNome("Ana");
    expect(ana).toMatchObject({ A: "Inserir", F: 123456789, M: "Ana Silva", P: 4000123, Q: "912345678", U: LISTAS_EXECUCAO.situacao.emExecucao, AH: t.ana, AY: "1000-100", AZ: LISTAS_EXECUCAO.paisPortugal });
    // Horas: sala/presencial 4 + 4 (sábado), online/síncrona 3 - 1 h de atraso; laboral 4, pós-laboral 2 + 4.
    expect(ana).toMatchObject({ BA: 8, BH: 8, BI: 2, BJ: 2, BL: 4, BM: 6, BN: 2, BU: 2, BV: 1, BW: 1, BY: 1, BZ: 2 });
    expect(ana.S).toBe(serieExcel("2026-01-05"));
    expect(ana.CA).toBe(serieExcel("2025-12-15"));
    expect(ana.T ?? null).toBeNull();
    // Colunas que a plataforma não recolhe ficam em branco.
    for (const col of ["B", "C", "D", "E", "G", "L", "N", "O", "V", "Z", "AW"]) expect(ana[col] ?? null, col).toBeNull();

    const bruno = porNome("Bruno");
    expect(bruno.F ?? null).toBeNull();
    expect(bruno).toMatchObject({ P: 2000001, BA: 4, BJ: 3 });
    const carla = porNome("Carla");
    expect(carla.BA ?? null).toBeNull();
    expect(carla.R ?? null).toBeNull();

    // As validações (também as x14 do extLst), as folhas escondidas e os nomes definidos ficam; o resto do zip igual.
    const original = new Map(lerZip(MODELO).map(e => [e.nome, conteudoZip(e)]));
    const gerado = lerZip(bytes);
    expect(gerado.map(e => e.nome).sort()).toEqual([...original.keys()].sort());
    for (const e of gerado) {
      if (e.nome !== "xl/worksheets/sheet1.xml") expect(conteudoZip(e).equals(original.get(e.nome)!), e.nome).toBe(true);
    }
    const folha = conteudoZip(gerado.find(e => e.nome === "xl/worksheets/sheet1.xml")!).toString("utf8");
    const folhaOriginal = original.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    const depoisDosDados = (s: string) => s.slice(s.indexOf("</sheetData>"));
    expect(depoisDosDados(folha)).toBe(depoisDosDados(folhaOriginal));
    expect(folha.includes('<x14:dataValidations xWindow="910" yWindow="529" count="25"')).toBe(true);
    expect(folha.includes('<dataValidations xWindow="910" yWindow="529" count="9">')).toBe(true);
    const livro = original.get("xl/workbook.xml")!.toString("utf8");
    expect(livro).toContain('<sheet name="Referencias" sheetId="3" state="hidden"');
    expect(livro).toContain('<sheet name="TD" sheetId="2" state="hidden"');
    expect(livro).toContain('<definedName name="Medidas_Ativas">');
  }, 60_000);

  it("só a equipa da Financiada vê e descarrega (nunca o comercial nem o formador)", async () => {
    const ctx = await arrancar();
    const t = await turmaComFormandos(ctx);
    for (const perfil of ["comercial", "formador"] as const) {
      expect((await pedido(ctx, perfil, "GET", `/v1/turmas-fin/${t.id}/reembolso`)).statusCode).toBe(403);
      expect((await pedido(ctx, perfil, "GET", `/v1/turmas-fin/${t.id}/reembolso/execucao-fisica`)).statusCode).toBe(403);
      expect((await pedido(ctx, perfil, "POST", `/v1/turmas-fin/${t.id}/reembolso/atualizar`, {})).statusCode).toBe(403);
    }
    expect((await pedido(ctx, null, "GET", `/v1/turmas-fin/${t.id}/reembolso`)).statusCode).toBe(401);
    // Uma turma Gold não é uma turma da Financiada.
    const gold = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-01-05", nome: unico("TG"), curso: "Curso Gold" });
    expect(gold.statusCode, gold.body).toBe(200);
    const goldId = gold.json().turma.id as number;
    const existeFin = (await ctx.db.query("SELECT 1 FROM turmas_fin WHERE id = $1", [goldId])).rows.length > 0;
    if (!existeFin) expect((await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${goldId}/reembolso`)).statusCode).toBe(404);
    for (const perfil of ["admin", "secretaria", "financiada"] as const) {
      expect((await pedido(ctx, perfil, "GET", `/v1/turmas-fin/${t.id}/reembolso`)).statusCode).toBe(200);
    }
  }, 60_000);

  it("cada turma tem um só ficheiro de cada: actualizar substitui a cópia e mostra o que falta", async () => {
    const ctx = await arrancar();
    const t = await turmaComFormandos(ctx);
    const contar = async () => (await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM drive_files WHERE regime = 'fin' AND turma = $1 AND label = 'Reembolso'", [t.nome])).rows[0]!.n;

    const antes = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${t.id}/reembolso`)).json();
    expect(antes.ficheiros.map((f: { tipo: string; desatualizado: boolean; drive: unknown }) => [f.tipo, f.desatualizado, f.drive])).toEqual([
      ["execucao-fisica", true, null], ["despesas", true, null],
    ]);
    expect(antes.execucaoFisica.formandos).toBe(3);
    expect(antes.execucaoFisica.naoRecolhidos).toEqual(CAMPOS_NAO_RECOLHIDOS);
    const porCampo = Object.fromEntries((antes.execucaoFisica.porCampo as { campo: string; formandos: number }[]).map(c => [c.campo, c.formandos]));
    expect(porCampo).toMatchObject({ NIF: 2, "Código postal": 1, Telefone: 1, "E-mail": 1, "Data de inscrição": 1 });
    expect(antes.execucaoFisica.porFormando.find((f: { id: number }) => f.id === t.carla).falta).toEqual(["NIF", "Código postal", "Telefone", "E-mail", "Data de inscrição"]);

    const a1 = await pedido(ctx, "financiada", "POST", `/v1/turmas-fin/${t.id}/reembolso/atualizar`, {});
    expect(a1.statusCode, a1.body).toBe(200);
    expect(a1.json().erros).toEqual({});
    const ids1 = Object.fromEntries((a1.json().ficheiros as { tipo: string; drive: { id: string }; desatualizado: boolean }[]).map(f => [f.tipo, f.drive.id]));
    expect(a1.json().ficheiros.every((f: { desatualizado: boolean }) => !f.desatualizado)).toBe(true);
    expect(await contar()).toBe(2);

    // Sem mudanças nos dados, actualizar e descarregar não criam cópias novas.
    await pedido(ctx, "financiada", "POST", `/v1/turmas-fin/${t.id}/reembolso/atualizar`, {});
    await descarregar(ctx, t.id);
    expect(await contar()).toBe(2);
    expect((await ctx.db.query("SELECT 1 FROM reembolso_ficheiros WHERE turma_id = $1", [t.id])).rows).toHaveLength(2);

    // Novas presenças: o ficheiro fica desactualizado e, ao actualizar, a cópia é substituída (não duplicada).
    await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${t.id}/sessoes/3`, { presencas: [marca(t.ana, "Ana Silva", "presente"), marca(t.bruno, "Bruno Silva", "presente")] });
    const meio = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${t.id}/reembolso`)).json();
    expect(meio.ficheiros.find((f: { tipo: string }) => f.tipo === "execucao-fisica").desatualizado).toBe(true);
    expect(meio.ficheiros.find((f: { tipo: string }) => f.tipo === "despesas").desatualizado).toBe(false);
    const a2 = (await pedido(ctx, "financiada", "POST", `/v1/turmas-fin/${t.id}/reembolso/atualizar`, {})).json();
    const ids2 = Object.fromEntries((a2.ficheiros as { tipo: string; drive: { id: string } }[]).map(f => [f.tipo, f.drive.id]));
    expect(ids2["execucao-fisica"]).not.toBe(ids1["execucao-fisica"]);
    expect(ids2.despesas).toBe(ids1.despesas);
    expect(await contar()).toBe(2);
    expect((await ctx.db.query("SELECT 1 FROM drive_files WHERE id = $1", [ids1["execucao-fisica"]])).rows).toHaveLength(0);
    const bruno = linhasTemplate(await descarregar(ctx, t.id)).find(l => String(l.M).startsWith("Bruno"))!;
    expect(bruno).toMatchObject({ BA: 8, BN: 2 });

    // Despesas: cada alteração actualiza a cópia da turma, sempre uma só.
    const d = await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId: t.id, dados: { descricao: "Almoços" } });
    expect(d.statusCode, d.body).toBe(200);
    const depois = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${t.id}/reembolso`)).json();
    const despesas = depois.ficheiros.find((f: { tipo: string }) => f.tipo === "despesas");
    expect(despesas.desatualizado).toBe(false);
    expect(despesas.drive.id).not.toBe(ids1.despesas);
    expect(await contar()).toBe(2);
    await pedido(ctx, "financiada", "DELETE", `/v1/despesas/${d.json().despesa.id}`);
    expect(await contar()).toBe(2);
    const exp = await pedido(ctx, "financiada", "GET", `/v1/despesas/exportar?turma=${t.id}`);
    expect(exp.statusCode).toBe(200);
    expect(XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(exp.rawPayload, { type: "buffer" }).Sheets.Despesas!, { header: 1 })).toHaveLength(1);
  }, 90_000);
});
