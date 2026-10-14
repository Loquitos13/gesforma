// Ficha de um cliente (ao lado da lista): contactos, propostas, contratos e acções.
import { useEffect, useState } from "react";
import {
  apiAlterarCliente, apiApagarCliente, apiCliente, apiCriarContrato, apiPropostaCliente, type DadosCliente,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  AreaTexto, Botao, Campo, Cartao, ConfirmarPerigo, Detalhes, Entrada, ErroCarregar, Esqueleto, Modal, data, eur,
} from "../../../partilhado/ui";
import { EstadoDoc, useGestao } from "./comum";
import { FormProposta } from "./FormProposta";

const VAZIO: DadosCliente = { nome: "", email: "", telf: "", nif: "", notas: "" };

export function FormCliente({ aberto, titulo, inicial, aCarregar, onFechar, onGravar }: {
  aberto: boolean;
  titulo: string;
  inicial?: DadosCliente;
  aCarregar?: boolean;
  onFechar: () => void;
  onGravar: (d: DadosCliente) => void;
}) {
  const [d, setD] = useState<DadosCliente>(inicial ?? VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setD(inicial ?? VAZIO);
      setErro(null);
    }
  }, [aberto, inicial]);
  function gravar() {
    if (!d.nome.trim()) return setErro("Indique o nome.");
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return setErro("O email não parece válido.");
    onGravar({ nome: d.nome.trim(), email: d.email.trim(), telf: d.telf.trim(), nif: d.nif.trim(), notas: d.notas });
  }
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={aCarregar} onClick={gravar}>Guardar</Botao></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome" obrigatorio erro={erro} className="sm:col-span-2">
          {p => <Entrada {...p} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} placeholder="Empresa, Lda." data-autofocus />}
        </Campo>
        <Campo rotulo="Email">{p => <Entrada {...p} type="email" value={d.email} onChange={e => setD({ ...d, email: e.target.value })} />}</Campo>
        <Campo rotulo="Telefone">{p => <Entrada {...p} type="tel" value={d.telf} onChange={e => setD({ ...d, telf: e.target.value })} />}</Campo>
        <Campo rotulo="NIF">{p => <Entrada {...p} inputMode="numeric" value={d.nif} onChange={e => setD({ ...d, nif: e.target.value })} />}</Campo>
        <Campo rotulo="Notas" className="sm:col-span-2">
          {p => <AreaTexto {...p} value={d.notas} onChange={e => setD({ ...d, notas: e.target.value })} placeholder="Quem decide, número de pessoas, preferências de horário…" />}
        </Campo>
      </div>
    </Modal>
  );
}

