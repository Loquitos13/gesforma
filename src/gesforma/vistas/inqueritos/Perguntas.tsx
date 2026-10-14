// Editor das perguntas de um inquérito: título, público-alvo, perguntas (ordem, tipo, opções), ligação pública e lançar respostas.
import { useState } from "react";
import {
  apiGravarInquerito, apiLigacaoInquerito, type InqueritoDefinicao, type Pergunta, type PublicoInquerito, type Regime, type TipoPergunta,
} from "../../../partilhado/api/inqueritos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, Campo, Cartao, Entrada, Selecao, Vazio } from "../../../partilhado/ui";
import { LancarResposta } from "./LancarResposta";
import { PUBLICOS, TIPOS, descarregarCsv, rotuloTipo } from "./comum";

type Rascunho = { titulo: string; publico: PublicoInquerito; perguntas: Pergunta[] };

function inicial(d: InqueritoDefinicao): Rascunho {
  return {
    titulo: String(d.titulo ?? ""),
    publico: (d.publico as PublicoInquerito) ?? "formando",
    perguntas: Array.isArray(d.perguntas) ? d.perguntas.map(p => ({ ...p, opcoes: p.opcoes ? [...p.opcoes] : undefined })) : [],
  };
}

const proximoId = (lista: Pergunta[]) => lista.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;

