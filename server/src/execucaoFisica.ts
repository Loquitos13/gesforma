/**
 * Template de execução física (participantes) da Financiada, preenchido pela plataforma: uma linha por
 * formando da turma, a partir da linha 3 da folha «Template», com o que o GesForma já sabe. O resto fica
 * em branco para a equipa completar. O modelo oficial (server/src/modelos/execucao-fisica.xlsx) é editado
 * no lugar (xlsxModelo.ts): as listas das folhas escondidas «Referencias» e «TD» e as validações ficam.
 *
 * Os valores das colunas com lista são exactamente os da folha TD (coluna C, «n - descrição»).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { estadoDaMarca, sessoesComHoras } from "./assiduidade.js";
import { hojeLisboa } from "./datas.js";
import type { Db } from "./db/pool.js";
import { readFormandoPii, readPreinscricaoPii } from "./pii.js";
import { folhasDePresenca } from "./repos/resultados.js";
import { certificadosEmitidosFin, formandosExecucao, moradaDoLocal, turmaReembolso, type FormandoExecucao } from "./repos/reembolso.js";
import { resultadosDaTurma } from "./resultados.js";
import { sessaoLectivaN } from "./sessaoAcesso.js";
import { conteudoZip, escreverZip, lerZip, preencherFolha, type ValorCelula } from "./xlsxModelo.js";

/** Valores das listas do modelo (folha TD) usados pela plataforma. */
export const LISTAS_EXECUCAO = {
  gestaoRegisto: "Inserir",
  situacao: {
    inscrito: "1 - Inscrito",
    emExecucao: "2 - Em Execução",
    desistente: "5 - Desistente",
    reprovado: "6 - Reprovado",
    aprovado: "7 - Aprovado/Concluido",
    certificado: "13 - Certificado",
  },
  paisPortugal: "191 - Portugal",
} as const;

/**
 * Colunas que o GesForma ainda não recolhe (ficam em branco em todas as linhas). Para a equipa saber o
 * que tem de completar antes de submeter.
 */
export const CAMPOS_NAO_RECOLHIDOS = [
  "NISS", "Data de nascimento", "Género", "Nacionalidade", "Habilitações literárias", "Situação face ao emprego",
];

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
  /** Dados que a plataforma podia ter e ainda não tem para este formando. */
  falta: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const so = (v: number) => (v > 0 ? r2(v) : null);
const dataIso = (s: string) => /^(\d{4}-\d{2}-\d{2})/.exec(s.trim())?.[1]
  ?? (/^(\d{2})\/(\d{2})\/(\d{4})/.exec(s.trim())?.slice(1).reverse().join("-") ?? "");

