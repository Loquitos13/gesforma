/**
 * Documentos da turma da Financiada, no modelo da candidatura: a ficha de inscrição (uma página por formando),
 * o plano de sessão (uma página por sessão lectiva, na horizontal) e a folha de presenças / sumário (uma folha por sessão
 * lectiva, com o sumário dessa sessão). Todos levam no topo o logótipo da entidade (Configurações › Entidade; sem
 * logótipo, o da ENA) e no rodapé os logótipos do financiamento (modelos/rodape-financiamento.png).
 *
 * O enquadramento do programa (programa, prioridade e tipologias) vem de Configurações › Financiada (candidaturaFin.ts);
 * os dados pessoais, da ficha › Dados para o financiamento e da pré-inscrição (os mesmos da execução física).
 * A Gold continua com os PDF de texto de dtpPdfs.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { CandidaturaFin } from "../../src/partilhado/candidaturaFin.js";
import { GENEROS_FIN, HABILITACOES_FIN, PAIS_PORTUGAL_FIN, SITUACOES_EMPREGO_FIN, rotuloPais } from "../../src/partilhado/dadosPessoaisFin.js";
import { rotuloCodigoCurso } from "../../src/partilhado/codigoCurso.js";
import { estadoDaMarca, type MarcaPresenca } from "./assiduidade.js";
import type { Db } from "./db/pool.js";
import { obterLogoEntidade } from "./entidadeLogo.js";
import { dadosFinanciamento, piiDaInscricao } from "./execucaoFisica.js";
import { readFormandoPii } from "./pii.js";
import { lerCandidatura, lerEntidade } from "./regrasConfig.js";
import { listarSessoes } from "./repos/pedagogiaSessoes.js";
import { formandosExecucao, turmaReembolso, type FormandoExecucao, type TurmaReembolso } from "./repos/reembolso.js";
import { sessaoLectivaN } from "./sessaoAcesso.js";

// ── Dados ────────────────────────────────────────────────────────────────────

export type Imagem = { bytes: Buffer; mime: string };

/** O que vai no cabeçalho de todos os documentos da turma. */
export type CabecalhoFin = {
  entidade: string;
  candidatura: CandidaturaFin;
  /** Código da UFCD («8600») e designação. */
  ufcdCodigo: string;
  ufcdNome: string;
  /** «UFCD 8600 - Competências … (Ação 2)». */
  acao: string;
  local: string;
  logo: Imagem | null;
};

export type FichaInscricaoFin = {
  formandoId: number;
  nome: string;
  genero: string;
  dataNascimento: string;
  documentoRotulo: string;
  documento: string;
  validade: string;
  nif: string;
  niss: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  concelho: string;
  email: string;
  telefone: string;
  nacionalidade: string;
  habilitacoes: string;
  situacaoEmprego: string;
  nifEntidadeEmpregadora: string;
};

export type MomentoPlano = { conteudo?: string; atividades?: string; metodos?: string; avaliacao?: string; recursos?: string; materiais?: string; tempo?: string };
export type PlanoPdf = { objetivosGerais?: string; objetivosEspecificos?: string; momentos?: Partial<Record<"introducao" | "desenvolvimento" | "conclusao", MomentoPlano>> };

export type SessaoDocFin = {
  n: number;
  /** AAAA-MM-DD. */
  data: string;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
  plano: PlanoPdf | null;
  sumario: { conteudos?: string; atividades?: string; observacoes?: string } | null;
  /** Uma linha por formando, pela ordem da turma; `presenca` em branco quando ainda não foi marcada. */
  presencas: { nome: string; presenca: string }[];
};

const MOMENTOS = [
  { id: "introducao", rotulo: "Introdução" },
  { id: "desenvolvimento", rotulo: "Desenvolvimento" },
  { id: "conclusao", rotulo: "Conclusão" },
] as const;

function txt(v: unknown) {
  return String(v ?? "").replace(/\r/g, "").trim();
}

function obj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return p && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}

function arr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

