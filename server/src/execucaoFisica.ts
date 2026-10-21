/**
 * Template de execução física (participantes) da Financiada, preenchido pela plataforma: uma linha por
 * formando da turma, a partir da linha 3 da folha «Template», com o que o GesForma sabe. O que ainda não
 * foi recolhido fica em branco e aparece na lista do que falta. O modelo oficial
 * (server/src/modelos/execucao-fisica.xlsx) é editado no lugar (xlsxModelo.ts): as listas das folhas
 * escondidas «Referencias» e «TD» e as validações ficam.
 *
 * Os valores das colunas com lista são exactamente os da folha TD (coluna C, «n - descrição»), partilhados
 * com a ficha do formando em src/partilhado/execucaoFisica.ts.
 *
 * Horas e dias (por formando, a partir das presenças): Sala e PCT = todas as horas em grupo (presenciais e
 * síncronas); E-Learning quando a turma é toda à distância; B-Learning quando mistura presencial e distância;
 * Presencial e Síncronas (vídeo-conferência) à parte. Horário laboral/pós-laboral e «online (presencial)»
 * ficam em branco, como no ficheiro preenchido de referência.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  EMPREGADOS, ENTIDADE_EMPREGADORA, FINANCIAMENTO_VAZIO, NAO, PAIS_PORTUGAL, ROTULOS_FINANCIAMENTO,
  faltaDocumentoEstrangeiro, procuraEmpregoPorOmissao, qnqDasHabilitacoes, type DadosFinanciamento,
} from "../../src/partilhado/execucaoFisica.js";
import { rotuloCodigoCurso } from "../../src/partilhado/codigoCurso.js";
import { estadoDaMarca, sessoesComHoras } from "./assiduidade.js";
import { hojeLisboa } from "./datas.js";
import type { Db } from "./db/pool.js";
import { readFormandoPii, readPreinscricaoPii } from "./pii.js";
import { COLUNAS_FINANCIAMENTO, type CampoTabela } from "./repos/formandoFinanciamento.js";
import { folhasDePresenca } from "./repos/resultados.js";
import {
  certificadosEmitidosFin, formandosExecucao, moradaDoLocal, turmaReembolso, type FormandoExecucao, type TurmaReembolso,
} from "./repos/reembolso.js";
import { resultadosDaTurma } from "./resultados.js";
import { sessaoLectivaN } from "./sessaoAcesso.js";
import { conteudoZip, escreverZip, lerZip, preencherFolha, type ValorCelula } from "./xlsxModelo.js";

/** Valores das listas do modelo (folhas TD e Referencias) usados pela plataforma. */
export const LISTAS_EXECUCAO = {
  gestaoRegisto: "Inserir",
  /** Coluna C «Atividade»: o número da atividade da candidatura (1 no ficheiro de referência). */
  atividade: 1,
  situacao: {
    inscrito: "1 - Inscrito",
    emExecucao: "2 - Em Execução",
    desistente: "5 - Desistente",
    reprovado: "6 - Reprovado",
    aprovado: "7 - Aprovado/Concluido",
    certificado: "13 - Certificado",
  },
  paisPortugal: PAIS_PORTUGAL,
  entidadeEmpregadora: ENTIDADE_EMPREGADORA,
} as const;

/** O que falta por formando: os rótulos (os mesmos da ficha › Dados para o financiamento). */
export const FALTA = {
  nif: ROTULOS_FINANCIAMENTO.nif,
  niss: ROTULOS_FINANCIAMENTO.niss,
  dataNascimento: ROTULOS_FINANCIAMENTO.dataNascimento,
  genero: ROTULOS_FINANCIAMENTO.genero,
  nacionalidade: ROTULOS_FINANCIAMENTO.nacionalidade,
  documentoEstrangeiro: "Documento de estrangeiro",
  codigoPostal: ROTULOS_FINANCIAMENTO.codigoPostal,
  telefone: "Telefone",
  email: "E-mail",
  inscricao: "Data de inscrição",
  situacaoEmprego: "Situação face ao emprego",
  habilitacoes: "Habilitações",
  numeroSigo: ROTULOS_FINANCIAMENTO.numeroSigo,
  nifEntidade: ROTULOS_FINANCIAMENTO.nifEntidadeEmpregadora,
} as const;

