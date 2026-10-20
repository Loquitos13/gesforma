/**
 * Despesas automáticas dos formadores (Financiada). Cada formador da turma com horas no cronograma e valor por
 * hora (o da visão geral da turma ou, vazio, o custo por hora da ficha) tem uma linha nas despesas da turma:
 * fornecedor = o formador (nome e NIF da ficha), quantidade = horas, custo unitário = €/h, total = horas × €/h.
 *
 * Só esses campos (CAMPOS_DESPESA_FORMADOR) acompanham a turma; os da equipa (categoria, documento, pagamento,
 * imputado, elegível, …) nunca se sobrepõem. Quando o formador sai da turma, fica sem horas ou sem valor, a linha
 * apaga-se se a equipa ainda não lhe preencheu nada; se já preencheu, fica com um aviso.
 *
 * Sincroniza-se na mesma transacção das escritas que mudam estes valores (turma, cronograma) e, à parte, quando a
 * ficha do formador muda, e ainda sempre que a lista ou o ficheiro de despesas da turma se pedem (rede de segurança).
 */
import { CAMPOS_DESPESA, CAMPOS_DESPESA_FORMADOR, temCamposDaEquipa, type DadosDespesa } from "../../src/partilhado/despesas.js";
import { arred2, custosFormadores, nomesFormadoresTurma, type LinhaCustoFormador } from "../../src/partilhado/custoFormadores.js";
import { rotuloCodigoCurso } from "../../src/partilhado/codigoCurso.js";
import type { Db } from "./db/pool.js";
import * as repo from "./repos/despesas.js";
import type { Consulta } from "./repos/sql.js";

export const AVISO_SAIU = "O formador já não está na turma.";
export const AVISO_SEM_HORAS = "O formador já não tem horas no cronograma desta turma.";
export const AVISO_SEM_VALOR = "Sem valor por hora (nem na visão geral da turma, nem na ficha do formador).";

const decimal = (n: number, casas: number) =>
  n.toLocaleString("pt-PT", { minimumFractionDigits: casas, maximumFractionDigits: 2, useGrouping: false });

/** NIF português da ficha (9 dígitos, sem espaços nem «PT»); outro formato fica em branco para não falhar a validação. */
function nifDaFicha(nif: string) {
  const s = nif.replace(/\s/g, "").replace(/^PT/i, "");
  return /^\d{9}$/.test(s) ? s : "";
}

type TurmaDesc = { nome: string; curso: string; ufcd_cod: string };

export function descricaoDespesaFormador(t: TurmaDesc, l: Pick<LinhaCustoFormador, "horas" | "valorHora">) {
  const curso = [rotuloCodigoCurso(t.ufcd_cod), t.curso.trim()].filter(Boolean).join(" ");
  return [`Formação`, curso, `turma ${t.nome}`, `${decimal(l.horas, 0)} h × ${decimal(l.valorHora, 2)} €/h`]
    .filter(Boolean).join(" — ");
}

/** Os campos que acompanham a turma e a ficha. */
function camposSincronizados(t: TurmaDesc, l: LinhaCustoFormador, ficha: { nome: string; nif: string } | undefined): DadosDespesa {
  return {
    nomeFornecedor: ficha?.nome.trim() || l.nome,
    nifFornecedor: nifDaFicha(ficha?.nif ?? ""),
    nifFornecedorEstrangeiro: "Não",
    paisFornecedor: "Portugal",
    descricao: descricaoDespesaFormador(t, l),
    quantidade: l.horas,
    custoUnitario: arred2(l.valorHora),
    totalDocDespesa: l.total,
  };
}

const vazia = (): DadosDespesa =>
  Object.fromEntries(CAMPOS_DESPESA.map(c => [c.chave, c.tipo === "numero" || c.tipo === "euros" ? null : ""]));

const mudou = (antes: Record<string, unknown>, sinc: DadosDespesa) =>
  CAMPOS_DESPESA_FORMADOR.some(k => (antes[k] ?? null) !== (sinc[k] ?? null));

const mapaValores = (v: unknown): Record<string, number> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof x === "number" ? x : Number(x);
    if (x !== null && x !== "" && Number.isFinite(n)) out[k] = n;
  }
  return out;
};

