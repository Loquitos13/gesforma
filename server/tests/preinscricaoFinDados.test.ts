import { describe, expect, it } from "vitest";
import { arrancar, pedido, preinscricaoDoEmail, type Ctx } from "./helpers.js";
import {
  GENEROS_FIN, HABILITACOES_FIN, SITUACOES_EMPREGO_FIN, TERMOS_FIN_VERSAO, ibanDoNib, validarIban,
} from "../../src/partilhado/dadosPessoaisFin.js";
import {
  LISTA_GENERO, LISTA_HABILITACOES, LISTA_SITUACAO_EMPREGO,
} from "../../src/partilhado/execucaoFisica.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

let seq = 0;
function unico(prefixo: string) {
  seq += 1;
  return `${prefixo}-${Date.now()}-${seq}`;
}

/** Datas relativas a hoje (os testes não dependem do dia em que correm). */
function diaMais(anos: number, dias = 0) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + anos);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const NIF = "123456789";
const NIF_EMPRESA = "509999999";
const NISS = "12345678901";
const NIB = "000201231234567890154";
const IBAN = "PT50000201231234567890154";

async function cursoFin(ctx: Ctx) {
  const curso = unico("Curso Fin Dados");
  expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-fin", {
    ufcdCod: unico("U").slice(0, 18), ufcd: curso, nomeComercial: curso, regime: "Presencial", horas: 25,
  })).statusCode).toBe(200);
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", {
    dataInicio: "2030-06-03", nome: unico("TF"), curso, local: "Porto", horario: "Laboral Manhã", alunosTotal: 5, estado: "A montar",
    cronograma: [{ id: unico("s"), data: "2030-06-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(t.statusCode, t.body).toBe(200);
  return { curso, turmaId: t.json().turma.id as number };
}

async function cursoGold(ctx: Ctx) {
  const nome = unico("Curso Gold Dados");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
    nome, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8,
  });
  expect(r.statusCode).toBe(200);
  return nome;
}

function publico(ctx: Ctx, body: Record<string, unknown>) {
  return ctx.app.inject({ method: "POST", url: "/v1/public/preinscricoes", payload: body, remoteAddress: `10.9.${seq % 250}.${(seq * 7) % 250}` });
}

const dadosFin = (extra: Record<string, unknown> = {}) => ({
  nomeCompleto: "Maria  da Silva Santos",
  genero: "2 - Mulheres",
  dataNascimento: "1990-05-17",
  nacionalidade: "191 - Portugal",
  habilitacoes: "12.º Ano",
  ...extra,
});

async function pedidoFin(ctx: Ctx, curso: string) {
  const email = `${unico("fin")}@exemplo.pt`;
  const r = await publico(ctx, { nome: "Maria", email, telf: "912345678", curso, regime: "fin", consentimento: true, dadosFin: dadosFin() });
  expect(r.statusCode, r.body).toBe(200);
  const id = await preinscricaoDoEmail(ctx, email);
  const tok = await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id]);
  return { id, email, token: tok.rows[0]!.docs_token };
}

async function linha(ctx: Ctx, id: number) {
  const r = await ctx.db.query<Record<string, unknown>>("SELECT * FROM preinscricoes WHERE id = $1", [id]);
  return r.rows[0]!;
}

async function pacote(ctx: Ctx, id: number) {
  const { readPreinscricaoPii } = await import("../src/pii.js");
  return readPreinscricaoPii(await linha(ctx, id));
}

