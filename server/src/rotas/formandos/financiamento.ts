/**
 * Ficha da Financiada › Dados para o financiamento: o que a execução física pede de cada formando (NISS, data de
 * nascimento, género, nacionalidade, documentos de estrangeiro, situação face ao emprego, habilitações, número
 * SIGO, entidade empregadora…). Só a equipa da Financiada (regras de /v1/formandos-fin*: admin, secretaria,
 * financiada) lê e altera; o comercial e o formador ficam de fora.
 *
 * Os identificadores pessoais vão para o pacote cifrado da ficha (pii_enc); o resto para formando_fin_financiamento.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CAMPOS_FINANCIAMENTO_CIFRADOS, FINANCIAMENTO_VAZIO, LISTAS_FINANCIAMENTO, type DadosFinanciamento,
} from "../../../../src/partilhado/execucaoFisica.js";
import { TIPOS_DOCUMENTO_FIN } from "../../../../src/partilhado/dadosPessoaisFin.js";
import { hojeLisboa } from "../../datas.js";
import { readFormandoPii, readPreinscricaoPii, writeFormandoPiiPatch, type IdentificacaoFin } from "../../pii.js";
import {
  COLUNAS_FINANCIAMENTO, fichaFinParaFinanciamento, financiamentoDoFormando, gravarFinanciamento, gravarPiiFormandoFin, type CampoTabela,
} from "../../repos/formandoFinanciamento.js";
import { idParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";

const vazioOu = <T extends z.ZodTypeAny>(s: T) => z.union([z.literal(""), s]);
const lista = (valores: readonly string[]) => vazioOu(z.string().refine(v => valores.includes(v), "Valor fora da lista do template."));
const digitos = (min: number, max: number, msg: string) => vazioOu(z.string().regex(new RegExp(`^\\d{${min},${max}}$`), msg));
const documento = z.string().trim().max(40);

/** Data de nascimento: AAAA-MM-DD, depois de 1900 e antes de hoje. */
const dataNascimento = vazioOu(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).").refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= "1900-01-01" && v < hojeLisboa();
}, "Data de nascimento inválida."));

const corpo = z.object({
  nif: digitos(9, 9, "O NIF tem 9 dígitos."),
  niss: digitos(9, 13, "O NISS tem só dígitos (normalmente 11)."),
  dataNascimento,
  codigoPostal: vazioOu(z.string().regex(/^\d{4}-\d{3}$/, "Código postal no formato 0000-000.")),
  protecaoInternacional: documento,
  autorizacaoResidencia: documento,
  tipoAutorizacaoResidencia: z.string().trim().max(80),
  passaporte: documento,
  tipoDocumento: vazioOu(z.enum(TIPOS_DOCUMENTO_FIN)),
  numeroDocumento: vazioOu(z.string().regex(/^[A-Z0-9]{6,12}$/, "N.º do documento: 6 a 12 letras e dígitos, sem espaços.")),
  validadeDocumento: vazioOu(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).")),
  genero: lista(LISTAS_FINANCIAMENTO.genero),
  nacionalidade: lista(LISTAS_FINANCIAMENTO.nacionalidade),
  situacaoEmpregoEntrada: lista(LISTAS_FINANCIAMENTO.situacaoEmpregoEntrada),
  situacaoEmpregoSaida: lista(LISTAS_FINANCIAMENTO.situacaoEmpregoSaida),
  habilitacoesEntrada: lista(LISTAS_FINANCIAMENTO.habilitacoesEntrada),
  habilitacoesSaida: lista(LISTAS_FINANCIAMENTO.habilitacoesSaida),
  procuraEmpregoApos: lista(LISTAS_FINANCIAMENTO.procuraEmpregoApos),
  estudaEntrada: lista(LISTAS_FINANCIAMENTO.estudaEntrada),
  estudaApos: lista(LISTAS_FINANCIAMENTO.estudaApos),
  numeroSigo: digitos(1, 12, "O número SIGO tem só dígitos."),
  nifEntidadeEmpregadora: digitos(9, 9, "O NIF da entidade empregadora tem 9 dígitos."),
}).partial().strict();

/** Os dados gravados; NIF e código postal, se a ficha ainda não os tem, vêm da pré-inscrição. */
export async function lerFinanciamento(db: Deps["db"], formandoId: number) {
  const ficha = await fichaFinParaFinanciamento(db, formandoId);
  if (!ficha) return null;
  const ident = readFormandoPii({ pii_enc: ficha.pii_enc, telf: ficha.telf }).ident ?? {};
  const pre = readPreinscricaoPii({ pii_enc: ficha.p_pii_enc, nif: ficha.p_nif, codigo_postal: ficha.p_codigo_postal, telf: ficha.p_telf });
  const linha = await financiamentoDoFormando(db, formandoId);
  const dados: DadosFinanciamento = { ...FINANCIAMENTO_VAZIO };
  for (const k of CAMPOS_FINANCIAMENTO_CIFRADOS) dados[k] = String(ident[k] ?? "");
  for (const [k, col] of Object.entries(COLUNAS_FINANCIAMENTO) as [CampoTabela, keyof NonNullable<typeof linha>][]) {
    dados[k] = linha ? String(linha[col] ?? "") : "";
  }
  const nifPre = (pre.nif ?? "").replace(/\D/g, "");
  const cpPre = /(\d{4})\s*-?\s*(\d{3})/.exec(pre.codigoPostal ?? "");
  const daInscricao: (keyof DadosFinanciamento)[] = [];
  if (!dados.nif && nifPre.length === 9) { dados.nif = nifPre; daInscricao.push("nif"); }
  if (!dados.codigoPostal && cpPre) { dados.codigoPostal = `${cpPre[1]}-${cpPre[2]}`; daInscricao.push("codigoPostal"); }
  return { dados, daInscricao };
}

export function registarFinanciamento(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/formandos-fin/:id/financiamento", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const r = await lerFinanciamento(db, v.params.id);
    if (!r) return reply.code(404).send({ error: "formando inexistente" });
    return r;
  });

  app.patch("/v1/formandos-fin/:id/financiamento", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: corpo }, req);
    if (!v) return;
    const id = v.params.id;
    const ficha = await fichaFinParaFinanciamento(db, id);
    if (!ficha) return reply.code(404).send({ error: "formando inexistente" });
    const d = v.body as Partial<DadosFinanciamento>;
    const cifrados = CAMPOS_FINANCIAMENTO_CIFRADOS.filter(k => d[k] !== undefined);
    const tabela = (Object.keys(COLUNAS_FINANCIAMENTO) as CampoTabela[]).filter(k => d[k] !== undefined);
    await db.tx(async q => {
      if (cifrados.length) {
        const prev = readFormandoPii({ pii_enc: ficha.pii_enc, telf: ficha.telf });
        const ident: IdentificacaoFin = { ...prev.ident };
        for (const k of cifrados) ident[k] = String(d[k] ?? "").trim();
        await gravarPiiFormandoFin(q, id, writeFormandoPiiPatch({ ident }, prev));
      }
      if (tabela.length) {
        await gravarFinanciamento(q, id, Object.fromEntries(tabela.map(k => [k, String(d[k] ?? "").trim()])), req.actor!.id ?? null);
      }
    });
    // Só os nomes dos campos: os valores (NISS, documentos…) nunca vão para o registo.
    if (cifrados.length || tabela.length) {
      await audit(db, req.actor!.id, "formando.financiamento", "formandos_fin", String(id), req.ip, { campos: [...cifrados, ...tabela] });
    }
    return lerFinanciamento(db, id);
  });
}