/** AAAA-MM-DD → DD-MM-AAAA (o resto fica como está). */
function dataDma(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

const semCodigo = (v: string) => v.replace(/^\s*\d+\s*-\s*/, "").trim();

/** «2 - Mulheres» → «Feminino». */
export function rotuloGenero(v: string) {
  return GENEROS_FIN.find(g => g.valor === v)?.rotulo ?? semCodigo(v);
}

/** «191 - Portugal» → «Portuguesa»; os outros países ficam pelo nome («Brasil»). */
export function rotuloNacionalidade(v: string) {
  if (!v.trim()) return "";
  return v === PAIS_PORTUGAL_FIN ? "Portuguesa" : rotuloPais(v);
}

/** O rótulo que a pessoa escolheu («12.º Ano»), se ainda corresponde ao valor da ficha; senão, o do template. */
export function rotuloHabilitacoes(valor: string, escolhido = "") {
  const opcao = HABILITACOES_FIN.find(h => h.rotulo === escolhido);
  if (opcao && (!valor || opcao.valor === valor)) return opcao.rotulo;
  return semCodigo(valor);
}

export function rotuloSituacaoEmprego(valor: string, escolhido = "") {
  const opcao = SITUACOES_EMPREGO_FIN.find(s => s.rotulo === escolhido);
  if (opcao && (!valor || opcao.valor === valor)) return opcao.rotulo;
  return semCodigo(valor);
}

const ROTULO_PRESENCA: Record<ReturnType<typeof estadoDaMarca>, string> = {
  presente: "Presente",
  atraso: "Atraso",
  falta_justificada: "Falta justificada",
  falta_injustificada: "Falta",
};

function rotuloPresenca(m: MarcaPresenca) {
  const estado = estadoDaMarca(m);
  const min = estado === "atraso" && m.minutos ? ` (${m.minutos} min)` : "";
  return `${ROTULO_PRESENCA[estado]}${min}`;
}

/** Código e designação da UFCD (do curso; na falta, da turma). */
function ufcdDaTurma(t: TurmaReembolso) {
  const codigo = (t.c_ufcd_cod || t.ufcd_cod || "").trim().replace(/\s+/g, " ");
  const nome = (t.c_ufcd || t.curso || "").trim();
  return { codigo, nome };
}

/** «UFCD 8600 - Competências … (Ação 2)», como na folha de presenças do modelo. */
export function acaoDaTurma(t: TurmaReembolso) {
  const { codigo, nome } = ufcdDaTurma(t);
  const base = [rotuloCodigoCurso(codigo), nome].filter(Boolean).join(" - ");
  return `${base}${base ? " " : ""}(Ação ${Math.max(1, Number(t.numero_acao) || 1)})`;
}

const LOGO_PREDEFINIDO = fileURLToPath(new URL("./assinaturas/fontes/logo-predefinido.png", import.meta.url));
const RODAPE = fileURLToPath(new URL("./modelos/rodape-financiamento.png", import.meta.url));
const FONTES = fileURLToPath(new URL("./assinaturas/fontes/", import.meta.url));

const cacheFicheiros = new Map<string, Buffer | null>();
function ficheiro(caminho: string) {
  if (!cacheFicheiros.has(caminho)) {
    try { cacheFicheiros.set(caminho, readFileSync(caminho)); } catch { cacheFicheiros.set(caminho, null); }
  }
  return cacheFicheiros.get(caminho) ?? null;
}

/** Logótipo de Configurações › Entidade; sem ele, o logótipo ENA do site (o mesmo dos contratos). */
async function logoDosDocumentos(db: Db): Promise<Imagem | null> {
  const logo = await obterLogoEntidade(db).catch(() => null);
  if (logo) return logo;
  const predefinido = ficheiro(LOGO_PREDEFINIDO);
  return predefinido ? { bytes: predefinido, mime: "image/png" } : null;
}

export async function cabecalhoFin(db: Db, turma: TurmaReembolso): Promise<CabecalhoFin> {
  const [entidade, candidatura, logo] = await Promise.all([lerEntidade(db), lerCandidatura(db, turma.programa || turma.curso_programa), logoDosDocumentos(db)]);
  const ufcd = ufcdDaTurma(turma);
  return {
    entidade: entidade.nome,
    candidatura,
    ufcdCodigo: ufcd.codigo,
    ufcdNome: ufcd.nome,
    acao: acaoDaTurma(turma),
    local: turma.local ?? "",
    logo,
  };
}

/** Formandos da turma que contam (os indeferidos ficam de fora, como na execução física). */
async function formandosDaTurma(db: Db, turma: TurmaReembolso) {
  return (await formandosExecucao(db, turma)).filter(f => !/^indeferid/i.test(f.estado.trim()));
}

function fichaDoFormando(f: FormandoExecucao): FichaInscricaoFin {
  const d = dadosFinanciamento(f);
  const pii = readFormandoPii({ pii_enc: f.pii_enc, telf: f.telf });
  const pre = piiDaInscricao(f);
  const fin = pre.fin ?? {};
  const ident = pii.ident ?? {};
  const tipo = txt(ident.tipoDocumento || fin.tipoDocumento);
  const numero = txt(ident.numeroDocumento || fin.numeroDocumento) || (tipo === "Passaporte" ? txt(d.passaporte) : "");
  const cp = /(\d{4})\s*-?\s*(\d{3})/.exec(d.codigoPostal || pre.codigoPostal || "");
  return {
    formandoId: f.id,
    nome: `${f.nome} ${f.apelido}`.replace(/\s+/g, " ").trim(),
    genero: rotuloGenero(d.genero || txt(fin.genero)),
    dataNascimento: txt(d.dataNascimento || fin.dataNascimento),
    documentoRotulo: !tipo || tipo === "Cartão de Cidadão" ? "Cartão Cidadão" : tipo,
    documento: numero,
    validade: dataDma(txt(ident.validadeDocumento || fin.validadeDocumento)),
    nif: d.nif.replace(/\D/g, "").length === 9 ? d.nif.replace(/\D/g, "") : "",
    niss: d.niss.replace(/\D/g, ""),
    morada: txt(pre.moradaFiscal || f.p_morada),
    codigoPostal: cp ? `${cp[1]}-${cp[2]}` : "",
    localidade: txt(fin.localidade),
    concelho: txt(f.p_concelho),
    email: txt(f.email),
    telefone: txt(pii.telf || f.telf || pre.telf),
    nacionalidade: rotuloNacionalidade(d.nacionalidade || txt(fin.nacionalidade)),
    habilitacoes: rotuloHabilitacoes(d.habilitacoesEntrada || txt(fin.habilitacoesEntrada), txt(fin.habilitacoes)),
    situacaoEmprego: rotuloSituacaoEmprego(d.situacaoEmpregoEntrada || txt(fin.situacaoEmpregoEntrada), txt(fin.situacaoEmprego)),
    nifEntidadeEmpregadora: (d.nifEntidadeEmpregadora || txt(fin.nifEntidadeEmpregadora)).replace(/\D/g, ""),
  };
}

type SessaoCronograma = { id?: string; data?: string; horaInicio?: string; horaFim?: string; modulos?: string[]; formadores?: string[]; formador?: string };

/** As sessões lectivas (presencial e síncrona) da turma, com plano, sumário e presenças. */
async function sessoesDaTurma(db: Db, turma: TurmaReembolso, formandos: FormandoExecucao[]): Promise<SessaoDocFin[]> {
  const linhas = await listarSessoes(db, "fin", turma.id);
  const porN = new Map(linhas.map(l => [Number(l.sessao_n), l]));
  const out: SessaoDocFin[] = [];
  for (let n = 1; n <= 2000; n++) {
    const s = sessaoLectivaN(turma.cronograma, n) as SessaoCronograma | null;
    if (!s) break;
    const linha = porN.get(n);
    const marcas = arr(linha?.presencas).filter((m): m is MarcaPresenca => Boolean(m) && typeof m === "object");
    const usadas = new Set<MarcaPresenca>();
    const presencas = formandos.flatMap(f => {
      const nome = `${f.nome} ${f.apelido}`.replace(/\s+/g, " ").trim();
      const baixo = nome.toLowerCase();
      const m = marcas.find(x => Number(x.id) === f.id)
        ?? marcas.find(x => !Number.isFinite(Number(x.id)) && txt(x.nome).toLowerCase() === baixo);
      if (m) usadas.add(m);
      // Quem desistiu só aparece nas sessões em que tem marcação.
      if (!m && /^desist/i.test(f.estado.trim())) return [];
      return [{ nome, presenca: m ? rotuloPresenca(m) : "" }];
    });
    // Marcações de quem já não está na turma (mudou de turma depois da sessão): ficam na folha dessa sessão.
    for (const m of marcas) if (!usadas.has(m) && txt(m.nome)) presencas.push({ nome: txt(m.nome), presenca: rotuloPresenca(m) });
    const plano = obj(linha?.plano);
    const sumario = obj(linha?.sumario);
    const formadores = (Array.isArray(s.formadores) && s.formadores.length ? s.formadores : [s.formador ?? ""]).map(txt).filter(Boolean);
    out.push({
      n,
      data: txt(s.data).slice(0, 10),
      horaInicio: txt(s.horaInicio),
      horaFim: txt(s.horaFim),
      modulos: (Array.isArray(s.modulos) ? s.modulos : []).map(txt).filter(Boolean),
      formadores,
      plano: Object.keys(plano).length ? plano as PlanoPdf : null,
      sumario: Object.keys(sumario).length ? sumario as SessaoDocFin["sumario"] : null,
      presencas,
    });
  }
  return out;
}

// ── Desenho ──────────────────────────────────────────────────────────────────

const RETRATO: [number, number] = [595.28, 841.89];
const PAISAGEM: [number, number] = [841.89, 595.28];
const TINTA = rgb(0.13, 0.13, 0.15);
const SUAVE = rgb(0.42, 0.44, 0.48);
const BORDA = rgb(0.2, 0.2, 0.22);
const CLARA = rgb(0.86, 0.87, 0.89);

type Doc = { pdf: PDFDocument; sans: PDFFont; negrito: PDFFont; logo: PDFImage | null; rodape: PDFImage | null; entidade: string };
type Pg = { page: PDFPage; y: number; m: number; w: number; largura: number; fundo: number };

async function abrirDoc(titulo: string, cab: Pick<CabecalhoFin, "entidade" | "logo">): Promise<Doc> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setAuthor(cab.entidade);
  pdf.setProducer("GesForma");
  pdf.setCreator("GesForma");
  pdf.registerFontkit(fontkit);
  const fonte = (nome: string) => {
    const b = ficheiro(FONTES + nome);
    if (!b) throw new Error(`Fonte em falta: ${nome}`);
    return pdf.embedFont(b, { subset: true });
  };
  const [sans, negrito] = await Promise.all([fonte("PublicSans-Regular.ttf"), fonte("PublicSans-Bold.ttf")]);
  const imagem = async (img: Imagem | null) => {
    if (!img?.bytes.length) return null;
    try {
      return img.mime === "image/jpeg" ? await pdf.embedJpg(img.bytes) : await pdf.embedPng(img.bytes);
    } catch {
      return null;
    }
  };
  const rodapeBytes = ficheiro(RODAPE);
  const [logo, rodape] = await Promise.all([imagem(cab.logo), imagem(rodapeBytes ? { bytes: rodapeBytes, mime: "image/png" } : null)]);
  return { pdf, sans, negrito, logo, rodape, entidade: cab.entidade };
}

