// Ficha da Financiada › Dados para o financiamento: o que a execução física (modelo oficial do reembolso) pede de
// cada formando. Os seletores têm exactamente os valores das listas do template; NIF, NISS, data de nascimento,
// código postal, documento de identificação e documentos ficam cifrados no servidor.
import { useEffect, useMemo, useState } from "react";
import {
  apiAlterarFinanciamentoFormando, apiFinanciamentoFormando,
} from "../../../partilhado/api/formandos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  EMPREGADOS, FINANCIAMENTO_VAZIO, LISTAS_FINANCIAMENTO, PAIS_PORTUGAL, ROTULOS_FINANCIAMENTO, faltaDocumentoEstrangeiro,
  procuraEmpregoPorOmissao, qnqDasHabilitacoes, type DadosFinanciamento,
} from "../../../partilhado/execucaoFisica";
import { SearchSelect } from "../../../partilhado/FormKit";
import { TIPOS_DOCUMENTO_FIN } from "../../../partilhado/dadosPessoaisFin";
import { Aviso, Botao, Campo, Cartao, Entrada, ErroCarregar, Esqueleto, Selecao } from "../../../partilhado/ui";
import { hojeLisboa } from "../../datas";

type Chave = keyof DadosFinanciamento;

const opcoes = (l: readonly string[]) => l.map(v => ({ valor: v, rotulo: v }));

/** Erros de formato (o servidor valida o mesmo). */
function erros(d: DadosFinanciamento): Partial<Record<Chave, string>> {
  const e: Partial<Record<Chave, string>> = {};
  if (d.nif && !/^\d{9}$/.test(d.nif)) e.nif = "O NIF tem 9 dígitos.";
  if (d.niss && !/^\d{9,13}$/.test(d.niss)) e.niss = "Só dígitos (normalmente 11).";
  if (d.codigoPostal && !/^\d{4}-\d{3}$/.test(d.codigoPostal)) e.codigoPostal = "Formato 0000-000.";
  if (d.dataNascimento && (d.dataNascimento < "1900-01-01" || d.dataNascimento >= hojeLisboa())) e.dataNascimento = "Data inválida.";
  if (d.numeroSigo && !/^\d{1,12}$/.test(d.numeroSigo)) e.numeroSigo = "Só dígitos.";
  if (d.numeroDocumento && !/^[A-Z0-9]{6,12}$/.test(d.numeroDocumento)) e.numeroDocumento = "6 a 12 letras e dígitos.";
  if (d.validadeDocumento && d.validadeDocumento < hojeLisboa()) e.validadeDocumento = "Fora da validade.";
  if (d.nifEntidadeEmpregadora && !/^\d{9}$/.test(d.nifEntidadeEmpregadora)) e.nifEntidadeEmpregadora = "O NIF tem 9 dígitos.";
  return e;
}

