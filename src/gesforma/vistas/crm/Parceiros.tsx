// Parceiros: quem encaminha formandos ou clientes, o comercial responsável e a retribuição. A ficha edita-se no painel ao lado.
import { useEffect, useState } from "react";
import {
  apiAlterarParceiro, apiApagarParceiro, apiCriarParceiro, apiParceiros, type DadosParceiro, type Parceiro,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Botao, ConfirmarPerigo, ErroCarregar, num, useFiltrosUrl } from "../../../partilhado/ui";
import { CabecalhoLista, iniciais, ListaComDetalhe, useGestao } from "./comum";
import { TabelaLista, type ColunaLista } from "./TabelaLista";

const VAZIO: DadosParceiro = { nome: "", email: "", telf: "", tipo: "", notas: "", comercialId: null, retribuicao: "" };
const FILTRO = "h-9 rounded-lg border border-linha-forte bg-white px-2.5 text-[13px] text-tinta";
const CONTROLO = "h-[38px] border border-linha-forte rounded-lg px-2.5 text-sm font-normal text-tinta bg-white w-full min-w-0";
const MODOS = ["Percentagem por inscrito", "Valor fixo por inscrito", "Sem retribuição", "Outra"] as const;

/** "Percentagem por inscrito · 10 %" ↔ { modo, valor }. Texto livre antigo fica em "Outra". */
function lerRetribuicao(t: string): { modo: (typeof MODOS)[number]; valor: string } {
  if (!t.trim()) return { modo: "Sem retribuição", valor: "" };
  const m = MODOS.find(x => t === x || t.startsWith(`${x} · `));
  return m && m !== "Outra" ? { modo: m, valor: t.slice(m.length + 3) } : { modo: "Outra", valor: t };
}
function escreverRetribuicao(modo: (typeof MODOS)[number], valor: string) {
  if (modo === "Sem retribuição") return "";
  if (modo === "Outra") return valor.trim();
  return valor.trim() ? `${modo} · ${valor.trim()}` : modo;
}

