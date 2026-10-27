import { useEffect, useState } from "react";
import { ApiError } from "../../../partilhado/api/cliente";
import { apiAlterarFormador, apiCriarFormador, apiJuntarRegimeFormador, apiReporAcessoFormador, type AcessoCriado, type DadosFormador, type FormadorBase, type Regime } from "../../../partilhado/api/formadores";
import { DisponibilidadeEditor } from "../../../partilhado/DisponibilidadeEditor";
import { SLOTS_TODOS } from "../../../partilhado/disponibilidade";
import { toastError } from "../../../partilhado/toastBus";
import { Aviso, Botao, Caixa, Campo, Entrada, Interruptor, Modal } from "../../../partilhado/ui";
import { AvisoAcesso } from "./AvisoAcesso";
import { corpoAcesso, ESCOLHA_INICIAL, erroEscolha, EscolhaPalavraPasse, type EscolhaAcesso } from "./EscolhaPalavraPasse";

const novo = (regime: Regime): DadosFormador => ({
  nome: "", telf: "", email: "", especialidade: "", ccp: "", ccpValidade: "", nif: "", regimes: [regime],
  estado: "Ativo", disponibilidade: [...SLOTS_TODOS], custoHora: 0,
});

function deFormador(f: FormadorBase): DadosFormador {
  return {
    nome: f.nome, telf: f.telf, email: f.email, especialidade: f.especialidade, ccp: f.ccp, ccpValidade: f.ccpValidade, nif: f.nif,
    regimes: [...f.regimes], estado: f.estado, disponibilidade: [...f.disponibilidade], custoHora: f.custoHora,
  };
}

