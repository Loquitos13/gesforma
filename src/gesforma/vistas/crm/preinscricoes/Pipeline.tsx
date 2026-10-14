import { useState } from "react";
import { Botao, Esqueleto, Estado, cx, eur, num } from "../../../../partilhado/ui";
import type { Lead } from "../../../../partilhado/api/crm";
import { ETAPAS, nomeCompleto, proximoPasso, rotuloEtapa, seguimento, tomEtapa } from "./util";

type Coluna = { estado: string; total: number; valor?: number; items: Lead[] };

/**
 * Pipeline por etapa: arrastar um cartão muda a etapa (com as mesmas regras do servidor).
 * Cada coluna mostra no máximo 80 cartões; o total e o valor vêm do servidor.
 */
export function Pipeline({ colunas, aCarregar, hoje, onAbrir, onMover }: {
  colunas: Coluna[] | undefined;
  aCarregar: boolean;
  hoje: string;
  onAbrir: (l: Lead) => void;
  onMover: (l: Lead, estado: string) => void;
}) {
  const [arrastar, setArrastar] = useState<Lead | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [verDesistiu, setVerDesistiu] = useState(false);
  const etapas = ETAPAS.filter(e => e !== "Desistiu" || verDesistiu);

  return (
    <div className="flex flex-col gap-2">
      <Botao variante="ligacao" tamanho="sm" className="self-start" onClick={() => setVerDesistiu(v => !v)}>
        {verDesistiu ? "Esconder «Desistiu»" : "Mostrar «Desistiu»"}
      </Botao>
      <div className="flex gap-3 overflow-x-auto pb-3" aria-label="Pipeline por etapa">
        {etapas.map(estado => {
          const col = colunas?.find(c => c.estado === estado) ?? { estado, total: 0, items: [] };
          return (
            <section
              key={estado}
              aria-label={rotuloEtapa(estado)}
              onDragOver={e => { e.preventDefault(); setSobre(estado); }}
              onDragLeave={() => setSobre(null)}
              onDrop={() => { if (arrastar) onMover(arrastar, estado); setArrastar(null); setSobre(null); }}
              className={cx("w-72 shrink-0 rounded-cartao border border-linha bg-fundo", sobre === estado && "ring-2 ring-acao")}
            >
              <header className="flex items-center gap-2 px-3 py-2.5 border-b border-linha">
                <Estado tom={tomEtapa(estado)} ponto>{rotuloEtapa(estado)}</Estado>
                <span className="num ml-auto text-xs font-semibold text-tinta-suave">{num(col.total)}</span>
              </header>
              {!!col.valor && <p className="num m-0 px-3 pt-2 text-xs text-tinta-suave">{eur(col.valor)} em aberto</p>}
              <div className="flex flex-col gap-2 p-2 max-h-[62vh] overflow-y-auto">
                {aCarregar && !col.items.length && <Esqueleto linhas={3} altura="h-16" />}
                {!aCarregar && !col.items.length && <p className="m-0 py-6 text-center text-xs text-tinta-fraca">Sem pré-inscrições.</p>}
                {col.items.map(l => {
                  const s = seguimento(l, hoje);
                  return (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={() => setArrastar(l)}
                      onDragEnd={() => setArrastar(null)}
                      className="rounded-controlo border border-linha bg-superficie p-3 shadow-sm"
                      style={l.etiquetaCor ? { borderLeft: `3px solid ${l.etiquetaCor}` } : undefined}
                    >
                      <button type="button" onClick={() => onAbrir(l)} className="w-full text-left">
                        <span className="flex items-start gap-2">
                          <span className="flex-1 text-[13px] font-semibold text-tinta">{nomeCompleto(l)}</span>
                          {l.preco > 0 && <span className="num text-xs font-semibold text-acao-texto">{eur(l.preco)}</span>}
                        </span>
                        <span className="block mt-0.5 truncate text-xs text-tinta-suave">{l.curso || "Sem curso"}</span>
                        <span className="block mt-1 text-xs text-tinta">{proximoPasso(l).texto}</span>
                        {s.texto && <span className={cx("block text-xs", s.atrasado ? "font-semibold text-perigo" : "text-tinta-suave")}>{s.texto}</span>}
                        {l.comercialNome && <span className="block mt-1 text-[11px] text-tinta-fraca">{l.comercialNome}</span>}
                      </button>
                    </article>
                  );
                })}
                {col.total > col.items.length && (
                  <p className="num m-0 text-center text-[11px] text-tinta-suave">+ {num(col.total - col.items.length)} nesta etapa · use a lista</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="m-0 text-xs text-tinta-suave">Arraste um cartão para mudar a etapa. «Formando» é só para a secretaria e pede a turma.</p>
    </div>
  );
}
