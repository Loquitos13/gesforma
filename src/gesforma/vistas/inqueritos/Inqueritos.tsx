// Inquéritos: lista com taxa de resposta, editor das perguntas e resultados por turma.
import { useState } from "react";
import {
  apiApagarInquerito, apiCriarInquerito, apiDefinicoesInqueritos, apiInqueritos, type PublicoInquerito, type Regime,
} from "../../../partilhado/api/inqueritos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Botao, Campo, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Modal, PageHeader, Selecao, Separadores, Vazio, cx, num, useFiltrosUrl,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { Perguntas } from "./Perguntas";
import { Resultados } from "./Resultados";
import { PUBLICOS, rotuloPublico } from "./comum";

type Sep = "perguntas" | "resultados";

export default function Inqueritos({ view }: VistaProps) {
  const regime: Regime = view === "fin-inqueritos" ? "fin" : "gold";
  const [f, setF] = useFiltrosUrl({ id: "", sep: "resultados" });
  const lista = useRecurso(`inqueritos:lista:${regime}`, signal => apiInqueritos(regime, signal));
  const defs = useRecurso(`inqueritos:defs:${regime}`, signal => apiDefinicoesInqueritos(regime, signal));
  const [novo, setNovo] = useState(false);
  const [apagar, setApagar] = useState<{ id: number; titulo: string; respostas: number } | null>(null);

  const itens = lista.dados?.inqueritos ?? [];
  const idSel = Number(f.id) || itens[0]?.id || null;
  const sel = itens.find(i => i.id === idSel) ?? null;
  const def = defs.dados?.itens.find(i => i.id === idSel) ?? null;
  const apagarAccao = useAccao(apiApagarInquerito, { ok: "Inquérito eliminado.", invalidar: [`inqueritos:`] });

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "fin" ? "Financiada" : "Gold" }, { rotulo: "Inquéritos" }]}
        titulo="Inquéritos"
        subtitulo={lista.dados
          ? `${num(itens.length)} inquéritos · cada turma recebe os do público-alvo de cada pessoa (formandos, formador, pós-formação)`
          : "Inquéritos de satisfação por público-alvo, com respostas e taxa por turma."}
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}>Novo inquérito</Botao>}
      />
      {lista.erro ? <ErroCarregar erro={lista.erro} onTentar={lista.recarregar} /> : null}
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
        <nav aria-label="Inquéritos" className="bg-superficie border border-linha rounded-cartao overflow-hidden">
          {lista.aCarregar && !lista.dados && <Esqueleto linhas={4} altura="h-16" />}
          {lista.dados && itens.length === 0 && (
            <Vazio compacto titulo="Ainda sem inquéritos." descricao="Crie um e escolha o público-alvo. No envio, cada pessoa da turma recebe os seus." />
          )}
          {itens.map(i => {
            const ativo = i.id === idSel;
            return (
              <button
                key={i.id}
                type="button"
                aria-current={ativo ? "true" : undefined}
                onClick={() => setF({ id: String(i.id) })}
                className={cx(
                  "w-full border-0 border-b border-linha-suave px-4 py-3 text-left transition-colors",
                  ativo ? "bg-acao-suave/60 shadow-[inset_3px_0_0_#FFB020]" : "bg-superficie hover:bg-fundo",
                )}
              >
                <span className="block text-sm font-semibold text-tinta">{i.titulo}</span>
                <span className="mt-0.5 block text-xs text-tinta-suave">{rotuloPublico(i.publico)} · {i.perguntas} perguntas</span>
                <span className="mt-2 flex items-center gap-3 text-xs tabular-nums text-tinta-suave">
                  <span><strong className="text-tinta">{num(i.respostas)}</strong> respostas</span>
                  <span>{i.taxa == null ? "Ainda não enviado" : <><strong className="text-tinta">{i.taxa} %</strong> de resposta</>}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <section aria-label="Inquérito seleccionado" className="min-w-0 bg-superficie border border-linha rounded-cartao overflow-hidden">
          {!sel ? (
            lista.dados && itens.length > 0 ? <Vazio titulo="Seleccione um inquérito." /> : null
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-linha">
                <div className="min-w-[220px] flex-1">
                  <h2 className="m-0 text-[17px] font-semibold text-tinta">{sel.titulo}</h2>
                  <p className="m-0 mt-0.5 text-xs text-tinta-suave">{rotuloPublico(sel.publico)} · {sel.perguntas} perguntas</p>
                </div>
                <Botao variante="fantasma" tamanho="sm" className="text-perigo" onClick={() => setApagar({ id: sel.id, titulo: sel.titulo, respostas: sel.respostas })}>Eliminar</Botao>
              </div>
              <Separadores<Sep>
                className="px-5"
                rotulo="Secções do inquérito"
                ativo={(f.sep as Sep) || "resultados"}
                onMudar={sep => setF({ sep })}
                itens={[
                  { id: "resultados", rotulo: "Resultados", contagem: sel.respostas },
                  { id: "perguntas", rotulo: "Perguntas", contagem: sel.perguntas },
                ]}
              />
              <div className="p-5 bg-fundo/40">
                {f.sep === "perguntas"
                  ? (def ? <Perguntas key={def.id} regime={regime} definicao={def} /> : <Esqueleto linhas={5} altura="h-12" />)
                  : <Resultados key={sel.id} regime={regime} inquerito={sel} definicao={def} />}
              </div>
            </>
          )}
        </section>
      </div>
      <NovoInquerito aberto={novo} regime={regime} onFechar={() => setNovo(false)} onCriado={id => setF({ id: String(id), sep: "perguntas" })} />
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Eliminar inquérito"
        descricao={apagar ? `«${apagar.titulo}» deixa de poder ser enviado e preenchido.${apagar.respostas ? ` As ${apagar.respostas} respostas recebidas deixam de aparecer aqui.` : ""}` : ""}
        onConfirmar={async () => {
          if (!apagar) return;
          await apagarAccao.correr(apagar.id);
          setApagar(null);
          setF({ id: "" });
        }}
      />
    </div>
  );
}

function NovoInquerito({ aberto, regime, onFechar, onCriado }: { aberto: boolean; regime: Regime; onFechar: () => void; onCriado: (id: number) => void }) {
  const [titulo, setTitulo] = useState("");
  const [publico, setPublico] = useState<PublicoInquerito>("formando");
  const criar = useAccao(apiCriarInquerito, { ok: "Inquérito criado. Acrescente as perguntas.", invalidar: ["inqueritos:"] });
  async function submeter() {
    const r = await criar.correr(regime, { titulo: titulo.trim(), publico, perguntas: [] });
    if (!r) return;
    setTitulo("");
    setPublico("formando");
    onFechar();
    onCriado(r.item.id);
  }
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Novo inquérito"
      largura="sm"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!titulo.trim()} aCarregar={criar.aCorrer} onClick={() => void submeter()}>Criar</Botao>
        </>
      }
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (titulo.trim()) void submeter(); }}>
        <Campo rotulo="Título">{p => <Entrada {...p} value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={200} autoFocus placeholder="Ex.: Satisfação no fim da formação" />}</Campo>
        <Campo rotulo="Público-alvo" ajuda={PUBLICOS.find(p => p.valor === publico)?.ajuda}>
          {p => <Selecao {...p} value={publico} onChange={e => setPublico(e.target.value as PublicoInquerito)} opcoes={PUBLICOS.map(p => ({ valor: p.valor, rotulo: p.rotulo }))} />}
        </Campo>
      </form>
    </Modal>
  );
}