function passo(ctx: Ctx, token: string, nome: "morada" | "identificacao" | "termos", payload: Record<string, unknown>) {
  return ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/dados/${nome}`, payload });
}

function upload(ctx: Ctx, token: string, tipo: string) {
  const boundary = "----gesforma";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${tipo}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    PDF,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/public/documentos/${token}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  });
}

const MORADA = { morada: "Rua das Flores, 12, 3.º Esq.", localidade: "Porto", codigoPostal: "4000-123", concelho: "Porto" };
const IDENT = {
  tipoDocumento: "Cartão de Cidadão", numeroDocumento: "12345678 0 zz0", validadeDocumento: diaMais(5), nif: NIF, niss: NISS,
  iban: NIB, situacaoEmprego: "Trabalhador(a) por conta de outrem", nifEntidadeEmpregadora: NIF_EMPRESA,
};

const campos = (r: { json: () => { campos?: { campo: string }[] } }) => (r.json().campos ?? []).map(c => c.campo);

describe("listas da financiada", () => {
  it("género, habilitações e situação face ao emprego gravam valores das listas da execução física", () => {
    for (const g of GENEROS_FIN) expect(LISTA_GENERO as readonly string[]).toContain(g.valor);
    for (const h of HABILITACOES_FIN) if (h.valor) expect(LISTA_HABILITACOES as readonly string[]).toContain(h.valor);
    for (const s of SITUACOES_EMPREGO_FIN) expect(LISTA_SITUACAO_EMPREGO as readonly string[]).toContain(s.valor);
    expect(ibanDoNib(NIB)).toBe(IBAN);
    expect(validarIban(IBAN).ok).toBe(true);
  });
});

describe("formulário público da financiada", () => {
  it("grava nome completo, género, nascimento, nacionalidade e habilitações cifrados (nada em claro)", async () => {
    const ctx = await arrancar();
    const { curso } = await cursoFin(ctx);
    const { id } = await pedidoFin(ctx, curso);
    const l = await linha(ctx, id);
    expect(l).toMatchObject({ regime: "fin", nome: "Maria", apelido: "da Silva Santos" });
    expect(String(l.pii_enc)).not.toContain("1990-05-17");
    expect(JSON.stringify(l)).not.toContain("1990-05-17");
    const p = await pacote(ctx, id);
    expect(p.telf).toBe("912345678");
    expect(p.fin).toMatchObject({
      genero: "2 - Mulheres", dataNascimento: "1990-05-17", nacionalidade: "191 - Portugal", habilitacoes: "12.º Ano",
      habilitacoesEntrada: "3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior",
    });
    // O histórico só diz que campos chegaram, nunca os valores.
    const ev = await ctx.db.query<{ detalhe: string }>("SELECT detalhe FROM lead_eventos WHERE lead_id = $1", [id]);
    for (const e of ev.rows) expect(e.detalhe).not.toContain("1990-05-17");
  });

  it("recusa dados em falta ou inválidos, com o erro de cada campo", async () => {
    const ctx = await arrancar();
    const { curso } = await cursoFin(ctx);
    const base = { nome: "X", telf: "912345678", curso, regime: "fin", consentimento: true };
    const casos: [Record<string, unknown>, Record<string, unknown>, string][] = [
      [{}, { nomeCompleto: "Maria" }, "dadosFin.nomeCompleto"],
      [{}, { genero: "Masculino" }, "dadosFin.genero"],
      [{}, { dataNascimento: diaMais(-15) }, "dadosFin.dataNascimento"],
      [{}, { dataNascimento: diaMais(1) }, "dadosFin.dataNascimento"],
      [{}, { dataNascimento: "1990-02-30" }, "dadosFin.dataNascimento"],
      [{}, { nacionalidade: "Portugal" }, "dadosFin.nacionalidade"],
      [{}, { habilitacoes: "Secundário" }, "dadosFin.habilitacoes"],
      [{ telf: "" }, {}, "telf"],
      [{ telf: "12345" }, {}, "telf"],
    ];
    for (const [extra, fin, campo] of casos) {
      const email = `${unico("inv")}@exemplo.pt`;
      const r = await publico(ctx, { ...base, ...extra, email, dadosFin: dadosFin(fin) });
      expect(r.statusCode, `${campo}: ${r.body}`).toBe(400);
      expect(campos(r)).toContain(campo);
      expect(await preinscricaoDoEmail(ctx, email)).toBe(0);
    }
    // Com 16 anos feitos hoje, já pode.
    const email = `${unico("ok16")}@exemplo.pt`;
    expect((await publico(ctx, { ...base, email, dadosFin: dadosFin({ dataNascimento: diaMais(-16) }) })).statusCode).toBe(200);
  });

  it("um curso Gold não muda: ignora os dados da financiada e mantém nome e apelido", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const email = `${unico("gold")}@exemplo.pt`;
    const r = await publico(ctx, {
      nome: "João", apelido: "Pires", email, telf: "912345678", curso, regime: "gold", consentimento: true,
      dadosFin: dadosFin({ genero: "inválido" }),
    });
    expect(r.statusCode, r.body).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    expect(await linha(ctx, id)).toMatchObject({ regime: "gold", nome: "João", apelido: "Pires" });
    expect((await pacote(ctx, id)).fin).toBeUndefined();
    const v = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${(await linha(ctx, id)).docs_token}` })).json();
    expect(v.dadosFin).toBeNull();
  });
});