/**
 * Põe as despesas automáticas da turma em dia. Chamar dentro de `db.tx` (com o `q` da transacção) ou com o `db`.
 * `soAberta`: não mexe numa turma fechada (só uma alteração explícita da turma o faz). Devolve se mudou alguma linha.
 */
export async function sincronizarDespesasFormador(c: Consulta, turmaId: number, opts: { soAberta?: boolean } = {}) {
  const t = await repo.turmaParaDespesasFormador(c, turmaId);
  if (!t || (opts.soAberta && t.fechada_em)) return false;
  const turma = {
    formador: t.formador,
    formadores: Array.isArray(t.formadores) ? t.formadores : [],
    cronograma: t.cronograma,
    valoresHoraFormador: mapaValores(t.valores_hora_formador),
  };
  const presentes = nomesFormadoresTurma(turma);
  const existentes = await repo.despesasFormadorDaTurma(c, turmaId);
  if (!presentes.length && !existentes.length) return false;

  const fichas = new Map<string, { nome: string; nif: string; custo: number }>();
  for (const f of await repo.fichasDosFormadores(c, presentes)) {
    const k = f.nome.trim().toLowerCase();
    if (!fichas.has(k)) fichas.set(k, { nome: f.nome, nif: f.nif, custo: Number(f.custo_hora ?? 0) || 0 });
  }
  const linhas = custosFormadores(turma, nome => fichas.get(nome.toLowerCase())?.custo ?? 0);
  const porNome = new Map(existentes.map(e => [String(e.formador ?? "").trim().toLowerCase(), e]));
  let alterou = false;

  for (const l of linhas) {
    const k = l.nome.toLowerCase();
    const e = porNome.get(k);
    if (l.horas <= 0 || l.valorHora <= 0) continue;
    porNome.delete(k);
    const sinc = camposSincronizados(t, l, fichas.get(k));
    if (!e) {
      if (await repo.criarDespesaFormador(c, turmaId, l.nome, { ...vazia(), ...sinc })) alterou = true;
      continue;
    }
    if (mudou(e.dados, sinc) || e.aviso || e.formador !== l.nome) {
      await repo.actualizarDespesaFormador(c, e.id, l.nome, { ...e.dados, ...sinc }, "");
      alterou = true;
    }
  }

  // Linhas sem formador válido nesta turma: apagam-se se a equipa não lhes mexeu; senão ficam com o aviso.
  const linhaDe = new Map(linhas.map(l => [l.nome.toLowerCase(), l]));
  for (const [k, e] of porNome) {
    const l = linhaDe.get(k);
    const aviso = !l ? AVISO_SAIU : l.horas <= 0 ? AVISO_SEM_HORAS : AVISO_SEM_VALOR;
    if (!temCamposDaEquipa(e.dados)) {
      await repo.apagarDespesa(c, e.id);
      alterou = true;
    } else if (e.aviso !== aviso) {
      await repo.marcarDespesaFormador(c, e.id, aviso);
      alterou = true;
    }
  }
  return alterou;
}

/** O mesmo, numa transacção própria. */
export function sincronizarDespesasDaTurma(db: Db, turmaId: number, opts: { soAberta?: boolean } = {}) {
  return db.tx(q => sincronizarDespesasFormador(q, turmaId, opts));
}

/** A ficha do formador mudou (custo por hora, NIF ou nome): as turmas abertas onde ele está acompanham-na. */
export async function sincronizarTurmasDoFormador(db: Db, nome: string) {
  const mudaram: number[] = [];
  if (!nome.trim()) return mudaram;
  for (const { id } of await repo.turmasAbertasDoFormador(db, nome)) {
    if (await sincronizarDespesasDaTurma(db, Number(id), { soAberta: true })) mudaram.push(Number(id));
  }
  return mudaram;
}

/**
 * Antes de apagar a turma: as linhas automáticas sem nada da equipa saem; as que a equipa já preencheu ficam
 * (sem turma, como as despesas antigas) e passam a despesas normais.
 */
export async function largarDespesasFormadorDaTurma(c: Consulta, turmaId: number) {
  for (const e of await repo.despesasFormadorDaTurma(c, turmaId)) {
    if (temCamposDaEquipa(e.dados)) await repo.tornarDespesaManual(c, e.id);
    else await repo.apagarDespesa(c, e.id);
  }
}