async function fecharDoc(d: Doc) {
  return Buffer.from(await d.pdf.save({ useObjectStreams: false }));
}

/** Tira o que a fonte não desenha bem (controlo, tabulações) sem perder as quebras de linha. */
function limpo(t: string) {
  return t.replace(/\r/g, "").replace(/\t/g, " ").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");
}

/** Linhas de até `larg` pontos, pelas palavras (uma palavra maior que a largura parte-se). */
function quebrar(texto: string, f: PDFFont, tam: number, larg: number): string[] {
  const out: string[] = [];
  for (const paragrafo of limpo(texto).split("\n")) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    if (!palavras.length) { out.push(""); continue; }
    let atual = "";
    for (let p of palavras) {
      while (f.widthOfTextAtSize(p, tam) > larg && p.length > 1) {
        let corte = p.length - 1;
        while (corte > 1 && f.widthOfTextAtSize(p.slice(0, corte), tam) > larg) corte--;
        if (atual) { out.push(atual); atual = ""; }
        out.push(p.slice(0, corte));
        p = p.slice(corte);
      }
      const seguinte = atual ? `${atual} ${p}` : p;
      if (atual && f.widthOfTextAtSize(seguinte, tam) > larg) {
        out.push(atual);
        atual = p;
      } else {
        atual = seguinte;
      }
    }
    if (atual) out.push(atual);
  }
  while (out.length > 1 && !out[out.length - 1]) out.pop();
  return out;
}

