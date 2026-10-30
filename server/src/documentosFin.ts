/**
 * Documentos da turma da Financiada, no modelo da candidatura: a ficha de inscrição (uma página por formando),
 * o plano de sessão (uma página por sessão lectiva, na horizontal) e a folha de presenças / sumário (uma folha por sessão
 * lectiva, com o sumário dessa sessão), e os restantes PDF da turma (listagens, cronograma, relatórios). Todos levam no
 * topo o logótipo da entidade (Configurações › Entidade; sem logótipo, o da ENA) e no rodapé os logótipos da DGERT
 * (Configurações › Entidade), do programa da turma (Edição de cursos › Programas) e da União Europeia.
 *
 * O enquadramento do programa (programa, prioridade e tipologias) vem de Edição de cursos › Programas: o da turma, senão
 * o da ficha do curso, senão o primeiro activo (regrasConfig.ts › programaDaTurma);
 * os dados pessoais, da ficha › Dados para o financiamento e da pré-inscrição (os mesmos da execução física).
 * A Gold continua com os PDF de texto de dtpPdfs.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { CANDIDATURA_FIN_VAZIA, type CandidaturaFin } from "../../src/partilhado/candidaturaFin.js";
import { GENEROS_FIN, HABILITACOES_FIN, PAIS_PORTUGAL_FIN, SITUACOES_EMPREGO_FIN, rotuloPais } from "../../src/partilhado/dadosPessoaisFin.js";
import { rotuloCodigoCurso } from "../../src/partilhado/codigoCurso.js";
import { fmtDataDDMMAAAA } from "../../src/partilhado/horaLisboa.js";
import { estadoDaMarca, type MarcaPresenca } from "./assiduidade.js";
import type { Db } from "./db/pool.js";
import { many, one } from "./repos/sql.js";
import { obterLogoEntidade } from "./entidadeLogo.js";
import { CHAVE_DGERT, chavePrograma, obterLogoDocumento } from "./logosDocumentos.js";
import { dadosFinanciamento, piiDaInscricao } from "./execucaoFisica.js";
import { readFormandoPii } from "./pii.js";
import { lerEntidade, programaDaTurma } from "./regrasConfig.js";
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
  /** Rodapé, da esquerda para a direita: DGERT, programa e União Europeia (os que existirem). Vazio na Gold. */
  rodape: Imagem[];
};

export type FichaInscricaoFin = {
  formandoId: number;
  nome: string;
  genero: string;
  /** DD-MM-AAAA, como todas as datas dos documentos. */
  dataNascimento: string;
  documentoRotulo: string;
  documento: string;
  /** DD-MM-AAAA. */
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
  /** AAAA-MM-DD (no PDF sai DD-MM-AAAA). */
  data: string;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
  plano: PlanoPdf | null;
  sumario: { conteudos?: string; atividades?: string; observacoes?: string } | null;
  /** Uma linha por formando, pela ordem da turma; `presenca` em branco quando ainda não foi marcada. */
  presencas: { nome: string; presenca: string }[];
  /** Horas teóricas (T) e práticas (P) definidas na folha da sessão; null = por preencher. */
  componente?: { teoricas: number | null; praticas: number | null };
  /** Assinaturas digitais (nome da conta e hora): plano pelo formador e aprovação; folha pelo formador e validação. */
  assinaturas?: { planoFormador?: Assinatura; planoCoordenador?: Assinatura; folhaFormador?: Assinatura; folhaCoordenador?: Assinatura };
};

/** `qualificada`: assinatura com Cartão de Cidadão / Chave Móvel Digital (PDF assinado guardado no GesForma). */
export type Assinatura = { nome: string; em: string; qualificada?: boolean } | null;

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
  atraso: "Presente",
  falta_justificada: "Falta justificada",
  falta_injustificada: "Falta injustificada",
};