const MODELO = fileURLToPath(new URL("./modelos/execucao-fisica.xlsx", import.meta.url));
const FOLHA = "xl/worksheets/sheet1.xml";
/** Linhas do modelo com «Inserir» já escrito (as que não têm formando ficam limpas). */
const ULTIMA_LINHA_MODELO = 522;

let modelo: { entradas: ReturnType<typeof lerZip>; folha: string } | null = null;
function lerModelo() {
  if (!modelo) {
    const entradas = lerZip(readFileSync(MODELO));
    const folha = entradas.find(e => e.nome === FOLHA);
    if (!folha) throw new Error("O modelo de execução física não tem a folha Template.");
    modelo = { entradas, folha: conteudoZip(folha).toString("utf8") };
  }
  return modelo;
}

export type LinhaExecucao = {
  formandoId: number;
  nome: string;
  /** Coluna (letra) → valor. */
  valores: Record<string, ValorCelula>;
  /** Dados que a plataforma recolhe e ainda não tem para este formando. */
  falta: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const dataIso = (s: string) => /^(\d{4}-\d{2}-\d{2})/.exec(s.trim())?.[1]
  ?? (/^(\d{2})\/(\d{2})\/(\d{4})/.exec(s.trim())?.slice(1).reverse().join("-") ?? "");
const soDigitos = (s: string) => s.replace(/\D/g, "");
/** Número no ficheiro quando são só dígitos (como no ficheiro de referência), senão o texto. */
const numeroOuTexto = (s: string): ValorCelula => {
  const t = s.trim();
  if (!t) return null;
  return /^\d{1,15}$/.test(t) ? Number(t) : t;
};

/** Sessão síncrona: vídeo-conferência, à distância e em tempo real (conta como «Síncrona»). */
export function sessaoSincrona(modalidade?: string) {
  const m = (modalidade ?? "presencial").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return m === "sincrona" || m.startsWith("video") || m === "online";
}

function sessoesDoCronograma(cronograma: unknown): { modalidade?: string }[] {
  let v = cronograma;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { v = []; }
  }
  return Array.isArray(v) ? v.filter((s): s is { modalidade?: string } => Boolean(s) && typeof s === "object") : [];
}

/**
 * Forma da turma para as colunas E-Learning / B-Learning: toda à distância (só síncronas e/ou
 * auto-aprendizagem) é e-learning; presencial com distância é b-learning; só presencial, nenhuma.
 */
export function formatoDaTurma(cronograma: unknown): "presencial" | "e-learning" | "b-learning" {
  let presencial = false;
  let distancia = false;
  for (const s of sessoesDoCronograma(cronograma)) {
    const m = s.modalidade ?? "presencial";
    if (m === "presencial") presencial = true;
    else if (m === "auto" || sessaoSincrona(m)) distancia = true;
  }
  if (!distancia) return "presencial";
  return presencial ? "b-learning" : "e-learning";
}

/** «UFCD 8995 - Língua Inglesa - Distribuição / Ação 1» (ou «UC00277 - … / Ação 1»). */
export function cursoAcao(t: Pick<TurmaReembolso, "numero_acao" | "ufcd_cod" | "c_ufcd_cod" | "c_ufcd" | "curso">) {
  const cod = (t.c_ufcd_cod || t.ufcd_cod || "").trim().replace(/\s+/g, " ");
  if (!cod) return "";
  const codigo = rotuloCodigoCurso(cod);
  const nome = (t.c_ufcd || t.curso || "").trim();
  return `${codigo}${nome ? ` - ${nome}` : ""} / Ação ${Math.max(1, Number(t.numero_acao) || 1)}`;
}

/** NIF, código postal e telefone da pré-inscrição (cifrados, ou nas colunas antigas). */
export function piiDaInscricao(f: FormandoExecucao) {
  return readPreinscricaoPii({ pii_enc: f.p_pii_enc, nif: f.p_nif, codigo_postal: f.p_codigo_postal, telf: f.p_telf });
}

function codigoPostal7(s: string) {
  const m = /(\d{4})\s*-?\s*(\d{3})/.exec(s);
  return m ? `${m[1]}-${m[2]}` : "";
}