export function SeparadorFinanciamento({ formandoId, podeEditar }: { formandoId: number; podeEditar: boolean }) {
  const chave = `formandos:financiamento:${formandoId}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, s => apiFinanciamentoFormando(formandoId, s));
  const [form, setForm] = useState<DadosFinanciamento>(FINANCIAMENTO_VAZIO);
  const gravar = useAccao(
    (corpo: Partial<DadosFinanciamento>) => apiAlterarFinanciamentoFormando(formandoId, corpo),
    { invalidar: [chave, "despesas:reembolso:", "formandos:ficha:"], ok: "Dados para o financiamento gravados." },
  );
  useEffect(() => { if (dados) setForm(dados.dados); }, [dados]);

  const alterados = useMemo(() => {
    if (!dados) return {} as Partial<DadosFinanciamento>;
    const base = dados.dados;
    const out: Partial<DadosFinanciamento> = {};
    for (const k of Object.keys(form) as Chave[]) {
      // O que vem da pré-inscrição grava-se na ficha mesmo sem mudar.
      if (form[k] !== base[k] || (dados.daInscricao.includes(k) && form[k])) out[k] = form[k];
    }
    return out;
  }, [form, dados]);
  const errosForm = erros(form);
  const temErros = Object.keys(errosForm).length > 0;
  const mudou = Boolean(dados) && (Object.keys(form) as Chave[]).some(k => form[k] !== dados!.dados[k]);

  if (erro != null && !dados) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <div aria-busy={aCarregar}><Esqueleto linhas={8} altura="h-9" /></div>;

  const mudar = (p: Partial<DadosFinanciamento>) => setForm(f => ({ ...f, ...p }));
  const ro = !podeEditar;
  const estrangeiro = Boolean(form.nacionalidade) && form.nacionalidade !== PAIS_PORTUGAL;
  const saidaEmprego = form.situacaoEmpregoSaida || form.situacaoEmpregoEntrada;
  const procuraOmissao = procuraEmpregoPorOmissao(saidaEmprego);
  const qnqEntrada = qnqDasHabilitacoes(form.habilitacoesEntrada);
  const qnqSaida = qnqDasHabilitacoes(form.habilitacoesSaida || form.habilitacoesEntrada);

  const texto = (k: Chave, props: { tipo?: string; ajuda?: string; normalizar?: (v: string) => string; className?: string; inputMode?: "numeric" | "text"; semMaximo?: boolean } = {}) => (
    <Campo rotulo={ROTULOS_FINANCIAMENTO[k]} erro={errosForm[k] ?? null} className={props.className}
      ajuda={props.ajuda ?? (dados.daInscricao.includes(k) ? "Vem da pré-inscrição; ao gravar fica na ficha." : undefined)}>
      {p => (
        <Entrada {...p} type={props.tipo ?? "text"} inputMode={props.inputMode} disabled={ro} value={form[k]}
          max={props.tipo === "date" && !props.semMaximo ? hojeLisboa() : undefined}
          onChange={e => mudar({ [k]: props.normalizar ? props.normalizar(e.target.value) : e.target.value } as Partial<DadosFinanciamento>)} />
      )}
    </Campo>
  );
  const lista = (k: keyof typeof LISTAS_FINANCIAMENTO, vazio = "Escolher…", className?: string, ajuda?: string) => (
    <Campo rotulo={ROTULOS_FINANCIAMENTO[k]} className={className} ajuda={ajuda}>
      {p => <Selecao {...p} disabled={ro} opcoes={opcoes(LISTAS_FINANCIAMENTO[k])} vazio={vazio} value={form[k]} onChange={e => mudar({ [k]: e.target.value } as Partial<DadosFinanciamento>)} />}
    </Campo>
  );
  const digitos = (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max);

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-[13px] text-tinta-suave">
        O que o ficheiro de execução física do reembolso pede deste formando. Os valores são os das listas do template oficial.
      </p>
      {estrangeiro && faltaDocumentoEstrangeiro(form) && (
        <Aviso tom="aviso" titulo="Falta um documento de estrangeiro">Indique a autorização de residência, o passaporte ou o pedido de proteção internacional.</Aviso>
      )}

      <Cartao titulo="Identificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {texto("nif", { inputMode: "numeric", normalizar: digitos(9) })}
          {texto("niss", { inputMode: "numeric", normalizar: digitos(13) })}
          {texto("dataNascimento", { tipo: "date" })}
          {lista("genero")}
          <div className="sm:col-span-2 min-w-0">
            <span className="mb-1 block text-xs font-semibold text-[#3A4352]">{ROTULOS_FINANCIAMENTO.nacionalidade}</span>
            <SearchSelect value={form.nacionalidade} onChange={v => mudar({ nacionalidade: v })} disabled={ro} allowEmpty emptyLabel="Escolher…"
              placeholder="Pesquisar país…" options={LISTAS_FINANCIAMENTO.nacionalidade.map(value => ({ value }))} />
          </div>
          {texto("codigoPostal", { normalizar: v => { const d = v.replace(/\D/g, "").slice(0, 7); return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d; } })}
          {texto("numeroSigo", { inputMode: "numeric", normalizar: digitos(12), ajuda: "Número do formando na plataforma SIGO." })}
          <Campo rotulo={ROTULOS_FINANCIAMENTO.tipoDocumento}>
            {p => <Selecao {...p} disabled={ro} opcoes={opcoes(TIPOS_DOCUMENTO_FIN)} vazio="Escolher…" value={form.tipoDocumento} onChange={e => mudar({ tipoDocumento: e.target.value })} />}
          </Campo>
          {texto("numeroDocumento", { normalizar: v => v.replace(/[\s-]+/g, "").toUpperCase().slice(0, 12) })}
          {texto("validadeDocumento", { tipo: "date", semMaximo: true })}
        </div>
      </Cartao>

      <Cartao titulo="Documentos de estrangeiro" subtitulo={estrangeiro ? "Pelo menos um: autorização de residência, passaporte ou pedido de proteção internacional." : "Só para quem não tem nacionalidade portuguesa."}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {texto("autorizacaoResidencia")}
          {texto("tipoAutorizacaoResidencia")}
          {texto("passaporte")}
          {texto("protecaoInternacional")}
        </div>
      </Cartao>

      <Cartao titulo="À entrada">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lista("situacaoEmpregoEntrada", "Escolher…", "sm:col-span-2")}
          {form.situacaoEmpregoEntrada === EMPREGADOS && texto("nifEntidadeEmpregadora", { inputMode: "numeric", normalizar: digitos(9), ajuda: "A entidade enquadradora no ficheiro (entidade empregadora, Portugal)." })}
          {lista("habilitacoesEntrada", "Escolher…", "sm:col-span-2", qnqEntrada ? `Nível QNQ: ${qnqEntrada}` : undefined)}
          {lista("estudaEntrada", `Não indicado (${LISTAS_FINANCIAMENTO.estudaEntrada[1]})`)}
        </div>
      </Cartao>

      <Cartao titulo="À saída" subtitulo="Entra no ficheiro quando a participação termina. Em branco, fica igual à entrada.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lista("situacaoEmpregoSaida", form.situacaoEmpregoEntrada ? `Igual à entrada (${form.situacaoEmpregoEntrada})` : "Igual à entrada", "sm:col-span-2")}
          {lista("habilitacoesSaida", "Igual à entrada", "sm:col-span-2", qnqSaida ? `Nível QNQ: ${qnqSaida}` : undefined)}
          {lista("procuraEmpregoApos", procuraOmissao ? `Pela situação face ao emprego (${procuraOmissao})` : "Pela situação face ao emprego")}
          {lista("estudaApos", `Não indicado (${LISTAS_FINANCIAMENTO.estudaApos[1]})`)}
        </div>
      </Cartao>

      {podeEditar && (
        <div className="flex justify-end gap-2">
          <Botao disabled={!mudou || gravar.aCorrer} onClick={() => setForm(dados.dados)}>Repor</Botao>
          <Botao variante="primario" aCarregar={gravar.aCorrer} disabled={temErros || !Object.keys(alterados).length}
            onClick={() => void gravar.correr(alterados)}>Guardar</Botao>
        </div>
      )}
    </div>
  );
}
