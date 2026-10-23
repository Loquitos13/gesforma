/** Dados do formando da Financiada para o financiamento (execução física): a tabela própria e o pacote PII. */
import { many, one, type Consulta } from "./sql.js";

export type LinhaFinanciamento = {
  genero: string; nacionalidade: string; situacao_emprego_entrada: string; situacao_emprego_saida: string;
  habilitacoes_entrada: string; habilitacoes_saida: string; procura_emprego_apos: string; estuda_entrada: string;
  estuda_apos: string; numero_sigo: string; nif_entidade_empregadora: string;
};

/** Colunas da tabela ↔ campos (DadosFinanciamento). */
export const COLUNAS_FINANCIAMENTO = {
  genero: "genero",
  nacionalidade: "nacionalidade",
  situacaoEmpregoEntrada: "situacao_emprego_entrada",
  situacaoEmpregoSaida: "situacao_emprego_saida",
  habilitacoesEntrada: "habilitacoes_entrada",
  habilitacoesSaida: "habilitacoes_saida",
  procuraEmpregoApos: "procura_emprego_apos",
  estudaEntrada: "estuda_entrada",
  estudaApos: "estuda_apos",
  numeroSigo: "numero_sigo",
  nifEntidadeEmpregadora: "nif_entidade_empregadora",
} as const satisfies Record<string, keyof LinhaFinanciamento>;

export type CampoTabela = keyof typeof COLUNAS_FINANCIAMENTO;

const LISTA_COLUNAS = Object.values(COLUNAS_FINANCIAMENTO).join(", ");

export function financiamentoDoFormando(c: Consulta, formandoId: number) {
  return one<LinhaFinanciamento>(c, `SELECT ${LISTA_COLUNAS} FROM formando_fin_financiamento WHERE formando_id = $1`, [formandoId]);
}

/** A ficha da Financiada (pacote PII, telefone em claro antigo e pré-inscrição do mesmo email, para NIF e código postal). */
export function fichaFinParaFinanciamento(c: Consulta, formandoId: number) {
  return one<{ id: number; email: string; telf: string; pii_enc: string; p_nif: string; p_codigo_postal: string; p_telf: string; p_pii_enc: string }>(
    c,
    `SELECT f.id, f.email, COALESCE(f.telf, '') AS telf, COALESCE(f.pii_enc, '') AS pii_enc,
            COALESCE(p.nif, '') AS p_nif, COALESCE(p.codigo_postal, '') AS p_codigo_postal, COALESCE(p.telf, '') AS p_telf,
            COALESCE(p.pii_enc, '') AS p_pii_enc
       FROM formandos_fin f
       LEFT JOIN LATERAL (
         SELECT nif, codigo_postal, telf, pii_enc FROM preinscricoes
          WHERE f.email <> '' AND lower(trim(email)) = lower(trim(f.email))
          ORDER BY (regime = 'fin') DESC, id DESC LIMIT 1
       ) p ON true
      WHERE f.id = $1`,
    [formandoId],
  );
}

/** Grava os campos da tabela que vierem (os outros ficam). */
export async function gravarFinanciamento(c: Consulta, formandoId: number, campos: Partial<Record<CampoTabela, string>>, actorId: string | null) {
  const entradas = Object.entries(campos).filter(([k]) => k in COLUNAS_FINANCIAMENTO) as [CampoTabela, string][];
  const cols = entradas.map(([k]) => COLUNAS_FINANCIAMENTO[k]);
  const vals = entradas.map(([, v]) => v);
  const ins = cols.map((_, i) => `$${i + 3}`);
  const set = cols.map(col => `${col} = EXCLUDED.${col}`);
  await many(
    c,
    `INSERT INTO formando_fin_financiamento (formando_id, updated_by${cols.map(col => `, ${col}`).join("")}, updated_at)
     VALUES ($1, $2${ins.map(x => `, ${x}`).join("")}, now())
     ON CONFLICT (formando_id) DO UPDATE SET updated_at = now(), updated_by = EXCLUDED.updated_by${set.map(x => `, ${x}`).join("")}`,
    [formandoId, actorId, ...vals],
  );
}

/** Grava o pacote PII da ficha (e limpa o telefone em claro antigo, que passa para o pacote). */
export async function gravarPiiFormandoFin(c: Consulta, formandoId: number, pack: { telf: string; pii_enc: string | null }) {
  await many(c, "UPDATE formandos_fin SET telf = $2, pii_enc = $3 WHERE id = $1", [formandoId, pack.telf, pack.pii_enc ?? ""]);
}

/**
 * O pacote PII da ficha, bloqueado até ao fim da transacção (chamar dentro de `db.tx`): quem grava junta as suas
 * alterações a esta cópia, e duas gravações seguidas não se apagam uma à outra.
 */
export function piiFormandoFinParaGravar(c: Consulta, formandoId: number) {
  return one<{ telf: string; pii_enc: string }>(
    c,
    "SELECT COALESCE(telf, '') AS telf, COALESCE(pii_enc, '') AS pii_enc FROM formandos_fin WHERE id = $1 FOR UPDATE",
    [formandoId],
  );
}
