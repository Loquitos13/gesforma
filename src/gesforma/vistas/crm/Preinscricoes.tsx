// CRM de pré-inscrições (Gold e Financiada): filas de trabalho, filtros no URL, lista ou pipeline,
// acções em lote e a ficha da pré-inscrição. Tudo vem do servidor (`/v1/crm/*`).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Botao, ConfirmarPerigo, ErroCarregar, Filtros, PageHeader, Paginacao, Separadores, Vazio, num, useFiltrosUrl,
} from "../../../partilhado/ui";
import {
  apiApagarLead, apiComerciais, apiEditarLead, apiEtiquetas, apiExportarLeads, apiLeads, apiNota,
  type CrmFila, type CrmSort, type FiltrosCrm, type Lead,
} from "../../../partilhado/api/crm";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useAuth } from "../../../partilhado/AuthGate";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import type { VistaProps } from "../../shell/tipos";
import { WhatsappSimulador } from "../../WhatsappSimulador";
import { BarraLote } from "./preinscricoes/BarraLote";
import { FichaLead } from "./preinscricoes/FichaLead";
import { NovaPreinscricao } from "./preinscricoes/NovaPreinscricao";
import { Pipeline } from "./preinscricoes/Pipeline";
import { TabelaLeads } from "./preinscricoes/TabelaLeads";
import { ETAPAS, hojeLisboa, nomeCompleto, podeMudarEtapa, rotuloEtapa } from "./preinscricoes/util";

const PADRAO = {
  q: "", fila: "", estado: "", curso: "", local: "", origem: "", comercial: "", entrada: "",
  de: "", ate: "", ordem: "-inscrito", pagina: "1", porPagina: "50", vista: "lista",
};

const SORTS: CrmSort[] = ["inscrito", "proximo", "valor", "nome", "actividade", "comercial", "origem", "meio", "etiqueta", "curso", "turma", "estado"];

