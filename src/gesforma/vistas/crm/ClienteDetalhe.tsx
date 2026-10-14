// Ficha de um cliente (no painel ao lado da lista): contactos, propostas, contratos e acções.
import { useEffect, useState } from "react";
import { apiAlterarCliente, apiApagarCliente, apiCliente, type DadosCliente } from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { AreaTexto, Botao, Campo, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Modal, data } from "../../../partilhado/ui";
import { Dados, EstadoDoc, useGestao } from "./comum";
import { eurosCurto } from "./documento/modelo";

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

export type AcoesCliente = {
  onNovaProposta: (clienteId: number) => void;
  onAbrirProposta: (id: number) => void;
  onCriarContrato: (propostaId: number) => void;
  onAbrirContrato: (id: number) => void;
};

export function ClienteDetalhe({ id, onApagado, acoes }: { id: number; onApagado: () => void; acoes: AcoesCliente }) {
  const gestao = useGestao();
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:clientes:ficha:${id}`, signal => apiCliente(id, { signal }));
  const [editar, setEditar] = useState(false);
  const [menu, setMenu] = useState(false);
  const [apagar, setApagar] = useState(false);
  const alterar = useAccao((d: DadosCliente) => apiAlterarCliente(id, d), { ok: "Cliente guardado.", invalidar: ["crm:clientes"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  const c = dados?.cliente;
  if (!c || (aCarregar && !c)) return <Esqueleto linhas={8} />;

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-xs text-tinta-suave">Cliente{c.criadoEm ? ` desde ${data(c.criadoEm)}` : ""}</p>
          <h2 className="m-0 mt-0.5 text-lg font-semibold text-tinta">{c.nome}</h2>
        </div>
        <div className="relative">
          <button type="button" aria-label="Mais acções" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}
            className="w-9 h-9 rounded-lg border border-linha bg-white text-tinta-suave cursor-pointer hover:border-linha-forte">⋯</button>
          {menu && (
            <div role="menu" className="absolute right-0 top-10 z-10 w-44 rounded-lg border border-linha bg-white shadow-flutuante py-1 text-[13px]">
              <button type="button" role="menuitem" className="w-full text-left px-3 py-2 border-0 bg-transparent cursor-pointer hover:bg-fundo" onClick={() => { setMenu(false); setEditar(true); }}>Editar cliente</button>
              {gestao && <button type="button" role="menuitem" className="w-full text-left px-3 py-2 border-0 bg-transparent cursor-pointer text-perigo hover:bg-fundo" onClick={() => { setMenu(false); setApagar(true); }}>Apagar cliente</button>}
            </div>
          )}
        </div>
      </div>

      <Dados itens={[
        { rotulo: "NIF", valor: c.nif || "—" },
        { rotulo: "Email", valor: c.email ? <a className="text-ligacao" href={`mailto:${c.email}`}>{c.email}</a> : "—" },
        { rotulo: "Telemóvel", valor: c.telf ? <a className="text-ligacao" href={`tel:${c.telf.replace(/\s/g, "")}`}>{c.telf}</a> : "—" },
        { rotulo: "Notas", valor: c.notas ? <span className="whitespace-pre-wrap">{c.notas}</span> : "—" },
      ]} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center">
          <h3 className="m-0 text-sm font-semibold text-tinta">Propostas</h3>
          <button type="button" onClick={() => acoes.onNovaProposta(c.id)} className="ml-auto border-0 bg-transparent p-0 text-ligacao font-semibold text-[13px] cursor-pointer hover:underline">Nova proposta</button>
        </div>
        {c.propostas.length === 0 && <p className="m-0 text-[13px] text-tinta-suave">Ainda sem propostas para este cliente.</p>}
        {c.propostas.map(p => (
          <div key={p.id} className="flex items-start gap-2 py-2.5 border-t border-[#EEF0F3]">
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => acoes.onAbrirProposta(p.id)} className="block max-w-full text-left border-0 bg-transparent p-0 cursor-pointer text-sm font-medium text-tinta truncate hover:text-ligacao">
                {p.curso || "Proposta"}
              </button>
              <span className="num block text-xs text-tinta-suave">{[p.valor ? eurosCurto(p.valor) : "", p.comercial, data(p.enviadaEm)].filter(Boolean).join(" · ")}</span>
              {p.estado === "Aceite" && !p.contratoId && (
                <button type="button" onClick={() => acoes.onCriarContrato(p.id)} className="mt-1 border-0 bg-transparent p-0 text-xs font-semibold text-ligacao cursor-pointer hover:underline">Criar contrato</button>
              )}
            </div>
            <EstadoDoc estado={p.estado} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-tinta">Contratos</h3>
        {c.contratos.length === 0 && <p className="m-0 text-[13px] text-tinta-suave">Ainda sem contrato. Uma proposta aceite passa a contrato com um clique.</p>}
        {c.contratos.map(k => (
          <div key={k.id} className="flex items-center gap-2 py-2.5 border-t border-[#EEF0F3]">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-tinta truncate">{k.curso || "Contrato"}</div>
              <div className="num text-xs text-tinta-suave">{[k.valor ? eurosCurto(k.valor) : "", k.assinadoEm ? `assinado ${data(k.assinadoEm)}` : k.estado].filter(Boolean).join(" · ")}</div>
            </div>
            <button type="button" onClick={() => acoes.onAbrirContrato(k.id)} className="border-0 bg-transparent p-0 text-ligacao font-semibold text-[13px] cursor-pointer hover:underline">Abrir</button>
          </div>
        ))}
      </section>

      <FormCliente
        aberto={editar}
        titulo="Editar cliente"
        inicial={{ nome: c.nome, email: c.email, telf: c.telf, nif: c.nif, notas: c.notas }}
        aCarregar={alterar.aCorrer}
        onFechar={() => setEditar(false)}
        onGravar={async d => { if (await alterar.correr(d)) setEditar(false); }}
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
    </>
  );
}