function minutos(h?: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(h ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Pós-laboral: a sessão começa às 18:00 ou depois, ou é ao sábado ou ao domingo. */
export function sessaoPosLaboral(data: string, horaInicio?: string) {
  const ini = minutos(horaInicio);
  if (ini != null && ini >= 18 * 60) return true;
  const iso = dataIso(data);
  if (!iso) return false;
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return dia === 0 || dia === 6;
}

/** NIF, código postal e telefone da pré-inscrição (cifrados, ou nas colunas antigas). */
function piiDaInscricao(f: FormandoExecucao) {
  return readPreinscricaoPii({ pii_enc: f.p_pii_enc, nif: f.p_nif, codigo_postal: f.p_codigo_postal, telf: f.p_telf });
}

function codigoPostal7(s: string) {
  const m = /(\d{4})\s*-?\s*(\d{3})/.exec(s);
  return m ? `${m[1]}-${m[2]}` : "";
}

type Acumulado = { horas: Record<string, number>; dias: Record<string, Set<string>>; primeira: string; ultima: string };

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
    const raw = sessaoLectivaN(turma.cronograma, s.n) as { modalidade?: string; horaInicio?: string } | null;
    return { ...s, data: dataIso(s.data), sincrona: raw?.modalidade === "sincrona", pos: sessaoPosLaboral(s.data, raw?.horaInicio) };
  });
  const datas = sessoes.map(s => s.data).filter(Boolean).sort();
  const comecou = Boolean(datas[0] && datas[0] <= hoje);
  const cpLocal = codigoPostal7(morada);
  const porId = new Map((resultados?.formandos ?? []).map(r => [r.id, r]));
  const certPorId = new Map(certs.map(c => [Number(c.formando_id), c]));

  const linhas: LinhaExecucao[] = formandos.filter(f => !/^indeferid/i.test(f.estado.trim())).map(f => {
    const nome = `${f.nome} ${f.apelido}`.trim();
    const baixo = nome.toLowerCase();
    const acc: Acumulado = { horas: {}, dias: {}, primeira: "", ultima: "" };
    const somar = (col: string, diaCol: string, horas: number, data: string) => {
      acc.horas[col] = (acc.horas[col] ?? 0) + horas;
      if (data) (acc.dias[diaCol] ??= new Set()).add(data);
    };
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
      }
      if (s.sincrona) {
        somar("BI", "BV", horas, s.data); // online (presencial)
        somar("BJ", "BW", horas, s.data); // síncronas
      } else {
        somar("BA", "BN", horas, s.data); // sala
        somar("BH", "BU", horas, s.data); // presencial
      }
      if (s.pos) somar("BM", "BZ", horas, s.data);
      else somar("BL", "BY", horas, s.data);
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
    const fim = situacao === LISTAS_EXECUCAO.situacao.desistente ? acc.ultima : terminou ? (datas[datas.length - 1] ?? "") : "";

    const pre = piiDaInscricao(f);
    const nif = (pre.nif ?? "").replace(/\D/g, "");
    const cp = codigoPostal7(pre.codigoPostal ?? "");
    const telf = (readFormandoPii({ pii_enc: f.pii_enc, telf: f.telf }).telf || f.telf || pre.telf || "").replace(/\s+/g, "");
    const inscrito = dataIso(f.inscrito);
    const emitidoEm = cert?.emitido && cert.emitido_em ? dataIso(cert.emitido_em) : "";

    const valores: Record<string, ValorCelula> = {
      A: LISTAS_EXECUCAO.gestaoRegisto,
      F: nif.length === 9 ? Number(nif) : null,
      M: nome,
      P: cp ? Number(cp.replace("-", "")) : null,
      Q: telf,
      R: f.email.trim(),
      S: inicio ? { data: inicio } : null,
      T: fim ? { data: fim } : null,
      U: situacao,
      AH: f.id,
      AY: cpLocal,
      AZ: LISTAS_EXECUCAO.paisPortugal,
      CA: inscrito ? { data: inscrito } : null,
      CG: emitidoEm ? { data: emitidoEm } : null,
    };
    for (const [col, h] of Object.entries(acc.horas)) valores[col] = so(h);
    for (const [col, d] of Object.entries(acc.dias)) valores[col] = d.size || null;

    const falta: string[] = [];
    if (nif.length !== 9) falta.push("NIF");
    if (!cp) falta.push("Código postal");
    if (!telf) falta.push("Telefone");
    if (!f.email.trim()) falta.push("E-mail");
    if (!inscrito) falta.push("Data de inscrição");
    return { formandoId: f.id, nome, valores, falta };
  });

  const impressao = createHash("sha256")
    .update(JSON.stringify({ v: 1, linhas: linhas.map(l => l.valores) }))
    .digest("hex");
  return { turma, linhas, impressao, semLocal: !cpLocal };
}

/** O modelo oficial com as linhas escritas (o resto do ficheiro fica igual). */
export function xlsxExecucaoFisica(linhas: LinhaExecucao[]) {
  const { entradas, folha } = lerModelo();
  const nova = preencherFolha(folha, linhas.map(l => l.valores), { primeira: 3, limparAte: ULTIMA_LINHA_MODELO, limpar: ["A"] });
  return escreverZip(entradas.map(e => (e.nome === FOLHA ? { ...e, novo: Buffer.from(nova, "utf8") } : e)));
}

/** Resumo do que falta, para o ecrã: por campo, quantos formandos; e a lista por formando. */
export function emFaltaExecucao(linhas: LinhaExecucao[]) {
  const porCampo = new Map<string, number>();
  for (const l of linhas) for (const c of l.falta) porCampo.set(c, (porCampo.get(c) ?? 0) + 1);
  return {
    formandos: linhas.length,
    porCampo: [...porCampo.entries()].map(([campo, formandos]) => ({ campo, formandos })),
    porFormando: linhas.filter(l => l.falta.length).map(l => ({ id: l.formandoId, nome: l.nome, falta: l.falta })),
    naoRecolhidos: CAMPOS_NAO_RECOLHIDOS,
  };
}
