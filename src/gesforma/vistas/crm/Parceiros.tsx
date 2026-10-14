// Parceiros: quem encaminha formandos ou clientes, o comercial responsável e as condições de retribuição.
import { useEffect, useState } from "react";
import {
  apiAlterarParceiro, apiApagarParceiro, apiCriarParceiro, apiParceiros, type DadosParceiro, type Parceiro,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  AreaTexto, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Filtros, PageHeader, PainelLateral, Selecao, Tabela,
  Vazio, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { iniciais, trilhoCrm, useGestao } from "./comum";

const VAZIO: DadosParceiro = { nome: "", email: "", telf: "", tipo: "", notas: "", comercialId: null, retribuicao: "" };

export default function Parceiros({ view, navigate }: VistaProps) {
  const gestao = useGestao();
  const [f, setF, limpar] = useFiltrosUrl({ q: "", tipo: "", comercial: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:parceiros:${f.q}:${f.tipo}:${f.comercial}`, signal => apiParceiros(f, { signal }));
  const tipos = useOpcoes("lista", { lista: "tipos_parceria" });
  const comerciais = useOpcoes("comerciais");
  const [aberto, setAberto] = useState<Parceiro | "novo" | null>(null);
  const [apagar, setApagar] = useState<Parceiro | null>(null);

  const colunas: Coluna<Parceiro>[] = [
    {
      id: "nome", titulo: "Parceiro", principal: true,
      celula: p => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{p.nome}</span>
          <span className="block text-xs text-tinta-suave truncate">{p.email || p.telf || "Sem contacto"}</span>
        </span>
      ),
    },
    { id: "tipo", titulo: "Tipo", celula: p => p.tipo || "—" },
    {
      id: "comercial", titulo: "Comercial",
      celula: p => p.comercial ? (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-6 w-6 rounded-full bg-acao-suave text-[11px] font-bold text-acao-texto inline-flex items-center justify-center">{iniciais(p.comercial)}</span>
          {p.comercial}
        </span>
      ) : <span className="text-tinta-suave">Sem comercial</span>,
    },
    { id: "retribuicao", titulo: "Retribuição", celula: p => <span className="line-clamp-2">{p.retribuicao || "—"}</span> },
  ];
  const ativos = [f.q, f.tipo, f.comercial].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={trilhoCrm(view, navigate, "Parceiros")}
        titulo="Parceiros"
        subtitulo={dados ? `${num(dados.parceiros.length)} parceiros · cada um ligado a um comercial e às condições de retribuição` : "Entidades e pessoas que encaminham formandos e clientes."}
        acoes={<Botao variante="primario" onClick={() => setAberto("novo")}>Novo parceiro</Botao>}
      />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Nome, email ou notas…", rotulo: "Pesquisar parceiros" }}
        selecoes={[
          { chave: "tipo", rotulo: "Tipo", vazio: "Tipo: todos", opcoes: tipos.selecao, valor: f.tipo, onMudar: tipo => setF({ tipo }) },
          { chave: "comercial", rotulo: "Comercial", vazio: "Comercial: todos", opcoes: comerciais.selecao, valor: f.comercial, onMudar: comercial => setF({ comercial }) },
        ]}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Parceiros"
          linhas={dados?.parceiros ?? []}
          colunas={colunas}
          chave={p => p.id}
          onLinha={p => setAberto(p)}
          aCarregar={aCarregar}
          acoesLinha={gestao ? p => <Botao tamanho="sm" variante="fantasma" onClick={() => setApagar(p)}>Apagar</Botao> : undefined}
          vazio={
            <Vazio
              titulo={ativos ? "Nenhum parceiro com estes filtros." : "Ainda sem parceiros."}
              descricao={ativos ? undefined : "Registe quem encaminha formandos: associações, empresas, escolas ou particulares."}
              acao={ativos ? <Botao onClick={limpar}>Limpar filtros</Botao> : <Botao variante="primario" onClick={() => setAberto("novo")}>Novo parceiro</Botao>}
            />
          }
        />
      </Cartao>
      <PainelParceiro
        parceiro={aberto}
        tipos={tipos.selecao}
        comerciais={comerciais.selecao}
        onFechar={() => setAberto(null)}
      />
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Apagar parceiro"
        descricao={`O parceiro «${apagar?.nome ?? ""}» deixa de aparecer na lista. Esta acção não se desfaz.`}
        onConfirmar={async () => {
          if (!apagar) return;
          try {
            await apiApagarParceiro(apagar.id);
            invalidar("crm:parceiros");
            toastOk("Parceiro apagado.");
          } catch (e) {
            toastError(e, "Não foi possível apagar o parceiro.");
          }
        }}
      />
    </div>
  );
}

function PainelParceiro({ parceiro, tipos, comerciais, onFechar }: {
  parceiro: Parceiro | "novo" | null;
  tipos: { valor: string; rotulo: string }[];
  comerciais: { valor: string; rotulo: string }[];
  onFechar: () => void;
}) {
  const novo = parceiro === "novo";
  const [d, setD] = useState<DadosParceiro>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!parceiro) return;
    setErro(null);
    setD(parceiro === "novo" ? VAZIO : {
      nome: parceiro.nome, email: parceiro.email, telf: parceiro.telf, tipo: parceiro.tipo, notas: parceiro.notas,
      comercialId: parceiro.comercialId, retribuicao: parceiro.retribuicao,
    });
  }, [parceiro]);
  const gravar = useAccao(
    async (x: DadosParceiro): Promise<unknown> => (parceiro && parceiro !== "novo" ? apiAlterarParceiro(parceiro.id, x) : apiCriarParceiro(x)),
    { ok: novo ? "Parceiro criado." : "Parceiro guardado.", invalidar: ["crm:parceiros"] },
  );
  async function guardar() {
    if (!d.nome.trim()) return setErro("Indique o nome.");
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return setErro("O email não parece válido.");
    if (await gravar.correr({ ...d, nome: d.nome.trim(), email: d.email.trim() })) onFechar();
  }
  const tiposComAtual = d.tipo && !tipos.some(t => t.valor === d.tipo) ? [...tipos, { valor: d.tipo, rotulo: d.tipo }] : tipos;
  return (
    <PainelLateral
      aberto={Boolean(parceiro)}
      onFechar={onFechar}
      titulo={novo ? "Novo parceiro" : (parceiro as Parceiro | null)?.nome ?? ""}
      subtitulo={novo ? undefined : "Editar dados e condições"}
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void guardar()}>Guardar</Botao></>}
    >
      <div className="grid gap-4">
        <Campo rotulo="Nome" obrigatorio erro={erro}>{p => <Entrada {...p} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} data-autofocus />}</Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Email">{p => <Entrada {...p} type="email" value={d.email} onChange={e => setD({ ...d, email: e.target.value })} />}</Campo>
          <Campo rotulo="Telefone">{p => <Entrada {...p} type="tel" value={d.telf} onChange={e => setD({ ...d, telf: e.target.value })} />}</Campo>
        </div>
        <Campo rotulo="Tipo" ajuda="As opções vêm de Listas de opções › Tipos de parceria.">
          {p => <Selecao {...p} value={d.tipo} onChange={e => setD({ ...d, tipo: e.target.value })} vazio="Sem tipo" opcoes={tiposComAtual} />}
        </Campo>
        <Campo rotulo="Comercial responsável">
          {p => <Selecao {...p} value={d.comercialId ?? ""} onChange={e => setD({ ...d, comercialId: e.target.value || null })} vazio="Sem comercial" opcoes={comerciais} />}
        </Campo>
        <Campo rotulo="Condições de retribuição">
          {p => <AreaTexto {...p} value={d.retribuicao} onChange={e => setD({ ...d, retribuicao: e.target.value })} placeholder="Percentagem, valor por formando, prazo de pagamento…" />}
        </Campo>
        <Campo rotulo="Notas">{p => <AreaTexto {...p} value={d.notas} onChange={e => setD({ ...d, notas: e.target.value })} />}</Campo>
      </div>
    </PainelLateral>
  );
}
