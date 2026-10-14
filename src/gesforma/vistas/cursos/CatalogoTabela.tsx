import { useMemo, useState, type ReactNode } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiApagarItem, apiCatalogo, apiCriarItem, apiEditarItem, textoUso, totalUso, type ItemCatalogo, type KindCatalogo, type Regime } from "../../../partilhado/api/catalogos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Estado, Filtros, Interruptor, PainelLateral, Selecao, Tabela, Vazio,
  useFiltrosUrl, type Coluna, type OpcaoSelecao,
} from "../../../partilhado/ui";

/** Um campo do formulário de edição. */
export type CampoCatalogo = {
  chave: string;
  rotulo: string;
  tipo?: "texto" | "numero" | "data" | "opcoes" | "area";
  opcoes?: OpcaoSelecao[];
  obrigatorio?: boolean;
  ajuda?: string;
  metade?: boolean;
  placeholder?: string;
};

/** Um filtro (além da pesquisa e do estado) aplicado a um campo do item. */
export type FiltroCatalogo = { chave: string; rotulo: string; vazio: string; opcoes: OpcaoSelecao[] };

export type ConfigCatalogo = {
  kind: KindCatalogo;
  regime: Regime;
  /** "local", "horário", … (para títulos e mensagens). */
  singular: string;
  plural: string;
  /** Campo onde o estado é guardado ("status" ou "estado", conforme o catálogo). */
  campoEstado: "status" | "estado";
  campos: CampoCatalogo[];
  colunas: Coluna<ItemCatalogo>[];
  rotulo: (item: ItemCatalogo) => string;
  pesquisa: (item: ItemCatalogo) => string;
  filtros?: FiltroCatalogo[];
  /** Valores por omissão de um item novo (ex.: curso escolhido no filtro). */
  novo?: (filtros: Record<string, string>) => Record<string, unknown>;
  /** Validação extra antes de gravar; devolve a mensagem de erro. */
  validar?: (valores: Record<string, unknown>, itens: ItemCatalogo[], id: number | null) => string | null;
  /** Ao gravar: completar valores (ex.: gerar código). */
  completar?: (valores: Record<string, unknown>, itens: ItemCatalogo[]) => Record<string, unknown>;
  /** Texto explicativo por cima da tabela (pode depender dos filtros activos). */
  nota?: ReactNode | ((filtros: Record<string, string>) => ReactNode);
  /** Capacidade necessária para editar. */
  capacidade?: Parameters<ReturnType<typeof usePode>>[0];
  /** Editor próprio (ex.: conteúdos com envio de ficheiro). Por omissão, o formulário gerado de `campos`. */
  editor?: (p: { item: ItemCatalogo | null; inicial: Record<string, unknown>; itens: ItemCatalogo[]; onFechar: () => void }) => ReactNode;
  /** Acções extra em cada linha (antes de Editar). */
  acoesExtra?: (item: ItemCatalogo) => ReactNode;
};

const ATIVO = (v: unknown) => !/^(inactiv|inativ|arquiv)/i.test(String(v ?? "Ativo"));

export function chaveCatalogo(kind: KindCatalogo, regime: Regime) {
  return `catalogo:${kind}:${regime}`;
}