describe("ligação pessoal da financiada: morada, identificação e termos antes dos documentos", () => {
  it("valida cada passo, mascara ao retomar e só abre os documentos depois dos termos", async () => {
    const ctx = await arrancar();
    const { curso } = await cursoFin(ctx);
    const { id, token } = await pedidoFin(ctx, curso);
    const vista = async () => (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();

    expect((await vista()).dadosFin).toMatchObject({ moradaCompleta: false, identificacaoCompleta: false, termos: null, completo: false });
    // Sem os passos, nada de documentos, consentimentos nem conclusão.
    expect((await upload(ctx, token, "cc")).statusCode).toBe(409);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/consentir`, payload: { tipo: "rgpd" } })).statusCode).toBe(409);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(409);

    // Morada.
    let r = await passo(ctx, token, "morada", { ...MORADA, codigoPostal: "4000123", localidade: "" });
    expect(r.statusCode).toBe(400);
    expect(campos(r)).toEqual(expect.arrayContaining(["codigoPostal", "localidade"]));
    expect((await passo(ctx, token, "termos", { termos: true, dados: true })).statusCode).toBe(400);
    r = await passo(ctx, token, "morada", MORADA);
    expect(r.statusCode, r.body).toBe(200);

    // Identificação: cada campo validado.
    const invalidos: [Record<string, string>, string][] = [
      [{ nif: "123456788" }, "nif"],
      [{ niss: "1234" }, "niss"],
      [{ iban: "PT50000201231234567890155" }, "iban"],
      [{ validadeDocumento: diaMais(0, -1) }, "validadeDocumento"],
      [{ numeroDocumento: "1234" }, "numeroDocumento"],
      [{ tipoDocumento: "Carta de condução" }, "tipoDocumento"],
      [{ situacaoEmprego: "" }, "situacaoEmprego"],
      [{ nifEntidadeEmpregadora: "" }, "nifEntidadeEmpregadora"],
      [{ nifEntidadeEmpregadora: "509999998" }, "nifEntidadeEmpregadora"],
    ];
    const antes = await pacote(ctx, id);
    for (const [mudar, campo] of invalidos) {
      r = await passo(ctx, token, "identificacao", { ...IDENT, ...mudar });
      expect(r.statusCode, `${campo}: ${r.body}`).toBe(400);
      expect(campos(r)).toContain(campo);
    }
    expect(await pacote(ctx, id)).toEqual(antes);

    // Independente: o NIF da actividade, em branco, é o próprio.
    r = await passo(ctx, token, "identificacao", { ...IDENT, situacaoEmprego: "Trabalhador(a) independente", nifEntidadeEmpregadora: "" });
    expect(r.statusCode, r.body).toBe(200);
    expect((await pacote(ctx, id)).fin?.nifEntidadeEmpregadora).toBe(NIF);
    r = await passo(ctx, token, "identificacao", IDENT);
    expect(r.statusCode, r.body).toBe(200);
    const p = await pacote(ctx, id);
    expect(p.nif).toBe(NIF);
    expect(p.codigoPostal).toBe("4000-123");
    expect(p.moradaFiscal).toBe(MORADA.morada);
    expect(p.fin).toMatchObject({
      localidade: "Porto", tipoDocumento: "Cartão de Cidadão", numeroDocumento: "123456780ZZ0", niss: NISS, iban: IBAN,
      situacaoEmprego: "Trabalhador(a) por conta de outrem", situacaoEmpregoEntrada: "5 - Empregados", nifEntidadeEmpregadora: NIF_EMPRESA,
      genero: "2 - Mulheres",
    });
    const l = await linha(ctx, id);
    expect(l.concelho).toBe("Porto");
    for (const v of [NIF, NISS, IBAN, "123456780ZZ0"]) expect(JSON.stringify(l)).not.toContain(v);

    // Ao retomar: sensíveis mascarados; em branco mantêm-se.
    const d = (await vista()).dadosFin;
    expect(d.identificacao.mascarados).toMatchObject({ nif: "•••• 6789", iban: "•••• 0154", niss: "•••• 8901" });
    expect(JSON.stringify(d)).not.toContain(NISS);
    expect(d.identificacao.guardados).toEqual(expect.arrayContaining(["numeroDocumento", "nif", "niss", "iban", "nifEntidadeEmpregadora"]));
    r = await passo(ctx, token, "identificacao", { ...IDENT, numeroDocumento: "", nif: "", niss: "", iban: "", nifEntidadeEmpregadora: "" });
    expect(r.statusCode, r.body).toBe(200);
    expect((await pacote(ctx, id)).fin?.iban).toBe(IBAN);

    // Termos: os dois obrigatórios.
    r = await passo(ctx, token, "termos", { termos: true, dados: false });
    expect(r.statusCode).toBe(400);
    expect(campos(r)).toContain("dados");
    expect((await passo(ctx, token, "termos", { termos: false, dados: true })).statusCode).toBe(400);
    expect((await upload(ctx, token, "cc")).statusCode).toBe(409);
    r = await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/dados/termos`, payload: { termos: true, dados: true }, remoteAddress: "10.1.2.3" });
    expect(r.statusCode, r.body).toBe(200);
    const t = await linha(ctx, id);
    expect(t.termos_fin_em).toBeTruthy();
    expect(t.termos_fin_ip).toBe("10.1.2.3");
    expect(t.termos_fin_versao).toBe(TERMOS_FIN_VERSAO);
    expect((await vista()).dadosFin.completo).toBe(true);

    // Agora sim: documentos e conclusão.
    expect((await upload(ctx, token, "cc")).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(200);

    // Nem o histórico nem a auditoria levam os valores.
    const ev = await ctx.db.query<{ detalhe: string; titulo: string }>("SELECT titulo, detalhe FROM lead_eventos WHERE lead_id = $1", [id]);
    for (const e of ev.rows) for (const v of [NIF, NISS, IBAN, NIB, "123456780ZZ0", NIF_EMPRESA]) expect(`${e.titulo} ${e.detalhe}`).not.toContain(v);
  });
});