function rotuloPresenca(m: MarcaPresenca) {
  const estado = estadoDaMarca(m);
  const min = estado === "atraso" && m.minutos ? ` (ausente ${m.minutos} min)` : "";
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
const LOGO_UE = fileURLToPath(new URL("./modelos/logo-uniao-europeia.png", import.meta.url));
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

/** Logótipos do rodapé: DGERT, o do programa (se tiver) e o da União Europeia. */
async function logosDoRodape(db: Db, programaId: number | null): Promise<Imagem[]> {
  const [dgert, programa] = await Promise.all([
    obterLogoDocumento(db, CHAVE_DGERT).catch(() => null),
    programaId == null ? null : obterLogoDocumento(db, chavePrograma(programaId)).catch(() => null),
  ]);
  const ue = ficheiro(LOGO_UE);
  return [dgert, programa, ue ? { bytes: ue, mime: "image/png" } : null].filter((x): x is Imagem => Boolean(x));
}

export async function cabecalhoFin(db: Db, turma: TurmaReembolso): Promise<CabecalhoFin> {
  const [entidade, programa, logo] = await Promise.all([lerEntidade(db), programaDaTurma(db, turma), logoDosDocumentos(db)]);
  const { candidatura } = programa;
  const rodape = await logosDoRodape(db, programa.id);
  const ufcd = ufcdDaTurma(turma);
  return {
    entidade: entidade.nome,
    candidatura,
    ufcdCodigo: ufcd.codigo,
    ufcdNome: ufcd.nome,
    acao: acaoDaTurma(turma),
    local: turma.local ?? "",
    logo,
    rodape,
  };
}

/** Cabeçalho dos documentos da Gold: o logótipo da entidade, sem rodapé de financiamento. */
export async function cabecalhoGold(db: Db, t: { nome: string; curso: string; local?: string | null }): Promise<CabecalhoFin> {
  const [entidade, logo] = await Promise.all([lerEntidade(db), logoDosDocumentos(db)]);
  return {
    entidade: entidade.nome, candidatura: CANDIDATURA_FIN_VAZIA, ufcdCodigo: "", ufcdNome: t.curso,
    acao: t.nome, local: t.local ?? "", logo, rodape: [],
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
    dataNascimento: fmtDataDDMMAAAA(txt(d.dataNascimento || fin.dataNascimento)),
    documentoRotulo: !tipo || tipo === "Cartão de Cidadão" ? "Cartão Cidadão" : tipo,
    documento: numero,
    validade: fmtDataDDMMAAAA(txt(ident.validadeDocumento || fin.validadeDocumento)),
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

type FormandoDaFolha = Pick<FormandoExecucao, "id" | "nome" | "apelido" | "estado"> & { transferido?: boolean };

/** As sessões lectivas (presencial e síncrona) da turma, com plano, sumário e presenças. */
async function sessoesDaTurma(
  db: Db, turma: { id: number; cronograma: unknown }, formandos: FormandoDaFolha[], semAssinaturas = false, regime: "fin" | "gold" = "fin",
): Promise<SessaoDocFin[]> {
  const linhas = await listarSessoes(db, regime, turma.id);
  // Assinaturas qualificadas (CC/CMD, só na Financiada): passam à frente das assinaturas simples na linha de cada um.
  const { qualificadasDaTurma } = await import("./sessaoAssinaturaQualificada.js");
  const qualificadas = semAssinaturas || regime !== "fin" ? new Map() : await qualificadasDaTurma(db, turma.id);
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
      // Quem desistiu ou mudou para outra turma só aparece nas sessões em que tem marcação.
      if (!m && (/^desist/i.test(f.estado.trim()) || f.transferido)) return [];
      return [{ nome, presenca: m ? rotuloPresenca(m) : "" }];
    });
    // Marcações de quem já não está na turma (mudou de turma depois da sessão): ficam na folha dessa sessão.
    for (const m of marcas) if (!usadas.has(m) && txt(m.nome)) presencas.push({ nome: txt(m.nome), presenca: rotuloPresenca(m) });
    const plano = obj(linha?.plano);
    const sumario = obj(linha?.sumario);
    const formadores = (Array.isArray(s.formadores) && s.formadores.length ? s.formadores : [s.formador ?? ""]).map(txt).filter(Boolean);
    const folha = obj(linha?.folha);
    const horas = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const ass = (nome: unknown, em: unknown): Assinatura => (txt(nome) && txt(em) ? { nome: txt(nome), em: txt(em) } : null);
    const assPlano = obj(plano.assinaturaFormador);
    const q = (doc: "plano" | "folha", papel: "formador" | "coordenacao"): Assinatura => {
      const a = (qualificadas.get(`${String(s.id ?? "")}|${doc}`) ?? []).filter((x: { papel: string }) => x.papel === papel).at(-1);
      return a ? { nome: a.titular, em: a.em, qualificada: true } : null;
    };
    out.push({
      // O PDF emitido para assinar com CC/CMD sai com as linhas em branco (a assinatura vai no próprio PDF).
      assinaturas: semAssinaturas ? {} : {
        planoFormador: q("plano", "formador") ?? ass(assPlano.nome, assPlano.em),
        planoCoordenador: q("plano", "coordenacao") ?? (plano.estado === "aprovado" || plano.assinado === true ? ass(plano.revistoPor, plano.revistoEm) : null),
        folhaFormador: q("folha", "formador") ?? ass(folha.assinadaPor, folha.assinadaEm),
        folhaCoordenador: q("folha", "coordenacao") ?? (obj(linha?.sumario).presencasValidadas ? ass(folha.validadaPor, folha.validadaEm) : null),
      },
      componente: { teoricas: horas(folha.teoricas), praticas: horas(folha.praticas) },
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

type Doc = { pdf: PDFDocument; sans: PDFFont; negrito: PDFFont; logo: PDFImage | null; rodape: PDFImage[]; entidade: string };
type Pg = { page: PDFPage; y: number; m: number; w: number; largura: number; fundo: number };

async function abrirDoc(titulo: string, cab: Pick<CabecalhoFin, "entidade" | "logo" | "rodape">): Promise<Doc> {
  // Sem datas de criação: o mesmo conteúdo dá os mesmos bytes (o dossiê reutiliza o ficheiro quando nada mudou).
  const pdf = await PDFDocument.create({ updateMetadata: false });
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
  const [logo, ...rodape] = await Promise.all([imagem(cab.logo), ...cab.rodape.map(imagem)]);
  return { pdf, sans, negrito, logo: logo ?? null, rodape: rodape.filter((x): x is PDFImage => Boolean(x)), entidade: cab.entidade };
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

/** Página nova: logótipo à esquerda e título à direita no topo; DGERT, programa e União Europeia no rodapé. */
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
  if (d.rodape.length) {
    // Todos à mesma altura, centrados numa linha; se não couberem, encolhem juntos.
    const espaco = 22;
    let alt = 30;
    const larguraA = (a: number) => d.rodape.reduce((t, img) => t + img.width * a / img.height, 0) + espaco * (d.rodape.length - 1);
    const max = Math.min(retrato ? 420 : 460, w - 2 * m);
    if (larguraA(alt) > max) alt = alt * (max - espaco * (d.rodape.length - 1)) / (larguraA(alt) - espaco * (d.rodape.length - 1));
    let x = (w - larguraA(alt)) / 2;
    for (const img of d.rodape) {
      const larg = img.width * alt / img.height;
      page.drawImage(img, { x, y: 14, width: larg, height: alt });
      x += larg + espaco;
    }
    pg.fundo = 14 + alt + 12;
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
/** «Assinado digitalmente por Nome em dd-mm-aaaa hh:mm» (hora de Lisboa). */
export function textoAssinatura(a: Assinatura | undefined) {
  if (!a) return "";
  const dt = new Date(a.em);
  const como = a.qualificada ? "Assinatura qualificada (Cartão de Cidadão / CMD) de" : "Assinado digitalmente por";
  if (Number.isNaN(dt.getTime())) return `${como} ${a.nome}`;
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(dt).map(x => [x.type, x.value]));
  return `${como} ${a.nome} em ${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

function linhaAssinatura(d: Doc, pg: Pg, rotulo: string, comprimento = 150, assinatura?: Assinatura) {
  escrever(pg, rotulo, pg.m, pg.y - TAM, d.sans, TAM);
  const x = pg.m + d.sans.widthOfTextAtSize(rotulo, TAM) + 4;
  const texto = textoAssinatura(assinatura);
  if (texto) escrever(pg, texto, x + 2, pg.y - TAM, d.negrito, TAM - 0.5);
  pg.page.drawLine({ start: { x, y: pg.y - TAM - 1 }, end: { x: x + Math.max(comprimento, texto ? d.negrito.widthOfTextAtSize(texto, TAM - 0.5) + 6 : 0), y: pg.y - TAM - 1 }, thickness: 0.5, color: BORDA });
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
  return [juntar(m?.conteudo), juntar(m?.atividades), juntar(m?.metodos), juntar(m?.recursos, m?.materiais), juntar(m?.avaliacao), juntar(m?.tempo)];
}

/** «M1 · O formador… · 10h» → «M1 · O formador…» (as horas do módulo já estão no sumário). */
function semHoras(modulo: string) {
  return modulo.replace(/\s*[·-]\s*\d+([.,]\d+)?\s*h\s*$/i, "").trim();
}

/**
 * Uma página por sessão lectiva (sem sessões, um plano em branco): objetivo geral e específicos em caixas separadas,
 * a tabela dos momentos com as atividades, e tudo na mesma folha (a letra da tabela encolhe quando é preciso).
 * `semAssinaturas` (Gold): as linhas do formador e do coordenador ficam na folha de presenças / sumário.
 */
export async function pdfPlanosSessaoFin(cab: CabecalhoFin, sessoes: SessaoDocFin[], semAssinaturas = false) {
  const d = await abrirDoc("Planos de sessão", cab);
  const lista: (SessaoDocFin | null)[] = sessoes.length ? sessoes : [null];
  const cabecalhos = ["Momento", "Conteúdos", "Atividades", "Métodos / Estratégias", "Recursos didáticos", "Avaliação", "Tempo"];
  for (const s of lista) {
    const sub = s ? [`Sessão ${s.n}`, fmtDataDDMMAAAA(s.data), horario(s), s.formadores.join(", ")].filter(Boolean).join(" · ") : "";
    const pg = novaPagina(d, PAISAGEM, "PLANO DE SESSÃO", sub);
    const larguras = (() => {
      const momento = 90;
      const tempo = 50;
      const resto = (pg.largura - momento - tempo) / 5;
      return [momento, resto, resto, resto, resto, resto, tempo];
    })();
    const modulo = semHoras(s?.modulos.length ? s.modulos.join(" · ") : [cab.ufcdNome].filter(Boolean).join(""));
    const xValor = pg.m + 110;
    const larguraValor = pg.w - pg.m - xValor;
    escrever(pg, "Público-alvo:", pg.m + 6, pg.y - TAM, d.negrito, TAM);
    const [publico = ""] = quebrar(`Formandos do módulo - ${modulo}`, d.sans, TAM, larguraValor);
    escrever(pg, publico, xValor, pg.y - TAM, d.sans, TAM);
    pg.y -= 20;
    for (const [rotulo, valor] of [["Objetivo geral:", s?.plano?.objetivosGerais], ["Objetivos específicos:", s?.plano?.objetivosEspecificos]] as const) {
      const linhas = quebrar(txt(valor), d.sans, TAM, larguraValor - 10);
      const alt = Math.max(24, linhas.length * ENTRELINHA + 10);
      escrever(pg, rotulo, pg.m + 6, pg.y - alt / 2 - 3, d.negrito, TAM);
      caixa(pg, xValor, pg.y - alt, larguraValor, alt);
      linhas.forEach((l, i) => escrever(pg, l, xValor + 5, pg.y - 5 - TAM - i * ENTRELINHA, d.sans, TAM));
      pg.y -= alt + 6;
    }
    pg.y -= 6;

    // Tudo numa folha: escolhe a maior letra com que os três momentos cabem no espaço que sobra.
    const disponivel = pg.y - 18 - pg.fundo - (semAssinaturas ? 4 : 52);
    const colunasDe = MOMENTOS.map(mo => colunasMomento(s?.plano?.momentos?.[mo.id]));
    const medir = (tam: number) => colunasDe.map(colunas => {
      const quebradas = colunas.map((c, i) => quebrar(c, d.sans, tam, larguras[i + 1]! - 8));
      return { quebradas, alt: Math.max(36, Math.max(...quebradas.map(q => q.length)) * (tam + 2) + 10) };
    });
    let tamCel = 8.5;
    let linhasMomentos = medir(tamCel);
    while (tamCel > 5.5 && linhasMomentos.reduce((t, m) => t + m.alt, 0) > disponivel) {
      tamCel -= 0.5;
      linhasMomentos = medir(tamCel);
    }
    const sobra = disponivel - linhasMomentos.reduce((t, m) => t + m.alt, 0);
    // Com espaço de sobra, as linhas crescem por igual até ao fim da folha (como o modelo).
    const extra = sobra > 0 ? Math.min(sobra / MOMENTOS.length, 60) : 0;

    let x = pg.m;
    cabecalhos.forEach((c, i) => {
      caixa(pg, x, pg.y - 18, larguras[i]!, 18);
      const lc = d.negrito.widthOfTextAtSize(c, TAM);
      escrever(pg, c, x + (larguras[i]! - lc) / 2, pg.y - 12.5, d.negrito, TAM);
      x += larguras[i]!;
    });
    pg.y -= 18;
    MOMENTOS.forEach((mo, k) => {
      const { quebradas } = linhasMomentos[k]!;
      const alt = linhasMomentos[k]!.alt + extra;
      let xc = pg.m;
      caixa(pg, xc, pg.y - alt, larguras[0]!, alt);
      const lm = d.sans.widthOfTextAtSize(mo.rotulo, TAM);
      escrever(pg, mo.rotulo, xc + (larguras[0]! - lm) / 2, pg.y - alt / 2 - 3, d.sans, TAM);
      xc += larguras[0]!;
      quebradas.forEach((linhas, i) => {
        const lw = larguras[i + 1]!;
        caixa(pg, xc, pg.y - alt, lw, alt);
        linhas.forEach((l, j) => escrever(pg, l, xc + 4, pg.y - 5 - tamCel - j * (tamCel + 2), d.sans, tamCel));
        xc += lw;
      });
      pg.y -= alt;
    });
    if (!semAssinaturas) {
      pg.y -= 16;
      linhaAssinatura(d, pg, "o Formador:", 150, s?.assinaturas?.planoFormador);
      linhaAssinatura(d, pg, "o Coordenador:", 150, s?.assinaturas?.planoCoordenador);
    }
  }
  return fecharDoc(d);
}

// ── Folha de presenças / sumário ─────────────────────────────────────────────

/** O texto do sumário na folha: os conteúdos, as atividades e as observações da sessão. */
export function textoSumario(s: SessaoDocFin["sumario"]) {
  if (!s) return "";
  return [txt(s.conteudos), txt(s.atividades), txt(s.observacoes) ? `Observações: ${txt(s.observacoes)}` : ""].filter(Boolean).join("\n");
}

/**
 * Uma folha por sessão lectiva (sem sessões, uma folha em branco). Uma turma grande continua na página seguinte.
 * `pares`: o bloco do topo (na Gold, entidade, curso e turma em vez do enquadramento do programa).
 */
export async function pdfFolhasPresencaFin(cab: CabecalhoFin, sessoes: SessaoDocFin[], pares?: [string, string][], gold = false) {
  const d = await abrirDoc("Folhas de presenças", cab);
  const c = cab.candidatura;
  const lista: (SessaoDocFin | null)[] = sessoes.length ? sessoes : [null];
  for (const s of lista) {
    // A Financiada deixou de ter sumário: o título só o refere nas sessões que ainda o têm gravado.
    // Gold (CCP): o modelo da folha de presenças / sumário, sem sala, T/P nem meios utilizados.
    const titulo = gold || textoSumario(s?.sumario ?? null) ? "FOLHA DE PRESENÇAS / SUMÁRIO" : "FOLHA DE PRESENÇAS";
    let pg = novaPagina(d, RETRATO, titulo);
    const topo: [string, string][] = pares ?? [
      ["Entidade:", cab.entidade],
      ["Programa:", c.programa],
      ["Prioridade do Programa:", c.prioridade],
      ["Tipologia de Ação:", c.tipologiaAcao],
      ["Tipologia de Intervenção:", c.tipologiaIntervencao],
      ["Tipologia de Operação:", c.tipologiaOperacao],
      ["UFCD:", [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" | ")],
      ["Ação:", cab.acao],
    ];
    for (const [r, v] of gold && s?.modulos.length ? [...topo, ["Módulo:", s.modulos.join(" · ")] as [string, string]] : topo) linhaPar(d, pg, r, v, 130, 19);
    const terco = pg.largura / 3;
    if (gold) {
      celulaRotulo(d, pg, pg.m, terco, 20, "Local:", cab.local);
      celulaRotulo(d, pg, pg.m + terco, terco, 20, "Data:", fmtDataDDMMAAAA(s?.data));
      celulaRotulo(d, pg, pg.m + 2 * terco, terco, 20, "Horário:", s ? horario(s) : "");
      pg.y -= 20 + 12;
    } else {
    celulaRotulo(d, pg, pg.m, terco, 18, "Sala:", "");
    celulaRotulo(d, pg, pg.m + terco, terco, 18, "Local:", cab.local);
    celulaRotulo(d, pg, pg.m + 2 * terco, terco, 18, "Data:", fmtDataDDMMAAAA(s?.data));
    pg.y -= 18;
    celulaRotulo(d, pg, pg.m, terco, 22, "Horário:", s ? horario(s) : "");
    // Horas teóricas (T) e práticas (P) da folha da sessão; sem elas, caixas em branco para preencher à mão.
    const horasTP = (v: number | null | undefined) => (v == null ? null : `${String(v).replace(".", ",")} h`);
    celulaRotulo(d, pg, pg.m + terco, terco, 22, "T:", horasTP(s?.componente?.teoricas));
    celulaRotulo(d, pg, pg.m + 2 * terco, terco, 22, "P:", horasTP(s?.componente?.praticas));
    pg.y -= 22 + 12;
    }

    // Gold: coluna do número à esquerda e «Assinaturas» em vez de «Presenças».
    const colN = gold ? 26 : 0;
    const colNome = gold ? (pg.largura - colN) * 0.45 : pg.largura / 2;
    const xNome = pg.m + colN;
    const cabecalhoLista = () => {
      const colunas: [number, number, string][] = gold
        ? [[pg.m, colN, "N.º"], [xNome, colNome, "Nome dos Formandos"], [xNome + colNome, pg.largura - colN - colNome, "Assinaturas"]]
        : [[pg.m, colNome, "Nome:"], [pg.m + colNome, pg.largura - colNome, "Presenças:"]];
      for (const [x, w, t] of colunas) {
        caixa(pg, x, pg.y - 16, w, 16);
        const lt = d.negrito.widthOfTextAtSize(t, TAM);
        escrever(pg, t, x + (w - lt) / 2, pg.y - 11.5, d.negrito, TAM);
      }
      pg.y -= 16;
    };
    cabecalhoLista();
    const linhas = s?.presencas.length ? s.presencas : Array.from({ length: 12 }, () => ({ nome: "", presenca: "" }));
    const alt = gold ? 18 : 15;
    linhas.forEach((p, i) => {
      if (pg.y - alt < pg.fundo + 10) {
        pg = novaPagina(d, RETRATO, titulo, s ? `Sessão ${s.n} · ${fmtDataDDMMAAAA(s.data)} (continuação)` : "");
        cabecalhoLista();
      }
      if (gold) {
        caixa(pg, pg.m, pg.y - alt, colN, alt, 0.4);
        const num = String(i + 1);
        escrever(pg, num, pg.m + (colN - d.sans.widthOfTextAtSize(num, TAM)) / 2, pg.y - alt + 5.5, d.sans, TAM);
      }
      caixa(pg, xNome, pg.y - alt, colNome, alt, 0.4);
      caixa(pg, xNome + colNome, pg.y - alt, pg.largura - colN - colNome, alt, 0.4);
      const [nome = ""] = quebrar(p.nome, d.sans, TAM, colNome - 10);
      escrever(pg, nome, xNome + 5, pg.y - alt + 5.5, d.sans, TAM);
      // Gold: a assinatura é à mão; só fica escrito quem faltou.
      const marca = gold ? (/aus|falt/i.test(p.presenca) ? p.presenca : "") : p.presenca;
      escrever(pg, marca, xNome + colNome + 5, pg.y - alt + 5.5, d.sans, TAM);
      pg.y -= alt;
    });
    pg.y -= 12;

    // A Financiada deixou de ter sumário: o quadro só sai nas sessões que já o tinham gravado.
    const sumario = textoSumario(s?.sumario ?? null);
    if (sumario || gold) {
      const linhasSumario = sumario ? quebrar(sumario, d.sans, TAM, pg.largura - 12) : [];
      const altSumario = Math.max(gold ? 90 : 56, linhasSumario.length * ENTRELINHA + 10);
      if (pg.y - altSumario - 16 < pg.fundo) pg = novaPagina(d, RETRATO, titulo, s ? `Sessão ${s.n} · ${fmtDataDDMMAAAA(s.data)} (continuação)` : "");
      escrever(pg, "Sumário:", pg.m, pg.y - TAM, d.negrito, TAM);
      pg.y -= TAM + 5;
      caixa(pg, pg.m, pg.y - altSumario, pg.largura, altSumario);
      linhasSumario.forEach((l, i) => escrever(pg, l, pg.m + 6, pg.y - 5 - TAM - i * ENTRELINHA, d.sans, TAM));
      pg.y -= altSumario + 18;
    }
    if (pg.y - 40 < pg.fundo) pg = novaPagina(d, RETRATO, titulo, s ? `Sessão ${s.n} · ${fmtDataDDMMAAAA(s.data)} (continuação)` : "");
    linhaAssinatura(d, pg, "o Formador:", 160, s?.assinaturas?.folhaFormador);
    linhaAssinatura(d, pg, "o Coordenador:", 160, s?.assinaturas?.folhaCoordenador);
  }
  return fecharDoc(d);
}

// ── Texto e tabelas (listagens, cronograma, relatórios) ─────────────────────

/** Bloco de linhas «rótulo: valor» no topo de uma listagem (ação, curso, local…). */
function blocoInfo(d: Doc, pg: Pg, pares: [string, string][]) {
  for (const [r, v] of pares) if (v) linhaPar(d, pg, r, v, 130, 17);
  pg.y -= 12;
}

/**
 * PDF de texto com o cabeçalho e o rodapé dos documentos (os relatórios e listagens que antes eram texto simples).
 * Cada linha é um parágrafo; o recuo inicial mantém-se nas linhas de continuação.
 */
export async function pdfLinhasFin(cab: CabecalhoFin, titulo: string, linhas: string[], subtitulo = "") {
  const d = await abrirDoc(titulo, cab);
  const tituloPg = titulo.toUpperCase();
  let pg = novaPagina(d, RETRATO, tituloPg, subtitulo);
  const lista = linhas.length ? linhas : [""];
  lista.forEach((linha, i) => {
    const recuo = /^ */.exec(linha)![0].length * 3;
    // Título de secção: linha curta, sem «:», a abrir um bloco (depois de uma linha em branco).
    const seccao = !recuo && (i === 0 || !lista[i - 1]!.trim()) && Boolean(lista[i + 1]?.trim()) && linha.length < 70 && !linha.includes(":");
    const f = seccao ? d.negrito : d.sans;
    const partes = linha.trim() ? quebrar(linha.trim(), f, TAM + 0.5, pg.largura - recuo) : [""];
    for (const l of partes) {
      if (pg.y - ENTRELINHA < pg.fundo) pg = novaPagina(d, RETRATO, tituloPg, subtitulo);
      escrever(pg, l, pg.m + recuo, pg.y - TAM, f, TAM + 0.5);
      pg.y -= ENTRELINHA + 1.5;
    }
  });
  return fecharDoc(d);
}

export type ColunaTabela = { titulo: string; peso: number };

/** Tabela com o cabeçalho repetido em cada página (listagem de formandos, cronograma). */
export async function pdfTabelaFin(
  cab: CabecalhoFin,
  opts: {
    titulo: string; subtitulo?: string; pares?: [string, string][]; colunas: ColunaTabela[]; linhas: string[][]; vazio?: string; nota?: string; paisagem?: boolean;
    /** Linha final a negrito (totais), alinhada pelas colunas. */
    total?: string[];
    /** Linhas de assinatura no fim («o Coordenador:»…). */
    assinaturas?: string[];
  },
) {
  const d = await abrirDoc(opts.titulo, cab);
  const tamanho = opts.paisagem ? PAISAGEM : RETRATO;
  const tituloPg = opts.titulo.toUpperCase();
  let pg = novaPagina(d, tamanho, tituloPg, opts.subtitulo);
  if (opts.pares?.length) blocoInfo(d, pg, opts.pares);
  const total = opts.colunas.reduce((t, c) => t + c.peso, 0);
  const larguras = opts.colunas.map(c => pg.largura * c.peso / total);
  const cabecalho = () => {
    let x = pg.m;
    opts.colunas.forEach((c, i) => {
      const w = larguras[i]!;
      pg.page.drawRectangle({ x, y: pg.y - 18, width: w, height: 18, color: rgb(0.95, 0.95, 0.96), borderColor: BORDA, borderWidth: 0.6 });
      const [t = ""] = quebrar(c.titulo, d.negrito, TAM, w - 8);
      escrever(pg, t, x + 4, pg.y - 12.5, d.negrito, TAM);
      x += w;
    });
    pg.y -= 18;
  };
  cabecalho();
  const tam = 8.5;
  const entre = 10.5;
  for (const linha of opts.linhas) {
    const celulas = larguras.map((w, i) => quebrar(linha[i] ?? "", d.sans, tam, w - 8));
    const alt = Math.max(16, Math.max(...celulas.map(c => c.length)) * entre + 6);
    if (pg.y - alt < pg.fundo) {
      pg = novaPagina(d, tamanho, tituloPg, opts.subtitulo ? `${opts.subtitulo} (continuação)` : "(continuação)");
      cabecalho();
    }
    let x = pg.m;
    celulas.forEach((c, i) => {
      const w = larguras[i]!;
      caixa(pg, x, pg.y - alt, w, alt, 0.4);
      c.forEach((l, j) => escrever(pg, l, x + 4, pg.y - 4 - tam - j * entre, d.sans, tam));
      x += w;
    });
    pg.y -= alt;
  }
  if (opts.total) {
    if (pg.y - 18 < pg.fundo) pg = novaPagina(d, tamanho, tituloPg, opts.subtitulo ? `${opts.subtitulo} (continuação)` : "(continuação)");
    let x = pg.m;
    larguras.forEach((w, i) => {
      pg.page.drawRectangle({ x, y: pg.y - 18, width: w, height: 18, color: rgb(0.95, 0.95, 0.96), borderColor: BORDA, borderWidth: 0.6 });
      const [t = ""] = quebrar(opts.total![i] ?? "", d.negrito, tam, w - 8);
      escrever(pg, t, x + 4, pg.y - 12.5, d.negrito, tam);
      x += w;
    });
    pg.y -= 18;
  }
  if (!opts.linhas.length && opts.vazio) {
    caixa(pg, pg.m, pg.y - 20, pg.largura, 20, 0.4);
    escrever(pg, opts.vazio, pg.m + 6, pg.y - 13.5, d.sans, TAM, SUAVE);
    pg.y -= 20;
  }
  if (opts.nota) {
    pg.y -= 10;
    for (const l of quebrar(opts.nota, d.sans, 8, pg.largura)) {
      if (pg.y - 10 < pg.fundo) pg = novaPagina(d, tamanho, tituloPg, opts.subtitulo);
      escrever(pg, l, pg.m, pg.y - 8, d.sans, 8, SUAVE);
      pg.y -= 10;
    }
  }
  if (opts.assinaturas?.length) {
    pg.y -= 22;
    if (pg.y - opts.assinaturas.length * 26 < pg.fundo) pg = novaPagina(d, tamanho, tituloPg, opts.subtitulo);
    for (const rotulo of opts.assinaturas) linhaAssinatura(d, pg, rotulo, 160);
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
export async function documentosSessoesDaTurma(db: Db, turmaId: number, opts: { n?: number; so?: "planos" | "folhas"; semAssinaturas?: boolean } = {}) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const formandos = await formandosDaTurma(db, turma);
  const [cab, todas] = await Promise.all([cabecalhoFin(db, turma), sessoesDaTurma(db, turma, formandos, opts.semAssinaturas)]);
  const sessoes = opts.n == null ? todas : todas.filter(s => s.n === opts.n);
  if (opts.n != null && !sessoes.length) return null;
  const vazio = Buffer.alloc(0);
  const [planos, folhas] = await Promise.all([
    opts.so === "folhas" ? vazio : pdfPlanosSessaoFin(cab, sessoes),
    opts.so === "planos" ? vazio : pdfFolhasPresencaFin(cab, sessoes),
  ]);
  return { planos, folhas, sessoes: sessoes.length };
}

/**
 * Gold: as mesmas folhas de presenças e planos de sessão da Financiada, com o logótipo da entidade no topo e sem o
 * enquadramento do programa nem os logótipos de financiamento no rodapé.
 */
export async function documentosSessoesGold(db: Db, turmaId: number, opts: { n?: number; so?: "planos" | "folhas" } = {}) {
  const turma = await one<{ id: number; nome: string; curso: string; local: string; cronograma: unknown }>(db,
    "SELECT id, nome, curso, COALESCE(local, '') AS local, cronograma FROM turmas_gold WHERE id = $1", [turmaId]);
  if (!turma) return null;
  const formandos = await many<FormandoDaFolha>(db,
    `SELECT id, COALESCE(nome, '') AS nome, COALESCE(apelido, '') AS apelido, COALESCE(estado, '') AS estado
       FROM formandos_gold WHERE turma_id = $1 ORDER BY lower(nome), lower(apelido), id`, [turmaId]);
  const [cab, todas] = await Promise.all([cabecalhoGold(db, turma), sessoesDaTurma(db, turma, formandos, false, "gold")]);
  const sessoes = opts.n == null ? todas : todas.filter(s => s.n === opts.n);
  if (opts.n != null && !sessoes.length) return null;
  const pares: [string, string][] = [["Entidade Formadora:", cab.entidade], ["Curso:", turma.curso], ["Ação:", turma.nome]];
  const vazio = Buffer.alloc(0);
  const [planos, folhas] = await Promise.all([
    opts.so === "folhas" ? vazio : pdfPlanosSessaoFin(cab, sessoes, true),
    opts.so === "planos" ? vazio : pdfFolhasPresencaFin(cab, sessoes, pares, true),
  ]);
  return { planos, folhas, sessoes: sessoes.length };
}

/** Qualquer PDF de texto da turma (relatórios, pauta, programa…) com o cabeçalho e o rodapé da Financiada. */
export async function pdfTextoDaTurmaFin(db: Db, turmaId: number, titulo: string, linhas: string[], subtitulo = "") {
  const turma = await turmaReembolso(db, turmaId);
  const cab = turma ? await cabecalhoFin(db, turma) : await cabecalhoSemTurma(db);
  return pdfLinhasFin(cab, titulo, linhas, subtitulo);
}

/** Sem turma (já apagada): cabeçalho com a entidade e o rodapé do primeiro programa activo. */
async function cabecalhoSemTurma(db: Db): Promise<CabecalhoFin> {
  const [entidade, programa, logo] = await Promise.all([lerEntidade(db), programaDaTurma(db, {}), logoDosDocumentos(db)]);
  return {
    entidade: entidade.nome, candidatura: programa.candidatura, ufcdCodigo: "", ufcdNome: "", acao: "", local: "", logo,
    rodape: await logosDoRodape(db, programa.id),
  };
}

/** Lista de selecionados da turma para o dossiê: N.º e nome, só com a assinatura do coordenador (os indeferidos ficam de fora). */
export async function listagemFormandosFin(db: Db, turmaId: number) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const [cab, formandos] = await Promise.all([cabecalhoFin(db, turma), formandosDaTurma(db, turma)]);
  const linhas = formandos.map((f, i) => [String(i + 1), fichaDoFormando(f).nome]);
  const bytes = await pdfTabelaFin(cab, {
    titulo: "Lista de selecionados",
    subtitulo: `${formandos.length} ${formandos.length === 1 ? "formando" : "formandos"}`,
    // O mesmo enquadramento da candidatura que as folhas de presenças levam no topo.
    pares: [
      ["Entidade:", cab.entidade],
      ["Programa:", cab.candidatura.programa],
      ["Prioridade do Programa:", cab.candidatura.prioridade],
      ["Tipologia de Ação:", cab.candidatura.tipologiaAcao],
      ["Tipologia de Intervenção:", cab.candidatura.tipologiaIntervencao],
      ["Tipologia de Operação:", cab.candidatura.tipologiaOperacao],
      ["UFCD:", [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" | ")],
      ["Ação:", cab.acao],
      ["Local:", cab.local],
    ],
    colunas: [{ titulo: "N.º", peso: 6 }, { titulo: "Nome", peso: 94 }],
    linhas,
    vazio: "Ainda sem formandos nesta turma.",
    nota: `Gerado a ${fmtDataDDMMAAAA(new Date().toISOString())}.`,
    assinaturas: ["o Coordenador:"],
  });
  return { nome: "ListaSelecionados.pdf", bytes };
}

export type FichaQualitativa = {
  formando: string;
  competencias: string;
  criterios: { titulo: string; esquerda: string; direita: string; nivel: number | null; texto: string }[];
};

/** Os três critérios da ficha individual, pela ordem do modelo do dossiê. */
export const CRITERIOS_QUALITATIVOS = [
  { id: "aquisicao", titulo: "Aquisição de Competências (saber e saber fazer): (Competências adquiridas pelo formando)",
    esquerda: "Não adquiriu as competências desejadas", direita: "Adquiriu as competências desejadas" },
  { id: "autonomiaAprendizagens", titulo: "Autonomia na realização das aprendizagens",
    esquerda: "Não conseguiu autonomia na realização das aprendizagens", direita: "Conseguiu autonomia na realização das aprendizagens" },
  { id: "autonomiaProblemas", titulo: "Autonomia na resolução de problemas",
    esquerda: "Não conseguiu autonomia na resolução de problemas", direita: "Conseguiu autonomia na resolução de problemas" },
] as const;

const VERMELHO = rgb(0.62, 0.05, 0.05);

/**
 * Ficha individual de avaliação da aprendizagem (qualitativa), uma página por formando: o enquadramento, a UFCD e o
 * formando; as competências a adquirir; os três critérios com a escala de 1 a 5 e o texto do formador.
 */
export async function pdfAvaliacaoQualitativa(cab: CabecalhoFin, fichas: FichaQualitativa[], pares?: [string, string][]) {
  const d = await abrirDoc("Avaliação da aprendizagem", cab);
  const titulo = "AVALIAÇÃO DA APRENDIZAGEM";
  const ufcd = [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" - ");
  const lista = fichas.length ? fichas : [{ formando: "", competencias: "", criterios: CRITERIOS_QUALITATIVOS.map(c => ({ ...c, nivel: null, texto: "" })) }];
  for (const f of lista) {
    const pg = novaPagina(d, RETRATO, titulo);
    const topo: [string, string][] = pares ?? [
      ["Entidade:", cab.entidade],
      ["Programa:", cab.candidatura.programa],
      ["Prioridade do Programa:", cab.candidatura.prioridade],
      ["Tipologia de Ação:", cab.candidatura.tipologiaAcao],
      ["Tipologia de Intervenção:", cab.candidatura.tipologiaIntervencao],
      ["Tipologia de Operação:", cab.candidatura.tipologiaOperacao],
      ["UFCD:", [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" | ")],
    ];
    for (const [r, v] of topo) linhaPar(d, pg, r, v, 130, 17);
    pg.y -= 8;
    // Faixa do percurso, da unidade e do formando (rótulos a vermelho, como no modelo).
    const faixa = (rotulo: string, valor: string) => {
      const alt = 18;
      pg.page.drawRectangle({ x: pg.m, y: pg.y - alt, width: 130, height: alt, color: VERMELHO, borderColor: BORDA, borderWidth: 0.6 });
      escrever(pg, rotulo, pg.m + 6, pg.y - 12.5, d.negrito, TAM, rgb(1, 1, 1));
      caixa(pg, pg.m + 130, pg.y - alt, pg.largura - 130, alt);
      const [v = ""] = quebrar(valor, d.sans, TAM, pg.largura - 140);
      escrever(pg, v, pg.m + 136, pg.y - 12.5, d.sans, TAM);
      pg.y -= alt;
    };
    faixa("Percurso:", ufcd || cab.acao);
    const sub = "Avaliação do Resultado da Aprendizagem por Unidade de Competência";
    caixa(pg, pg.m, pg.y - 18, pg.largura, 18);
    escrever(pg, sub, pg.m + (pg.largura - d.sans.widthOfTextAtSize(sub, TAM)) / 2, pg.y - 12.5, d.sans, TAM);
    pg.y -= 18;
    faixa("Unidade de Competência:", ufcd || cab.acao);
    faixa("Formando:", f.formando);
    pg.y -= 10;

    // Uma secção: título a vermelho, (escala), caixa do texto.
    const seccao = (tituloSec: string, texto: string, escala?: { esquerda: string; direita: string; nivel: number | null }) => {
      pg.page.drawRectangle({ x: pg.m, y: pg.y - 15, width: pg.largura, height: 15, color: VERMELHO });
      const [t = ""] = quebrar(tituloSec, d.negrito, 8.5, pg.largura - 10);
      escrever(pg, t, pg.m + (pg.largura - d.negrito.widthOfTextAtSize(t, 8.5)) / 2, pg.y - 10.5, d.negrito, 8.5, rgb(1, 1, 1));
      pg.y -= 15;
      if (escala) {
        const alt = 26;
        caixa(pg, pg.m, pg.y - alt, pg.largura, alt, 0.4);
        const lado = (pg.largura - 120) / 2;
        const esq = quebrar(escala.esquerda, d.sans, 8, lado - 10);
        const dir = quebrar(escala.direita, d.sans, 8, lado - 10);
        esq.forEach((l, i) => escrever(pg, l, pg.m + 6, pg.y - 10 - i * 9, d.sans, 8));
        dir.forEach((l, i) => escrever(pg, l, pg.m + lado + 120 + 4, pg.y - 10 - i * 9, d.sans, 8));
        for (let n = 1; n <= 5; n++) {
          const x = pg.m + lado + 8 + (n - 1) * 21;
          const marcado = escala.nivel === n;
          pg.page.drawRectangle({ x, y: pg.y - 19, width: 16, height: 14, borderColor: BORDA, borderWidth: 0.6, ...(marcado ? { color: TINTA } : {}) });
          escrever(pg, String(n), x + 5.5, pg.y - 15.5, d.negrito, 8, marcado ? rgb(1, 1, 1) : TINTA);
        }
        pg.y -= alt;
      }
      const linhas = quebrar(texto, d.sans, TAM, pg.largura - 12);
      const alt = Math.max(48, linhas.length * ENTRELINHA + 10);
      caixa(pg, pg.m, pg.y - alt, pg.largura, alt, 0.4);
      linhas.forEach((l, i) => escrever(pg, l, pg.m + 6, pg.y - 5 - TAM - i * ENTRELINHA, d.sans, TAM));
      pg.y -= alt + 10;
    };
    seccao("Competências a adquirir: (apresentação dos objectivos/competências que o formando deveria adquirir)", f.competencias);
    for (const c of f.criterios) seccao(c.titulo, c.texto, c);
    pg.y -= 6;
    linhaAssinatura(d, pg, "o Formador:", 160);
    linhaAssinatura(d, pg, "o Coordenador:", 160);
  }
  return fecharDoc(d);
}

/** As fichas qualitativas da turma (ou só de um formando), com o cabeçalho do regime. */
export async function avaliacaoQualitativaDaTurma(db: Db, regime: "gold" | "fin", turmaId: number, formandoId?: number) {
  const { listarQualitativas } = await import("./repos/avaliacaoQualitativa.js");
  const { carregarTurma } = await import("./repos/pedagogiaTurma.js");
  const { formandosDaTurma: membros } = await import("./repos/pedagogiaTurma.js");
  const turma = await carregarTurma(db, regime, turmaId);
  if (!turma) return null;
  let cab: CabecalhoFin;
  let pares: [string, string][] | undefined;
  if (regime === "fin") {
    const t = await turmaReembolso(db, turmaId);
    if (!t) return null;
    cab = await cabecalhoFin(db, t);
  } else {
    cab = await cabecalhoGold(db, turma);
    pares = [["Entidade:", cab.entidade], ["Curso:", turma.curso], ["Turma:", turma.nome]];
  }
  const linhas = new Map((await listarQualitativas(db, regime, turmaId)).map(l => [Number(l.formando_id), l.dados ?? {}]));
  const competencias = txt(linhas.get(0)?.competencias);
  const todos = await membros(db, regime, turma);
  const alvo = formandoId ? todos.filter(f => f.id === formandoId) : todos;
  if (formandoId && !alvo.length) return null;
  const fichas: FichaQualitativa[] = alvo.map(f => {
    const dados = linhas.get(f.id) ?? {};
    return {
      formando: f.nome,
      competencias: txt(dados.competencias) || competencias,
      criterios: CRITERIOS_QUALITATIVOS.map(c => {
        const v = (dados as Record<string, { nivel?: number | null; texto?: string } | undefined>)[c.id];
        return { titulo: c.titulo, esquerda: c.esquerda, direita: c.direita, nivel: v?.nivel ?? null, texto: txt(v?.texto) };
      }),
    };
  });
  const bytes = await pdfAvaliacaoQualitativa(cab, fichas, pares);
  const nome = fichas.length === 1 ? `Avaliacao da aprendizagem - ${fichas[0]!.formando}.pdf` : `Avaliacao da aprendizagem - ${turma.nome}.pdf`;
  return { nome, bytes };
}

export type LinhaSubsidio = { formandoId: number; nome: string; iban: string; dias: number; horas: number; valor: number };

/**
 * Processamento do subsídio de alimentação (modelo do dossiê): o enquadramento da candidatura e, por formando,
 * NIF, IBAN, dias e horas com direito e o valor; total no fim e a assinatura do coordenador.
 */
export async function pdfSubsidioAlimentacaoFin(db: Db, turmaId: number, linhas: LinhaSubsidio[], o: { periodo: string; valorDia: number | null; horas: number }) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const [cab, formandos] = await Promise.all([cabecalhoFin(db, turma), formandosDaTurma(db, turma)]);
  const nifs = new Map(formandos.map(f => [Number(f.id), fichaDoFormando(f).nif]));
  const sessoes = (Array.isArray(turma.cronograma) ? turma.cronograma : []) as SessaoCron[];
  const datas = sessoes.map(x => txt(x.data)).filter(Boolean).sort();
  const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
  const nDias = linhas.reduce((m, l) => Math.max(m, l.dias), 0);
  const total = Math.round(linhas.reduce((t, l) => t + l.valor, 0) * 100) / 100;
  const bytes = await pdfTabelaFin(cab, {
    titulo: "Processamento do subsídio de alimentação",
    subtitulo: o.periodo,
    paisagem: true,
    pares: [
      ["Entidade:", cab.entidade],
      ["Programa:", cab.candidatura.programa],
      ["Prioridade do Programa:", cab.candidatura.prioridade],
      ["Tipologia de Ação:", cab.candidatura.tipologiaAcao],
      ["Tipologia de Intervenção:", cab.candidatura.tipologiaIntervencao],
      ["Tipologia de Operação:", cab.candidatura.tipologiaOperacao],
      ["UFCD:", [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" | ")],
      ["Ação:", cab.acao],
      ["Local:", cab.local],
      ["Datas:", datas.length ? `${fmtDataDDMMAAAA(datas[0])} a ${fmtDataDDMMAAAA(datas[datas.length - 1])}` : ""],
      ["N.º de horas:", o.horas ? String(o.horas) : ""],
      ["N.º de dias:", nDias ? String(nDias) : ""],
      ["Subsídio de alimentação:", o.valorDia != null ? `${eur(o.valorDia)} por dia` : ""],
    ],
    colunas: [
      { titulo: "N.º", peso: 4 }, { titulo: "Nome do formando", peso: 30 }, { titulo: "NIF", peso: 11 }, { titulo: "IBAN", peso: 25 },
      { titulo: "Dias", peso: 7 }, { titulo: "Horas", peso: 8 }, { titulo: "Valor", peso: 11 },
    ],
    linhas: linhas.map((l, i) => [String(i + 1), l.nome, nifs.get(l.formandoId) ?? "", l.iban || "Sem IBAN", String(l.dias), String(l.horas).replace(".", ","), eur(l.valor)]),
    total: ["", "Total", "", "", String(linhas.reduce((t, l) => t + l.dias, 0)), "", eur(total)],
    vazio: "Sem formandos com direito ao subsídio neste período.",
    nota: `Calculado a partir das folhas de presença. Gerado a ${fmtDataDDMMAAAA(new Date().toISOString())}.`,
    assinaturas: ["o Coordenador:"],
  });
  return { nome: `Subsidio de alimentacao - ${turma.nome}${o.periodo ? ` - ${o.periodo}` : ""}.pdf`, bytes };
}

/** Os rótulos do cronograma (src/partilhado/cronogramaGrelha.ts › EVENTO_OPTS). */
const MODALIDADES: Record<string, string> = {
  presencial: "Presencial", sincrona: "Síncrona (vídeo-conferência)", auto: "Assíncrona / auto-aprendizagem", avaliacao: "Limite de entrega / avaliação",
};

type SessaoCron = { data?: string; horaInicio?: string; horaFim?: string; modalidade?: string; modulos?: string[]; formadores?: string[]; formador?: string };

/** Cronograma da turma (todas as sessões, por ordem), em tabela. */
export async function cronogramaFin(db: Db, turmaId: number) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const cab = await cabecalhoFin(db, turma);
  return pdfCronograma(cab, turma.cronograma,
    [["Entidade:", cab.entidade], ["UFCD:", [cab.ufcdCodigo, cab.ufcdNome].filter(Boolean).join(" | ")], ["Ação:", cab.acao], ["Local:", cab.local]]);
}

/** Cronograma de uma turma Gold: o mesmo desenho, com o logótipo da entidade e sem rodapé de financiamento. */
export async function cronogramaGold(db: Db, turmaId: number) {
  const turma = await one<{ nome: string; curso: string; local: string; cronograma: unknown }>(db,
    "SELECT nome, curso, COALESCE(local, '') AS local, cronograma FROM turmas_gold WHERE id = $1", [turmaId]);
  if (!turma) return null;
  const cab = await cabecalhoGold(db, turma);
  return pdfCronograma(cab, turma.cronograma, [["Entidade:", cab.entidade], ["Curso:", turma.curso], ["Turma:", turma.nome], ["Local:", turma.local]]);
}

function pdfCronograma(cab: CabecalhoFin, cronograma: unknown, pares: [string, string][]) {
  const sessoes = arr(cronograma).filter((s): s is SessaoCron => Boolean(s) && typeof s === "object");
  const linhas = sessoes.map((s, i) => [
    String(i + 1),
    fmtDataDDMMAAAA(txt(s.data).slice(0, 10)),
    s.horaInicio || s.horaFim ? `${txt(s.horaInicio) || "--:--"} – ${txt(s.horaFim) || "--:--"}` : "",
    MODALIDADES[txt(s.modalidade) || "presencial"] ?? txt(s.modalidade),
    (Array.isArray(s.modulos) ? s.modulos : []).map(txt).filter(Boolean).join(", "),
    (Array.isArray(s.formadores) && s.formadores.length ? s.formadores : [s.formador ?? ""]).map(txt).filter(Boolean).join(", "),
  ]);
  return pdfTabelaFin(cab, {
    titulo: "Cronograma",
    subtitulo: `${sessoes.length} ${sessoes.length === 1 ? "sessão" : "sessões"}`,
    pares,
    colunas: [{ titulo: "N.º", peso: 4 }, { titulo: "Data", peso: 11 }, { titulo: "Horário", peso: 12 }, { titulo: "Modalidade", peso: 12 }, { titulo: "Módulos", peso: 34 }, { titulo: "Formador", peso: 27 }],
    linhas,
    vazio: "Ainda sem sessões neste cronograma.",
  });
}

/** Listagem dos formandos de uma turma Gold: o mesmo desenho, com o logótipo da entidade e sem rodapé de financiamento. */
export async function listagemFormandosGold(db: Db, turmaId: number) {
  const turma = await one<{ nome: string; curso: string; local: string }>(db,
    "SELECT nome, curso, COALESCE(local, '') AS local FROM turmas_gold WHERE id = $1", [turmaId]);
  if (!turma) return null;
  const formandos = await many<{ nome: string; apelido: string; email: string; telf: string; pii_enc: string; inscrito: string; pago: boolean; metodo: string; estado: string }>(db,
    `SELECT nome, apelido, email, telf, COALESCE(pii_enc, '') AS pii_enc, COALESCE(inscrito::text, '') AS inscrito,
            pago, COALESCE(metodo, '') AS metodo, COALESCE(estado, '') AS estado
       FROM formandos_gold WHERE turma_id = $1 ORDER BY lower(nome), lower(apelido), id`, [turmaId]);
  const cab = await cabecalhoGold(db, turma);
  const linhas = formandos.map((f, i) => [
    String(i + 1),
    `${f.nome} ${f.apelido}`.replace(/\s+/g, " ").trim(),
    txt(f.email),
    txt(readFormandoPii({ pii_enc: f.pii_enc, telf: f.telf }).telf || f.telf),
    fmtDataDDMMAAAA(f.inscrito.slice(0, 10)),
    f.pago ? "Pago" : "Por pagar",
    txt(f.metodo),
  ]);
  const bytes = await pdfTabelaFin(cab, {
    titulo: "Listagem de formandos",
    subtitulo: `${formandos.length} ${formandos.length === 1 ? "formando" : "formandos"}`,
    pares: [["Entidade:", cab.entidade], ["Curso:", turma.curso], ["Turma:", turma.nome], ["Local:", turma.local]],
    colunas: [{ titulo: "N.º", peso: 4 }, { titulo: "Nome", peso: 26 }, { titulo: "Email", peso: 26 }, { titulo: "Telefone", peso: 13 }, { titulo: "Inscrito a", peso: 11 }, { titulo: "Pago", peso: 9 }, { titulo: "Método", peso: 11 }],
    linhas,
    vazio: "Ainda sem formandos nesta turma.",
    nota: `Gerado a ${fmtDataDDMMAAAA(new Date().toISOString())}.`,
  });
  return { nome: "ListagemFormandos.pdf", bytes };
}
