// Equipa comercial (Gold) ou da Financiada: indicadores do período comparados com o período anterior,
// a carteira de cada pessoa e, no painel ao lado, o funil, os objectivos e o que há para seguir.
import { useState } from "react";
import { apiEquipa, apiMembro, type Membro } from "../../../partilhado/api/equipa";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { ErroCarregar, Esqueleto, data, dataHora, evolucao, num, useFiltrosUrl } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { CabecalhoLista, iniciais, ListaComDetalhe, regimeDaVista } from "../crm/comum";
import { eurosCurto } from "../crm/documento/modelo";
import { TabelaLista, type ColunaLista } from "../crm/TabelaLista";
import { FichaMembro, type TabMembro } from "./FichaMembro";

const hoje = () => new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PERIODOS: { id: string; rotulo: string; de: () => string; ate: () => string }[] = [
  { id: "mes", rotulo: "Este mês", de: () => iso(new Date(hoje().getFullYear(), hoje().getMonth(), 1)), ate: () => iso(hoje()) },
  { id: "30", rotulo: "Últimos 30 dias", de: () => iso(new Date(Date.now() - 29 * 864e5)), ate: () => iso(hoje()) },
  { id: "trim", rotulo: "Este trimestre", de: () => iso(new Date(hoje().getFullYear(), Math.floor(hoje().getMonth() / 3) * 3, 1)), ate: () => iso(hoje()) },
  { id: "ano", rotulo: "Este ano", de: () => iso(new Date(hoje().getFullYear(), 0, 1)), ate: () => iso(hoje()) },
];