describe("validação: os dados passam para a ficha do formando", () => {
  it("cria a ficha com os dados para o financiamento, o IBAN dos apoios e o dossiê mascarado", async () => {
    const ctx = await arrancar();
    const { curso, turmaId } = await cursoFin(ctx);
    const { id, token, email } = await pedidoFin(ctx, curso);
    expect((await passo(ctx, token, "morada", MORADA)).statusCode).toBe(200);
    expect((await passo(ctx, token, "identificacao", IDENT)).statusCode).toBe(200);
    expect((await passo(ctx, token, "termos", { termos: true, dados: true })).statusCode).toBe(200);

    // Dossiê da secretaria: sensíveis mascarados.
    const dossie = await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}`);
    expect(dossie.statusCode).toBe(200);
    const df = dossie.json().dadosFin;
    expect(df).toMatchObject({
      genero: "Feminino", nacionalidade: "Portugal", habilitacoes: "12.º Ano", tipoDocumento: "Cartão de Cidadão",
      numeroDocumento: "•••• 0ZZ0", niss: "•••• 8901", iban: "•••• 0154", nif: NIF,
      situacaoEmprego: "Trabalhador(a) por conta de outrem", nifEntidadeEmpregadora: "•••• 9999",
    });
    expect(df.termosAceitesEm).toBeTruthy();
    expect(JSON.stringify(df)).not.toContain(IBAN);
    const comercial = await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${id}`);
    if (comercial.statusCode === 200) expect(comercial.json().dadosFin ?? null).toBeNull();

    for (const tipo of ["cc", "ch", "cu", "morada", "ci", "ce", "contrato", "rgpd"]) {
      await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, $2, $3, 'validado')", [id, tipo, `${tipo}.pdf`]);
    }
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(200);
    const ok = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/validar-preinscricao`, { turmaId });
    expect(ok.statusCode, ok.body).toBe(200);

    const ficha = await ctx.db.query<{ id: number }>("SELECT id FROM formandos_fin WHERE lower(email) = $1", [email]);
    const formandoId = Number(ficha.rows[0]!.id);
    const fin = await pedido(ctx, "secretaria", "GET", `/v1/formandos-fin/${formandoId}/financiamento`);
    expect(fin.statusCode, fin.body).toBe(200);
    expect(fin.json().dados).toMatchObject({
      nif: NIF, niss: NISS, dataNascimento: "1990-05-17", codigoPostal: "4000-123",
      tipoDocumento: "Cartão de Cidadão", numeroDocumento: "123456780ZZ0", validadeDocumento: IDENT.validadeDocumento,
      genero: "2 - Mulheres", nacionalidade: "191 - Portugal",
      habilitacoesEntrada: "3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior",
      situacaoEmpregoEntrada: "5 - Empregados", nifEntidadeEmpregadora: NIF_EMPRESA,
    });
    // Cifrados na ficha (nada em claro nas colunas).
    const linhaFicha = await ctx.db.query<Record<string, unknown>>("SELECT * FROM formandos_fin WHERE id = $1", [formandoId]);
    for (const v of [NIF, NISS]) expect(JSON.stringify(linhaFicha.rows[0])).not.toContain(v);

    // IBAN nos apoios, cifrado.
    const banco = await ctx.db.query<{ iban_enc: string; titular: string }>("SELECT iban_enc, titular FROM formando_apoio_dados WHERE formando_id = $1", [formandoId]);
    expect(banco.rows[0]?.iban_enc).toBeTruthy();
    expect(banco.rows[0]!.iban_enc).not.toContain(IBAN);
    const { ibanDe } = await import("../src/apoios.js");
    expect(ibanDe(banco.rows[0]!.iban_enc)).toBe(IBAN);
    expect(banco.rows[0]!.titular).toBe("Maria da Silva Santos");
  });

  it("não substitui o que a ficha já tem", async () => {
    const ctx = await arrancar();
    const { levarDadosPessoaisParaFicha } = await import("../src/finPipeline.js");
    const { curso, turmaId } = await cursoFin(ctx);
    const { id, token, email } = await pedidoFin(ctx, curso);
    expect((await passo(ctx, token, "morada", MORADA)).statusCode).toBe(200);
    expect((await passo(ctx, token, "identificacao", IDENT)).statusCode).toBe(200);
    // Ficha já criada pela secretaria com género e NISS próprios.
    const nova = await pedido(ctx, "secretaria", "POST", "/v1/formandos-fin", {
      nome: "Maria", apelido: "Santos", email, curso, turmaId, estado: "Elegível",
    });
    let formandoId = 0;
    if (nova.statusCode === 200) {
      formandoId = Number(nova.json().formando?.id ?? 0);
    }
    if (!formandoId) {
      const f = await ctx.db.query<{ id: number }>("SELECT id FROM formandos_fin WHERE lower(email) = $1", [email]);
      formandoId = Number(f.rows[0]?.id ?? 0);
    }
    expect(formandoId, nova.body).toBeGreaterThan(0);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-fin/${formandoId}/financiamento`, { genero: "1 - Homens", niss: "99999999999" })).statusCode).toBe(200);
    const levados = await levarDadosPessoaisParaFicha(ctx.db, await linha(ctx, id), formandoId);
    expect(levados).not.toContain("genero");
    expect(levados).not.toContain("niss");
    expect(levados).toContain("nif");
    const dados = (await pedido(ctx, "secretaria", "GET", `/v1/formandos-fin/${formandoId}/financiamento`)).json().dados;
    expect(dados).toMatchObject({ genero: "1 - Homens", niss: "99999999999", nif: NIF });
  });
});