function escrever(pg: Pg, t: string, x: number, y: number, f: PDFFont, tam: number, cor = TINTA) {
  const s = limpo(t).replace(/\n/g, " ");
  if (s) pg.page.drawText(s, { x, y, size: tam, font: f, color: cor });
}

function caixa(pg: Pg, x: number, y: number, w: number, h: number, espessura = 0.6) {
  pg.page.drawRectangle({ x, y, width: w, height: h, borderColor: BORDA, borderWidth: espessura });
}

/** Página nova: logótipo à esquerda e título à direita no topo; logótipos do financiamento no rodapé. */
function novaPagina(d: Doc, tamanho: [number, number], titulo: string, subtitulo = ""): Pg {
  const page = d.pdf.addPage(tamanho);
  const [w, h] = tamanho;
  const retrato = h > w;
  const m = retrato ? 36 : 28;
  const topo = h - (retrato ? 30 : 24);
  const pg: Pg = { page, y: topo, m, w, largura: w - 2 * m, fundo: 24 };
  let alturaLogo = 0;
  if (d.logo) {
    const escala = Math.min(100 / d.logo.width, 30 / d.logo.height);
    alturaLogo = d.logo.height * escala;
    page.drawImage(d.logo, { x: m, y: topo - alturaLogo, width: d.logo.width * escala, height: alturaLogo });
  } else {
    escrever(pg, d.entidade, m, topo - 14, d.negrito, 11);
    alturaLogo = 16;
  }
  const tamTitulo = 16;
  const larguraTitulo = d.negrito.widthOfTextAtSize(titulo, tamTitulo);
  escrever(pg, titulo, w - m - larguraTitulo, topo - 20, d.negrito, tamTitulo);
  if (subtitulo) {
    const larguraSub = d.sans.widthOfTextAtSize(subtitulo, 8.5);
    escrever(pg, subtitulo, w - m - larguraSub, topo - 34, d.sans, 8.5, SUAVE);
  }
  const base = topo - Math.max(alturaLogo, subtitulo ? 38 : 26) - 8;
  page.drawLine({ start: { x: m, y: base }, end: { x: w - m, y: base }, thickness: 0.6, color: CLARA });
  pg.y = base - 12;
  if (d.rodape) {
    const larg = Math.min(retrato ? 330 : 300, w - 2 * m);
    const alt = larg * d.rodape.height / d.rodape.width;
    page.drawImage(d.rodape, { x: (w - larg) / 2, y: 12, width: larg, height: alt });
    pg.fundo = 12 + alt + 10;
  }
  return pg;
}

