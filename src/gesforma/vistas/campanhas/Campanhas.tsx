// Campanhas comerciais: números de cada campanha (pré-inscrições ligadas, pagamentos, receita, ROI),
// detalhe ao lado e criação/edição.
import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiCampanha, apiCampanhas, type Campanha } from "../../../partilhado/api/campanhas";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  BarrasHorizontais, Botao, Cartao, Chip, ErroCarregar, Esqueleto, Estado, Filtros, Kpi, KpiFaixa, PageHeader, Tabela, Vazio,
  data, eur, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { CampanhasEmail } from "./CampanhasEmail";
import { ApagarCampanha, FormCampanha } from "./FormCampanha";

const ESTADOS = [["ativas", "Ativas"], ["terminadas", "Terminadas"], ["todas", "Todas"]] as const;

function roi(v: number | null) {
  if (v == null) return { texto: "—", cls: "text-tinta-suave" };
  return { texto: `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v))} %`, cls: v >= 0 ? "text-sucesso" : "text-perigo" };
}

function periodo(c: Campanha) {
  return `${data(c.data)} → ${c.fim ? data(c.fim) : "sem fim"}`;
}

export default function Campanhas({ navigate }: VistaProps) {
  const pode = usePode();
  const gerir = pode("campanhas.gerir");
  const podeApagar = pode("campanhas.apagar");
  const [f, setF, limpar] = useFiltrosUrl({ estado: "ativas", canal: "", curso: "", responsavel: "", q: "", sel: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `campanhas:${f.estado}:${f.canal}:${f.curso}:${f.responsavel}:${f.q}`,
    signal => apiCampanhas({ estado: f.estado, canal: f.canal, curso: f.curso, responsavel: f.responsavel, q: f.q }, { signal }),
  );
  const canais = useOpcoes("lista", { lista: "origens" });
  const cursos = useOpcoes("cursos");
  const responsaveis = useOpcoes("comerciais");
  const [form, setForm] = useState<Campanha | "nova" | null>(null);
  const [apagar, setApagar] = useState<Campanha | null>(null);
  const lista = dados?.campanhas ?? [];
  const sel = lista.find(c => String(c.id) === f.sel) ?? lista[0] ?? null;
  const r = dados?.resumo;

  const colunas: Coluna<Campanha>[] = [
    {
      id: "nome", titulo: "Campanha", principal: true,
      celula: c => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{c.nome}</span>
          <span className="block text-xs text-tinta-suave">{periodo(c)}{c.curso ? ` · ${c.curso}` : ""}</span>
        </span>
      ),
    },
    { id: "canal", titulo: "Canal", celula: c => c.canal || "—", esconderMovel: true },
    { id: "pre", titulo: "Pré-inscrições", alinhar: "dir", celula: c => num(c.preinscricoes) },
    { id: "pagos", titulo: "Pagos", alinhar: "dir", celula: c => num(c.pagos) },
    { id: "conv", titulo: "Conversão", alinhar: "dir", celula: c => (c.preinscricoes ? `${num(c.conversao)} %` : "—") },
    { id: "receita", titulo: "Receita", alinhar: "dir", celula: c => eur(c.receita) },
    { id: "custo", titulo: "Custo", alinhar: "dir", esconderMovel: true, celula: c => (c.custo ? eur(c.custo) : "—") },
    { id: "roi", titulo: "ROI", alinhar: "dir", celula: c => { const x = roi(c.roi); return <span className={`font-semibold ${x.cls}`}>{x.texto}</span>; } },
  ];
  const ativos = [f.canal, f.curso, f.responsavel, f.q].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Gold", onClick: () => navigate("gold-painel") }, { rotulo: "Campanhas" }]}
        titulo="Campanhas"
        subtitulo="Os números contam as pré-inscrições ligadas a cada campanha e os pagamentos dessas pré-inscrições. O custo e o canal são da campanha."
        acoes={gerir ? <Botao variante="primario" onClick={() => setForm("nova")}>Nova campanha</Botao> : undefined}
      />
      <KpiFaixa rotulo="Campanhas activas" className="xl:grid-cols-5">
        <Kpi rotulo="Campanhas activas" valor={r?.ativas} delta={r ? `${num(r.total)} no total` : undefined} />
        <Kpi rotulo="Pré-inscrições (activas)" valor={r?.preinscricoes} delta={r ? { texto: `${num(r.porContactar)} por contactar`, tom: r.porContactar ? "aviso" : "neutro" } : undefined} />
        <Kpi rotulo="Receita confirmada" valor={r?.receita} formato="eur" delta={r ? `${num(r.pagos)} pagamentos` : undefined} />
        <Kpi rotulo="Custo anunciado" valor={r?.custo} formato="eur" delta="campanhas activas" />
        <Kpi rotulo="ROI das activas" valor={r ? roi(r.roi).texto : undefined} delta="só campanhas com custo" />
      </KpiFaixa>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado das campanhas">
        {ESTADOS.map(([id, rot]) => <Chip key={id} ativo={f.estado === id} onClick={() => setF({ estado: id })}>{rot}</Chip>)}
      </div>
      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Nome ou notas…", rotulo: "Pesquisar campanhas" }}
        selecoes={[
          { chave: "canal", rotulo: "Canal", vazio: "Canal: todos", opcoes: canais.selecao, valor: f.canal, onMudar: canal => setF({ canal }) },
          { chave: "curso", rotulo: "Curso", vazio: "Curso: todos", opcoes: cursos.selecao, valor: f.curso, onMudar: curso => setF({ curso }) },
          { chave: "responsavel", rotulo: "Responsável", vazio: "Responsável: todos", opcoes: responsaveis.opcoes.map(o => ({ valor: o.rotulo, rotulo: o.rotulo })), valor: f.responsavel, onMudar: responsavel => setF({ responsavel }) },
        ]}
        ativos={ativos}
        onLimpar={() => setF({ canal: "", curso: "", responsavel: "", q: "" })}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <Cartao semPadding>
          <Tabela
            rotulo="Campanhas"
            linhas={lista}
            colunas={colunas}
            chave={c => c.id}
            onLinha={c => setF({ sel: String(c.id) })}
            linhaAtiva={sel?.id ?? null}
            aCarregar={aCarregar}
            vazio={(
              <Vazio
                titulo={ativos || f.estado !== "todas" ? "Nenhuma campanha com estes filtros." : "Ainda sem campanhas."}
                descricao="Crie uma campanha e escolha-a nas pré-inscrições que dela resultam: os números aparecem aqui."
                acao={ativos ? <Botao onClick={limpar}>Limpar filtros</Botao> : gerir ? <Botao variante="primario" onClick={() => setForm("nova")}>Nova campanha</Botao> : undefined}
              />
            )}
          />
        </Cartao>
        {sel && <Detalhe id={sel.id} gerir={gerir} onEditar={setForm} onApagar={podeApagar ? setApagar : undefined} />}
      </div>
      <CampanhasEmail campanhas={lista} gerir={gerir} />
      <FormCampanha campanha={form} onFechar={() => setForm(null)} onGravada={id => setF({ sel: String(id) })} />
      <ApagarCampanha campanha={apagar} onFechar={() => setApagar(null)} onApagada={() => setF({ sel: "" })} />
    </div>
  );
}

