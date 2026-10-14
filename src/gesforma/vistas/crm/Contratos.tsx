// Propostas e contratos: separadores Propostas / Contratos / Modelos com o detalhe ao lado,
// e os editores de página inteira (nova proposta, contrato, modelo) quando o URL tem ?editar=….
import { useState } from "react";
import { apiContratos, apiModelos, apiPropostas, type TipoModelo } from "../../../partilhado/api/crmDiretorio";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, ErroCarregar, Esqueleto, useFiltrosUrl } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { Abas, CabecalhoLista, ListaComDetalhe, regimeDaVista } from "./comum";
import { eurosCurto } from "./documento/modelo";
import { EditorContrato } from "./EditorContrato";
import { EditorModelo } from "./EditorModelo";
import { EditorProposta } from "./EditorProposta";
import { DetalheContrato, TabContratos } from "./TabContratos";
import { TabModelos } from "./TabModelos";
import { DetalheProposta, TabPropostas } from "./TabPropostas";

type Tab = "propostas" | "contratos" | "modelos";

export default function Contratos({ view }: VistaProps) {
  const [f, setF] = useFiltrosUrl({ tab: "propostas", editar: "", sel: "" });
  const tab = (["propostas", "contratos", "modelos"].includes(f.tab) ? f.tab : "propostas") as Tab;
  const trilho = `${regimeDaVista(view) === "fin" ? "Financiada" : "Gold"} · CRM · Contratos`;
  const abrir = (editar: string) => setF({ editar });
  const fechar = () => setF({ editar: "" });

  if (f.editar) return <Editor editar={f.editar} trilho={trilho} onFechar={fechar} />;
  return <Lista tab={tab} sel={f.sel} setF={setF} abrir={abrir} />;
}

function Editor({ editar, trilho, onFechar }: { editar: string; trilho: string; onFechar: () => void }) {
  const [tipo, a, b] = editar.split(":");
  if (tipo === "proposta") {
    const id = a && a !== "novo" ? Number(a) : null;
    const cliente = b?.startsWith("c") ? Number(b.slice(1)) : null;
    return <EditorProposta propostaId={id} clienteInicial={cliente} onFechar={onFechar} trilho={trilho} />;
  }
  if (tipo === "contrato") {
    const id = a && a !== "novo" ? Number(a) : null;
    const proposta = b?.startsWith("p") ? Number(b.slice(1)) : null;
    return <EditorContrato contratoId={id} propostaId={proposta} onFechar={onFechar} trilho={trilho} />;
  }
  if (tipo === "modelo" && (a === "proposta" || a === "contrato")) return <EditorModeloPorId tipo={a} id={b && b !== "novo" ? Number(b) : null} trilho={trilho} onFechar={onFechar} />;
  return null;
}

function EditorModeloPorId({ tipo, id, trilho, onFechar }: { tipo: TipoModelo; id: number | null; trilho: string; onFechar: () => void }) {
  const { dados, erro, recarregar } = useRecurso(`crm:modelos:${tipo}`, signal => apiModelos(tipo, { signal }));
  if (id && erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (id && !dados) return <Esqueleto linhas={8} />;
  const modelo = id ? dados?.modelos.find(m => m.id === id) ?? null : null;
  return <EditorModelo key={`${tipo}:${id ?? "novo"}`} tipo={tipo} modelo={modelo} onFechar={onFechar} trilho={trilho} />;
}

function Lista({ tab, sel, setF, abrir }: { tab: Tab; sel: string; setF: (p: Partial<{ tab: string; editar: string; sel: string }>) => void; abrir: (e: string) => void }) {
  const [primeiro, setPrimeiro] = useState<number | null>(null);
  const nP = useRecurso("crm:propostas:contagem", signal => apiPropostas({ pagina: 1 }, { signal }));
  const nK = useRecurso("crm:contratos:contagem", signal => apiContratos({ pagina: 1 }, { signal }));
  const nMp = useRecurso("crm:modelos:proposta", signal => apiModelos("proposta", { signal }));
  const nMc = useRecurso("crm:modelos:contrato", signal => apiModelos("contrato", { signal }));
  const nModelos = nMp.dados && nMc.dados ? nMp.dados.modelos.length + nMc.dados.modelos.length : undefined;
  const somaFase = (fases: { estado: string; valor: number }[] | undefined, estados: string[]) =>
    (fases ?? []).filter(x => estados.includes(x.estado)).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const abertas = somaFase(nP.dados?.fases, ["Enviada", "Negociação"]);
  const assinados = somaFase(nK.dados?.fases, ["Assinado"]);
  const novo = tab === "propostas" ? "Nova proposta" : "Novo contrato";
  const selId = sel ? Number(sel) : primeiro;
  const selecionar = (id: number) => setF({ sel: String(id) });

  const detalhe = tab === "propostas" && selId
    ? <DetalheProposta id={selId} onEditar={() => abrir(`proposta:${selId}`)} onContrato={p => abrir(`contrato:novo:p${p}`)} onVerContrato={k => setF({ tab: "contratos", sel: String(k) })} />
    : tab === "contratos" && selId
      ? <DetalheContrato id={selId} onEditar={() => abrir(`contrato:${selId}`)} />
      : undefined;

  return (
    <ListaComDetalhe rotulo={tab === "propostas" ? "Proposta seleccionada" : "Contrato seleccionado"} detalhe={detalhe}>
      <CabecalhoLista
        titulo="Propostas e contratos"
        resumo={nP.dados && nK.dados ? `${eurosCurto(abertas)} em propostas abertas · ${eurosCurto(assinados)} em contratos assinados` : " "}
        acoes={tab === "modelos" ? undefined : (
          <Botao variante="primario" onClick={() => abrir(tab === "propostas" ? "proposta:novo" : "contrato:novo")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="mr-2"><path d="M12 5v14M5 12h14" /></svg>
            {novo}
          </Botao>
        )}
      />
      <Abas<Tab>
        rotulo="Secções"
        ativo={tab}
        onMudar={t => { setPrimeiro(null); setF({ tab: t, sel: "" }); }}
        itens={[
          { id: "propostas", rotulo: "Propostas", n: nP.dados?.total },
          { id: "contratos", rotulo: "Contratos", n: nK.dados?.total },
          { id: "modelos", rotulo: "Modelos", n: nModelos },
        ]}
      />
      {tab === "propostas" && <TabPropostas selecionado={selId} onSelecionar={selecionar} onPrimeiro={setPrimeiro} onAbrir={id => abrir(`proposta:${id}`)} onVerContrato={k => setF({ tab: "contratos", sel: String(k) })} />}
      {tab === "contratos" && <TabContratos selecionado={selId} onSelecionar={selecionar} onPrimeiro={setPrimeiro} onAbrir={id => abrir(`contrato:${id}`)} />}
      {tab === "modelos" && <TabModelos onAbrir={(tipo, id) => abrir(`modelo:${tipo}:${id ?? "novo"}`)} />}
    </ListaComDetalhe>
  );
}
