import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiApagarFormando, apiFichaFormando, type Regime } from "../../../partilhado/api/formandos";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Botao, BotaoLigacao, ConfirmarPerigo, ErroCarregar, Esqueleto, Estado, PageHeader, Separadores, Vazio,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { EditarDados, MudarTurma } from "./fichaDialogos";
import { CartaoAcesso, CartaoDados, CartaoElegibilidade, CartaoPagamento, CartaoTurma } from "./fichaLateral";
import { CartaoApoios, SeparadorApoios } from "./apoios/SeparadorApoios";
import { SeparadorAvaliacao, SeparadorContratos, SeparadorDocumentos, SeparadorHistorico } from "./fichaSeparadores";
import { Percurso } from "./partes";

type Aba = "documentos" | "avaliacao" | "apoios" | "contratos" | "historico";

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
  const chave = id ? `formandos:ficha:${regime}:${id}` : null;
  const { dados: ficha, erro, aCarregar, recarregar } = useRecurso(chave, s => apiFichaFormando(regime, id, s));
  const [aba, setAba] = useState<Aba>("documentos");
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
    <div className="flex flex-col gap-5">
      <PageHeader
        trilho={trilho}
        titulo={(
          <span className="inline-flex items-center gap-3">
            <span aria-hidden="true" className="h-11 w-11 rounded-full bg-acao-suave text-acao-texto font-bold text-base inline-flex items-center justify-center">
              {(ficha.nome[0] ?? "") + (ficha.apelido.split(" ").pop()?.[0] ?? "")}
            </span>
            {nome}
          </span>
        )}
        etiqueta={<Estado tom={/desist|indefer/i.test(ficha.estado) ? "perigo" : "sucesso"} ponto>{ficha.estado}</Estado>}
        subtitulo={`#${ficha.id} · ${[ficha.turma?.nome, ficha.curso].filter(Boolean).join(" · ") || "Sem turma"}${ficha.inscrito ? ` · inscrito ${ficha.inscrito.slice(0, 10)}` : ""}`}
        acoes={(
          <>
            {tel && <BotaoLigacao href={`tel:+${tel}`} tamanho="sm">Ligar</BotaoLigacao>}
            {tel && <BotaoLigacao href={`https://wa.me/${tel}`} tamanho="sm" target="_blank" rel="noopener noreferrer">WhatsApp</BotaoLigacao>}
            {ficha.email && <BotaoLigacao href={`mailto:${ficha.email}`} tamanho="sm">Email</BotaoLigacao>}
            {podeEditar && <Botao tamanho="sm" onClick={() => setMudar(true)}>{ficha.turma ? "Mudar de turma" : "Colocar em turma"}</Botao>}
            {podeApagar && <Botao tamanho="sm" variante="fantasma" onClick={() => setApagar(true)}>Eliminar</Botao>}
          </>
        )}
      />

      <section className="bg-superficie border border-linha rounded-cartao p-4">
        <Percurso passos={ficha.passos} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Separadores<Aba>
            rotulo="Secções da ficha"
            ativo={aba}
            onMudar={setAba}
            itens={[
              { id: "documentos", rotulo: docsAba },
              { id: "avaliacao", rotulo: gold ? "Assiduidade e avaliação" : "Assiduidade (horas) e avaliação" },
              ...(gold ? [] : [{ id: "apoios" as const, rotulo: "Apoios" }]),
              { id: "contratos", rotulo: "Contratos e certificados" },
              { id: "historico", rotulo: "Histórico e notas" },
            ]}
          />
          {aba === "documentos" && <SeparadorDocumentos ficha={ficha} podeEditar={podeEditar} />}
          {aba === "avaliacao" && <SeparadorAvaliacao ficha={ficha} />}
          {aba === "apoios" && !gold && <SeparadorApoios formandoId={ficha.id} podeEditar={podeEditar} />}
          {aba === "contratos" && <SeparadorContratos ficha={ficha} podeEditar={podeEditar} />}
          {aba === "historico" && <SeparadorHistorico ficha={ficha} podeEditar={podeEditar} />}
        </div>

        <aside className="flex flex-col gap-4 min-w-0" aria-label="Resumo da ficha">
          <CartaoDados ficha={ficha} podeEditar={podeEditar} onEditar={() => setEditar(true)} />
          <CartaoAcesso ficha={ficha} podeEditar={podeEditar} />
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
