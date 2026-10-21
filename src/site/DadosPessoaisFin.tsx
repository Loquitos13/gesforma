import type { ReactNode } from "react";
import { GENEROS_FIN, HABILITACOES_FIN, rotuloPais, type InscricaoFin } from "../partilhado/dadosPessoaisFin";
import { LISTA_PAISES } from "../partilhado/execucaoFisica";
import { SearchSelect } from "../partilhado/FormKit";
import { hojeLisboa } from "../partilhado/horaLisboa";

export type ErrosForm = Record<string, string | undefined>;

/** Estilos do modal de inscrição (SiteInscricao); a página /preinscricao passa os seus. */
export const INPUT_MODAL = "w-full border border-[#1C3350]/15 bg-white px-3 py-2.5 text-sm text-[#1C3350] outline-none focus:border-[#1C3350] aria-[invalid=true]:border-[#A60000]";
export const ROTULO_MODAL = "mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#1C3350]/70";

const PAISES = LISTA_PAISES.map(value => ({ value, label: rotuloPais(value) }));

/** Um campo com rótulo, erro e ajuda; `input` recebe o id e os atributos de acessibilidade. */
export function CampoFin({ id, rotulo, erro, ajuda, rotuloCls = ROTULO_MODAL, className, children }: {
  id: string; rotulo: string; erro?: string; ajuda?: string; rotuloCls?: string; className?: string;
  children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <label htmlFor={id} className={rotuloCls}>{rotulo}</label>
      {children({ id, "aria-invalid": Boolean(erro), "aria-describedby": erro ? `${id}-erro` : undefined })}
      {erro
        ? <p id={`${id}-erro`} className="mt-1 text-xs text-[#A60000]">{erro}</p>
        : ajuda ? <p className="mt-1 text-xs text-[#1C3350]/50">{ajuda}</p> : null}
    </div>
  );
}

/**
 * Formação financiada, formulário público: nome completo, género, data de nascimento, nacionalidade e habilitações
 * (o telemóvel e o email ficam com o formulário). Guarda-se o valor das listas da execução física; mostra-se o rótulo.
 */
export function CamposInscricaoFin({ valor, onMudar, erros, inputCls = INPUT_MODAL, rotuloCls = ROTULO_MODAL }: {
  valor: InscricaoFin;
  onMudar: (v: InscricaoFin) => void;
  erros: ErrosForm;
  inputCls?: string;
  rotuloCls?: string;
}) {
  const set = (k: keyof InscricaoFin) => (e: { target: { value: string } }) => onMudar({ ...valor, [k]: e.target.value });
  return (
    <>
      <CampoFin id="fin-nomeCompleto" rotulo="Nome completo" erro={erros.nomeCompleto} rotuloCls={rotuloCls} className="sm:col-span-2">
        {p => <input {...p} className={inputCls} value={valor.nomeCompleto} onChange={set("nomeCompleto")} autoComplete="name" maxLength={160} required />}
      </CampoFin>
      <CampoFin id="fin-genero" rotulo="Género" erro={erros.genero} rotuloCls={rotuloCls}>
        {p => (
          <select {...p} className={inputCls} value={valor.genero} onChange={set("genero")} required>
            <option value="">Seleccione</option>
            {GENEROS_FIN.map(g => <option key={g.valor} value={g.valor}>{g.rotulo}</option>)}
          </select>
        )}
      </CampoFin>
      <CampoFin id="fin-dataNascimento" rotulo="Data de nascimento" erro={erros.dataNascimento} rotuloCls={rotuloCls}>
        {p => <input {...p} type="date" className={inputCls} value={valor.dataNascimento} onChange={set("dataNascimento")} autoComplete="bday" max={hojeLisboa()} min="1900-01-01" required />}
      </CampoFin>
      <div className="min-w-0">
        <span className={rotuloCls}>Nacionalidade</span>
        <SearchSelect value={valor.nacionalidade} onChange={v => onMudar({ ...valor, nacionalidade: v })} options={PAISES}
          placeholder="Pesquisar país" emptyLabel="Seleccione a nacionalidade" allowEmpty />
        {erros.nacionalidade && <p className="mt-1 text-xs text-[#A60000]">{erros.nacionalidade}</p>}
      </div>
      <CampoFin id="fin-habilitacoes" rotulo="Habilitações" erro={erros.habilitacoes} rotuloCls={rotuloCls}>
        {p => (
          <select {...p} className={inputCls} value={valor.habilitacoes} onChange={set("habilitacoes")} required>
            <option value="">Seleccione</option>
            {HABILITACOES_FIN.map(h => <option key={h.rotulo} value={h.rotulo}>{h.rotulo}</option>)}
          </select>
        )}
      </CampoFin>
    </>
  );
}

/** Erros por campo que o servidor devolveu (`campos`), no formato do formulário (sem o prefixo «dadosFin.»). */
export function errosDoServidor(campos: { campo: string; erro: string }[] | undefined): ErrosForm {
  const out: ErrosForm = {};
  for (const c of campos ?? []) out[c.campo.replace(/^dadosFin\./, "")] = c.erro;
  return out;
}