export default function Equipa({ view }: VistaProps) {
  const regime = regimeDaVista(view);
  const [f, setF] = useFiltrosUrl({ q: "", periodo: "mes", sel: "" });
  const per = PERIODOS.find(p => p.id === f.periodo) ?? PERIODOS[0]!;
  const de = per.de();
  const ate = per.ate();
  const { dados, erro, aCarregar, recarregar } = useRecurso(`equipa:${regime}:${de}:${ate}`, signal => apiEquipa(regime, { de, ate }, { signal }));
  const [ficha, setFicha] = useState<{ id: string; tab: TabMembro } | null>(null);
  const termo = f.q.trim().toLowerCase();
  const membros = (dados?.membros ?? []).filter(m => !termo || `${m.nome} ${m.email}`.toLowerCase().includes(termo));
  const sel = membros.find(m => m.id === f.sel) ?? membros[0] ?? null;
  const t = dados?.totais;
  const conversaoEquipa = t && t.atual.leads ? Math.round((t.atual.pagos / t.atual.leads) * 100) : 0;
  const metaMedia = (() => {
    const metas = (dados?.membros ?? []).map(m => m.objetivo.conversao).filter((x): x is number => x != null && x > 0);
    return metas.length ? Math.round(metas.reduce((s, x) => s + x, 0) / metas.length) : null;
  })();
  const ev = (a: number, b: number) => {
    const e = evolucao(a, b);
    return e.delta == null ? "sem base no período anterior" : `${e.texto} face ao período anterior`;
  };

  const colunas: ColunaLista<Membro>[] = [
    {
      titulo: "Comercial", celula: m => (
        <span className="flex items-center gap-2.5 min-w-0">
          <span aria-hidden="true" className={`h-8 w-8 shrink-0 rounded-full text-xs font-bold inline-flex items-center justify-center ${m.ativo ? "bg-[#FFF4DB] text-[#7A4A00]" : "bg-[#EEF0F3] text-tinta-suave"}`}>{iniciais(m.nome)}</span>
          <span className="min-w-0">
            <span className="block font-semibold text-tinta truncate">{m.nome}</span>
            <span className="block text-xs text-tinta-suave truncate">{m.ativo ? (m.ultimoAcesso ? `activo · ${data(m.ultimoAcesso)}` : "activo") : "conta inactiva"}</span>
          </span>
        </span>
      ),
    },
    { titulo: "Carteira", dir: true, celula: m => <span className="num">{num(m.carteira.leads)}</span> },
    { titulo: "Por contactar", dir: true, celula: m => <span className={`num ${m.carteira.porContactar >= 8 ? "font-semibold text-perigo" : ""}`}>{num(m.carteira.porContactar)}</span> },
    { titulo: "Propostas", dir: true, celula: m => <span className="num">{num(m.carteira.propostasAbertas)}</span> },
    { titulo: "Conversão vs objectivo", celula: m => <BarraMeta valor={m.carteira.conversao} meta={m.objetivo.conversao} /> },
    { titulo: "Receita", dir: true, celula: m => <span className="num">{eurosCurto(m.atual.receita)}</span> },
  ];

  return (
    <ListaComDetalhe
      rotulo="Ficha do comercial"
      detalhe={sel ? <Resumo key={sel.id} membro={sel} regime={regime} de={de} ate={ate} onAbrir={tab => setFicha({ id: sel.id, tab })} /> : undefined}
    >
      <CabecalhoLista
        titulo={regime === "fin" ? "Equipa da Financiada" : "Equipa comercial"}
        resumo={t ? `${num(t.ativos)} ${regime === "fin" ? "pessoas activas" : "comerciais activos"} · ${per.rotulo.toLowerCase()} (${data(de)} a ${data(ate)})` : " "}
        acoes={(
          <>
            <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-linha-forte bg-white text-tinta-suave">
              <span className="sr-only">Pesquisar na equipa</span>
              <input type="search" value={f.q} onChange={e => setF({ q: e.target.value })} placeholder="Nome ou email" className="border-0 outline-none bg-transparent w-40 text-sm text-tinta" />
            </label>
            <select aria-label="Período" value={f.periodo} onChange={e => setF({ periodo: e.target.value })} className="h-10 rounded-lg border border-linha-forte bg-white px-3 text-sm font-semibold text-tinta">
              {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </>
        )}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <div className="num grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pré-inscrições na carteira", t ? num(t.carteira) : "—", t ? `${num(t.porContactar)} por contactar` : ""],
          ["Propostas abertas", t ? eurosCurto(t.pipeline) : "—", t ? `${num(t.atual.propostas)} propostas no período` : ""],
          ["Conversão", t ? `${num(conversaoEquipa)} %` : "—", metaMedia != null ? `objectivo ${num(metaMedia)} %` : "sem objectivo definido"],
          ["Receita fechada", t ? eurosCurto(t.atual.receita) : "—", t ? ev(t.atual.receita, t.anterior.receita) : ""],
        ].map(([r, v, s]) => (
          <div key={r} className="bg-white border border-linha rounded-[10px] p-4">
            <p className="m-0 text-xs text-tinta-suave">{r}</p>
            <p className="m-0 mt-1.5 text-2xl font-semibold text-tinta">{aCarregar && !t ? <span className="inline-block w-16 h-6 rounded bg-[#EEF0F3] animate-pulse" /> : v}</p>
            <p className="m-0 mt-0.5 text-xs text-tinta-suave">{s}</p>
          </div>
        ))}
      </div>
      <TabelaLista
        rotulo="Equipa"
        minimo={680}
        colunas={colunas}
        linhas={membros}
        chave={m => m.id}
        selecionado={sel?.id ?? null}
        onLinha={m => setF({ sel: m.id })}
        aCarregar={aCarregar && !dados}
        vazio={dados?.membros.length ? "Ninguém corresponde à pesquisa." : `Ainda não há contas nesta equipa. Crie contas com o perfil ${regime === "fin" ? "Financiada" : "Comercial"} em Sistema › Utilizadores.`}
      />
      {ficha && <FichaMembro id={ficha.id} regime={regime} de={de} ate={ate} tabInicial={ficha.tab} onFechar={() => setFicha(null)} />}
    </ListaComDetalhe>
  );
}