/** Criar ou editar a ficha de um formador. Ao criar com email, nasce a conta de acesso. */
export function FormadorFormulario({ aberto, regime, formador, especialidades, onFechar, onGuardado }: {
  aberto: boolean;
  regime: Regime;
  /** null = novo formador. */
  formador: FormadorBase | null;
  especialidades: string[];
  onFechar: () => void;
  onGuardado: (f: FormadorBase, acesso: AcessoCriado) => void;
}) {
  const [d, setD] = useState<DadosFormador>(() => novo(regime));
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  /** Ficha que já existe com este email (409 ao criar): junta-se o regime em vez de criar outra. */
  const [existente, setExistente] = useState<number | null>(null);
  /** Palavra-passe temporária gerada agora (mostrada uma vez). */
  const [novoAcesso, setNovoAcesso] = useState<AcessoCriado>(null);
  const [aRepor, setARepor] = useState(false);
  /** Palavra-passe do acesso: gerada (temporária) ou escolhida — ao criar, e ao repor numa ficha que já existe. */
  const [escolha, setEscolha] = useState<EscolhaAcesso>(ESCOLHA_INICIAL);

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    setExistente(null);
    setNovoAcesso(null);
    setEscolha(ESCOLHA_INICIAL);
    setD(formador ? deFormador(formador) : novo(regime));
  }, [aberto, formador, regime]);

  const mudar = (p: Partial<DadosFormador>) => setD(x => ({ ...x, ...p }));
  const alternarRegime = (r: Regime) => mudar({ regimes: d.regimes.includes(r) ? d.regimes.filter(x => x !== r) : [...d.regimes, r] });

  async function guardar() {
    if (!d.nome.trim()) { setErro("Indique o nome do formador."); return; }
    if (!d.regimes.length) { setErro("Escolha pelo menos um regime: Gold ou Financiada."); return; }
    if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) { setErro("O email não parece válido."); return; }
    const erroPasse = !formador && d.email.trim() ? erroEscolha(escolha) : "";
    if (erroPasse) { setErro(erroPasse); return; }
    setErro("");
    setAGravar(true);
    try {
      const corpo = { ...d, nome: d.nome.trim(), email: d.email.trim(), telf: d.telf.trim(), ccp: d.ccp.trim(), nif: d.nif.trim(), especialidade: d.especialidade.trim() };
      const r = formador ? await apiAlterarFormador(formador.id, corpo) : await apiCriarFormador({ ...corpo, acesso: corpoAcesso(escolha) });
      onGuardado(r.formador, r.acesso);
    } catch (e) {
      const ficha = e instanceof ApiError && typeof e.dados?.fichaExistente === "number" ? e.dados.fichaExistente : null;
      setExistente(formador ? null : ficha);
      setErro(e instanceof Error ? e.message : "Não foi possível gravar.");
      if (ficha == null) toastError(e, "Não foi possível gravar o formador.");
    } finally {
      setAGravar(false);
    }
  }

  async function reporAcesso() {
    if (!formador) return;
    const erroPasse = erroEscolha(escolha);
    if (erroPasse) { setErro(erroPasse); return; }
    setErro("");
    setARepor(true);
    try {
      setNovoAcesso((await apiReporAcessoFormador(formador.id, corpoAcesso(escolha))).acesso);
      setEscolha(ESCOLHA_INICIAL);
    } catch (e) {
      toastError(e, "Não foi possível gerar a palavra-passe.");
    } finally {
      setARepor(false);
    }
  }

  async function juntarRegime() {
    if (existente == null) return;
    setAGravar(true);
    try {
      const r = await apiJuntarRegimeFormador(existente, regime, d.email.trim());
      onGuardado(r.formador, null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível juntar o regime.");
      toastError(e, "Não foi possível juntar o regime à ficha.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={formador ? `Editar ${formador.nome}` : "Novo formador"}
      subtitulo={formador ? "Dados, CCP, valor por hora e disponibilidade." : "Com email, cria-se também a conta de acesso à área do formador."}
      largura="lg"
      rodape={(
        <>
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={() => void guardar()} aCarregar={aGravar}>{formador ? "Guardar alterações" : "Criar formador"}</Botao>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        {existente != null && (
          <Botao variante="secundario" onClick={() => void juntarRegime()} aCarregar={aGravar}>
            Juntar {regime === "gold" ? "Gold" : "Financiada"} à ficha que já existe
          </Botao>
        )}
        <Campo rotulo="Nome completo" obrigatorio>
          {p => <Entrada {...p} value={d.nome} onChange={e => mudar({ nome: e.target.value })} autoComplete="off" />}
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo rotulo="Email" ajuda="É o utilizador da área do formador.">
            {p => <Entrada {...p} type="email" value={d.email} onChange={e => mudar({ email: e.target.value })} autoComplete="off" />}
          </Campo>
          <Campo rotulo="Telemóvel">
            {p => <Entrada {...p} type="tel" value={d.telf} onChange={e => mudar({ telf: e.target.value })} />}
          </Campo>
        </div>
        {/* Palavra-passe do acesso: sempre à vista (Gold e Financiada usam este formulário); sem email não há conta. */}
        {!formador && (
          <div className="rounded-cartao border border-linha p-3">
            <p className="m-0 mb-2 text-[13px] font-medium text-tinta">Palavra-passe do acesso à área do formador</p>
            {d.email.trim()
              ? <EscolhaPalavraPasse nome="acesso-novo-formador" valor={escolha} onMudar={setEscolha} />
              : <p className="m-0 text-xs text-tinta-suave">Indique o email do formador para escolher a palavra-passe: gerar uma temporária ou definir uma.</p>}
          </div>
        )}
        {formador && (
          <div className="space-y-2 rounded-cartao border border-linha p-3">
            <p className="m-0 text-[13px] font-medium text-tinta">Acesso à área do formador: nova palavra-passe</p>
            {formador.email
              ? <>
                  <EscolhaPalavraPasse nome="acesso-repor-formador" valor={escolha} onMudar={setEscolha} />
                  <Botao variante="secundario" tamanho="sm" aCarregar={aRepor} onClick={() => void reporAcesso()}>
                    {escolha.modo === "definir" ? "Definir esta palavra-passe" : "Gerar nova palavra-passe"}
                  </Botao>
                </>
              : <p className="m-0 text-xs text-tinta-suave">Esta ficha ainda não tem email: indique-o e guarde as alterações; a conta de acesso cria-se nesse momento (com uma palavra-passe temporária), e depois pode definir outra aqui.</p>}
          </div>
        )}
        {novoAcesso && <AvisoAcesso acesso={novoAcesso} onFechar={() => setNovoAcesso(null)} />}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Campo rotulo="CCP / CCPE">
            {p => <Entrada {...p} value={d.ccp} onChange={e => mudar({ ccp: e.target.value })} />}
          </Campo>
          <Campo rotulo="Validade do CCP">
            {p => <Entrada {...p} type="date" value={d.ccpValidade} onChange={e => mudar({ ccpValidade: e.target.value })} />}
          </Campo>
          <Campo rotulo="NIF">
            {p => <Entrada {...p} inputMode="numeric" value={d.nif} onChange={e => mudar({ nif: e.target.value })} />}
          </Campo>
        </div>
        <Campo rotulo="Especialidade">
          {p => (
            <>
              <Entrada {...p} list="especialidades-formador" value={d.especialidade} onChange={e => mudar({ especialidade: e.target.value })} />
              <datalist id="especialidades-formador">{especialidades.map(e => <option key={e} value={e} />)}</datalist>
            </>
          )}
        </Campo>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium text-tinta mb-1">Regimes em que lecciona</legend>
          <div className="flex gap-4">
            <Caixa rotulo="Gold" checked={d.regimes.includes("gold")} onChange={() => alternarRegime("gold")} />
            <Caixa rotulo="Financiada" checked={d.regimes.includes("fin")} onChange={() => alternarRegime("fin")} />
          </div>
          <p className="text-xs text-tinta-suave m-0">Com os dois, aparece nas listas e nos cronogramas de ambos.</p>
        </fieldset>
        <Campo rotulo="Valor base por hora (€)" ajuda="Cada turma pode ter um valor próprio.">
          {p => <Entrada {...p} type="number" min={0} step="0.5" value={d.custoHora} onChange={e => mudar({ custoHora: Math.max(0, Number(e.target.value) || 0) })} />}
        </Campo>
        <div>
          <p className="text-[13px] font-medium text-tinta mb-2">Disponibilidade</p>
          <DisponibilidadeEditor
            value={d.disponibilidade}
            onChange={slots => mudar({ disponibilidade: slots })}
            nota="O formador também a pode actualizar na área do formador. O cronograma só lhe atribui sessões nestes horários."
          />
        </div>
        <Interruptor ligado={d.estado === "Ativo"} onMudar={v => mudar({ estado: v ? "Ativo" : "Inactivo" })} rotulo="Formador ativo" />
      </div>
    </Modal>
  );
}
