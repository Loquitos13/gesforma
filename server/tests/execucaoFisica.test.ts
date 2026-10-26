import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import * as XLSX from "xlsx";
import {
  LISTA_CNAEF, LISTA_GENERO, LISTA_HABILITACOES, LISTA_PAISES, LISTA_QNQ, LISTA_SIM_NAO, LISTA_SITUACAO_EMPREGO,
  LISTA_TIPO_ENTIDADE, procuraEmpregoPorOmissao, qnqDasHabilitacoes,
} from "../../src/partilhado/execucaoFisica.js";
import { codigoCursoValido, normalizarCodigoCurso, rotuloCodigoCurso } from "../../src/partilhado/codigoCurso.js";
import { cursoAcao, estilosDatasDDMMAAAA, FALTA, formatoDaTurma, LISTAS_EXECUCAO, sessaoSincrona } from "../src/execucaoFisica.js";
import { writePreinscricaoPii } from "../src/pii.js";
import { conteudoZip, lerZip, serieExcel } from "../src/xlsxModelo.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

/** A Financiada só associa à acção com os documentos obrigatórios (menos o contrato, que se assina ao entrar). */
const DOCS_TURMA_OK = Object.fromEntries(["cc", "ch", "cu", "ci", "ce", "morada", "rgpd"].map(k => [k, { ok: true, data: "" }]));

const MODELO = readFileSync(fileURLToPath(new URL("../src/modelos/execucao-fisica.xlsx", import.meta.url)));
let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

// s2 é uma sessão síncrona (vídeo-conferência); s4 auto-aprendizagem (sem presenças): a turma é b-learning.
const CRONOGRAMA = [
  { id: "s1", data: "2026-01-05", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos: [], formadores: [] },
  { id: "s2", data: "2026-01-06", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", modulos: [], formadores: [] },
  { id: "s3", data: "2026-01-10", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos: [], formadores: [] },
  { id: "s4", data: "2026-01-11", horaInicio: "10:00", horaFim: "12:00", modalidade: "auto", modulos: [], formadores: [] },
];

// Toda por vídeo-conferência: e-learning.
const CRONOGRAMA_DISTANCIA = [
  { id: "v1", data: "2026-02-02", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", modulos: [], formadores: [] },
  { id: "v2", data: "2026-02-03", horaInicio: "19:00", horaFim: "21:30", modalidade: "sincrona", modulos: [], formadores: [] },
];

const marca = (id: number, nome: string, estado: string, minutos?: number) =>
  ({ id, nome, estado, presente: estado === "presente" || estado === "atraso", ...(minutos ? { minutos } : {}) });

type Turma = { id: number; nome: string; ana: number; bruno: number; carla: number };

/** Curso da Financiada com código UFCD, designação e área CNAEF (dados fictícios). */
async function cursoFin(ctx: Ctx, areaCnaef = "341 - Comércio") {
  const nomeComercial = unico("Inglês Comercial");
  const c = await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", {
    ufcdCod: "8995", ufcd: "Língua Inglesa - Distribuição", nomeComercial, regime: "b-learning", horas: 25, areaCnaef,
  });
  expect(c.statusCode, c.body).toBe(200);
  expect(c.json().curso.areaCnaef).toBe(areaCnaef);
  return nomeComercial;
}

async function inscrever(ctx: Ctx, turmaId: number, nomes: [string, string][]) {
  const ids: number[] = [];
  for (const [n, email] of nomes) {
    const f = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { ...DOCS_TURMA_OK, nome: n, apelido: "Silva", email, telf: n === "Carla" ? "" : "912 345 678", turmaId });
    expect(f.statusCode, f.body).toBe(200);
    ids.push(f.json().formando.id as number);
  }
  return ids;
}