/** Lista, filtra, cria, edita e apaga itens de um catálogo, com o uso de cada item vindo do servidor. */
export function CatalogoTabela({ config, acaoExtra }: { config: ConfigCatalogo; acaoExtra?: ReactNode }) {
  const { kind, regime } = config;
  const pode = usePode();
  const podeEditar = config.capacidade ? pode(config.capacidade) : true;
  const chave = chaveCatalogo(kind, regime);
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal => apiCatalogo(kind, regime, signal));
  const padrao = useMemo(() => {
    const p: Record<string, string> = { q: "", estado: "" };
    for (const f of config.filtros ?? []) p[f.chave] = "";
    return p;
  }, [config.filtros]);
  const [filtros, setFiltros, limpar] = useFiltrosUrl(padrao);
  const [aberto, setAberto] = useState<ItemCatalogo | "novo" | null>(null);
  const [apagar, setApagar] = useState<ItemCatalogo | null>(null);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const visiveis = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return itens.filter(i => {
      if (q && !config.pesquisa(i).toLowerCase().includes(q)) return false;
      if (filtros.estado === "ativo" && !ATIVO(i[config.campoEstado])) return false;
      if (filtros.estado === "inativo" && ATIVO(i[config.campoEstado])) return false;
      for (const f of config.filtros ?? []) if (filtros[f.chave] && String(i[f.chave] ?? "") !== filtros[f.chave]) return false;
      return true;
    });
  }, [itens, filtros, config]);

  const ativos = itens.filter(i => ATIVO(i[config.campoEstado])).length;
  const nFiltros = Object.entries(filtros).filter(([k, v]) => k !== "pagina" && v).length;

  const apagarAccao = useAccao((id: number) => apiApagarItem(kind, id), { ok: `${cap(config.singular)} eliminado.`, invalidar: [chave, "opcoes:"] });

  const colunas: Coluna<ItemCatalogo>[] = [
    ...config.colunas,
    {
      id: "uso", titulo: "Em uso", alinhar: "dir", esconderMovel: true,
      celula: i => (totalUso(i.uso) ? <span className="text-tinta">{textoUso(i.uso)}</span> : <span className="text-tinta-fraca">—</span>),
    },
    { id: "estado", titulo: "Estado", celula: i => <Estado tom={ATIVO(i[config.campoEstado]) ? "sucesso" : "neutro"} ponto>{ATIVO(i[config.campoEstado]) ? "Activo" : "Inactivo"}</Estado> },
  ];

  return (
    <div className="space-y-4">
      {typeof config.nota === "function" ? config.nota(filtros) : config.nota}
      <Filtros
        pesquisa={{ valor: filtros.q, onMudar: v => setFiltros({ q: v }), placeholder: `Pesquisar ${config.plural}…` }}
        selecoes={[
          ...(config.filtros ?? []).map(f => ({ chave: f.chave, rotulo: f.rotulo, vazio: f.vazio, opcoes: f.opcoes, valor: filtros[f.chave] ?? "", onMudar: (v: string) => setFiltros({ [f.chave]: v }) })),
          { chave: "estado", rotulo: "Estado", vazio: "Todos os estados", opcoes: [{ valor: "ativo", rotulo: "Activos" }, { valor: "inativo", rotulo: "Inactivos" }], valor: filtros.estado, onMudar: v => setFiltros({ estado: v }) },
        ]}
        ativos={nFiltros}
        onLimpar={limpar}
        extra={(
          <div className="flex items-center gap-2 ml-auto">
            <span className="num text-[13px] text-tinta-suave">{itens.length} {config.plural} · {ativos} activos</span>
            {acaoExtra}
            {podeEditar && <Botao variante="primario" onClick={() => setAberto("novo")}>Novo {config.singular}</Botao>}
          </div>
        )}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : (
        <Cartao semPadding>
          <Tabela
            rotulo={cap(config.plural)}
            linhas={visiveis}
            colunas={colunas}
            chave={i => i.id}
            aCarregar={aCarregar}
            onLinha={podeEditar ? i => setAberto(i) : undefined}
            acoesLinha={podeEditar || config.acoesExtra ? i => podeEditar ? (
              <div className="flex justify-end gap-1">
                {config.acoesExtra?.(i)}
                <Botao tamanho="sm" variante="fantasma" onClick={e => { e.stopPropagation(); setAberto(i); }}>Editar</Botao>
                <Botao tamanho="sm" variante="fantasma" onClick={e => { e.stopPropagation(); setApagar(i); }}>Eliminar</Botao>
              </div>
            ) : <div className="flex justify-end gap-1">{config.acoesExtra?.(i)}</div> : undefined}
            vazio={(
              <Vazio
                titulo={itens.length ? `Nenhum ${config.singular} corresponde aos filtros.` : `Ainda não há ${config.plural}.`}
                acao={itens.length ? <Botao variante="secundario" onClick={limpar}>Limpar filtros</Botao>
                  : podeEditar ? <Botao variante="primario" onClick={() => setAberto("novo")}>Criar o primeiro</Botao> : undefined}
              />
            )}
          />
        </Cartao>
      )}
      {aberto && config.editor && config.editor({
        item: aberto === "novo" ? null : aberto,
        inicial: aberto === "novo" ? { ...(config.novo?.(filtros) ?? {}), [config.campoEstado]: "Ativo" } : aberto,
        itens,
        onFechar: () => setAberto(null),
      })}
      {aberto && !config.editor && (
        <EditorItem
          config={config}
          item={aberto === "novo" ? null : aberto}
          itens={itens}
          inicial={aberto === "novo" ? { ...(config.novo?.(filtros) ?? {}), [config.campoEstado]: "Ativo" } : aberto}
          onFechar={() => setAberto(null)}
        />
      )}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo={`Eliminar ${config.singular}`}
        descricao={apagar ? (totalUso(apagar.uso)
          ? `«${config.rotulo(apagar)}» está em uso (${textoUso(apagar.uso)}). Em vez de eliminar, desactive-o: deixa de aparecer nas escolhas e os registos antigos mantêm-se.`
          : `«${config.rotulo(apagar)}» deixa de existir. Esta acção não se desfaz.`) : ""}
        onConfirmar={async () => { if (apagar) { await apagarAccao.correr(apagar.id); setApagar(null); } }}
      />
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function EditorItem({ config, item, itens, inicial, onFechar }: {
  config: ConfigCatalogo;
  item: ItemCatalogo | null;
  itens: ItemCatalogo[];
  inicial: Record<string, unknown>;
  onFechar: () => void;
}) {
  const [valores, setValores] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(inicial)) if (k !== "uso" && k !== "id" && k !== "regime") v[k] = x;
    return v;
  });
  const [erro, setErro] = useState<string | null>(null);
  const chave = chaveCatalogo(config.kind, config.regime);
  const gravar = useAccao(
    (payload: Record<string, unknown>) => (item ? apiEditarItem(config.kind, item.id, payload) : apiCriarItem(config.kind, config.regime, payload)),
    { ok: item ? "Alterações gravadas." : `${cap(config.singular)} criado.`, invalidar: [chave, "opcoes:", "catalogo:", "cursos:"] },
  );

  async function submeter() {
    for (const c of config.campos) {
      if (c.obrigatorio && !String(valores[c.chave] ?? "").trim()) {
        setErro(`Preencha «${c.rotulo}».`);
        return;
      }
    }
    const final = config.completar ? config.completar(valores, itens) : valores;
    const extra = config.validar?.(final, itens, item?.id ?? null);
    if (extra) { setErro(extra); return; }
    const limpo: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(final)) limpo[k] = typeof v === "string" ? v.trim() : v;
    for (const c of config.campos) if (c.tipo === "numero") limpo[c.chave] = Number(limpo[c.chave] ?? 0) || 0;
    const r = await gravar.correr(limpo);
    if (r) onFechar();
  }

  const ativo = ATIVO(valores[config.campoEstado]);
  return (
    <PainelLateral
      aberto
      onFechar={onFechar}
      titulo={item ? config.rotulo(item) || `Editar ${config.singular}` : `Novo ${config.singular}`}
      subtitulo={item && totalUso(item.uso) ? `Em uso: ${textoUso(item.uso)}. Mudar o nome actualiza esses registos.` : undefined}
      rodape={(
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void submeter()}>{item ? "Guardar" : "Criar"}</Botao>
        </div>
      )}
    >
      <form className="grid grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); void submeter(); }}>
        {erro && <Aviso tom="perigo" className="col-span-2">{erro}</Aviso>}
        {config.campos.map(c => (
          <Campo key={c.chave} rotulo={c.rotulo} obrigatorio={c.obrigatorio} ajuda={c.ajuda} className={c.metade ? "col-span-2 sm:col-span-1" : "col-span-2"}>
            {p => {
              const valor = String(valores[c.chave] ?? "");
              const mudar = (v: string) => { setErro(null); setValores(x => ({ ...x, [c.chave]: v })); };
              if (c.tipo === "opcoes") return <Selecao {...p} opcoes={garantir(c.opcoes ?? [], valor)} vazio="Escolher…" value={valor} onChange={e => mudar(e.target.value)} />;
              if (c.tipo === "area") return <AreaTexto {...p} value={valor} placeholder={c.placeholder} onChange={e => mudar(e.target.value)} />;
              return (
                <Entrada
                  {...p}
                  type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
                  min={c.tipo === "numero" ? 0 : undefined}
                  value={valor}
                  placeholder={c.placeholder}
                  onChange={e => mudar(e.target.value)}
                />
              );
            }}
          </Campo>
        ))}
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-controlo border border-linha px-3 py-2.5">
          <div>
            <p className="m-0 text-sm font-medium text-tinta">Activo</p>
            <p className="m-0 text-xs text-tinta-suave">Inactivo deixa de aparecer nas escolhas; os registos antigos mantêm-se.</p>
          </div>
          <Interruptor rotulo="Activo" ligado={ativo} onMudar={v => setValores(x => ({ ...x, [config.campoEstado]: v ? "Ativo" : "Inactivo" }))} />
        </div>
      </form>
    </PainelLateral>
  );
}

/** Mantém o valor actual visível mesmo que já não esteja nas opções (ex.: local desactivado). */
function garantir(opcoes: OpcaoSelecao[], valor: string): OpcaoSelecao[] {
  if (!valor || opcoes.some(o => o.valor === valor)) return opcoes;
  return [{ valor, rotulo: valor }, ...opcoes];
}