const TAM = 9;
const ENTRELINHA = 11;

/** Linha «rótulo | valor» de uma tabela de duas colunas. */
function linhaPar(d: Doc, pg: Pg, rotulo: string, valor: string, colRotulo: number, minAlt = 17) {
  const larguraValor = pg.largura - colRotulo - 10;
  const linhas = quebrar(valor, d.sans, TAM, larguraValor);
  const rotulos = quebrar(rotulo, d.negrito, TAM, colRotulo - 10);
  const alt = Math.max(minAlt, Math.max(linhas.length, rotulos.length) * ENTRELINHA + 6);
  const y0 = pg.y - alt;
  caixa(pg, pg.m, y0, colRotulo, alt);
  caixa(pg, pg.m + colRotulo, y0, pg.largura - colRotulo, alt);
  const topoTexto = pg.y - (alt - Math.max(linhas.length, rotulos.length) * ENTRELINHA) / 2 - TAM + 1;
  rotulos.forEach((l, i) => escrever(pg, l, pg.m + 5, topoTexto - i * ENTRELINHA, d.negrito, TAM));
  linhas.forEach((l, i) => escrever(pg, l, pg.m + colRotulo + 5, topoTexto - i * ENTRELINHA, d.sans, TAM));
  pg.y = y0;
}

/** Célula com «Rótulo: valor» (ou uma caixa de preencher à mão, sem valor). */
function celulaRotulo(d: Doc, pg: Pg, x: number, w: number, alt: number, rotulo: string, valor: string | null) {
  const y0 = pg.y - alt;
  caixa(pg, x, y0, w, alt);
  const base = y0 + (alt - TAM) / 2 + 1.5;
  escrever(pg, rotulo, x + 5, base, d.negrito, TAM);
  const xValor = x + 8 + d.negrito.widthOfTextAtSize(rotulo, TAM);
  if (valor == null) {
    // Caixa em branco (horas T / P): preenche-se à mão.
    caixa(pg, xValor, y0 + 3, x + w - 6 - xValor, alt - 6, 0.5);
  } else {
    const [primeira = ""] = quebrar(valor, d.sans, TAM, x + w - 4 - xValor);
    escrever(pg, primeira, xValor, base, d.sans, TAM);
  }
}

/** «o Formador: ________». */
function linhaAssinatura(d: Doc, pg: Pg, rotulo: string, comprimento = 150) {
  escrever(pg, rotulo, pg.m, pg.y - TAM, d.sans, TAM);
  const x = pg.m + d.sans.widthOfTextAtSize(rotulo, TAM) + 4;
  pg.page.drawLine({ start: { x, y: pg.y - TAM - 1 }, end: { x: x + comprimento, y: pg.y - TAM - 1 }, thickness: 0.5, color: BORDA });
  pg.y -= TAM + 14;
}

// ── Ficha de inscrição ───────────────────────────────────────────────────────

/** As linhas da tabela da ficha, pela ordem do modelo. */
export function linhasFichaInscricao(cab: CabecalhoFin, f: FichaInscricaoFin): [string, string][] {
  const cand = cab.candidatura;
  return [
    ["Entidade:", cab.entidade],
    ["Programa:", cand.programa],
    ["Prioridade do Programa:", cand.prioridade],
    ["Tipologia de Ação:", cand.tipologiaAcao],
    ["Tipologia de Intervenção:", cand.tipologiaIntervencao],
    ["Tipologia de Operação:", cand.tipologiaOperacao],
    ["UFCD:", cab.ufcdCodigo],
    ["Tipologia", cand.tipologia],
    ["Género:", f.genero],
    ["Data Nascimento:", f.dataNascimento],
    [`${f.documentoRotulo}:`, f.documento],
    ["Válido até:", f.validade],
    ["NIF:", f.nif],
    ["NISS:", f.niss],
    ["Morada:", f.morada],
    ["Código Postal:", f.codigoPostal],
    ["Localidade:", f.localidade],
    ["Concelho:", f.concelho],
    ["Email:", f.email],
    ["Telefone:", f.telefone],
    ["Nacionalidade:", f.nacionalidade],
    ["Habilitações:", f.habilitacoes],
    ["Situação Emprego:", f.situacaoEmprego],
    ["Nif Entidade Empregadora:", f.nifEntidadeEmpregadora],
  ];
}

