import { useEffect, useMemo, useState } from "react";
import {
  apiAlterarFormandoFin, apiAlterarFormandoGold, apiRecusarDocFormando, apiRegistarPagamentoFormando, type FichaFormando,
} from "../../../partilhado/api/formandos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { numeroPt } from "../../../partilhado/despesas";
import { AreaTexto, Botao, Campo, Entrada, Modal, Selecao } from "../../../partilhado/ui";

const INVALIDAR = ["formandos:"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Estados a que a ficha pode passar (o servidor valida a transição). */
const ESTADOS = {
  gold: ["Formando", "Desistiu", "Concluído", "Certificado"],
  fin: ["Em análise", "Elegível", "Colocado na turma", "A frequentar", "Concluído", "Certificado", "Desistiu", "Indeferido"],
};

function alterar(ficha: FichaFormando, corpo: Record<string, unknown>) {
  return ficha.regime === "gold" ? apiAlterarFormandoGold(ficha.id, corpo) : apiAlterarFormandoFin(ficha.id, corpo);
}

export function EditarDados({ aberto, onFechar, ficha }: { aberto: boolean; onFechar: () => void; ficha: FichaFormando }) {
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [estado, setEstado] = useState("");
  const gravar = useAccao((corpo: Record<string, unknown>) => alterar(ficha, corpo), { invalidar: INVALIDAR, ok: "Dados gravados." });
  useEffect(() => {
    if (!aberto) return;
    setNome(ficha.nome); setApelido(ficha.apelido); setEmail(ficha.email); setTelf(ficha.telf); setEstado(ficha.estado);
  }, [aberto, ficha]);
  const erroEmail = email && !EMAIL.test(email) ? "Email inválido." : null;
  const estados = ESTADOS[ficha.regime].includes(ficha.estado) ? ESTADOS[ficha.regime] : [ficha.estado, ...ESTADOS[ficha.regime]];

  async function guardar() {
    if (!nome.trim() || erroEmail) return;
    const corpo: Record<string, unknown> = {};
    if (nome.trim() !== ficha.nome) corpo.nome = nome.trim();
    if (apelido.trim() !== ficha.apelido) corpo.apelido = apelido.trim();
    if (email.trim() !== ficha.email) corpo.email = email.trim();
    if (telf.trim() !== ficha.telf) corpo.telf = telf.trim();
    if (estado !== ficha.estado) corpo.estado = estado;
    if (!Object.keys(corpo).length) { onFechar(); return; }
    if (await gravar.correr(corpo)) onFechar();
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Editar dados do formando"
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={gravar.aCorrer} onClick={guardar} disabled={!nome.trim() || Boolean(erroEmail)}>Guardar</Botao></>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo rotulo="Nome" obrigatorio erro={!nome.trim() ? "Indique o nome." : null}>{p => <Entrada {...p} value={nome} onChange={e => setNome(e.target.value)} data-autofocus />}</Campo>
        <Campo rotulo="Apelido">{p => <Entrada {...p} value={apelido} onChange={e => setApelido(e.target.value)} />}</Campo>
        <Campo rotulo="Email" erro={erroEmail} ajuda={ficha.acesso.tem ? "Mudar o email não muda o utilizador da conta já criada." : undefined}>
          {p => <Entrada {...p} type="email" value={email} onChange={e => setEmail(e.target.value)} />}
        </Campo>
        <Campo rotulo="Telemóvel">{p => <Entrada {...p} type="tel" value={telf} onChange={e => setTelf(e.target.value)} />}</Campo>
        <Campo rotulo="Estado" className="sm:col-span-2">
          {p => <Selecao {...p} opcoes={estados.map(e => ({ valor: e, rotulo: e }))} value={estado} onChange={e => setEstado(e.target.value)} />}
        </Campo>
      </div>
    </Modal>
  );
}

export function MudarTurma({ aberto, onFechar, ficha }: { aberto: boolean; onFechar: () => void; ficha: FichaFormando }) {
  const turmas = useOpcoes("turmas", { regime: ficha.regime });
  const [turmaId, setTurmaId] = useState("");
  const mover = useAccao((id: number) => alterar(ficha, { turmaId: id }), { invalidar: INVALIDAR, ok: "Turma alterada." });
  useEffect(() => { if (aberto) setTurmaId(""); }, [aberto]);
  // Turmas abertas do mesmo curso, sem a actual.
  const opcoes = useMemo(() => turmas.opcoes
    .filter(t => t.id !== ficha.turma?.id)
    .filter(t => !ficha.curso || String(t.extra?.curso ?? "").trim().toLowerCase() === ficha.curso.trim().toLowerCase())
    .map(t => ({ valor: String(t.id), rotulo: `${t.rotulo}${t.extra?.inicio ? ` · início ${String(t.extra.inicio)}` : ""}` })), [turmas.opcoes, ficha]);

  async function confirmar() {
    if (!turmaId) return;
    if (await mover.correr(Number(turmaId))) onFechar();
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={ficha.turma ? "Mudar de turma" : "Colocar numa turma"}
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={mover.aCorrer} disabled={!turmaId} onClick={confirmar}>Confirmar</Botao></>}
    >
      <Campo
        rotulo="Turma de destino"
        ajuda={opcoes.length ? "A vaga é confirmada no servidor; os documentos passam para a pasta da nova turma." : `Não há outras turmas abertas de ${ficha.curso || "este curso"}.`}
      >
        {p => <Selecao {...p} opcoes={opcoes} vazio="Escolher turma…" value={turmaId} onChange={e => setTurmaId(e.target.value)} data-autofocus />}
      </Campo>
    </Modal>
  );
}