export default function Parceiros(_: { view: string }) {
  const [f, setF] = useFiltrosUrl({ q: "", tipo: "", comercial: "", parceiro: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:parceiros:${f.q}:${f.tipo}:${f.comercial}`, signal => apiParceiros({ q: f.q, tipo: f.tipo, comercial: f.comercial }, { signal }));
  const tipos = useOpcoes("lista", { lista: "tipos_parceria" });
  const comerciais = useOpcoes("comerciais");
  const lista = dados?.parceiros ?? [];
  const novo = f.parceiro === "novo";
  const selecionado = novo ? null : lista.find(p => String(p.id) === f.parceiro) ?? lista[0] ?? null;

  const colunas: ColunaLista<Parceiro>[] = [
    { titulo: "Parceiro", celula: p => <><div className="font-semibold">{p.nome}</div><div className="text-xs text-tinta-suave mt-0.5 truncate max-w-[280px]">{[p.tipo, p.email || p.telf].filter(Boolean).join(" · ") || "Sem contacto"}</div></> },
    {
      titulo: "Comercial", corrido: true, celula: p => p.comercial ? (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-6 w-6 rounded-full bg-[#FFF4DB] text-[11px] font-bold text-[#7A4A00] inline-flex items-center justify-center">{iniciais(p.comercial)}</span>
          {p.comercial}
        </span>
      ) : <span className="text-tinta-suave">Sem comercial</span>,
    },
    { titulo: "Retribuição", celula: p => <span className="line-clamp-2">{p.retribuicao || "Sem retribuição"}</span> },
  ];

  return (
    <ListaComDetalhe
      rotulo="Editar parceiro"
      detalhe={novo || selecionado ? (
        <FichaParceiro
          key={novo ? "novo" : selecionado!.id}
          parceiro={novo ? null : selecionado}
          tipos={tipos.selecao}
          comerciais={comerciais.selecao}
          onGuardado={id => setF({ parceiro: String(id) })}
          onCancelar={() => setF({ parceiro: "" })}
        />
      ) : undefined}
    >
      <CabecalhoLista
        titulo="Parceiros"
        resumo={dados ? `${num(lista.length)} parceiros · cada um ligado a um comercial e às condições de retribuição` : " "}
        acoes={(
          <Botao variante="primario" onClick={() => setF({ parceiro: "novo" })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="mr-2"><path d="M12 5v14M5 12h14" /></svg>
            Novo parceiro
          </Botao>
        )}
      />
      <div className="flex gap-2 flex-wrap items-center">
        <label className="flex items-center gap-2 h-9 px-3 rounded-lg border border-linha-forte bg-white flex-[1_1_240px] max-w-[360px] text-tinta-suave">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr-only">Filtrar parceiros</span>
          <input type="search" value={f.q} onChange={e => setF({ q: e.target.value })} placeholder="Nome ou email" className="border-0 outline-none bg-transparent flex-1 min-w-0 text-sm text-tinta" />
        </label>
        <select aria-label="Tipo" value={f.tipo} onChange={e => setF({ tipo: e.target.value })} className={FILTRO}>
          <option value="">Tipo: todos</option>
          {tipos.selecao.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <select aria-label="Comercial" value={f.comercial} onChange={e => setF({ comercial: e.target.value })} className={FILTRO}>
          <option value="">Comercial: todos</option>
          {comerciais.selecao.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <TabelaLista
        rotulo="Parceiros"
        minimo={620}
        colunas={colunas}
        linhas={lista}
        chave={p => p.id}
        selecionado={selecionado?.id ?? null}
        onLinha={p => setF({ parceiro: String(p.id) })}
        aCarregar={aCarregar && !dados}
        vazio={f.q || f.tipo || f.comercial ? "Nenhum parceiro com estes filtros." : "Ainda sem parceiros. Registe quem encaminha formandos: associações, empresas, escolas ou particulares."}
      />
    </ListaComDetalhe>
  );
}

function FichaParceiro({ parceiro, tipos, comerciais, onGuardado, onCancelar }: {
  parceiro: Parceiro | null;
  tipos: { valor: string; rotulo: string }[];
  comerciais: { valor: string; rotulo: string }[];
  onGuardado: (id: number) => void;
  onCancelar: () => void;
}) {
  const gestao = useGestao();
  const [d, setD] = useState<DadosParceiro>(VAZIO);
  const [ret, setRet] = useState(lerRetribuicao(""));
  const [erro, setErro] = useState<string | null>(null);
  const [apagar, setApagar] = useState(false);
  useEffect(() => {
    setErro(null);
    const base = parceiro ? {
      nome: parceiro.nome, email: parceiro.email, telf: parceiro.telf, tipo: parceiro.tipo, notas: parceiro.notas,
      comercialId: parceiro.comercialId, retribuicao: parceiro.retribuicao,
    } : VAZIO;
    setD(base);
    setRet(lerRetribuicao(base.retribuicao));
  }, [parceiro]);
  const gravar = useAccao(
    async (x: DadosParceiro) => (parceiro ? apiAlterarParceiro(parceiro.id, x).then(() => ({ id: parceiro.id })) : apiCriarParceiro(x).then(r => ({ id: r.parceiro.id }))),
    { ok: parceiro ? "Parceiro guardado." : "Parceiro criado.", invalidar: ["crm:parceiros"] },
  );
  async function guardar() {
    if (!d.nome.trim()) return setErro("Indique o nome.");
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return setErro("O email não parece válido.");
    const r = await gravar.correr({ ...d, nome: d.nome.trim(), email: d.email.trim(), retribuicao: escreverRetribuicao(ret.modo, ret.valor) });
    if (r) onGuardado(r.id);
  }
  const tiposComAtual = d.tipo && !tipos.some(t => t.valor === d.tipo) ? [...tipos, { valor: d.tipo, rotulo: d.tipo }] : tipos;
  const rot = "flex flex-col gap-1.5 text-xs font-semibold text-tinta-suave";

  return (
    <>
      <div>
        <p className="m-0 text-xs text-tinta-suave">{parceiro ? "Parceiro" : "Novo parceiro"}</p>
        <h2 className="m-0 mt-0.5 text-lg font-semibold text-tinta">{parceiro ? parceiro.nome : "Dados do parceiro"}</h2>
      </div>
      <label className={rot}>Nome
        <input className={CONTROLO} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} aria-invalid={Boolean(erro)} />
      </label>
      {erro && <p role="alert" className="m-0 -mt-3 text-xs text-perigo">{erro}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className={rot}>Tipo
          <select className={CONTROLO} value={d.tipo} onChange={e => setD({ ...d, tipo: e.target.value })}>
            <option value="">Sem tipo</option>
            {tiposComAtual.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </label>
        <label className={rot}>Comercial
          <select className={CONTROLO} value={d.comercialId ?? ""} onChange={e => setD({ ...d, comercialId: e.target.value || null })}>
            <option value="">Sem comercial</option>
            {comerciais.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </label>
        <label className={rot}>Email
          <input className={CONTROLO} type="email" value={d.email} onChange={e => setD({ ...d, email: e.target.value })} />
        </label>
        <label className={rot}>Telemóvel
          <input className={CONTROLO} type="tel" value={d.telf} onChange={e => setD({ ...d, telf: e.target.value })} />
        </label>
      </div>
      <div className={rot}>
        Retribuição
        <span className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
          <select aria-label="Tipo de retribuição" className={CONTROLO} value={ret.modo} onChange={e => setRet({ modo: e.target.value as (typeof MODOS)[number], valor: ret.valor })}>
            {MODOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input aria-label="Valor da retribuição" className={CONTROLO} value={ret.valor} disabled={ret.modo === "Sem retribuição"} onChange={e => setRet({ ...ret, valor: e.target.value })}
            placeholder={ret.modo === "Percentagem por inscrito" ? "10 %" : ret.modo === "Valor fixo por inscrito" ? "€ 15" : ""} />
        </span>
      </div>
      <label className={rot}>Notas
        <textarea rows={3} className="border border-linha-forte rounded-lg p-2.5 text-sm font-normal text-tinta bg-white resize-y" value={d.notas} onChange={e => setD({ ...d, notas: e.target.value })} />
      </label>
      <div className="mt-auto flex gap-2 border-t border-[#EEF0F3] pt-4">
        {gestao && parceiro && <Botao variante="fantasma" className="text-perigo" onClick={() => setApagar(true)}>Remover</Botao>}
        <Botao className="ml-auto" onClick={onCancelar}>Cancelar</Botao>
        <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void guardar()}>Guardar</Botao>
      </div>
      {parceiro && (
        <ConfirmarPerigo
          aberto={apagar}
          onFechar={() => setApagar(false)}
          titulo="Remover parceiro"
          descricao={`O parceiro «${parceiro.nome}» deixa de aparecer na lista. Esta acção não se desfaz.`}
          onConfirmar={async () => {
            try {
              await apiApagarParceiro(parceiro.id);
              invalidar("crm:parceiros");
              toastOk("Parceiro removido.");
              onCancelar();
            } catch (e) {
              toastError(e, "Não foi possível remover o parceiro.");
            }
          }}
        />
      )}
    </>
  );
}