function BarraMeta({ valor, meta }: { valor: number; meta: number | null }) {
  const escala = Math.max(50, (meta ?? 0) + 10, valor);
  const cumpre = meta != null && meta > 0 && valor >= meta;
  return (
    <div className="min-w-[150px]" title={meta ? `Objectivo: ${meta} %` : "Sem objectivo"}>
      <div className="num flex text-[13px]"><span className="font-semibold">{num(valor)} %</span><span className="ml-auto text-xs text-tinta-suave">{meta ? `meta ${num(meta)} %` : "sem meta"}</span></div>
      <div className="relative h-1.5 mt-1 rounded bg-[#EEF0F3]" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (valor / escala) * 100)}%`, background: cumpre ? "#1F7A4D" : "#9A5B00" }} />
        {meta ? <span className="absolute -top-1 -bottom-1 w-0.5 bg-tinta" style={{ left: `${Math.min(100, (meta / escala) * 100)}%` }} /> : null}
      </div>
    </div>
  );
}

const ABAS: { id: "resumo" | TabMembro; rotulo: string }[] = [
  { id: "resumo", rotulo: "Resumo" }, { id: "leads", rotulo: "Pré-inscrições" }, { id: "propostas", rotulo: "Propostas" }, { id: "diario", rotulo: "Diário" },
];

function Resumo({ membro: m, regime, de, ate, onAbrir }: { membro: Membro; regime: "gold" | "fin"; de: string; ate: string; onAbrir: (tab: TabMembro) => void }) {
  const ficha = useRecurso(`equipa:${regime}:membro:${m.id}:${de}:${ate}`, signal => apiMembro(m.id, regime, { de, ate }, { signal }));
  const seguir = ficha.dados?.seguir ?? [];
  const funil = [
    ["Por contactar", m.carteira.porContactar],
    ["Em conversa", m.carteira.emConversa],
    ["Pagamento pedido", m.carteira.pagamentoPedido],
    [regime === "fin" ? "Validados" : "Formandos", m.carteira.formandos],
  ] as const;
  const max = Math.max(1, ...funil.map(([, n]) => n));
  return (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-12 w-12 shrink-0 rounded-full bg-[#FFF4DB] text-[#7A4A00] text-base font-bold inline-flex items-center justify-center">{iniciais(m.nome)}</span>
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-semibold text-tinta truncate">{m.nome}</h2>
          <p className="m-0 text-[13px] text-tinta-suave truncate">{[m.email, m.telefone].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div role="tablist" aria-label="Ficha" className="flex gap-5 border-b border-linha">
        {ABAS.map(a => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === "resumo"} onClick={() => a.id !== "resumo" && onAbrir(a.id)}
            className="border-0 bg-transparent py-2 -mb-px text-[13px] font-semibold cursor-pointer"
            style={{ color: a.id === "resumo" ? "#18202C" : "#5A6474", borderBottom: `2px solid ${a.id === "resumo" ? "#FFB020" : "transparent"}` }}>
            {a.rotulo}
          </button>
        ))}
      </div>
      <section className="flex flex-col gap-2.5">
        <h3 className="m-0 text-sm font-semibold text-tinta">Carteira por etapa</h3>
        {funil.map(([r, n]) => (
          <div key={r} className="num grid grid-cols-[120px_minmax(0,1fr)_32px] gap-2.5 items-center text-[13px]">
            <span className="text-tinta">{r}</span>
            <span className="relative h-2 rounded bg-[#EEF0F3]"><span className="absolute inset-y-0 left-0 rounded bg-[#1D4E89]" style={{ width: `${(n / max) * 100}%` }} /></span>
            <span className="text-right">{num(n)}</span>
          </div>
        ))}
        {m.carteira.maisAntigoPorContactar && <p className="m-0 text-xs text-[#9A5B00]">Por contactar desde {data(m.carteira.maisAntigoPorContactar)}</p>}
      </section>
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center"><h3 className="m-0 text-sm font-semibold text-tinta">Objectivos do período</h3>
          <button type="button" onClick={() => onAbrir("objetivos")} className="ml-auto border-0 bg-transparent p-0 text-ligacao font-semibold text-[13px] cursor-pointer hover:underline">Editar</button></div>
        <dl className="num m-0 grid grid-cols-3 gap-2">
          {[
            ["Conversão", `${num(m.atual.conversao)} / ${m.objetivo.conversao != null ? num(m.objetivo.conversao) : "—"} %`],
            ["Pré-inscrições", `${num(m.atual.leads)} / ${m.objetivo.leads ? num(m.objetivo.leads) : "—"}`],
            ["Propostas", `${num(m.atual.propostas)} / ${m.objetivo.propostas ? num(m.objetivo.propostas) : "—"}`],
          ].map(([r, v]) => (
            <div key={r} className="rounded-lg bg-fundo px-3 py-2">
              <dt className="text-[11px] text-tinta-suave">{r}</dt>
              <dd className="m-0 text-[15px] font-semibold text-tinta">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="m-0 mb-1 text-sm font-semibold text-tinta">A seguir</h3>
        {ficha.aCarregar && !ficha.dados ? <Esqueleto linhas={2} /> : seguir.length === 0 ? (
          <p className="m-0 text-[13px] text-tinta-suave">Nada pendente: sem propostas paradas nem pagamentos à espera.</p>
        ) : seguir.map(s => (
          <button key={`${s.tipo}-${s.id}`} type="button" onClick={() => onAbrir(s.tipo === "proposta" ? "propostas" : "leads")}
            className="flex items-center gap-2 text-left py-2.5 border-0 border-t border-solid border-[#EEF0F3] bg-transparent cursor-pointer hover:bg-fundo">
            <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-tinta">{s.titulo}</span><span className="block text-xs text-tinta-suave">{s.detalhe}</span></span>
            <span aria-hidden="true" className="text-[#A3ABB8]">›</span>
          </button>
        ))}
      </section>
      <p className="m-0 mt-auto text-xs text-tinta-suave">{m.ultimoAcesso ? `Último acesso ${dataHora(m.ultimoAcesso)}` : "Ainda sem acessos"}</p>
    </>
  );
}