/** Telefone: número de 9 dígitos (sem o 351) quando é português, como no ficheiro de referência. */
function telefone(s: string): ValorCelula {
  const t = s.replace(/\s+/g, "");
  if (!t) return null;
  const d = soDigitos(t);
  const pt = /^(?:00351|351)?(\d{9})$/.exec(d);
  return pt && !/[^\d+]/.test(t) ? Number(pt[1]) : t;
}

/** Os dados para o financiamento da ficha: o pacote cifrado e a tabela; NIF e código postal da pré-inscrição se faltarem. */
export function dadosFinanciamento(f: FormandoExecucao): DadosFinanciamento {
  const ident = readFormandoPii({ pii_enc: f.pii_enc, telf: f.telf }).ident ?? {};
  const d: DadosFinanciamento = { ...FINANCIAMENTO_VAZIO };
  for (const k of Object.keys(ident) as (keyof typeof ident)[]) d[k] = String(ident[k] ?? "").trim();
  for (const [k, col] of Object.entries(COLUNAS_FINANCIAMENTO) as [CampoTabela, string][]) {
    d[k] = String((f as unknown as Record<string, unknown>)[`d_${col}`] ?? "").trim();
  }
  const pre = piiDaInscricao(f);
  if (soDigitos(d.nif).length !== 9) d.nif = soDigitos(pre.nif ?? "");
  if (!codigoPostal7(d.codigoPostal)) d.codigoPostal = pre.codigoPostal ?? "";
  return d;
}

type Acumulado = { presencial: number; sincrona: number; dias: Set<string>; diasPresencial: Set<string>; diasSincrona: Set<string>; primeira: string; ultima: string };

