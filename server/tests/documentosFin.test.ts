// Documentos da turma da Financiada no modelo da candidatura: ficha de inscrição, plano de sessão e folha de
// presenças / sumário (server/src/documentosFin.ts). Dados fictícios.
import { crc32, deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { CANDIDATURA_FIN_OMISSAO, lerCandidaturaFin } from "../../src/partilhado/candidaturaFin.js";
import {
  acaoDaTurma, colunasMomento, rotuloGenero, rotuloHabilitacoes, rotuloNacionalidade, rotuloSituacaoEmprego, textoSumario,
} from "../src/documentosFin.js";
import { apagarLogoEntidade, guardarLogoEntidade } from "../src/entidadeLogo.js";
import { montarPdfsDossie } from "../src/pedagogia/ficheiros.js";
import { writePreinscricaoPii } from "../src/pii.js";
import { anexosDaTurma } from "../src/repos/dtp.js";
import { carregarTurma } from "../src/repos/pedagogiaTurma.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

const CRONOGRAMA = [
  { id: "d1", data: "2026-09-30", horaInicio: "19:00", horaFim: "22:00", modalidade: "presencial", modulos: ["Competências empreendedoras"], formadores: [] },
  { id: "d2", data: "2026-10-01", horaInicio: "19:00", horaFim: "22:00", modalidade: "sincrona", modulos: [], formadores: [] },
  // Auto-aprendizagem: sem folha nem plano.
  { id: "d3", data: "2026-10-02", horaInicio: "10:00", horaFim: "12:00", modalidade: "auto", modulos: [], formadores: [] },
];

const PLANO = {
  objetivosGerais: "Identificar competências empreendedoras.",
  objetivosEspecificos: "Elaborar um CV Europass.",
  momentos: {
    introducao: { conteudo: "Apresentação da sessão", metodos: "Expositivo", recursos: "Projetor", avaliacao: "Observação direta", tempo: "15 min" },
    desenvolvimento: { conteudo: "Técnicas de procura de emprego", atividades: "Simulação de entrevista", metodos: "Ativo", tempo: "2h30" },
    conclusao: { conteudo: "Síntese", tempo: "15 min" },
  },
};

/** Texto de cada página (pdfjs, como um leitor de PDF o extrai). */
async function paginas(bytes: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map(it => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " "));
  }
  await doc.destroy();
  return out;
}