export default function Preinscricoes({ view, params, limpar }: VistaProps) {
  const regime = view === "fin-preinscricoes" ? "fin" : "gold";
  const { user, pode } = useAuth();
  const [f, setF, limparFiltros] = useFiltrosUrl(PADRAO);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [ficha, setFicha] = useState<number | null>(null);
  const [editar, setEditar] = useState<{ aberto: boolean; lead: Lead | null }>({ aberto: false, lead: null });
  const [apagar, setApagar] = useState<Lead | null>(null);
  const [whatsapp, setWhatsapp] = useState(false);
  const hoje = hojeLisboa();

  // Ficha aberta a partir da pesquisa global ou de uma notificação.
  useEffect(() => {
    if (!params.leadId) return;
    setFicha(params.leadId);
    limpar("leadId");
  }, [params.leadId, limpar]);

  const campoOrdem = f.ordem.replace(/^-/, "");
  const filtros: FiltrosCrm = {
    regime,
    q: f.q,
    fila: f.fila as CrmFila | "",
    estado: f.estado,
    curso: f.curso,
    local: f.local,
    origem: f.origem,
    comercialId: f.comercial,
    entrada: f.entrada as FiltrosCrm["entrada"],
    de: f.de,
    ate: f.ate,
    page: Number(f.pagina) || 1,
    perPage: Number(f.porPagina) || 50,
    sort: (SORTS.includes(campoOrdem as CrmSort) ? campoOrdem : "inscrito") as CrmSort,
    dir: f.ordem.startsWith("-") ? "desc" : "asc",
    kanban: f.vista === "pipeline",
  };
  const chave = `crm:leads:${JSON.stringify(filtros)}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, s => apiLeads(filtros, s));
  const cursos = useOpcoes("cursos", { regime });
  const locais = useOpcoes("locais", { regime });
  const origens = useOpcoes("lista", { lista: "origens" });
  const comerciais = useRecurso(`crm:comerciais:${regime}`, s => apiComerciais(regime, s));
  const etiquetas = useRecurso("crm:etiquetas", s => apiEtiquetas(s));
  const opComerciais = useMemo(() => (comerciais.dados?.comerciais ?? []).map(c => ({ valor: c.id, rotulo: c.name })), [comerciais.dados]);

  // Mudar de filtros limpa a selecção (as linhas deixam de estar visíveis).
  useEffect(() => { setSelecionados(new Set()); }, [chave]);

  const c = dados?.counts;
  const filas: { id: CrmFila | ""; rotulo: string; contagem?: number }[] = [
    { id: "", rotulo: "Todas", contagem: c?.total },
    { id: "hoje", rotulo: "Hoje", contagem: c?.hoje },
    { id: "contactar", rotulo: "Por contactar", contagem: c?.porContactar },
    { id: "atrasados", rotulo: "Contacto atrasado", contagem: c?.atrasados },
    { id: "preinscricao", rotulo: "Completar NIF e morada", contagem: c?.filaPre },
    { id: "secretaria", rotulo: "Na secretaria", contagem: c?.filaSec },
    { id: "converter", rotulo: "Pagos por inscrever", contagem: c?.pagos },
    { id: "minhas", rotulo: "As minhas" },
  ];

  const ativos = ["q", "estado", "curso", "local", "origem", "comercial", "entrada", "de", "ate"].filter(k => f[k as keyof typeof f]).length;
  const linhas = dados?.items ?? [];
  const listaFicha = f.vista === "pipeline" ? (dados?.columns ?? []).flatMap(col => col.items) : linhas;

  const registarNota = useCallback(async (l: Lead, canal: "Telefone" | "WhatsApp") => {
    try {
      await apiNota(l.id, canal === "WhatsApp" ? "Abriu WhatsApp." : "Tentativa de chamada.", canal, canal === "WhatsApp" ? "Atendeu" : "");
      invalidar("crm:");
    } catch (e) {
      toastError(e, "Não foi possível registar o contacto.");
    }
  }, []);

  const mover = useAccao(apiEditarLead, { ok: "Etapa actualizada.", invalidar: ["crm:"] });
  function moverNoPipeline(l: Lead, estado: string) {
    const erroRegra = podeMudarEtapa(l.estado, estado, user.role, regime);
    if (erroRegra) { toastError(new Error(erroRegra)); return; }
    if (estado === l.estado) return;
    if (estado === "Formando" || estado === "Desistiu") {
      setFicha(l.id);
      toastOk(estado === "Formando" ? "Escolha a turma no separador «Validação»." : "Indique o motivo da desistência em «Dados».");
      return;
    }
    void mover.correr(l.id, { estado });
  }

  async function exportar() {
    try {
      await apiExportarLeads(filtros);
      toastOk("CSV descarregado (máx. 2 000 linhas).");
    } catch (e) {
      toastError(e, "A exportação falhou.");
    }
  }

  async function copiarFormulario() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pre-inscricao`);
      toastOk("Ligação do formulário copiada.");
    } catch {
      toastError(new Error("Não foi possível copiar. Abra /pre-inscricao."));
    }
  }

  const subtitulo = c
    ? `${num(c.abertos)} abertas · ${num(c.porContactar)} por contactar${c.atrasados ? ` · ${num(c.atrasados)} com contacto atrasado` : ""}`
    : "A carregar…";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        trilho={[{ rotulo: regime === "fin" ? "Financiada" : "Gold" }, { rotulo: "CRM" }, { rotulo: "Pré-inscrições" }]}
        titulo="Pré-inscrições"
        subtitulo={subtitulo}
        acoes={<>
          <Botao variante="fantasma" onClick={() => void exportar()}>Exportar CSV</Botao>
          {regime === "gold" && <Botao variante="secundario" onClick={() => void copiarFormulario()}>Ligação do formulário</Botao>}
          {regime === "gold" && pode("crm.escrever") && <Botao variante="fantasma" onClick={() => setWhatsapp(true)}>Simular WhatsApp</Botao>}
          {pode("crm.escrever") && <Botao variante="primario" onClick={() => setEditar({ aberto: true, lead: null })}>Nova pré-inscrição</Botao>}
        </>}
      />

      <Separadores<CrmFila | "">
        rotulo="Filas de trabalho"
        estilo="pilula"
        ativo={f.fila as CrmFila | ""}
        onMudar={id => setF({ fila: id })}
        itens={filas.map(x => ({ id: x.id, rotulo: x.rotulo, contagem: x.contagem }))}
      />

      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: "Nome, email, telemóvel, NIF, curso ou n.º", rotulo: "Pesquisar pré-inscrições" }}
        periodo={{ de: f.de, ate: f.ate, onMudar: (de, ate) => setF({ de, ate }) }}
        selecoes={[
          { chave: "estado", rotulo: "Etapa", valor: f.estado, onMudar: v => setF({ estado: v }), opcoes: ETAPAS.map(e => ({ valor: e, rotulo: rotuloEtapa(e) })), vazio: "Etapa: todas" },
          { chave: "curso", rotulo: "Curso", valor: f.curso, onMudar: v => setF({ curso: v }), opcoes: cursos.selecao, vazio: "Curso: todos" },
          { chave: "local", rotulo: "Local", valor: f.local, onMudar: v => setF({ local: v }), opcoes: locais.selecao, vazio: "Local: todos" },
          { chave: "origem", rotulo: "Como conheceu a ENA", valor: f.origem, onMudar: v => setF({ origem: v }), opcoes: origens.selecao, vazio: "Como conheceu: todos" },
          { chave: "comercial", rotulo: "Comercial", valor: f.comercial, onMudar: v => setF({ comercial: v }), opcoes: [{ valor: "eu", rotulo: "As minhas" }, ...opComerciais], vazio: "Comercial: todos" },
          { chave: "entrada", rotulo: "Entrada", valor: f.entrada, onMudar: v => setF({ entrada: v }), opcoes: [{ valor: "preinscricao", rotulo: "Formulário do site" }, { valor: "manual", rotulo: "Registada pela equipa" }], vazio: "Entrada: todas" },
        ]}
        ativos={ativos}
        onLimpar={limparFiltros}
        extra={(
          <div role="group" aria-label="Vista" className="ml-auto inline-flex overflow-hidden rounded-controlo border border-linha-forte">
            {([["lista", "Lista"], ["pipeline", "Funil"]] as const).map(([id, rot]) => (
              <button key={id} type="button" aria-pressed={f.vista === id} onClick={() => setF({ vista: id })}
                className={`h-[34px] px-3 text-[13px] font-semibold ${f.vista === id ? "bg-tinta text-white" : "bg-superficie text-tinta hover:bg-fundo"}`}>{rot}</button>
            ))}
          </div>
        )}
      />

      {selecionados.size > 0 && f.vista === "lista" && pode("crm.escrever") && (
        <BarraLote ids={[...selecionados]} comerciais={opComerciais} etiquetas={etiquetas.dados?.etiquetas ?? []} onLimpar={() => setSelecionados(new Set())} />
      )}

      {erro && !dados ? <ErroCarregar erro={erro} onTentar={recarregar} /> : f.vista === "pipeline" ? (
        <Pipeline colunas={dados?.columns} aCarregar={aCarregar} hoje={hoje} onAbrir={l => setFicha(l.id)} onMover={moverNoPipeline} />
      ) : (
        <div className="overflow-hidden rounded-cartao border border-linha bg-superficie">
          <TabelaLeads
            linhas={linhas}
            aCarregar={aCarregar}
            hoje={hoje}
            ordem={f.ordem}
            onOrdenar={o => setF({ ordem: o })}
            selecionados={selecionados}
            onSelecionar={setSelecionados}
            ativo={ficha}
            onAbrir={l => setFicha(l.id)}
            onContacto={(l, canal) => void registarNota(l, canal)}
            onEditar={l => setEditar({ aberto: true, lead: l })}
            onApagar={pode("crm.apagar") ? l => setApagar(l) : undefined}
            vazio={(
              <Vazio
                titulo={c?.total ? "Nenhuma pré-inscrição neste filtro." : "Ainda sem pré-inscrições."}
                descricao={c?.total ? undefined : "Os pedidos do formulário do site aparecem aqui. Também pode registar quem ligou."}
                acao={ativos ? <Botao variante="secundario" onClick={limparFiltros}>Limpar filtros</Botao> : undefined}
              />
            )}
          />
          {dados && dados.total > 0 && (
            <div className="flex flex-wrap items-center border-t border-linha">
              <div className="flex-1">
                <Paginacao pagina={dados.page} porPagina={dados.perPage} total={dados.total} onMudar={p => setF({ pagina: String(p) })} />
              </div>
              <label className="flex items-center gap-2 px-4 py-2 text-[13px] text-tinta-suave">
                Por página
                <select value={f.porPagina} onChange={e => setF({ porPagina: e.target.value })}
                  className="h-8 rounded-controlo border border-linha-forte bg-superficie px-2 text-[13px] text-tinta">
                  {["25", "50", "100"].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      <FichaLead id={ficha} lista={listaFicha} onFechar={() => setFicha(null)} onMudar={setFicha} />

      <NovaPreinscricao
        aberto={editar.aberto}
        regime={regime}
        lead={editar.lead}
        comerciais={opComerciais}
        onFechar={() => setEditar({ aberto: false, lead: null })}
        onCriada={id => { setEditar({ aberto: false, lead: null }); setFicha(id); }}
        onAbrirDuplicado={id => { setEditar({ aberto: false, lead: null }); setFicha(id); }}
      />

      <WhatsappSimulador open={whatsapp} onClose={() => setWhatsapp(false)} onLeadCreated={() => invalidar("crm:")} />

      <ConfirmarPerigo
        aberto={apagar != null}
        onFechar={() => setApagar(null)}
        titulo="Eliminar pré-inscrição"
        descricao={apagar ? `${nomeCompleto(apagar)} sai do CRM e os ficheiros enviados são apagados da Drive. Se ainda puder converter, prefira marcar «Desistiu».` : ""}
        onConfirmar={async () => {
          if (!apagar) return;
          try {
            await apiApagarLead(apagar.id);
            toastOk("Pré-inscrição eliminada.");
            if (ficha === apagar.id) setFicha(null);
            invalidar("crm:");
          } catch (e) {
            toastError(e, "Não foi possível eliminar.");
          }
        }}
      />
    </div>
  );
}