async function turmaComFormandos(ctx: Ctx, opts: { curso?: string; numeroAcao?: number } = {}): Promise<Turma> {
  const local = unico("Local Reembolso");
  await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', 'fin', $2::jsonb)",
    [900000 + (++seq), JSON.stringify({ nome: local, morada: "Rua das Flores, 10, 1000-100 Lisboa" })]);
  const nome = unico("TF Reembolso");
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
    dataInicio: "2026-01-05", nome, curso: opts.curso ?? "UFCD Reembolso", capacidade: 10, local, cronograma: CRONOGRAMA,
    ...(opts.numeroAcao ? { numeroAcao: opts.numeroAcao } : {}),
  });
  expect(t.statusCode, t.body).toBe(200);
  const turmaId = t.json().turma.id as number;
  const [ana, bruno, carla] = await inscrever(ctx, turmaId, [
    ["Ana", `ana${Date.now()}${seq}@exemplo.pt`], ["Bruno", `bruno${Date.now()}${seq}@exemplo.pt`], ["Carla", ""],
  ]) as [number, number, number];
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

const financiamento = (ctx: Ctx, perfil: Parameters<typeof pedido>[1], id: number, corpo?: Record<string, unknown>) =>
  corpo ? pedido(ctx, perfil, "PATCH", `/v1/formandos-fin/${id}/financiamento`, corpo) : pedido(ctx, perfil, "GET", `/v1/formandos-fin/${id}/financiamento`);