export function ClienteDetalhe({ id, onApagado, onContratos }: { id: number; onApagado: () => void; onContratos: () => void }) {
  const gestao = useGestao();
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:clientes:ficha:${id}`, signal => apiCliente(id, { signal }));
  const [editar, setEditar] = useState(false);
  const [proposta, setProposta] = useState(false);
  const [apagar, setApagar] = useState(false);
  const alterar = useAccao((d: DadosCliente) => apiAlterarCliente(id, d), { ok: "Cliente guardado.", invalidar: ["crm:clientes"] });
  const novaProposta = useAccao(
    (d: Parameters<typeof apiPropostaCliente>[1]) => apiPropostaCliente(id, d),
    { ok: "Proposta registada.", invalidar: ["crm:clientes", "crm:propostas"] },
  );
  const contrato = useAccao(apiCriarContrato, { ok: "Contrato criado em rascunho.", invalidar: ["crm:clientes", "crm:contratos", "crm:propostas"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  const c = dados?.cliente;
  if (!c || (aCarregar && !c)) return <Cartao><Esqueleto linhas={8} /></Cartao>;

  return (
    <Cartao
      titulo={c.nome}
      subtitulo={c.criadoEm ? `Cliente desde ${data(c.criadoEm)}` : undefined}
      acoes={<Botao tamanho="sm" onClick={() => setEditar(true)}>Editar</Botao>}
      className="xl:sticky xl:top-4"
    >
      <Detalhes itens={[
        { rotulo: "Email", valor: c.email ? <a className="text-ligacao" href={`mailto:${c.email}`}>{c.email}</a> : "—" },
        { rotulo: "Telefone", valor: c.telf ? <a className="text-ligacao" href={`tel:${c.telf.replace(/\s/g, "")}`}>{c.telf}</a> : "—" },
        { rotulo: "NIF", valor: c.nif || "—" },
        { rotulo: "Contratos", valor: String(c.contratos.length) },
      ]} />
      {c.notas && <p className="mt-4 mb-0 text-[13px] text-tinta whitespace-pre-wrap rounded-controlo bg-fundo px-3 py-2">{c.notas}</p>}

      <div className="mt-5 flex items-center gap-2">
        <h3 className="m-0 text-sm font-semibold text-tinta flex-1">Propostas</h3>
        <Botao tamanho="sm" variante="primario" onClick={() => setProposta(true)}>Nova proposta</Botao>
      </div>
      {c.propostas.length === 0 ? (
        <p className="mt-2 mb-0 text-[13px] text-tinta-suave">Ainda sem propostas para este cliente.</p>
      ) : (
        <ul className="mt-2 m-0 p-0 list-none divide-y divide-linha-suave">
          {c.propostas.map(p => (
            <li key={p.id} className="py-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium text-tinta truncate">{p.curso || "Proposta"}</p>
                  <p className="m-0 text-xs text-tinta-suave">{[p.valor ? eur(p.valor) : "", p.comercial, data(p.enviadaEm)].filter(Boolean).join(" · ")}</p>
                </div>
                <EstadoDoc estado={p.estado} />
              </div>
              {p.estado === "Aceite" && (
                p.contratoId
                  ? <Botao tamanho="sm" variante="ligacao" onClick={onContratos}>Ver contrato</Botao>
                  : <Botao tamanho="sm" variante="ligacao" aCarregar={contrato.aCorrer}
                      onClick={() => void contrato.correr({ clienteNome: c.nome, clienteEmail: c.email, clienteId: c.id, propostaId: p.id })}>
                      Criar contrato a partir desta proposta
                    </Botao>
              )}
            </li>
          ))}
        </ul>
      )}

      {c.contratos.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-tinta">Contratos</h3>
          <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
            {c.contratos.map(k => (
              <li key={k.id} className="py-2 flex items-center gap-2">
                <span className="flex-1 min-w-0 text-sm text-tinta truncate">{k.curso || "Contrato"} · {eur(k.valor)}</span>
                <EstadoDoc estado={k.estado} />
              </li>
            ))}
          </ul>
          <Botao tamanho="sm" variante="ligacao" onClick={onContratos}>Abrir contratos</Botao>
        </>
      )}

      {gestao && (
        <div className="mt-6 pt-4 border-t border-linha">
          <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setApagar(true)}>Apagar cliente</Botao>
        </div>
      )}

      <FormCliente
        aberto={editar}
        titulo="Editar cliente"
        inicial={{ nome: c.nome, email: c.email, telf: c.telf, nif: c.nif, notas: c.notas }}
        aCarregar={alterar.aCorrer}
        onFechar={() => setEditar(false)}
        onGravar={async d => { if (await alterar.correr(d)) setEditar(false); }}
      />
      <FormProposta
        aberto={proposta}
        cliente={c}
        aCarregar={novaProposta.aCorrer}
        onFechar={() => setProposta(false)}
        onGravar={async d => { if (await novaProposta.correr(d)) setProposta(false); }}
      />
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo="Apagar cliente"
        descricao={c.propostas.length || c.contratos.length
          ? "Este cliente tem propostas ou contratos. Não é possível apagá-lo enquanto existirem."
          : `O cliente «${c.nome}» deixa de aparecer na lista. Esta acção não se desfaz.`}
        onConfirmar={async () => {
          try {
            await apiApagarCliente(c.id);
            invalidar("crm:clientes");
            toastOk("Cliente apagado.");
            onApagado();
          } catch (e) {
            toastError(e, "Não foi possível apagar o cliente.");
          }
        }}
      />
    </Cartao>
  );
}