/** Uma página por formando (sem formandos, uma ficha em branco para preencher à mão). */
export async function pdfFichasInscricaoFin(cab: CabecalhoFin, fichas: FichaInscricaoFin[]) {
  const titulo = "FOLHA DE INSCRIÇÃO";
  const d = await abrirDoc(fichas.length === 1 ? `Ficha de inscrição · ${fichas[0]!.nome}` : "Fichas de inscrição", cab);
  const lista = fichas.length ? fichas : [vaziaFicha()];
  for (const f of lista) {
    const pg = novaPagina(d, RETRATO, titulo);
    // Caixa do nome e da assinatura.
    const altCaixa = 50;
    caixa(pg, pg.m, pg.y - altCaixa, pg.largura, altCaixa);
    escrever(pg, "Nome:", pg.m + 8, pg.y - 19, d.negrito, TAM);
    const [nome = ""] = quebrar(f.nome, d.negrito, TAM, pg.largura - 60);
    escrever(pg, nome, pg.m + 12 + d.negrito.widthOfTextAtSize("Nome:", TAM), pg.y - 19, d.negrito, TAM);
    escrever(pg, "Assinatura:", pg.m + 8, pg.y - 38, d.negrito, TAM);
    const xa = pg.m + 12 + d.negrito.widthOfTextAtSize("Assinatura:", TAM);
    pg.page.drawLine({ start: { x: xa, y: pg.y - 39 }, end: { x: xa + 190, y: pg.y - 39 }, thickness: 0.5, color: BORDA });
    pg.y -= altCaixa + 14;
    for (const [rotulo, valor] of linhasFichaInscricao(cab, f)) linhaPar(d, pg, rotulo, valor, 150);
    pg.y -= 22;
    linhaAssinatura(d, pg, "o Coordenador:", 160);
  }
  return fecharDoc(d);
}

function vaziaFicha(): FichaInscricaoFin {
  return {
    formandoId: 0, nome: "", genero: "", dataNascimento: "", documentoRotulo: "Cartão Cidadão", documento: "", validade: "",
    nif: "", niss: "", morada: "", codigoPostal: "", localidade: "", concelho: "", email: "", telefone: "",
    nacionalidade: "", habilitacoes: "", situacaoEmprego: "", nifEntidadeEmpregadora: "",
  };
}

// ── Plano de sessão ──────────────────────────────────────────────────────────

const horario = (s: Pick<SessaoDocFin, "horaInicio" | "horaFim">) => (s.horaInicio || s.horaFim ? `${s.horaInicio || "--:--"} às ${s.horaFim || "--:--"}` : "");

/** As colunas do plano no modelo: Conteúdos | Métodos / Estratégias | Recursos didáticos | Avaliação | Tempo. */
export function colunasMomento(m: MomentoPlano | undefined) {
  const juntar = (...v: (string | undefined)[]) => v.map(txt).filter(Boolean).join("\n");
  return [juntar(m?.conteudo), juntar(m?.metodos, m?.atividades), juntar(m?.recursos, m?.materiais), juntar(m?.avaliacao), juntar(m?.tempo)];
}