export function RegistarPagamento({ aberto, onFechar, ficha }: { aberto: boolean; onFechar: () => void; ficha: FichaFormando }) {
  const metodos = useOpcoes("lista", { lista: "metodos_pagamento" });
  const [metodo, setMetodo] = useState("");
  const [valor, setValor] = useState("");
  const [dataPag, setDataPag] = useState("");
  const registar = useAccao(apiRegistarPagamentoFormando, { invalidar: [...INVALIDAR, "pagamentos:", "painel:"], ok: "Pagamento registado." });
  useEffect(() => {
    if (!aberto) return;
    setMetodo(""); setValor(String(ficha.pagamento?.valor ?? "")); setDataPag(new Date().toISOString().slice(0, 10));
  }, [aberto, ficha.pagamento?.valor]);
  // Valor vazio é valor em falta (não 0 €); a oferta usa o seu próprio botão.
  // "1.250" são mil duzentos e cinquenta euros (como se escreve em português), não 1,25 €.
  const v = valor.trim() ? numeroPt(valor) : NaN;
  const valido = metodo && Number.isFinite(v) && v >= 0 && Boolean(dataPag);

  async function confirmar(oferta = false) {
    const r = oferta
      ? await registar.correr(ficha.id, { metodo: "Oferta" })
      : await registar.correr(ficha.id, { metodo, valor: v, data: dataPag });
    if (r) onFechar();
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Registar pagamento"
      rodape={(
        <>
          <Botao variante="fantasma" onClick={() => confirmar(true)} aCarregar={registar.aCorrer}>Marcar como oferta</Botao>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={registar.aCorrer} disabled={!valido} onClick={() => confirmar(false)}>Registar</Botao>
        </>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Campo rotulo="Método" obrigatorio className="sm:col-span-3">
          {p => <Selecao {...p} opcoes={metodos.selecao} vazio="Escolher…" value={metodo} onChange={e => setMetodo(e.target.value)} data-autofocus />}
        </Campo>
        <Campo rotulo="Valor (€)" obrigatorio erro={valor && !(v >= 0) ? "Valor inválido." : null}>
          {p => <Entrada {...p} inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} />}
        </Campo>
        <Campo rotulo="Data" className="sm:col-span-2">{p => <Entrada {...p} type="date" value={dataPag} onChange={e => setDataPag(e.target.value)} />}</Campo>
      </div>
      <p className="m-0 mt-3 text-xs text-tinta-suave">Fecha o pagamento pendente desta ficha (ou cria o movimento) e marca a ficha como paga.</p>
    </Modal>
  );
}

export function RecusarDoc({ alvo, onFechar, ficha }: { alvo: { id: string; label: string } | null; onFechar: () => void; ficha: FichaFormando }) {
  const [obs, setObs] = useState("");
  const recusar = useAccao((docId: string, o: string) => apiRecusarDocFormando(ficha.regime, ficha.id, docId, o), { invalidar: INVALIDAR, ok: "Documento recusado." });
  useEffect(() => { if (alvo) setObs(""); }, [alvo]);
  return (
    <Modal
      aberto={Boolean(alvo)}
      onFechar={onFechar}
      titulo={`Recusar ${alvo?.label ?? "documento"}`}
      rodape={(
        <>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="perigo" aCarregar={recusar.aCorrer} disabled={!obs.trim()} onClick={async () => { if (alvo && await recusar.correr(alvo.id, obs.trim())) onFechar(); }}>Recusar</Botao>
        </>
      )}
    >
      <Campo rotulo="O que está incorrecto" obrigatorio ajuda="A pessoa vê esta explicação para corrigir e enviar de novo.">
        {p => <AreaTexto {...p} value={obs} onChange={e => setObs(e.target.value)} maxLength={500} data-autofocus />}
      </Campo>
    </Modal>
  );
}
