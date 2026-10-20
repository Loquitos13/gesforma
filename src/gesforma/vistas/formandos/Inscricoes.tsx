import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { ESTADOS_INSCRICAO_FIN, apiListarInscricoesFin, type LinhaInscricaoFin } from "../../../partilhado/api/formandos";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ErroCarregar, Estado, Filtros, PageHeader, Paginacao, Separadores, Tabela, Vazio, cx, data, num,
  useFiltrosUrl, type Coluna, type Tom,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { DOCS_INSCRICAO, InscricaoPainel } from "./InscricaoPainel";

const TOM: Record<string, Tom> = {
  "Recebida": "neutro", "Em análise": "aviso", "Elegível": "sucesso", "Colocado na turma": "info", "Indeferido": "perigo",
};

function Pontos({ docs }: { docs: Record<string, boolean> }) {
  return (
    <span className="inline-flex gap-1" title={DOCS_INSCRICAO.map(d => `${d.curto} ${d.rotulo}`).join(" · ")}>
      {DOCS_INSCRICAO.map(d => (
        <span
          key={d.id}
          className={cx("h-6 w-6 rounded-full text-[9px] font-bold inline-flex items-center justify-center", docs[d.id] ? "bg-sucesso text-white" : "bg-linha-suave text-tinta-suave")}
        >
          {d.curto}
          <span className="sr-only">{docs[d.id] ? " entregue" : " em falta"}</span>
        </span>
      ))}
    </span>
  );
}

export default function Inscricoes({ navigate }: VistaProps) {
  const pode = usePode();
  const podeEditar = pode("formandosFin.gerir");
  const [f, setF, limpar] = useFiltrosUrl({ estado: "", q: "", curso: "", turma: "", docs: "", pagina: "1", ordem: "" });
  const [painel, setPainel] = useState<LinhaInscricaoFin | "nova" | null>(null);
  const filtros = { ...f, pagina: Number(f.pagina) || 1, porPagina: 25 };
  const { dados, erro, aCarregar, recarregar } = useRecurso(`formandos:inscricoes:${JSON.stringify(filtros)}`, s => apiListarInscricoesFin(filtros, s));
  const cursos = useOpcoes("cursos", { regime: "fin" });
  const turmas = useOpcoes("turmas", { regime: "fin", todos: true });
  const ativos = ["q", "curso", "turma", "docs"].filter(k => (f as Record<string, string>)[k]).length;
  const abrirFicha = (formandoId: number) => navigate({ view: "fin-formando-ficha", formandoId });

  const colunas: Coluna<LinhaInscricaoFin>[] = [
    { id: "inscrito", titulo: "Data", ordenavel: true, largura: "110px", esconderMovel: true, celula: l => <span className="text-tinta-suave">{l.inscrito ? data(l.inscrito) : "—"}</span> },
    {
      id: "nome", titulo: "Candidato", ordenavel: true, principal: true,
      celula: l => (
        <div className="min-w-0">
          <p className="m-0 font-semibold text-tinta">{`${l.nome} ${l.apelido}`.trim()}</p>
          <p className="m-0 text-xs text-tinta-suave truncate max-w-[240px]">{l.email || l.telf || "Sem contacto"}</p>
        </div>
      ),
    },
    {
      id: "curso", titulo: "UFCD", ordenavel: true,
      celula: l => (
        <div className="min-w-0">
          {l.ufcd && <span className="inline-flex rounded-full bg-ligacao text-white px-2 py-0.5 text-xs font-bold">{l.ufcd}</span>}
          <p className="m-0 mt-0.5 text-xs text-tinta-suave truncate max-w-[200px]">{l.curso}</p>
        </div>
      ),
    },
    { id: "turma", titulo: "Turma", ordenavel: true, celula: l => <span className="text-tinta">{l.turma || "—"}</span> },
    { id: "docs", titulo: "Documentos", ordenavel: true, celula: l => <Pontos docs={l.docs} /> },
    { id: "estado", titulo: "Estado", ordenavel: true, celula: l => <Estado tom={TOM[l.estado] ?? "neutro"}>{l.estado}</Estado> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        trilho={[{ rotulo: "Financiada", onClick: () => navigate("fin-painel") }, { rotulo: "Inscrições" }]}
        titulo="Inscrições"
        subtitulo="Candidaturas por UFCD. «Elegível» ou «Colocado na turma» criam a ficha em Formandos."
        acoes={podeEditar && <Botao variante="primario" onClick={() => setPainel("nova")}>Nova inscrição</Botao>}
      />

      <Separadores<string>
        rotulo="Estado das inscrições"
        estilo="pilula"
        ativo={f.estado}
        onMudar={id => setF({ estado: id })}
        itens={[{ id: "", rotulo: "Todas", contagem: dados?.contagens.todas }, ...ESTADOS_INSCRICAO_FIN.map(e => ({ id: e, rotulo: e, contagem: dados?.contagens[e] ?? (dados ? 0 : undefined) }))]}
      />

      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: "Nome, email, UFCD ou turma", rotulo: "Pesquisar inscrições" }}
        selecoes={[
          { chave: "curso", rotulo: "Curso / UFCD", opcoes: cursos.selecao, valor: f.curso, onMudar: v => setF({ curso: v }) },
          { chave: "turma", rotulo: "Turma", opcoes: turmas.selecao, valor: f.turma, onMudar: v => setF({ turma: v }) },
          { chave: "docs", rotulo: "Documentos", opcoes: [{ valor: "completos", rotulo: "Completos" }, { valor: "em_falta", rotulo: "Em falta" }], valor: f.docs, onMudar: v => setF({ docs: v }) },
        ]}
        ativos={ativos}
        onLimpar={limpar}
      />

      {erro != null && !dados && <ErroCarregar erro={erro} onTentar={recarregar} />}

      <Cartao semPadding>
        <Tabela
          rotulo="Inscrições financiadas"
          linhas={dados?.linhas ?? []}
          colunas={colunas}
          chave={l => l.id}
          ordem={f.ordem || undefined}
          onOrdenar={o => setF({ ordem: o })}
          onLinha={l => setPainel(l)}
          linhaAtiva={painel && painel !== "nova" ? painel.id : null}
          aCarregar={aCarregar}
          acoesLinha={l => l.formandoId
            ? <Botao variante="ligacao" tamanho="sm" onClick={() => abrirFicha(l.formandoId!)}>Ficha</Botao>
            : null}
          vazio={(
            <Vazio
              titulo={ativos || f.estado ? "Nenhuma inscrição com estes filtros." : "Ainda sem candidaturas."}
              descricao={ativos || f.estado ? undefined : "As candidaturas às UFCD financiadas começam aqui."}
              acao={ativos ? <Botao onClick={limpar}>Limpar filtros</Botao> : podeEditar ? <Botao variante="primario" onClick={() => setPainel("nova")}>Nova inscrição</Botao> : undefined}
            />
          )}
        />
        {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ pagina: String(p) })} />}
      </Cartao>
      <p className="m-0 text-xs text-tinta-suave">
        Documentos: {DOCS_INSCRICAO.map(d => `${d.curto} ${d.rotulo.toLowerCase()}`).join(" · ")}. Sem documentos completos a turma não arranca.
        {dados && ` ${num(dados.total)} inscrições nesta vista.`}
      </p>

      <InscricaoPainel alvo={painel} onFechar={() => setPainel(null)} podeApagar={podeEditar} onAbrirFicha={abrirFicha} />
    </div>
  );
}