/** Uma página por sessão lectiva (sem sessões, um plano em branco). */
export async function pdfPlanosSessaoFin(cab: CabecalhoFin, sessoes: SessaoDocFin[]) {
  const d = await abrirDoc("Planos de sessão", cab);
  const lista: (SessaoDocFin | null)[] = sessoes.length ? sessoes : [null];
  const cabecalhos = ["Momento", "Conteúdos", "Métodos / Estratégias", "Recursos didáticos", "Avaliação", "Tempo"];
  for (const s of lista) {
    const sub = s ? [`Sessão ${s.n}`, s.data, horario(s), s.formadores.join(", ")].filter(Boolean).join(" · ") : "";
    let pg = novaPagina(d, PAISAGEM, "PLANO DE SESSÃO", sub);
    const larguras = (() => {
      const momento = 110;
      const tempo = 60;
      const resto = (pg.largura - momento - tempo) / 4;
      return [momento, resto, resto, resto, resto, tempo];
    })();
    const modulo = s?.modulos.length ? s.modulos.join(" · ") : [cab.ufcdNome].filter(Boolean).join("");
    escrever(pg, "Publico alvo:", pg.m + 6, pg.y - TAM, d.negrito, TAM);
    const xPublico = pg.m + 84;
    const [publico = ""] = quebrar(`Formandos do módulo - ${modulo}`, d.sans, TAM, pg.largura - 90);
    escrever(pg, publico, xPublico, pg.y - TAM, d.sans, TAM);
    pg.y -= 24;
    const objetivos = [s?.plano?.objetivosGerais, s?.plano?.objetivosEspecificos].map(txt).filter(Boolean).join("\n");
    const linhasObj = quebrar(objetivos, d.sans, TAM, pg.largura - xPublico + pg.m - 10);
    const altObj = Math.max(42, linhasObj.length * ENTRELINHA + 10);
    escrever(pg, "Objetivos:", pg.m + 6, pg.y - altObj / 2 - 3, d.negrito, TAM);
    caixa(pg, xPublico, pg.y - altObj, pg.w - pg.m - xPublico, altObj);
    linhasObj.forEach((l, i) => escrever(pg, l, xPublico + 5, pg.y - 5 - TAM - i * ENTRELINHA, d.sans, TAM));
    pg.y -= altObj + 12;

    const desenharCabecalhoTabela = () => {
      let x = pg.m;
      cabecalhos.forEach((c, i) => {
        caixa(pg, x, pg.y - 18, larguras[i]!, 18);
        const lc = d.negrito.widthOfTextAtSize(c, TAM);
        escrever(pg, c, x + (larguras[i]! - lc) / 2, pg.y - 12.5, d.negrito, TAM);
        x += larguras[i]!;
      });
      pg.y -= 18;
    };
    desenharCabecalhoTabela();
    const tamCel = 8.5;
    const entreCel = 10.5;
    for (const mo of MOMENTOS) {
      const colunas = colunasMomento(s?.plano?.momentos?.[mo.id]);
      const quebradas = colunas.map((c, i) => quebrar(c, d.sans, tamCel, larguras[i + 1]! - 8));
      const alt = Math.max(76, Math.max(...quebradas.map(q => q.length)) * entreCel + 10);
      if (pg.y - alt < pg.fundo + 60) {
        pg = novaPagina(d, PAISAGEM, "PLANO DE SESSÃO", sub);
        desenharCabecalhoTabela();
      }
      let x = pg.m;
      caixa(pg, x, pg.y - alt, larguras[0]!, alt);
      const lm = d.sans.widthOfTextAtSize(mo.rotulo, TAM);
      escrever(pg, mo.rotulo, x + (larguras[0]! - lm) / 2, pg.y - alt / 2 - 3, d.sans, TAM);
      x += larguras[0]!;
      quebradas.forEach((linhas, i) => {
        const lw = larguras[i + 1]!;
        caixa(pg, x, pg.y - alt, lw, alt);
        linhas.forEach((l, j) => escrever(pg, l, x + 4, pg.y - 5 - tamCel - j * entreCel, d.sans, tamCel));
        x += lw;
      });
      pg.y -= alt;
    }
    pg.y -= 16;
    if (pg.y - 40 < pg.fundo) pg = novaPagina(d, PAISAGEM, "PLANO DE SESSÃO", sub);
    linhaAssinatura(d, pg, "o Formador:", 150);
    linhaAssinatura(d, pg, "o Coordenador:", 150);
  }
  return fecharDoc(d);
}

// ── Folha de presenças / sumário ─────────────────────────────────────────────

/** O texto do sumário na folha: os conteúdos, as atividades e as observações da sessão. */
export function textoSumario(s: SessaoDocFin["sumario"]) {
  if (!s) return "";
  return [txt(s.conteudos), txt(s.atividades), txt(s.observacoes) ? `Observações: ${txt(s.observacoes)}` : ""].filter(Boolean).join("\n");
}