describe("backoffice: género, nascimento, nacionalidade e habilitações postos à mão", () => {
  it("a equipa da Financiada completa e corrige; mesmas regras do site; o comercial não", async () => {
    const ctx = await arrancar();
    const { curso } = await cursoFin(ctx);
    const email = `${unico("semdados")}@exemplo.pt`;
    const r = await publico(ctx, { nome: "Rui", apelido: "Sem Dados", email, telf: "912345678", curso, regime: "fin", consentimento: true });
    expect(r.statusCode, r.body).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    const url = `/v1/crm/leads/${id}/dados-fin`;

    const vazio = await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}`);
    expect(vazio.json().dadosFin.perfil).toEqual({ genero: "", dataNascimento: "", nacionalidade: "", habilitacoes: "" });

    expect((await pedido(ctx, "comercial", "POST", url, { genero: "1 - Homens" })).statusCode).toBe(403);
    const mau = await pedido(ctx, "secretaria", "POST", url, { dataNascimento: "2030-01-01", habilitacoes: "Doutoramento falso" });
    expect(mau.statusCode).toBe(400);
    expect(Object.keys(mau.json().campos).sort()).toEqual(["dataNascimento", "habilitacoes"]);

    const ok = await pedido(ctx, "financiada", "POST", url, { genero: "1 - Homens", dataNascimento: "1985-03-02", nacionalidade: "191 - Portugal", habilitacoes: "12.º Ano" });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().dadosFin.perfil).toEqual({ genero: "1 - Homens", dataNascimento: "1985-03-02", nacionalidade: "191 - Portugal", habilitacoes: "12.º Ano" });
    expect(ok.json().dadosFin.genero).toBe("Masculino");

    // Só os campos enviados mudam; vazio apaga.
    const parcial = await pedido(ctx, "secretaria", "POST", url, { habilitacoes: "9.º Ano", genero: "" });
    expect(parcial.json().dadosFin.perfil).toEqual({ genero: "", dataNascimento: "1985-03-02", nacionalidade: "191 - Portugal", habilitacoes: "9.º Ano" });
    // Nunca em claro na base de dados.
    expect(JSON.stringify(await linha(ctx, id))).not.toContain("1985-03-02");
  });
});