function Detalhe({ id, gerir, onEditar, onApagar }: { id: number; gerir: boolean; onEditar: (c: Campanha) => void; onApagar?: (c: Campanha) => void }) {
  const { dados, erro, recarregar } = useRecurso(`campanhas:ficha:${id}`, signal => apiCampanha(id, { signal }));
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  const c = dados?.campanha;
  if (!c) return <Cartao><Esqueleto linhas={8} /></Cartao>;
  const x = roi(c.roi);
  const stats: [string, string, string?][] = [
    ["Pré-inscrições", num(c.preinscricoes)],
    ["Pagamentos", num(c.pagos)],
    ["Receita", eur(c.receita), "text-sucesso"],
    ["ROI", x.texto, x.cls],
    ["Conversão", c.preinscricoes ? `${num(c.conversao)} %` : "—"],
    ["Ticket médio", c.pagos ? eur(c.ticketMedio) : "—"],
    ["Por contactar", num(c.porContactar), c.porContactar ? "text-aviso" : undefined],
    ["Desistiram", num(c.desistiram), c.desistiram ? "text-perigo" : undefined],
  ];
  return (
    <Cartao
      titulo={c.nome}
      subtitulo={`${periodo(c)}${c.encarregado ? ` · ${c.encarregado}` : ""}`}
      acoes={<Estado tom={c.ativa ? "sucesso" : "neutro"} ponto>{c.ativa ? "Activa" : "Terminada"}</Estado>}
      className="xl:sticky xl:top-4"
    >
      <p className="m-0 mb-4 text-[13px] text-tinta-suave">{[c.canal && `Canal: ${c.canal}`, c.curso && `Curso: ${c.curso}`].filter(Boolean).join(" · ") || "Sem canal nem curso indicados."}</p>
      <dl className="num m-0 grid grid-cols-2 gap-2">
        {stats.map(([rot, v, cls]) => (
          <div key={rot} className="rounded-controlo bg-fundo px-3 py-2">
            <dt className="text-xs text-tinta-suave">{rot}</dt>
            <dd className={`m-0 text-base font-semibold ${cls ?? "text-tinta"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 mb-2 text-sm font-semibold text-tinta">Como chegaram</h3>
      <BarrasHorizontais rotulo="Origem das pré-inscrições" itens={c.origens.map(o => ({ rotulo: o.origem, valor: o.n }))} vazio="Ainda sem pré-inscrições ligadas a esta campanha." />
      <h3 className="mt-5 mb-2 text-sm font-semibold text-tinta">Custo e receita</h3>
      <dl className="num m-0 text-[13px] grid grid-cols-[1fr_auto] gap-y-1">
        <dt className="text-tinta-suave">Custo</dt><dd className="m-0 text-right">{c.custo ? eur(c.custo) : "Sem custo"}</dd>
        <dt className="text-tinta-suave">Receita confirmada</dt><dd className="m-0 text-right">{eur(c.receita)}</dd>
        <dt className="text-tinta-suave">Receita se todas pagarem</dt><dd className="m-0 text-right">{eur(c.receitaEstimada)}</dd>
        <dt className="text-tinta-suave">Formandos</dt><dd className="m-0 text-right">{num(c.formandos)}</dd>
      </dl>
      {c.notas && <p className="mt-4 mb-0 text-[13px] text-tinta whitespace-pre-wrap rounded-controlo bg-fundo px-3 py-2">{c.notas}</p>}
      {gerir && (
        <div className="mt-5 flex gap-2">
          <Botao onClick={() => onEditar(c)}>Editar</Botao>
          {onApagar && <Botao variante="fantasma" className="text-perigo" onClick={() => onApagar(c)}>Apagar</Botao>}
        </div>
      )}
    </Cartao>
  );
}