/** Uma folha por sessão lectiva (sem sessões, uma folha em branco). Uma turma grande continua na página seguinte. */
export async function pdfFolhasPresencaFin(cab: CabecalhoFin, sessoes: SessaoDocFin[]) {
  const titulo = "FOLHA DE PRESENÇAS / SUMÁRIO";
  const d = await abrirDoc("Folhas de presenças e sumários", cab);
  const c = cab.candidatura;
  const lista: (SessaoDocFin | null)[] = sessoes.length ? sessoes : [null];
  for (const s of lista) {
    let pg = novaPagina(d, RETRATO, titulo);
    const pares: [string, string][] = [
      ["Entidade:", cab.entidade],
      ["Programa:", c.programa],
      ["Prioridade do Programa:", c.prioridade],
      ["Tipologia de Ação:", c.tipologiaAcao],
      ["Tipologia de Intervenção:", c.tipologiaIntervencao],
      ["Tipologia de Operação:", c.tipologiaOperacao],
      ["UFCD:", [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" | ")],
      ["Ação:", cab.acao],
    ];
    for (const [r, v] of pares) linhaPar(d, pg, r, v, 130, 19);
    const terco = pg.largura / 3;
    celulaRotulo(d, pg, pg.m, terco, 18, "Sala:", "");
    celulaRotulo(d, pg, pg.m + terco, terco, 18, "Local:", cab.local);
    celulaRotulo(d, pg, pg.m + 2 * terco, terco, 18, "Data:", s?.data ?? "");
    pg.y -= 18;
    celulaRotulo(d, pg, pg.m, terco, 22, "Horário:", s ? horario(s) : "");
    // Horas teóricas (T) e práticas (P): a plataforma não as distingue; preenchem-se à mão.
    celulaRotulo(d, pg, pg.m + terco, terco, 22, "T:", null);
    celulaRotulo(d, pg, pg.m + 2 * terco, terco, 22, "P:", null);
    pg.y -= 22 + 12;

    const colNome = pg.largura / 2;
    const cabecalhoLista = () => {
      for (const [x, w, t] of [[pg.m, colNome, "Nome:"], [pg.m + colNome, pg.largura - colNome, "Presenças:"]] as const) {
        caixa(pg, x, pg.y - 16, w, 16);
        const lt = d.negrito.widthOfTextAtSize(t, TAM);
        escrever(pg, t, x + (w - lt) / 2, pg.y - 11.5, d.negrito, TAM);
      }
      pg.y -= 16;
    };
    cabecalhoLista();
    const linhas = s?.presencas.length ? s.presencas : Array.from({ length: 12 }, () => ({ nome: "", presenca: "" }));
    for (const p of linhas) {
      if (pg.y - 15 < pg.fundo + 10) {
        pg = novaPagina(d, RETRATO, titulo, s ? `Sessão ${s.n} · ${s.data} (continuação)` : "");
        cabecalhoLista();
      }
      caixa(pg, pg.m, pg.y - 15, colNome, 15, 0.4);
      caixa(pg, pg.m + colNome, pg.y - 15, pg.largura - colNome, 15, 0.4);
      const [nome = ""] = quebrar(p.nome, d.sans, TAM, colNome - 10);
      escrever(pg, nome, pg.m + 5, pg.y - 11, d.sans, TAM);
      escrever(pg, p.presenca, pg.m + colNome + 5, pg.y - 11, d.sans, TAM);
      pg.y -= 15;
    }
    pg.y -= 12;

    // O sumário da sessão (o modelo junta a folha de presenças e o sumário numa só folha).
    const linhasSumario = quebrar(textoSumario(s?.sumario ?? null), d.sans, TAM, pg.largura - 12);
    const altSumario = Math.max(56, linhasSumario.length * ENTRELINHA + 10);
    if (pg.y - altSumario - 16 < pg.fundo) pg = novaPagina(d, RETRATO, titulo, s ? `Sessão ${s.n} · ${s.data} (continuação)` : "");
    escrever(pg, "Sumário:", pg.m, pg.y - TAM, d.negrito, TAM);
    pg.y -= TAM + 5;
    caixa(pg, pg.m, pg.y - altSumario, pg.largura, altSumario);
    linhasSumario.forEach((l, i) => escrever(pg, l, pg.m + 6, pg.y - 5 - TAM - i * ENTRELINHA, d.sans, TAM));
    pg.y -= altSumario + 18;
    if (pg.y - 40 < pg.fundo) pg = novaPagina(d, RETRATO, titulo, s ? `Sessão ${s.n} · ${s.data} (continuação)` : "");
    linhaAssinatura(d, pg, "o Formador:", 160);
    linhaAssinatura(d, pg, "o Coordenador:", 160);
  }
  return fecharDoc(d);
}

// ── Por turma ────────────────────────────────────────────────────────────────

export const NOMES_DOCUMENTOS_FIN = {
  fichas: "FichasInscricao.pdf",
  planos: "Planos de sessao.pdf",
  folhas: "Folhas de presenca e sumarios.pdf",
} as const;

function nomeFicheiro(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "formando";
}

/** Fichas de inscrição da turma (todas, ou só a do formando indicado). Null se a turma não existe. */
export async function fichasInscricaoDaTurma(db: Db, turmaId: number, formandoId?: number) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const formandos = (await formandosDaTurma(db, turma)).filter(f => formandoId == null || f.id === formandoId);
  if (formandoId != null && !formandos.length) return null;
  const cab = await cabecalhoFin(db, turma);
  const fichas = formandos.map(fichaDoFormando);
  const nome = formandoId != null ? `FichaInscricao - ${nomeFicheiro(fichas[0]!.nome)}.pdf` : NOMES_DOCUMENTOS_FIN.fichas;
  return { nome, bytes: await pdfFichasInscricaoFin(cab, fichas) };
}

/** Planos de sessão e folhas de presenças / sumários da turma (todas as sessões lectivas, ou só a sessão n). */
export async function documentosSessoesDaTurma(db: Db, turmaId: number, opts: { n?: number; so?: "planos" | "folhas" } = {}) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const formandos = await formandosDaTurma(db, turma);
  const [cab, todas] = await Promise.all([cabecalhoFin(db, turma), sessoesDaTurma(db, turma, formandos)]);
  const sessoes = opts.n == null ? todas : todas.filter(s => s.n === opts.n);
  if (opts.n != null && !sessoes.length) return null;
  const vazio = Buffer.alloc(0);
  const [planos, folhas] = await Promise.all([
    opts.so === "folhas" ? vazio : pdfPlanosSessaoFin(cab, sessoes),
    opts.so === "planos" ? vazio : pdfFolhasPresencaFin(cab, sessoes),
  ]);
  return { planos, folhas, sessoes: sessoes.length };
}