/** As linhas da folha, uma por formando, e a impressão dos dados (muda quando o ficheiro tem de mudar). */
export async function dadosExecucaoFisica(db: Db, turmaId: number) {
  const turma = await turmaReembolso(db, turmaId);
  if (!turma) return null;
  const [formandos, folhas, certs, resultados, morada] = await Promise.all([
    formandosExecucao(db, turma),
    folhasDePresenca(db, "fin", turmaId),
    certificadosEmitidosFin(db, turmaId),
    resultadosDaTurma(db, "fin", turmaId),
    moradaDoLocal(db, turma.local),
  ]);
  const hoje = hojeLisboa();
  const sessoes = sessoesComHoras(turma.cronograma, folhas).map(s => {
    const raw = sessaoLectivaN(turma.cronograma, s.n) as { modalidade?: string } | null;
    return { ...s, data: dataIso(s.data), sincrona: sessaoSincrona(raw?.modalidade) };
  });
  const formato = formatoDaTurma(turma.cronograma);
  const temPresencial = sessoes.some(s => !s.sincrona);
  const temSincrona = sessoes.some(s => s.sincrona);
  const datas = sessoes.map(s => s.data).filter(Boolean).sort();
  const comecou = Boolean(datas[0] && datas[0] <= hoje);
  const cpLocal = codigoPostal7(morada);
  const area = turma.c_area_cnaef.trim();
  const acao = cursoAcao(turma);
  const porId = new Map((resultados?.formandos ?? []).map(r => [r.id, r]));
  const certPorId = new Map(certs.map(c => [Number(c.formando_id), c]));

  const linhas: LinhaExecucao[] = formandos.filter(f => !/^indeferid/i.test(f.estado.trim())).map(f => {
    const nome = `${f.nome} ${f.apelido}`.trim();
    const baixo = nome.toLowerCase();
    const acc: Acumulado = { presencial: 0, sincrona: 0, dias: new Set(), diasPresencial: new Set(), diasSincrona: new Set(), primeira: "", ultima: "" };
    for (const s of sessoes) {
      const m = s.marcas.find(x => x.id === f.id)
        ?? (baixo ? s.marcas.find(x => !Number.isFinite(x.id) && (x.nome ?? "").trim().toLowerCase() === baixo) : undefined);
      if (!m) continue;
      const estado = estadoDaMarca(m);
      const horas = estado === "presente" ? s.horas
        : estado === "atraso" ? Math.max(0, s.horas - Math.min(s.horas, (m.minutos ?? 0) / 60)) : 0;
      if (horas <= 0) continue;
      if (s.data) {
        if (!acc.primeira || s.data < acc.primeira) acc.primeira = s.data;
        if (s.data > acc.ultima) acc.ultima = s.data;
        acc.dias.add(s.data);
        (s.sincrona ? acc.diasSincrona : acc.diasPresencial).add(s.data);
      }
      if (s.sincrona) acc.sincrona += horas;
      else acc.presencial += horas;
    }

    const r = porId.get(f.id);
    const cert = certPorId.get(f.id);
    const estado = f.estado.trim();
    const certificado = /^certificad/i.test(estado) || Boolean(cert?.emitido);
    const concluiu = /^conclu/i.test(estado) || Boolean(turma.fechada_em);
    let situacao: string = comecou ? LISTAS_EXECUCAO.situacao.emExecucao : LISTAS_EXECUCAO.situacao.inscrito;
    if (/^desist/i.test(estado)) situacao = LISTAS_EXECUCAO.situacao.desistente;
    else if (certificado) situacao = LISTAS_EXECUCAO.situacao.certificado;
    else if (concluiu) situacao = r?.aprovado === false ? LISTAS_EXECUCAO.situacao.reprovado : LISTAS_EXECUCAO.situacao.aprovado;
    const terminou = situacao !== LISTAS_EXECUCAO.situacao.inscrito && situacao !== LISTAS_EXECUCAO.situacao.emExecucao;
    const inicio = acc.primeira || (comecou ? datas[0]! : "");
    // Quem sai antes do fim (desistente, reprovado) acaba na última presença; os outros no fim da acção.
    const saiuAntes = situacao === LISTAS_EXECUCAO.situacao.desistente || situacao === LISTAS_EXECUCAO.situacao.reprovado;
    const fim = !terminou ? "" : saiuAntes ? (acc.ultima || inicio) : (datas[datas.length - 1] ?? "");

    const d = dadosFinanciamento(f);
    const nif = soDigitos(d.nif);
    const cp = codigoPostal7(d.codigoPostal);
    const telf = (readFormandoPii({ pii_enc: f.pii_enc, telf: f.telf }).telf || f.telf || piiDaInscricao(f).telf || "").trim();
    const inscrito = dataIso(f.inscrito);
    const emitidoEm = cert?.emitido && cert.emitido_em ? dataIso(cert.emitido_em) : "";
    const empregoSaida = d.situacaoEmpregoSaida || d.situacaoEmpregoEntrada;
    const habSaida = d.habilitacoesSaida || d.habilitacoesEntrada;
    const nifEntidade = soDigitos(d.nifEntidadeEmpregadora);
    const comEntidade = d.situacaoEmpregoEntrada === EMPREGADOS && nifEntidade.length === 9;

    const valores: Record<string, ValorCelula> = {
      A: LISTAS_EXECUCAO.gestaoRegisto,
      C: LISTAS_EXECUCAO.atividade,
      D: area || null,
      E: acao || null,
      F: nif.length === 9 ? Number(nif) : null,
      G: numeroOuTexto(soDigitos(d.niss)),
      H: d.protecaoInternacional || null,
      I: d.autorizacaoResidencia || null,
      J: d.passaporte || null,
      K: d.tipoAutorizacaoResidencia || null,
      L: d.dataNascimento ? { data: d.dataNascimento } : null,
      M: nome,
      N: d.genero || null,
      O: d.nacionalidade || null,
      P: cp || null,
      Q: telefone(telf),
      R: f.email.trim(),
      S: inicio ? { data: inicio } : null,
      T: fim ? { data: fim } : null,
      U: situacao,
      V: d.situacaoEmpregoEntrada || null,
      // «À saída» e «após» só quando a participação acabou; por omissão, iguais à entrada.
      W: terminou ? empregoSaida || null : null,
      Z: d.habilitacoesEntrada || null,
      AA: terminou ? habSaida || null : null,
      AB: qnqDasHabilitacoes(d.habilitacoesEntrada) || null,
      AC: terminou ? qnqDasHabilitacoes(habSaida) || null : null,
      AD: terminou ? (d.procuraEmpregoApos || procuraEmpregoPorOmissao(empregoSaida)) || null : null,
      AE: d.estudaEntrada || NAO,
      AF: terminou ? d.estudaApos || NAO : null,
      AG: numeroOuTexto(soDigitos(d.numeroSigo)),
      AH: f.id,
      AQ: comEntidade ? LISTAS_EXECUCAO.entidadeEmpregadora : null,
      AR: comEntidade ? Number(nifEntidade) : null,
      AV: comEntidade ? LISTAS_EXECUCAO.paisPortugal : null,
      AY: cpLocal,
      AZ: LISTAS_EXECUCAO.paisPortugal,
      CA: inscrito ? { data: inscrito } : null,
      CG: emitidoEm ? { data: emitidoEm } : null,
    };
    // Horas e dias: depois de a acção começar, todas as colunas da forma da turma levam número (0 sem presenças).
    if (comecou) {
      const total = r2(acc.presencial + acc.sincrona);
      const dias = acc.dias.size;
      Object.assign(valores, { BA: total, BB: total, BN: dias, BO: dias });
      if (formato === "e-learning") Object.assign(valores, { BF: total, BS: dias });
      if (formato === "b-learning") Object.assign(valores, { BG: total, BT: dias });
      if (temPresencial) Object.assign(valores, { BH: r2(acc.presencial), BU: acc.diasPresencial.size });
      if (temSincrona) Object.assign(valores, { BJ: r2(acc.sincrona), BW: acc.diasSincrona.size });
    }

    const falta: string[] = [];
    if (nif.length !== 9) falta.push(FALTA.nif);
    if (!soDigitos(d.niss)) falta.push(FALTA.niss);
    if (!d.dataNascimento) falta.push(FALTA.dataNascimento);
    if (!d.genero) falta.push(FALTA.genero);
    if (!d.nacionalidade) falta.push(FALTA.nacionalidade);
    if (faltaDocumentoEstrangeiro(d)) falta.push(FALTA.documentoEstrangeiro);
    if (!cp) falta.push(FALTA.codigoPostal);
    if (!telf) falta.push(FALTA.telefone);
    if (!f.email.trim()) falta.push(FALTA.email);
    if (!inscrito) falta.push(FALTA.inscricao);
    if (!d.situacaoEmpregoEntrada) falta.push(FALTA.situacaoEmprego);
    if (!d.habilitacoesEntrada) falta.push(FALTA.habilitacoes);
    if (!soDigitos(d.numeroSigo)) falta.push(FALTA.numeroSigo);
    if (d.situacaoEmpregoEntrada === EMPREGADOS && nifEntidade.length !== 9) falta.push(FALTA.nifEntidade);
    return { formandoId: f.id, nome, valores, falta };
  });

  const faltaTurma: string[] = [];
  if (!area) faltaTurma.push("Área de formação CNAEF do curso");
  if (!acao) faltaTurma.push("Código UFCD do curso");

  const impressao = createHash("sha256")
    .update(JSON.stringify({ v: 2, linhas: linhas.map(l => l.valores) }))
    .digest("hex");
  return { turma, linhas, impressao, semLocal: !cpLocal, faltaTurma };
}

/** O modelo oficial com as linhas escritas (o resto do ficheiro fica igual). */
export function xlsxExecucaoFisica(linhas: LinhaExecucao[]) {
  const { entradas, folha } = lerModelo();
  const nova = preencherFolha(folha, linhas.map(l => l.valores), { primeira: 3, limparAte: ULTIMA_LINHA_MODELO, limpar: ["A"] });
  return escreverZip(entradas.map(e => (e.nome === FOLHA ? { ...e, novo: Buffer.from(nova, "utf8") } : e)));
}

/** Resumo do que falta, para o ecrã: por campo, quantos formandos; a lista por formando; e o que falta à turma. */
export function emFaltaExecucao(linhas: LinhaExecucao[], faltaTurma: string[] = []) {
  const porCampo = new Map<string, number>();
  for (const l of linhas) for (const c of l.falta) porCampo.set(c, (porCampo.get(c) ?? 0) + 1);
  return {
    formandos: linhas.length,
    porCampo: [...porCampo.entries()].map(([campo, formandos]) => ({ campo, formandos })),
    porFormando: linhas.filter(l => l.falta.length).map(l => ({ id: l.formandoId, nome: l.nome, falta: l.falta })),
    turma: faltaTurma,
  };
}