export function Perguntas({ regime, definicao }: { regime: Regime; definicao: InqueritoDefinicao }) {
  const [r, setR] = useState<Rascunho>(() => inicial(definicao));
  const [base, setBase] = useState(() => JSON.stringify(inicial(definicao)));
  const [ligacao, setLigacao] = useState("");
  const [lancar, setLancar] = useState(false);
  const alterado = JSON.stringify(r) !== base;
  const semTexto = r.perguntas.filter(p => !p.texto.trim()).length;
  const gravar = useAccao(apiGravarInquerito, { ok: "Inquérito gravado.", invalidar: ["inqueritos:"] });
  const pedirLigacao = useAccao(apiLigacaoInquerito);

  const mudar = (id: number, patch: Partial<Pergunta>) => setR(x => ({ ...x, perguntas: x.perguntas.map(p => (p.id === id ? { ...p, ...patch } : p)) }));
  const mover = (i: number, d: -1 | 1) => setR(x => {
    const lista = [...x.perguntas];
    const j = i + d;
    if (j < 0 || j >= lista.length) return x;
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    return { ...x, perguntas: lista };
  });
  const juntar = (tipo: TipoPergunta) => setR(x => ({
    ...x,
    perguntas: [...x.perguntas, { id: proximoId(x.perguntas), tipo, texto: "", opcoes: tipo === "multipla" ? ["", ""] : undefined }],
  }));

  async function submeter() {
    const limpo = { ...r, titulo: r.titulo.trim(), perguntas: r.perguntas.map(p => ({ ...p, texto: p.texto.trim(), opcoes: p.opcoes?.map(o => o.trim()).filter(Boolean) })) };
    const feito = await gravar.correr(definicao.id, limpo);
    if (feito) { setR(limpo); setBase(JSON.stringify(limpo)); }
  }

  async function copiarLigacao() {
    const out = await pedirLigacao.correr(definicao.id);
    if (!out) return;
    setLigacao(out.url);
    try { await navigator.clipboard?.writeText(out.url); toastOk("Ligação copiada."); } catch { toastError(null, "Copie a ligação abaixo."); }
  }

  return (
    <div className="space-y-4">
      <Cartao>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Campo rotulo="Título" erro={r.titulo.trim() ? null : "Indique o título."}>
            {p => <Entrada {...p} value={r.titulo} maxLength={200} onChange={e => setR(x => ({ ...x, titulo: e.target.value }))} />}
          </Campo>
          <Campo rotulo="Público-alvo" ajuda={PUBLICOS.find(x => x.valor === r.publico)?.ajuda}>
            {p => <Selecao {...p} value={r.publico} opcoes={PUBLICOS.map(x => ({ valor: x.valor, rotulo: x.rotulo }))} onChange={e => setR(x => ({ ...x, publico: e.target.value as PublicoInquerito }))} />}
          </Campo>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Botao variante="secundario" tamanho="sm" aCarregar={pedirLigacao.aCorrer} onClick={() => void copiarLigacao()}>Copiar ligação pública</Botao>
          <Botao variante="secundario" tamanho="sm" disabled={!r.perguntas.length || alterado} title={alterado ? "Grave primeiro as alterações." : undefined} onClick={() => setLancar(true)}>Lançar resposta em papel</Botao>
          <Botao
            variante="fantasma"
            tamanho="sm"
            disabled={!r.perguntas.length}
            onClick={() => descarregarCsv(`perguntas-${r.titulo}`, [["#", "Pergunta", "Tipo", "Opções"], ...r.perguntas.map((p, i) => [i + 1, p.texto, rotuloTipo(p.tipo), (p.opcoes ?? []).join(" | ")])])}
          >
            Exportar perguntas
          </Botao>
        </div>
        {ligacao && <p className="mt-3 break-all rounded-controlo bg-fundo px-3 py-2 font-mono text-xs text-tinta-suave">{ligacao}</p>}
        {regime === "fin" && (
          <p className="mt-3 text-xs text-tinta-suave">Quando o inquérito é enviado a uma turma, o GesForma gera o PDF das perguntas e guarda-o no dossiê da turma.</p>
        )}
      </Cartao>

      <Cartao semPadding>
        {r.perguntas.length === 0 ? (
          <Vazio compacto titulo="Sem perguntas." descricao="Acrescente perguntas com os botões abaixo." className="py-8" />
        ) : (
          <ol className="divide-y divide-linha">
            {r.perguntas.map((p, i) => (
              <li key={p.id} className="flex gap-3 p-4">
                <span className="mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fundo text-xs font-bold text-tinta-suave tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selecao
                      aria-label={`Tipo da pergunta ${i + 1}`}
                      className="h-8 w-auto text-xs"
                      value={p.tipo}
                      opcoes={TIPOS}
                      onChange={e => {
                        const tipo = e.target.value as TipoPergunta;
                        mudar(p.id, { tipo, opcoes: tipo === "multipla" ? (p.opcoes?.length ? p.opcoes : ["", ""]) : undefined });
                      }}
                    />
                    <span className="ml-auto flex gap-1">
                      <Botao variante="fantasma" tamanho="sm" soIcone aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</Botao>
                      <Botao variante="fantasma" tamanho="sm" soIcone aria-label="Descer" disabled={i === r.perguntas.length - 1} onClick={() => mover(i, 1)}>↓</Botao>
                      <Botao variante="fantasma" tamanho="sm" soIcone aria-label={`Apagar a pergunta ${i + 1}`} onClick={() => setR(x => ({ ...x, perguntas: x.perguntas.filter(q => q.id !== p.id) }))}>✕</Botao>
                    </span>
                  </div>
                  <Entrada
                    aria-label={`Texto da pergunta ${i + 1}`}
                    value={p.texto}
                    maxLength={500}
                    placeholder="Escreva a pergunta…"
                    aria-invalid={!p.texto.trim() || undefined}
                    onChange={e => mudar(p.id, { texto: e.target.value })}
                  />
                  {p.tipo === "multipla" && (
                    <div className="space-y-1.5 pl-1">
                      {(p.opcoes ?? []).map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-linha-forte" />
                          <Entrada
                            aria-label={`Opção ${oi + 1}`}
                            className="h-8"
                            value={o}
                            maxLength={200}
                            placeholder={`Opção ${oi + 1}`}
                            onChange={e => mudar(p.id, { opcoes: (p.opcoes ?? []).map((v, k) => (k === oi ? e.target.value : v)) })}
                          />
                          <Botao variante="fantasma" tamanho="sm" soIcone aria-label={`Retirar a opção ${oi + 1}`} disabled={(p.opcoes ?? []).length <= 2} onClick={() => mudar(p.id, { opcoes: (p.opcoes ?? []).filter((_, k) => k !== oi) })}>✕</Botao>
                        </div>
                      ))}
                      <Botao variante="ligacao" tamanho="sm" disabled={(p.opcoes ?? []).length >= 20} onClick={() => mudar(p.id, { opcoes: [...(p.opcoes ?? []), ""] })}>+ Opção</Botao>
                    </div>
                  )}
                  {p.tipo === "escala" && <p className="text-xs text-tinta-suave">Resposta de 1 (discordo totalmente) a 5 (concordo totalmente).</p>}
                  {p.tipo === "simnao" && <p className="text-xs text-tinta-suave">Resposta Sim ou Não.</p>}
                  {p.tipo === "texto" && <p className="text-xs text-tinta-suave">Resposta livre em texto.</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-linha bg-fundo px-4 py-3">
          <span className="text-xs font-semibold text-tinta-suave">Acrescentar:</span>
          {TIPOS.map(t => <Botao key={t.valor} variante="secundario" tamanho="sm" disabled={r.perguntas.length >= 60} onClick={() => juntar(t.valor)}>{t.rotulo}</Botao>)}
        </div>
      </Cartao>

      {(alterado || semTexto > 0) && (
        <Aviso
          tom={semTexto ? "aviso" : "info"}
          titulo={semTexto ? `${semTexto} ${semTexto === 1 ? "pergunta sem texto" : "perguntas sem texto"}` : "Alterações por gravar"}
          acao={
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="sm" disabled={!alterado} onClick={() => setR(JSON.parse(base) as Rascunho)}>Descartar</Botao>
              <Botao variante="primario" tamanho="sm" disabled={!alterado || semTexto > 0 || !r.titulo.trim()} aCarregar={gravar.aCorrer} onClick={() => void submeter()}>Gravar</Botao>
            </div>
          }
        >
          {semTexto ? "Escreva o texto de todas as perguntas antes de gravar." : "As turmas que receberem este inquérito vêem a versão gravada."}
        </Aviso>
      )}
      <LancarResposta aberto={lancar} onFechar={() => setLancar(false)} inqueritoId={definicao.id} titulo={r.titulo} perguntas={r.perguntas} regime={regime} />
    </div>
  );
}