/** Imagens (XObject) no PDF: o logótipo e o rodapé do financiamento. */
function imagens(bytes: Buffer) {
  return (bytes.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length;
}

/** PNG RGBA mínimo (largura × altura), para o logótipo configurado. */
function png(w: number, h: number) {
  const chunk = (tipo: string, dados: Buffer) => {
    const t = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
    const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(t) >>> 0);
    return Buffer.concat([len, t, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const linhas = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 4, 0xc0)])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(linhas)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

type Turma = { id: number; nome: string; ana: number; bruno: number };

async function turmaFin(ctx: Ctx): Promise<Turma> {
  const nomeComercial = unico("Empreender");
  const c = await pedido(ctx, "financiada", "POST", "/v1/cursos-fin", {
    ufcdCod: "8600", ufcd: "Competências empreendedoras e técnicas de procura de emprego", nomeComercial, regime: "b-learning", horas: 25,
    areaCnaef: "341 - Comércio",
  });
  expect(c.statusCode, c.body).toBe(200);
  const nome = unico("TF Docs");
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
    dataInicio: "2026-09-30", nome, curso: nomeComercial, capacidade: 10, local: "Sala Virtual / E-Learning", cronograma: CRONOGRAMA, numeroAcao: 2,
  });
  expect(t.statusCode, t.body).toBe(200);
  const turmaId = t.json().turma.id as number;
  const ids: number[] = [];
  for (const n of ["Ana", "Bruno"]) {
    const f = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { nome: n, apelido: "Silva", email: `${n.toLowerCase()}${Date.now()}${++seq}@exemplo.pt`, telf: "914 212 368", turmaId });
    expect(f.statusCode, f.body).toBe(200);
    ids.push(f.json().formando.id as number);
  }
  const [ana, bruno] = ids as [number, number];
  // Pré-inscrição da Ana: morada, localidade e concelho; habilitações e situação com o rótulo que escolheu.
  const email = (await ctx.db.query<{ email: string }>("SELECT email FROM formandos_fin WHERE id = $1", [ana])).rows[0]!.email;
  const pii = writePreinscricaoPii({
    nif: "206156928", moradaFiscal: "Rua do Espinheiro 664, bl 5", codigoPostal: "4400-450", telf: "914212368",
    fin: {
      localidade: "Vila Nova de Gaia", habilitacoes: "12.º Ano",
      habilitacoesEntrada: "3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior",
      situacaoEmprego: "Trabalhador(a) por conta de outrem", situacaoEmpregoEntrada: "5 - Empregados",
    },
  });
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, nif, morada_fiscal, codigo_postal, telf, pii_enc, concelho)
     VALUES ($1, '2026-09-01 10:30', 'Ana', $2, $3, 0, 'Formando', 'fin', $4, $5, $6, $7, COALESCE($8, ''), 'Vila Nova de Gaia')`,
    [870000 + (++seq), email, nomeComercial, pii.nif, pii.morada_fiscal, pii.codigo_postal, pii.telf, pii.pii_enc],
  );
  const fin = await pedido(ctx, "financiada", "PATCH", `/v1/formandos-fin/${ana}/financiamento`, {
    niss: "11335247740", dataNascimento: "1976-05-12", genero: "2 - Mulheres", nacionalidade: "191 - Portugal",
    tipoDocumento: "Cartão de Cidadão", numeroDocumento: "10859691", validadeDocumento: "2029-03-19",
    situacaoEmpregoEntrada: "5 - Empregados", nifEntidadeEmpregadora: "500000000",
    habilitacoesEntrada: "3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior",
  });
  expect(fin.statusCode, fin.body).toBe(200);
  const base = `/v1/turmas/fin/${turmaId}/sessoes`;
  const s1 = await pedido(ctx, "secretaria", "PUT", `${base}/1`, {
    plano: PLANO,
    sumario: { conteudos: "Técnicas de procura de emprego e CV.", atividades: "Simulação de entrevista.", assinado: true },
    presencas: [
      { id: ana, nome: "Ana Silva", presente: true, estado: "presente" },
      { id: bruno, nome: "Bruno Silva", presente: true, estado: "atraso", minutos: 20 },
    ],
  });
  expect(s1.statusCode, s1.body).toBe(200);
  const s2 = await pedido(ctx, "secretaria", "PUT", `${base}/2`, {
    presencas: [
      { id: ana, nome: "Ana Silva", presente: true, estado: "presente" },
      { id: bruno, nome: "Bruno Silva", presente: false, estado: "falta_injustificada" },
    ],
  });
  expect(s2.statusCode, s2.body).toBe(200);
  return { id: turmaId, nome, ana, bruno };
}

describe("documentos da Financiada: rótulos", () => {
  it("valores das listas em rótulos humanos, colunas do plano e candidatura por omissão", () => {
    expect(rotuloGenero("2 - Mulheres")).toBe("Feminino");
    expect(rotuloGenero("1 - Homens")).toBe("Masculino");
    expect(rotuloNacionalidade("191 - Portugal")).toBe("Portuguesa");
    expect(rotuloNacionalidade("31 - Brasil")).toBe("Brasil");
    expect(rotuloNacionalidade("")).toBe("");
    expect(rotuloHabilitacoes("3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior", "12.º Ano")).toBe("12.º Ano");
    // A secretaria mudou as habilitações na ficha: o rótulo da pré-inscrição já não serve.
    expect(rotuloHabilitacoes("6 - Licenciatura", "12.º Ano")).toBe("Licenciatura");
    expect(rotuloSituacaoEmprego("5 - Empregados", "Trabalhador(a) independente")).toBe("Trabalhador(a) independente");
    expect(rotuloSituacaoEmprego("6 - Inativos")).toBe("Inativos");
    expect(acaoDaTurma({ numero_acao: 2, ufcd_cod: "", c_ufcd_cod: "8600", c_ufcd: "Competências", curso: "X" } as never)).toBe("UFCD 8600 - Competências (Ação 2)");
    expect(colunasMomento({ conteudo: "C", metodos: "M", atividades: "A", recursos: "R", materiais: "Mat", avaliacao: "Av", tempo: "10 min" }))
      .toEqual(["C", "M\nA", "R\nMat", "Av", "10 min"]);
    // Plano antigo, sem «Tempo»: a coluna fica em branco.
    expect(colunasMomento({ conteudo: "C" })[4]).toBe("");
    expect(textoSumario({ conteudos: "X", observacoes: "Y" })).toBe("X\nObservações: Y");
    expect(lerCandidaturaFin(undefined)).toEqual(CANDIDATURA_FIN_OMISSAO);
    // Campo gravado em branco fica em branco; o que nunca foi gravado usa a omissão.
    expect(lerCandidaturaFin({ tipologia: "" }).tipologia).toBe("");
    expect(lerCandidaturaFin({ tipologia: "" }).programa).toBe(CANDIDATURA_FIN_OMISSAO.programa);
  });
});

describe("documentos da Financiada: PDF no modelo da candidatura", () => {
  it("plano de sessão: o «Tempo» de cada momento grava-se; planos sem ele continuam a gravar", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    const ped = (await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/pedagogia`)).json();
    const s1 = (ped.sessoes as { n: number; plano: typeof PLANO }[]).find(s => s.n === 1)!;
    expect(s1.plano.momentos.introducao.tempo).toBe("15 min");
    expect(s1.plano.momentos.desenvolvimento.tempo).toBe("2h30");
    // Formato antigo (sem «tempo»): aceite, e o tempo fica vazio.
    const antigo = { ...PLANO, momentos: Object.fromEntries(Object.entries(PLANO.momentos).map(([k, m]) => [k, { conteudo: m.conteudo }])) };
    const r = await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${t.id}/sessoes/2`, { plano: antigo });
    expect(r.statusCode, r.body).toBe(200);
    const depois = (await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/pedagogia`)).json();
    const s2 = (depois.sessoes as { n: number; plano: typeof PLANO }[]).find(s => s.n === 2)!;
    expect(s2.plano.momentos.introducao.tempo).toBe("");
    // Tempo comprido demais é recusado.
    const longo = { ...PLANO, momentos: { ...PLANO.momentos, conclusao: { tempo: "x".repeat(121) } } };
    expect((await pedido(ctx, "secretaria", "PUT", `/v1/turmas/fin/${t.id}/sessoes/2`, { plano: longo })).statusCode).toBe(400);
  });

  it("fichas de inscrição: uma página por formando, com a candidatura, a UFCD e os dados pessoais em rótulos", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    const r = await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/dossie/fichas`);
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(r.headers["content-disposition"]).toContain("FichasInscricao.pdf");
    const bytes = r.rawPayload;
    const [ana, bruno, ...resto] = await paginas(bytes);
    expect(resto).toHaveLength(0);
    // Logótipo da entidade (o da ENA, sem logótipo configurado) e o rodapé do financiamento.
    expect(imagens(bytes)).toBeGreaterThanOrEqual(2);
    for (const rotulo of [
      "FOLHA DE INSCRIÇÃO", "Nome:", "Assinatura:", "Entidade:", "Programa:", "Prioridade do Programa:", "Tipologia de Ação:",
      "Tipologia de Intervenção:", "Tipologia de Operação:", "UFCD:", "Tipologia", "Género:", "Data Nascimento:", "Cartão Cidadão:",
      "Válido até:", "NIF:", "NISS:", "Morada:", "Código Postal:", "Localidade:", "Concelho:", "Email:", "Telefone:",
      "Nacionalidade:", "Habilitações:", "Situação Emprego:", "Nif Entidade Empregadora:", "o Coordenador:",
    ]) expect(ana, rotulo).toContain(rotulo);
    for (const valor of [
      "Ana Silva", "ENA · Escola de Negócios e Administração", CANDIDATURA_FIN_OMISSAO.programa, CANDIDATURA_FIN_OMISSAO.tipologia,
      "8600", "Feminino", "1976-05-12", "10859691", "19-03-2029", "206156928", "11335247740", "Rua do Espinheiro 664, bl 5",
      "4400-450", "Vila Nova de Gaia", "914 212 368", "Portuguesa", "12.º Ano", "Trabalhador(a) por conta de outrem", "500000000",
    ]) expect(ana, valor).toContain(valor);
    // O Bruno não tem dados: os campos ficam em branco (sem valores de outro formando).
    expect(bruno).toContain("Bruno Silva");
    expect(bruno).not.toContain("11335247740");
    expect(bruno).not.toContain("Feminino");
    // Gerar liga o PDF ao item do dossiê.
    const anexos = await anexosDaTurma(ctx.db, "fin", t.id);
    expect(anexos.find(a => a.item_id === "fichas")?.drive_file_id).toBeTruthy();
  });

  it("ficha de inscrição de um formando: só a equipa da Financiada, uma página", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    const url = `/v1/formandos-fin/${t.ana}/ficha-inscricao`;
    for (const perfil of ["formador", "comercial"] as const) expect((await pedido(ctx, perfil, "GET", url)).statusCode, perfil).toBe(403);
    expect((await pedido(ctx, null, "GET", url)).statusCode).toBe(401);
    for (const perfil of ["admin", "secretaria", "financiada"] as const) {
      const r = await pedido(ctx, perfil, "GET", url);
      expect(r.statusCode, perfil).toBe(200);
      expect(r.headers["content-disposition"]).toContain("FichaInscricao - Ana Silva.pdf");
      const pgs = await paginas(r.rawPayload);
      expect(pgs).toHaveLength(1);
      expect(pgs[0]).toContain("Ana Silva");
      expect(pgs[0]).not.toContain("Bruno Silva");
    }
    expect((await pedido(ctx, "financiada", "GET", "/v1/formandos-fin/999999999/ficha-inscricao")).statusCode).toBe(404);
    const audit = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'formando.ficha_inscricao' AND entity_id = $1", [String(t.ana)]);
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it("folha de presenças / sumário: uma por sessão lectiva, com presenças e sumário; liga-se às presenças e aos sumários", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    const r = await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/dossie/presencas`);
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    const bytes = r.rawPayload;
    expect(imagens(bytes)).toBeGreaterThanOrEqual(2);
    const [p1, p2, ...resto] = await paginas(bytes);
    expect(resto).toHaveLength(0);
    for (const v of [
      "FOLHA DE PRESENÇAS / SUMÁRIO", "Entidade:", "Programa:", "Prioridade do Programa:", "Tipologia de Ação:", "Tipologia de Intervenção:",
      "Tipologia de Operação:", CANDIDATURA_FIN_OMISSAO.tipologiaOperacao,
      "8600 | Competências empreendedoras e técnicas de procura de emprego",
      "UFCD 8600 - Competências empreendedoras e técnicas de procura de emprego (Ação 2)",
      "Sala:", "Local:", "Sala Virtual / E-Learning", "Data:", "2026-09-30", "Horário:", "19:00 às 22:00", "T:", "P:",
      "Nome:", "Presenças:", "Ana Silva", "Presente", "Bruno Silva", "Atraso (20 min)",
      "Sumário:", "Técnicas de procura de emprego e CV.", "Simulação de entrevista.", "o Formador:", "o Coordenador:",
    ]) expect(p1, v).toContain(v);
    expect(p2).toContain("2026-10-01");
    expect(p2).toContain("Falta");
    // Sessão sem sumário: a caixa fica vazia.
    expect(p2).not.toContain("Técnicas de procura de emprego e CV.");
    // O mesmo PDF fica ligado aos dois itens (presenças e sumários).
    const anexos = await anexosDaTurma(ctx.db, "fin", t.id);
    const presencas = anexos.find(a => a.item_id === "presencas")?.drive_file_id;
    expect(presencas).toBeTruthy();
    expect(anexos.find(a => a.item_id === "sumarios")?.drive_file_id).toBe(presencas);
  });

  it("plano de sessão: uma página na horizontal por sessão lectiva, com as colunas do modelo e o Tempo", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    const r = await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/dossie/planos`);
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    const bytes = r.rawPayload;
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(imagens(bytes)).toBeGreaterThanOrEqual(2);
    const [p1, p2] = await paginas(bytes);
    for (const v of [
      "PLANO DE SESSÃO", "Publico alvo:", "Formandos do módulo - Competências empreendedoras", "Objetivos:",
      "Identificar competências empreendedoras.", "Elaborar um CV Europass.",
      "Momento", "Conteúdos", "Métodos / Estratégias", "Recursos didáticos", "Avaliação", "Tempo",
      "Introdução", "Desenvolvimento", "Conclusão", "Apresentação da sessão", "Expositivo", "Projetor", "Observação direta",
      "15 min", "2h30", "Simulação de entrevista", "o Formador:", "o Coordenador:",
    ]) expect(p1, v).toContain(v);
    // Sessão 2 sem plano: o módulo vem da UFCD e a tabela fica em branco.
    expect(p2).toContain("Formandos do módulo - Competências empreendedoras e técnicas de procura de emprego");
    expect(p2).not.toContain("15 min");
  });

  it("sessão a sessão no cockpit: folha e plano da sessão n; o formador fora da turma não os tira; Gold recusa", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    const folha = await pedido(ctx, "secretaria", "GET", `/v1/turmas/fin/${t.id}/folhas-presenca?sessao=2`);
    expect(folha.statusCode, folha.body.slice(0, 200)).toBe(200);
    expect(folha.headers["content-disposition"]).toContain("sessao 2");
    const pf = await paginas(folha.rawPayload);
    expect(pf).toHaveLength(1);
    expect(pf[0]).toContain("2026-10-01");
    const plano = await pedido(ctx, "financiada", "GET", `/v1/turmas/fin/${t.id}/planos-sessao?sessao=1`);
    expect(plano.statusCode).toBe(200);
    expect(await paginas(plano.rawPayload)).toHaveLength(1);
    const todas = await pedido(ctx, "admin", "GET", `/v1/turmas/fin/${t.id}/folhas-presenca`);
    expect(await paginas(todas.rawPayload)).toHaveLength(2);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/turmas/fin/${t.id}/folhas-presenca?sessao=9`)).statusCode).toBe(404);
    expect((await pedido(ctx, "formador", "GET", `/v1/turmas/fin/${t.id}/folhas-presenca?sessao=1`)).statusCode).toBe(403);
    expect((await pedido(ctx, null, "GET", `/v1/turmas/fin/${t.id}/planos-sessao`)).statusCode).toBe(401);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${t.id}/folhas-presenca`)).statusCode).toBe(400);
    // O formador continua sem gerar o dossiê da turma.
    expect((await pedido(ctx, "formador", "GET", `/v1/turmas/fin/${t.id}/dossie/presencas`)).statusCode).toBe(403);
  });

  it("programa da turma (Edição de cursos › Programas); logótipo configurado no topo; ZIP com as fichas; Gold com os PDF de texto", async () => {
    const ctx = await arrancar();
    const t = await turmaFin(ctx);
    // Sem programa escolhido vale o primeiro activo (o da migração, com os valores da candidatura PESSOAS 2030).
    const [antes] = await paginas((await pedido(ctx, "financiada", "GET", `/v1/formandos-fin/${t.ana}/ficha-inscricao`)).rawPayload);
    expect(antes).toContain(CANDIDATURA_FIN_OMISSAO.tipologia);
    const valores = { ...CANDIDATURA_FIN_OMISSAO, nome: "Programa Teste", tipologia: "1.09. Formação de Teste", programa: "" };
    expect((await pedido(ctx, "formador", "POST", "/v1/catalog/programas", { regime: "fin", payload: valores })).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/catalog/programas", { regime: "fin", payload: { ...valores, nome: "" } })).statusCode).toBe(400);
    const g = await pedido(ctx, "secretaria", "POST", "/v1/catalog/programas", { regime: "fin", payload: valores });
    expect(g.statusCode, g.body).toBe(200);
    const p = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-fin/${t.id}`, { programa: "Programa Teste" });
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json().turma.programa).toBe("Programa Teste");
    // Renomear o programa leva a turma com ele; apagar um programa em uso é recusado.
    const id = g.json().item.id as number;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/catalog/programas/${id}`, { payload: { ...valores, nome: "Programa Novo" } })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/catalog/programas/${id}`)).statusCode).toBe(409);
    try {
      const [ficha] = await paginas((await pedido(ctx, "financiada", "GET", `/v1/formandos-fin/${t.ana}/ficha-inscricao`)).rawPayload);
      expect(ficha).toContain("1.09. Formação de Teste");
      expect(ficha).not.toContain(CANDIDATURA_FIN_OMISSAO.programa);

      // Logótipo de Configurações › Entidade no topo dos três documentos (3×2 píxeis, para o reconhecer no PDF).
      await guardarLogoEntidade(ctx.db, { nome: "logo.png", bytes: png(3, 2) });
      for (const url of [`/v1/formandos-fin/${t.ana}/ficha-inscricao`, `/v1/turmas/fin/${t.id}/folhas-presenca`, `/v1/turmas/fin/${t.id}/planos-sessao`]) {
        const raw = (await pedido(ctx, "financiada", "GET", url)).rawPayload.toString("latin1");
        expect(raw, url).toMatch(/\/Width 3\s*\/Height 2|\/Height 2\s*\/Width 3/);
        // O rodapé do financiamento (1024 × 223).
        expect(raw, url).toMatch(/\/Width 1024/);
      }
    } finally {
      await apagarLogoEntidade(ctx.db);
      await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-fin/${t.id}`, { programa: "" });
    }

    // ZIP do dossiê: as fichas no tópico 5, as folhas e os planos no 6 (modelo da candidatura).
    const zip = await pedido(ctx, "financiada", "GET", `/v1/dtp/fin/${t.id}/export`);
    expect(zip.statusCode, zip.body.slice(0, 200)).toBe(200);
    const nomes = zip.rawPayload.toString("latin1");
    expect(nomes).toContain("5. Formandos/FichasInscricao.pdf");
    expect(nomes).toContain("Folhas de presenca e sumarios.pdf");

    // Gold: o mesmo gerador de sempre (PDF de texto, sem imagens).
    const turma = await carregarTurma(ctx.db, "fin", t.id);
    const gold = await montarPdfsDossie(ctx.db, "gold", { ...turma!, id: -1 });
    expect(gold.folhas.toString("latin1")).toContain("Folhas de presenca");
    expect(imagens(gold.folhas)).toBe(0);
    const fin = await montarPdfsDossie(ctx.db, "fin", turma!);
    expect(imagens(fin.folhas)).toBeGreaterThanOrEqual(2);
  });
});
