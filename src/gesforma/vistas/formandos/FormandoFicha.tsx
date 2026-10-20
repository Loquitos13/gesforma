import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiApagarFormando, apiFichaFormando, type Regime } from "../../../partilhado/api/formandos";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Botao, BotaoLigacao, ConfirmarPerigo, ErroCarregar, Esqueleto, Estado, MenuLinha, PageHeader, Separadores, Vazio, useFiltrosUrl,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { EditarDados, MudarTurma } from "./fichaDialogos";
import { CartaoAcesso, CartaoDados, CartaoElegibilidade, CartaoPagamento, CartaoTurma } from "./fichaLateral";
import { CartaoApoios, SeparadorApoios } from "./apoios/SeparadorApoios";
import { SeparadorAvaliacao, SeparadorContratos, SeparadorDocumentos, SeparadorHistorico } from "./fichaSeparadores";
import { SeparadorFinanciamento } from "./SeparadorFinanciamento";
import { Percurso } from "./partes";

type Aba = "documentos" | "avaliacao" | "financiamento" | "apoios" | "contratos" | "historico";
const ABAS_SO_FIN: Aba[] = ["financiamento", "apoios"];
const ABAS: Aba[] = ["documentos", "avaliacao", "financiamento", "apoios", "contratos", "historico"];

function soDigitos(t: string) {
  const d = t.replace(/\D/g, "");
  return d.length === 9 ? `351${d}` : d;
}