describe("execução física da turma (Financiada)", () => {
  it("as listas partilhadas são as da folha TD do modelo e o resto das regras", () => {
    const livro = XLSX.read(MODELO, { type: "buffer", sheets: ["TD", "Referencias"] });
    const td = livro.Sheets.TD!;
    const colunaC = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => String(td[`C${de + i}`]?.v ?? ""));
    expect([...LISTA_GENERO]).toEqual(colunaC(2, 4));
    expect([...LISTA_SITUACAO_EMPREGO]).toEqual(colunaC(25, 29));
    expect([...LISTA_HABILITACOES]).toEqual(colunaC(53, 63));
    expect([...LISTA_QNQ]).toEqual(colunaC(66, 74));
    expect([...LISTA_SIM_NAO]).toEqual(colunaC(77, 78));
    expect([...LISTA_SIM_NAO]).toEqual(colunaC(81, 82));
    expect([...LISTA_TIPO_ENTIDADE]).toEqual(colunaC(137, 140));
    expect([...LISTA_PAISES]).toEqual(colunaC(169, 414));
    expect([...LISTA_CNAEF]).toEqual(colunaC(418, 532));
    const listaTd = new Set(colunaC(1, 1022));
    for (const v of [...Object.values(LISTAS_EXECUCAO.situacao), LISTAS_EXECUCAO.paisPortugal, LISTAS_EXECUCAO.entidadeEmpregadora]) expect(listaTd.has(v), v).toBe(true);
    const ref = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets.Referencias!, { header: 1, raw: true }).map(l => String(l[0] ?? ""));
    expect(ref).toContain(LISTAS_EXECUCAO.gestaoRegisto);

    // QNQ a partir das habilitações: 1 a 8 dão o mesmo nível; abaixo do 2.º ciclo, «não aplicável».
    expect(qnqDasHabilitacoes("6 - Licenciatura")).toBe("6 - Nível Qualificação 6");
    expect(qnqDasHabilitacoes(LISTA_HABILITACOES[2])).toBe("3 - Nível Qualificação 3");
    expect(qnqDasHabilitacoes("8 - Doutoramento")).toBe("8 - Nível Qualificação 8");
    expect(qnqDasHabilitacoes("1 - 2.º ciclo do ensino básico")).toBe("1 - Nível Qualificação 1");
    expect(qnqDasHabilitacoes("11 - 1.º ciclo do ensino básico")).toBe("9 - Nível não aplicável");
    expect(qnqDasHabilitacoes("")).toBe("");
    for (const h of LISTA_HABILITACOES) expect(LISTA_QNQ).toContain(qnqDasHabilitacoes(h));
    expect(procuraEmpregoPorOmissao("3 - Desempregado à procura de novo emprego - Não DLD")).toBe("1 - Sim");
    expect(procuraEmpregoPorOmissao("5 - Empregados")).toBe("2 - Não");

    // Vídeo-conferência é síncrona; a forma da turma decide E-Learning / B-Learning.
    expect(sessaoSincrona("sincrona")).toBe(true);
    // Só a modalidade «sincrona» do cronograma (não há outras de vídeo-conferência).
    expect(sessaoSincrona("videoconferencia")).toBe(false);
    expect(sessaoSincrona("presencial")).toBe(false);
    expect(sessaoSincrona(undefined)).toBe(false);
    expect(formatoDaTurma(CRONOGRAMA)).toBe("b-learning");
    expect(formatoDaTurma(CRONOGRAMA_DISTANCIA)).toBe("e-learning");
    expect(formatoDaTurma(CRONOGRAMA.filter(s => s.modalidade === "presencial"))).toBe("presencial");
    expect(cursoAcao({ numero_acao: 2, ufcd_cod: "", c_ufcd_cod: "8995", c_ufcd: "Língua Inglesa - Distribuição", curso: "x" }))
      .toBe("UFCD 8995 - Língua Inglesa - Distribuição / Ação 2");
    expect(cursoAcao({ numero_acao: 1, ufcd_cod: "UC00277", c_ufcd_cod: "", c_ufcd: "", curso: "Comunicar em contexto profissional" }))
      .toBe("UC00277 - Comunicar em contexto profissional / Ação 1");
    expect(cursoAcao({ numero_acao: 1, ufcd_cod: "", c_ufcd_cod: "", c_ufcd: "", curso: "x" })).toBe("");
    expect(cursoAcao({ numero_acao: 3, ufcd_cod: "", c_ufcd_cod: "UC02784", c_ufcd: "Apoiar a gestão de pessoal", curso: "x" }))
      .toBe("UC02784 - Apoiar a gestão de pessoal / Ação 3");
  });

  it("o curso aceita o código de uma UFCD ou de uma UC, normalizado", async () => {
    expect(normalizarCodigoCurso("ufcd 8995")).toBe("8995");
    expect(normalizarCodigoCurso(" uc 00277 ")).toBe("UC00277");
    expect(codigoCursoValido("UC00277")).toBe(true);
    expect(codigoCursoValido("8995")).toBe(true);
    expect(codigoCursoValido("UC")).toBe(false);
    expect(codigoCursoValido("")).toBe(false);
    expect(rotuloCodigoCurso("8995")).toBe("UFCD 8995");
    expect(rotuloCodigoCurso("UC00277")).toBe("UC00277");
    const ctx = await arrancar();
    const base = { ufcd: "Comunicar e interagir", regime: "Online", horas: 25 };
    const uc = await pedido(ctx, "secretaria", "POST", "/v1/cursos-fin", { ...base, ufcdCod: "uc 00033", nomeComercial: `Comunicar ${Date.now()}` });
    expect(uc.statusCode, uc.body).toBe(200);
    const ruim = await pedido(ctx, "secretaria", "POST", "/v1/cursos-fin", { ...base, ufcdCod: "  ", nomeComercial: `Ruim ${Date.now()}` });
    expect(ruim.statusCode).toBe(400);
    const lido = await ctx.db.query<{ ufcd_cod: string }>("SELECT ufcd_cod FROM cursos_fin WHERE nome_comercial LIKE 'Comunicar %' ORDER BY id DESC LIMIT 1");
    expect(lido.rows[0]!.ufcd_cod).toBe("UC00033");
  });

  it("preenche uma linha por formando com os dados da plataforma e mantém o resto do modelo", async () => {
    const ctx = await arrancar();
    const curso = await cursoFin(ctx);
    const t = await turmaComFormandos(ctx, { curso, numeroAcao: 2 });
    expect((await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}`)).json().turma.numeroAcao).toBe(2);
    // Dados para o financiamento (fictícios): a Ana empregada e licenciada, o Bruno estrangeiro e desempregado.
    const a = await financiamento(ctx, "financiada", t.ana, {
      niss: "12345678901", dataNascimento: "1990-04-15", genero: "2 - Mulheres", nacionalidade: "191 - Portugal",
      situacaoEmpregoEntrada: "5 - Empregados", nifEntidadeEmpregadora: "500000000", habilitacoesEntrada: "6 - Licenciatura",
      numeroSigo: "1234567",
    });
    expect(a.statusCode, a.body).toBe(200);
    const b = await financiamento(ctx, "secretaria", t.bruno, {
      nif: "234567890", niss: "98765432109", dataNascimento: "1985-11-30", genero: "1 - Homens", nacionalidade: "31 - Brasil",
      passaporte: "XY123456", tipoAutorizacaoResidencia: "Temporária", situacaoEmpregoEntrada: "3 - Desempregado à procura de novo emprego - Não DLD",
      habilitacoesEntrada: LISTA_HABILITACOES[2], numeroSigo: "7654321",
    });
    expect(b.statusCode, b.body).toBe(200);

    const bytes = await descarregar(ctx, t.id);
    const linhas = linhasTemplate(bytes);
    const porNome = (n: string) => linhas.find(l => String(l.M ?? "").startsWith(n))!;
    expect(linhas.filter(l => l.A === "Inserir")).toHaveLength(3);
    // Depois dos formandos, o «Inserir» pré-escrito do modelo sai.
    expect(linhas.slice(3).every(l => l.A == null)).toBe(true);

    const ana = porNome("Ana");
    expect(ana).toMatchObject({
      A: "Inserir", C: 1, D: "341 - Comércio", E: "UFCD 8995 - Língua Inglesa - Distribuição / Ação 2",
      F: 123456789, G: 12345678901, M: "Ana Silva", N: "2 - Mulheres", O: "191 - Portugal", P: "4000-123", Q: 912345678,
      U: LISTAS_EXECUCAO.situacao.emExecucao, V: "5 - Empregados", Z: "6 - Licenciatura", AB: "6 - Nível Qualificação 6",
      AE: "2 - Não", AG: 1234567, AH: t.ana, AQ: "1 - Entidade Empregadora", AR: 500000000, AV: "191 - Portugal",
      AY: "1000-100", AZ: LISTAS_EXECUCAO.paisPortugal,
    });
    expect(ana.L).toBe(serieExcel("1990-04-15"));
    // Horas (b-learning): presencial 4 + 4 (sábado), síncrona por vídeo-conferência 3 - 1 h de atraso.
    expect(ana).toMatchObject({ BA: 10, BB: 10, BG: 10, BH: 8, BJ: 2, BN: 3, BO: 3, BT: 3, BU: 2, BW: 1 });
    // E-learning, laboral/pós-laboral e «online (presencial)» ficam em branco; as colunas «à saída» também (ainda em execução).
    for (const col of ["BF", "BS", "BI", "BV", "BK", "BX", "BL", "BM", "BY", "BZ", "W", "AA", "AC", "AD", "AF", "T", "B", "H", "I", "J", "K", "AW"]) {
      expect(ana[col] ?? null, col).toBeNull();
    }
    expect(ana.S).toBe(serieExcel("2026-01-05"));
    expect(ana.CA).toBe(serieExcel("2025-12-15"));

    const bruno = porNome("Bruno");
    expect(bruno).toMatchObject({
      F: 234567890, G: 98765432109, N: "1 - Homens", O: "31 - Brasil", J: "XY123456", K: "Temporária", P: "2000-001",
      V: "3 - Desempregado à procura de novo emprego - Não DLD", AB: "3 - Nível Qualificação 3", AG: 7654321,
      BA: 7, BB: 7, BG: 7, BH: 4, BJ: 3, BN: 2, BU: 1, BW: 1,
    });
    for (const col of ["AQ", "AR", "AV"]) expect(bruno[col] ?? null, col).toBeNull();
    // Sem presenças, depois de a acção começar: zeros nas colunas da forma da turma.
    const carla = porNome("Carla");
    expect(carla).toMatchObject({ BA: 0, BB: 0, BG: 0, BH: 0, BJ: 0, BN: 0, BO: 0, BT: 0, BU: 0, BW: 0 });
    expect(carla.R ?? null).toBeNull();
    expect(carla.N ?? null).toBeNull();

    // Fim da participação: «à saída» igual à entrada salvo indicação; procura emprego pela situação à saída.
    await financiamento(ctx, "financiada", t.ana, { situacaoEmpregoSaida: "3 - Desempregado à procura de novo emprego - Não DLD" });
    for (const id of [t.ana, t.bruno]) {
      const n = await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${t.id}/certificados/${id}`, { nota: 15 });
      expect(n.statusCode, n.body).toBe(200);
    }
    await ctx.db.query("UPDATE turmas_fin SET fechada_em = now() WHERE id = $1", [t.id]);
    const fim = linhasTemplate(await descarregar(ctx, t.id));
    const anaFim = fim.find(l => String(l.M).startsWith("Ana"))!;
    const brunoFim = fim.find(l => String(l.M).startsWith("Bruno"))!;
    expect(anaFim).toMatchObject({
      V: "5 - Empregados", W: "3 - Desempregado à procura de novo emprego - Não DLD", AA: "6 - Licenciatura",
      AC: "6 - Nível Qualificação 6", AD: "1 - Sim", AF: "2 - Não",
    });
    expect(brunoFim).toMatchObject({ W: brunoFim.V, AA: brunoFim.Z, AC: "3 - Nível Qualificação 3", AD: "1 - Sim", AF: "2 - Não" });
    expect([LISTAS_EXECUCAO.situacao.aprovado, LISTAS_EXECUCAO.situacao.reprovado]).toContain(anaFim.U);
    expect(anaFim.T).toBeTruthy();

    // As validações (também as x14 do extLst), as folhas escondidas e os nomes definidos ficam; o resto do zip igual
    // (os estilos só mudam o formato das datas para dd-mm-aaaa).
    const original = new Map(lerZip(MODELO).map(e => [e.nome, conteudoZip(e)]));
    const gerado = lerZip(bytes);
    expect(gerado.map(e => e.nome).sort()).toEqual([...original.keys()].sort());
    for (const e of gerado) {
      if (e.nome !== "xl/worksheets/sheet1.xml" && e.nome !== "xl/styles.xml") expect(conteudoZip(e).equals(original.get(e.nome)!), e.nome).toBe(true);
    }
    const estilos = conteudoZip(gerado.find(e => e.nome === "xl/styles.xml")!).toString("utf8");
    expect(estilos).toBe(estilosDatasDDMMAAAA(original.get("xl/styles.xml")!.toString("utf8")));
    expect(estilos).toContain('<numFmt numFmtId="166" formatCode="dd\\-mm\\-yyyy"/>');
    expect(estilos).not.toMatch(/<cellXfs[\s\S]*numFmtId="14"[\s\S]*<\/cellXfs>/);
    // As datas continuam datas do Excel, mostradas dd-mm-aaaa.
    const comFormato = XLSX.read(bytes, { type: "buffer", sheets: "Template", sheetRows: 4, cellNF: true, cellDates: false }).Sheets.Template!;
    expect(comFormato.S3?.t).toBe("n");
    expect(comFormato.S3?.z).toBe("dd\\-mm\\-yyyy");
    expect(XLSX.SSF.format(comFormato.S3!.z as string, comFormato.S3!.v as number)).toBe("05-01-2026");
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
  }, 90_000);

  it("turma só por vídeo-conferência: horas síncronas e E-Learning, sem presencial nem B-Learning", async () => {
    const ctx = await arrancar();
    const nome = unico("TF Distancia");
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2026-02-02", nome, curso: "UFCD Distancia", capacidade: 10, cronograma: CRONOGRAMA_DISTANCIA });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    const [dora] = await inscrever(ctx, turmaId, [["Dora", `dora${Date.now()}@exemplo.pt`]]) as [number];
    for (const n of [1, 2]) {
      const r = await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${turmaId}/sessoes/${n}`, { presencas: [marca(dora, "Dora Silva", "presente")] });
      expect(r.statusCode, r.body).toBe(200);
    }
    const linha = linhasTemplate(await descarregar(ctx, turmaId)).find(l => String(l.M).startsWith("Dora"))!;
    expect(linha).toMatchObject({ BA: 5.5, BB: 5.5, BF: 5.5, BJ: 5.5, BN: 2, BO: 2, BS: 2, BW: 2 });
    for (const col of ["BG", "BT", "BH", "BU", "BI", "BV", "BL", "BM"]) expect(linha[col] ?? null, col).toBeNull();
    // Sem área CNAEF nem código UFCD do curso: o ecrã diz o que falta à turma.
    const estado = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${turmaId}/reembolso`)).json();
    expect(estado.execucaoFisica.turma).toEqual(["Área de formação CNAEF do curso", "Código UFCD do curso"]);
  }, 60_000);

  it("dados para o financiamento: só a equipa da Financiada, valores das listas, identificadores cifrados", async () => {
    const ctx = await arrancar();
    const t = await turmaComFormandos(ctx);
    for (const perfil of ["comercial", "formador", "formando"] as const) {
      expect((await financiamento(ctx, perfil, t.ana)).statusCode, perfil).toBe(403);
      expect((await financiamento(ctx, perfil, t.ana, { niss: "12345678901" })).statusCode, perfil).toBe(403);
    }
    expect((await financiamento(ctx, null, t.ana)).statusCode).toBe(401);
    for (const perfil of ["admin", "secretaria", "financiada"] as const) expect((await financiamento(ctx, perfil, t.ana)).statusCode, perfil).toBe(200);

    // Fora da lista do template, formatos errados e campos desconhecidos são recusados.
    for (const corpo of [{ genero: "Feminino" }, { nacionalidade: "Portugal" }, { habilitacoesEntrada: "Licenciatura" }, { nif: "12345" },
      { niss: "12AB" }, { dataNascimento: "2999-01-01" }, { codigoPostal: "4000123" }, { numeroSigo: "x1" }, { qualquer: "1" }]) {
      expect((await financiamento(ctx, "financiada", t.ana, corpo)).statusCode, JSON.stringify(corpo)).toBe(400);
    }

    // NIF e código postal vêm da pré-inscrição até serem gravados na ficha.
    const antes = (await financiamento(ctx, "financiada", t.ana)).json();
    expect(antes.dados).toMatchObject({ nif: "123456789", codigoPostal: "4000-123", niss: "", genero: "" });
    expect(antes.daInscricao).toEqual(["nif", "codigoPostal"]);

    const r = await financiamento(ctx, "financiada", t.ana, {
      niss: "11122233344", passaporte: "AB9988776", dataNascimento: "1992-02-29", genero: "2 - Mulheres", nacionalidade: "6 - Angola", numeroSigo: "555",
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().dados).toMatchObject({ niss: "11122233344", passaporte: "AB9988776", dataNascimento: "1992-02-29", nacionalidade: "6 - Angola" });
    const linha = (await ctx.db.query<{ pii_enc: string; telf: string }>("SELECT pii_enc, telf FROM formandos_fin WHERE id = $1", [t.ana])).rows[0]!;
    expect(linha.pii_enc).toBeTruthy();
    for (const plano of ["11122233344", "AB9988776", "1992-02-29"]) expect(linha.pii_enc).not.toContain(plano);
    const tabela = (await ctx.db.query("SELECT * FROM formando_fin_financiamento WHERE formando_id = $1", [t.ana])).rows[0]!;
    expect(JSON.stringify(tabela)).not.toContain("11122233344");
    expect(tabela).toMatchObject({ genero: "2 - Mulheres", nacionalidade: "6 - Angola", numero_sigo: "555" });
    const log = (await ctx.db.query<{ meta: unknown }>("SELECT meta FROM audit_log WHERE action = 'formando.financiamento' AND entity_id = $1", [String(t.ana)])).rows;
    expect(log.length).toBeGreaterThan(0);
    expect(JSON.stringify(log)).not.toContain("11122233344");

    // Alterar o telefone na ficha não perde os identificadores do pacote cifrado.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formandos-fin/${t.ana}`, { telf: "934 000 111" })).statusCode).toBe(200);
    const depois = (await financiamento(ctx, "financiada", t.ana)).json();
    expect(depois.dados).toMatchObject({ niss: "11122233344", passaporte: "AB9988776" });
    const ficha = (await pedido(ctx, "financiada", "GET", `/v1/formandos/fin/${t.ana}`)).json();
    expect(JSON.stringify(ficha)).not.toContain("11122233344");

    // Limpar um campo apaga-o.
    expect((await financiamento(ctx, "financiada", t.ana, { passaporte: "" })).json().dados.passaporte).toBe("");
    // Uma ficha Gold não tem estes dados (as rotas são da Financiada).
    expect((await pedido(ctx, "secretaria", "GET", "/v1/formandos-fin/999999999/financiamento")).statusCode).toBe(404);
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
    const porCampo = Object.fromEntries((antes.execucaoFisica.porCampo as { campo: string; formandos: number }[]).map(c => [c.campo, c.formandos]));
    expect(porCampo).toMatchObject({
      [FALTA.nif]: 2, [FALTA.codigoPostal]: 1, [FALTA.telefone]: 1, [FALTA.email]: 1, [FALTA.inscricao]: 1,
      [FALTA.niss]: 3, [FALTA.dataNascimento]: 3, [FALTA.genero]: 3, [FALTA.nacionalidade]: 3, [FALTA.situacaoEmprego]: 3,
      [FALTA.habilitacoes]: 3, [FALTA.numeroSigo]: 3,
    });
    expect(antes.execucaoFisica.porFormando.find((f: { id: number }) => f.id === t.carla).falta).toEqual([
      FALTA.nif, FALTA.niss, FALTA.dataNascimento, FALTA.genero, FALTA.nacionalidade, FALTA.codigoPostal, FALTA.telefone,
      FALTA.email, FALTA.inscricao, FALTA.situacaoEmprego, FALTA.habilitacoes, FALTA.numeroSigo,
    ]);

    // Os dados recolhidos na ficha saem da lista; empregado sem NIF da entidade e estrangeiro sem documento entram.
    await financiamento(ctx, "financiada", t.bruno, {
      nif: "234567890", niss: "98765432109", dataNascimento: "1985-11-30", genero: "1 - Homens", nacionalidade: "31 - Brasil",
      situacaoEmpregoEntrada: "5 - Empregados", habilitacoesEntrada: "7 - Mestrado", numeroSigo: "42",
    });
    const meioDados = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${t.id}/reembolso`)).json();
    expect(meioDados.execucaoFisica.porFormando.find((f: { id: number }) => f.id === t.bruno).falta).toEqual([FALTA.documentoEstrangeiro, FALTA.nifEntidade]);

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

    // Dados para o financiamento alterados: a execução física fica desactualizada.
    await financiamento(ctx, "financiada", t.bruno, { passaporte: "ZZ000111" });
    const comDoc = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${t.id}/reembolso`)).json();
    expect(comDoc.ficheiros.find((f: { tipo: string }) => f.tipo === "execucao-fisica").desatualizado).toBe(true);
    await pedido(ctx, "financiada", "POST", `/v1/turmas-fin/${t.id}/reembolso/atualizar`, {});

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
    expect(bruno).toMatchObject({ BA: 11, BN: 3, J: "ZZ000111" });

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

describe("execução física: situação no fim e formandos que mudaram de turma", () => {
  it("turma fechada: «Aprovado» só com nota positiva e assiduidade; sem avaliação fica «Em Execução» e falta a avaliação", async () => {
    const ctx = await arrancar();
    const t = await turmaComFormandos(ctx);
    // Ana: 10 h de 11 e nota positiva; Bruno: nota positiva mas 7 h de 11; Carla: sem nota nem presenças.
    for (const id of [t.ana, t.bruno]) {
      expect((await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${t.id}/certificados/${id}`, { nota: 15 })).statusCode).toBe(200);
    }
    await ctx.db.query("UPDATE turmas_fin SET fechada_em = now() WHERE id = $1", [t.id]);
    const linhas = linhasTemplate(await descarregar(ctx, t.id));
    const porNome = (n: string) => linhas.find(l => String(l.M ?? "").startsWith(n))!;
    expect(porNome("Ana").U).toBe(LISTAS_EXECUCAO.situacao.aprovado);
    expect(porNome("Bruno").U).toBe(LISTAS_EXECUCAO.situacao.reprovado);
    // O Bruno sai na última presença; a Carla não tem resultado declarado (nem fim, nem «à saída»).
    expect(porNome("Bruno").T).toBe(serieExcel("2026-01-06"));
    const carla = porNome("Carla");
    expect(carla.U).toBe(LISTAS_EXECUCAO.situacao.emExecucao);
    expect(carla.T ?? null).toBeNull();
    const estado = (await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${t.id}/reembolso`)).json();
    const falta = (id: number) => (estado.execucaoFisica.porFormando as { id: number; falta: string[] }[]).find(f => f.id === id)?.falta ?? [];
    expect(falta(t.carla)).toContain(FALTA.avaliacao);
    expect(falta(t.ana)).not.toContain(FALTA.avaliacao);
    expect(falta(t.bruno)).not.toContain(FALTA.avaliacao);
  }, 60_000);

  it("quem mudou de turma continua na de origem como «Transferido», só com as horas dela; e entra na nova", async () => {
    const ctx = await arrancar();
    const t = await turmaComFormandos(ctx);
    const outra = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
      dataInicio: "2026-01-05", nome: unico("TF Destino"), curso: "UFCD Reembolso", capacidade: 10, cronograma: CRONOGRAMA,
    });
    expect(outra.statusCode, outra.body).toBe(200);
    const destino = outra.json().turma.id as number;
    // O Bruno (4 h presenciais + 3 h síncronas na origem) passa para a outra turma e tem lá uma sessão.
    const m = await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-fin/${t.bruno}`, { turmaId: destino });
    expect(m.statusCode, m.body).toBe(200);
    expect((await ctx.db.query<{ turma_id: number }>("SELECT turma_id FROM formandos_fin WHERE id = $1", [t.bruno])).rows[0]!.turma_id).toBe(destino);
    await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${destino}/sessoes/3`, { presencas: [marca(t.bruno, "Bruno Silva", "presente")] });

    const origem = linhasTemplate(await descarregar(ctx, t.id));
    const bruno = origem.find(l => String(l.M ?? "").startsWith("Bruno"))!;
    expect(bruno).toMatchObject({ U: LISTAS_EXECUCAO.situacao.transferido, BA: 7, BH: 4, BJ: 3, BN: 2, AH: t.bruno });
    expect(bruno.T).toBe(serieExcel("2026-01-06"));
    expect(origem.filter(l => l.A === "Inserir")).toHaveLength(3);
    const novo = linhasTemplate(await descarregar(ctx, destino)).find(l => String(l.M ?? "").startsWith("Bruno"))!;
    expect(novo).toMatchObject({ U: LISTAS_EXECUCAO.situacao.emExecucao, BA: 4, BN: 1 });

    // As fichas de inscrição da origem continuam a tê-lo (uma página por formando).
    const fichas = await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/dossie/fichas`);
    expect(fichas.statusCode, fichas.body.slice(0, 200)).toBe(200);
    expect((await PDFDocument.load(fichas.rawPayload)).getPageCount()).toBe(3);
  }, 60_000);
});

describe("nome dos ficheiros do reembolso", () => {
  it("«<tipo> - <turma> - <curso> - <dd-mm-aaaa>.xlsx», com acentos na descarga", async () => {
    const { nomeFicheiroReembolso, anexoXlsx } = await import("../src/reembolso.js");
    const turma = { id: 7, nome: "EFA 12/26", curso: "Língua Inglesa: Distribuição", data_inicio: "2026-03-05" };
    expect(nomeFicheiroReembolso("despesas", turma)).toBe("Despesas - EFA 1226 - Língua Inglesa_ Distribuição - 05-03-2026.xlsx");
    expect(nomeFicheiroReembolso("execucao-fisica", turma)).toBe("Execução Física - EFA 1226 - Língua Inglesa_ Distribuição - 05-03-2026.xlsx");
    expect(nomeFicheiroReembolso("despesas", { id: 8, nome: "", curso: "", data_inicio: "" })).toBe("Despesas - Turma 8.xlsx");
    const h = anexoXlsx("Execução Física - T1 - Curso - 05-03-2026.xlsx");
    expect(h).toContain('filename="Execucao Fisica - T1 - Curso - 05-03-2026.xlsx"');
    expect(h).toContain("filename*=UTF-8''Execu%C3%A7%C3%A3o%20F%C3%ADsica");
  });
});