export default function FormandoFicha({ view, params, navigate }: VistaProps) {
  const regime: Regime = view === "fin-formando-ficha" ? "fin" : "gold";
  const gold = regime === "gold";
  const id = Number(params.formandoId ?? 0);
  const pode = usePode();
  const podeEditar = pode(gold ? "turmas.gerir" : "formandosFin.gerir");
  const podeApagar = gold ? pode("sistema.ver") : pode("formandosFin.gerir");
  // O mesmo que o servidor exige em POST /v1/formandos/:regime/:id/acesso.
  const podeAcesso = pode(gold ? "pagamentos.confirmar" : "formandosFin.gerir");
  const chave = id ? `formandos:ficha:${regime}:${id}` : null;
  const { dados: ficha, erro, aCarregar, recarregar } = useRecurso(chave, s => apiFichaFormando(regime, id, s));
  // O separador vai no URL (?aba=financiamento): o cockpit da turma abre a ficha directamente nos dados em falta.
  const [filtrosAba, setFiltrosAba] = useFiltrosUrl({ aba: "documentos" });
  const pedida = filtrosAba.aba as Aba;
  const aba: Aba = ABAS.includes(pedida) && !(gold && ABAS_SO_FIN.includes(pedida)) ? pedida : "documentos";
  const setAba = (a: Aba) => setFiltrosAba({ aba: a });
  const [editar, setEditar] = useState(false);
  const [mudar, setMudar] = useState(false);
  const [apagar, setApagar] = useState(false);

  const lista = gold ? (ficha?.turma ? "gold-formandos-turmas" : "gold-formandos-gold") : "fin-formandos";
  const trilho = [
    { rotulo: gold ? "Gold" : "Financiada", onClick: () => navigate(gold ? "gold-painel" : "fin-painel") },
    { rotulo: "Formandos", onClick: () => navigate(lista) },
    { rotulo: ficha ? `${ficha.nome} ${ficha.apelido}`.trim() : `#${id}` },
  ];

  if (!id) return <Vazio titulo="Ficha sem identificador." acao={<Botao onClick={() => navigate(lista)}>Voltar aos formandos</Botao>} />;
  if (erro != null && !ficha) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader trilho={trilho} titulo="Ficha do formando" />
        <ErroCarregar erro={erro} onTentar={recarregar} />
      </div>
    );
  }
  if (!ficha) {
    return (
      <div className="flex flex-col gap-4" aria-busy={aCarregar}>
        <PageHeader trilho={trilho} titulo="Ficha do formando" />
        <Esqueleto linhas={8} altura="h-6" />
      </div>
    );
  }

  const nome = `${ficha.nome} ${ficha.apelido}`.trim();
  const tel = soDigitos(ficha.telf);
  const docsAba = `Documentos ${ficha.docsResumo.validados}/${ficha.docsResumo.total}`;

  async function confirmarApagar() {
    try {
      await apiApagarFormando(regime, id);
      invalidar("formandos:");
      toastOk("Ficha eliminada.");
      navigate(lista);
    } catch (err) {
      toastError(err, "Não foi possível eliminar a ficha.");
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="bg-superficie border border-linha rounded-cartao px-6 py-5 flex flex-col gap-[18px]">
        <div className="flex gap-4 items-start flex-wrap">
          <span aria-hidden="true" className={`h-14 w-14 rounded-painel font-bold text-xl inline-flex items-center justify-center shrink-0 ${gold ? "bg-acao-suave text-acao-texto" : "bg-ligacao-suave text-ligacao"}`}>
            {(ficha.nome[0] ?? "") + (ficha.apelido.split(" ").pop()?.[0] ?? "")}
          </span>
          <div className="flex-1 min-w-[240px]">
            <p className="num m-0 text-xs text-tinta-suave">
              #{ficha.id} · {gold ? "Gold" : "Financiada"}{ficha.inscrito ? ` · inscrito a ${ficha.inscrito.slice(0, 10).split("-").reverse().join("/")}` : ""}
            </p>
            <h1 className="m-0 mt-0.5 text-[22px] font-semibold tracking-[-0.01em] text-tinta">{nome}</h1>
            <p className="m-0 mt-1.5 text-[13px] text-tinta-suave flex items-center gap-2 flex-wrap">
              <Estado tom={/desist|indefer/i.test(ficha.estado) ? "perigo" : "sucesso"} ponto>{ficha.estado}</Estado>
              <span>{[ficha.turma?.nome, ficha.curso].filter(Boolean).join(" · ") || "Sem turma"}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tel && <BotaoLigacao href={`tel:+${tel}`} tamanho="sm">Ligar</BotaoLigacao>}
            {tel && <BotaoLigacao href={`https://wa.me/${tel}`} tamanho="sm" target="_blank" rel="noopener noreferrer">WhatsApp</BotaoLigacao>}
            {ficha.email && <BotaoLigacao href={`mailto:${ficha.email}`} tamanho="sm">Email</BotaoLigacao>}
            {podeEditar && <Botao tamanho="sm" onClick={() => setMudar(true)}>{ficha.turma ? "Mudar de turma" : "Colocar em turma"}</Botao>}
            {podeApagar && <MenuLinha rotulo="Mais acções" acoes={[{ rotulo: "Eliminar ficha", perigo: true, onClick: () => setApagar(true) }]} />}
          </div>
        </div>
        <Percurso passos={ficha.passos} />
      </section>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <section className="bg-superficie border border-linha rounded-cartao overflow-hidden min-w-0">
          <Separadores<Aba>
            rotulo="Secções da ficha"
            ativo={aba}
            onMudar={setAba}
            className="px-5"
            itens={[
              { id: "documentos", rotulo: docsAba },
              { id: "avaliacao", rotulo: gold ? "Assiduidade e avaliação" : "Assiduidade (horas) e avaliação" },
              ...(gold ? [] : [{ id: "financiamento" as const, rotulo: "Dados para o financiamento" }, { id: "apoios" as const, rotulo: "Apoios" }]),
              { id: "contratos", rotulo: "Contratos e certificados" },
              { id: "historico", rotulo: "Histórico e notas" },
            ]}
          />
          {/* Os cartões de cada separador ficam sem moldura: o cartão é a própria secção. */}
          <div className="p-5 flex flex-col gap-6 [&>section]:border-0 [&>section]:p-0 [&>section]:rounded-none [&>div>section]:border-0 [&>div>section]:p-0 [&>div>section]:rounded-none">
            {aba === "documentos" && <SeparadorDocumentos ficha={ficha} podeEditar={podeEditar} />}
            {aba === "avaliacao" && <SeparadorAvaliacao ficha={ficha} />}
            {aba === "financiamento" && !gold && <SeparadorFinanciamento formandoId={ficha.id} podeEditar={podeEditar} />}
            {aba === "apoios" && !gold && <SeparadorApoios formandoId={ficha.id} podeEditar={podeEditar} />}
            {aba === "contratos" && <SeparadorContratos ficha={ficha} podeEditar={podeEditar} />}
            {aba === "historico" && <SeparadorHistorico ficha={ficha} podeEditar={podeEditar} />}
          </div>
        </section>

        <aside className="flex flex-col gap-4 min-w-0" aria-label="Resumo da ficha">
          <CartaoDados ficha={ficha} podeEditar={podeEditar} onEditar={() => setEditar(true)} />
          {podeAcesso && <CartaoAcesso ficha={ficha} podeEditar={podeAcesso} />}
          {gold && <CartaoPagamento ficha={ficha} podeEditar={podeEditar} />}
          {!gold && <CartaoElegibilidade ficha={ficha} />}
          {!gold && <CartaoApoios formandoId={ficha.id} onAbrir={() => setAba("apoios")} />}
          <CartaoTurma ficha={ficha} onAbrir={t => navigate({ view: gold ? "gold-cockpit-turma" : "fin-cockpit-turma", turmaId: t })} />
        </aside>
      </div>

      <EditarDados aberto={editar} onFechar={() => setEditar(false)} ficha={ficha} />
      <MudarTurma aberto={mudar} onFechar={() => setMudar(false)} ficha={ficha} />
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        onConfirmar={confirmarApagar}
        titulo="Eliminar ficha do formando"
        descricao={`A ficha de ${nome} sai da lista e da turma, com os documentos registados. Esta acção não se desfaz.`}
        confirmarTexto={ficha.nome}
      />
    </div>
  );
}
