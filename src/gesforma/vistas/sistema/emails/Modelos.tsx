// Modelos dos emails: lista à esquerda, editor e pré-visualização (o mesmo HTML que sai) à direita.
import { useEffect, useMemo, useState } from "react";
import { usePode } from "../../../../partilhado/AuthGate";
import {
  apiAlterarModelo, apiModelosEmail, apiPrevisualizarEmail, type CtaAmbito, type ModeloEmail, type OpcoesEmail,
} from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Botao, Campo, Cartao, Entrada, ErroCarregar, Esqueleto, Selecao, Vazio, cx, dataHora } from "../../../../partilhado/ui";
import { EmailXmlEditor } from "../../../EmailTemplateEditor";
import { isCtaAmbito } from "../../../emailCta";
import { linesToXml, parseEmailXml, replaceCta } from "../../../emailXml";
import { MolduraEmail } from "./Previsualizacao";

type Rascunho = { nome: string; assunto: string; xml: string; cta: string; ambito: CtaAmbito | "" };

function linhasDe(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } }
  return [];
}

function rascunhoDe(m: ModeloEmail): Rascunho {
  const ambito = isCtaAmbito(m.cta_ambito) ? m.cta_ambito : "";
  const xml = m.body_xml?.trim() ? m.body_xml : linesToXml(linhasDe(m.body_lines), m.cta, "", ambito || undefined);
  const doc = parseEmailXml(xml);
  return { nome: m.nome, assunto: m.assunto, xml, cta: doc.cta || m.cta, ambito: doc.ambito ?? ambito };
}

/** Espera que a pessoa pare de escrever antes de pedir a pré-visualização ao servidor. */
function useAtraso<T>(valor: T, ms = 400) {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = window.setTimeout(() => setV(valor), ms); return () => window.clearTimeout(t); }, [valor, ms]);
  return v;
}

export function Modelos({ opcoes }: { opcoes?: OpcoesEmail }) {
  const pode = usePode();
  const gerir = pode("emails.gerir");
  const { dados, erro, recarregar } = useRecurso("emails:modelos", apiModelosEmail);
  const modelos = useMemo(() => dados?.templates ?? [], [dados]);
  const [selId, setSelId] = useState<number | null>(null);
  const sel = modelos.find(m => m.id === selId) ?? modelos[0] ?? null;
  const [r, setR] = useState<Rascunho | null>(null);
  useEffect(() => { if (sel) setR(rascunhoDe(sel)); }, [sel]);
  const gravar = useAccao(apiAlterarModelo, { ok: "Modelo gravado.", invalidar: ["emails:"] });

  const pedido = useAtraso(r && sel ? { tipo: sel.tipo, assunto: r.assunto, body_xml: r.xml, cta: r.cta, cta_ambito: r.ambito || undefined } : null);
  const { dados: prev, aCarregar } = useRecurso(
    pedido && pedido.assunto.trim().length >= 2 ? `emails:prev:modelo:${JSON.stringify(pedido)}` : null,
    signal => apiPrevisualizarEmail(pedido!, signal),
  );

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Cartao><Esqueleto linhas={8} /></Cartao>;
  if (!modelos.length) return <Cartao><Vazio titulo="Sem modelos de email" descricao="Os modelos vêm da instalação do GesForma." /></Cartao>;

  const original = sel ? rascunhoDe(sel) : null;
  const alterado = r && original && JSON.stringify(r) !== JSON.stringify(original);
  const valido = r && r.nome.trim().length >= 2 && r.assunto.trim().length >= 2 && parseEmailXml(r.xml).paragraphs.length > 0;

  function mudarCta(cta: string, ambito: CtaAmbito | "") {
    if (!r) return;
    setR({ ...r, cta, ambito, xml: replaceCta(r.xml, cta, "", ambito || undefined) });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <Cartao semPadding titulo="Modelos">
        <ul className="m-0 p-1.5 list-none" aria-label="Modelos de email">
          {modelos.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => setSelId(m.id)} aria-current={sel?.id === m.id ? "true" : undefined}
                className={cx("w-full text-left rounded-controlo px-3 py-2.5", sel?.id === m.id ? "bg-acao-suave/60" : "hover:bg-fundo")}>
                <span className="block text-sm font-semibold text-tinta">{m.nome}</span>
                <span className="block text-xs text-tinta-suave truncate">{m.funcao}</span>
              </button>
            </li>
          ))}
        </ul>
      </Cartao>

      {sel && r && (
        <Cartao
          titulo={sel.nome}
          subtitulo={`Alterado em ${dataHora(sel.updated_at)}`}
          acoes={gerir ? (
            <>
              <Botao tamanho="sm" disabled={!alterado} onClick={() => setR(rascunhoDe(sel))}>Descartar</Botao>
              <Botao tamanho="sm" variante="primario" disabled={!alterado || !valido} aCarregar={gravar.aCorrer}
                onClick={() => void gravar.correr(sel.id, { nome: r.nome.trim(), assunto: r.assunto.trim(), body_xml: r.xml, cta: r.cta.trim() || undefined, cta_ambito: r.ambito || undefined })}>
                Gravar
              </Botao>
            </>
          ) : undefined}
        >
          <fieldset disabled={!gerir} className="m-0 p-0 border-0 space-y-3">
            <Campo rotulo="Nome do modelo">{a => <Entrada {...a} value={r.nome} maxLength={120} onChange={e => setR({ ...r, nome: e.target.value })} />}</Campo>
            <Campo rotulo="Assunto" ajuda="Pode usar variáveis, por exemplo {{nome}} ou {{curso}}.">
              {a => <Entrada {...a} value={r.assunto} maxLength={200} onChange={e => setR({ ...r, assunto: e.target.value })} />}
            </Campo>
            <EmailXmlEditor xml={r.xml} onChange={xml => setR({ ...r, xml, cta: parseEmailXml(xml).cta || r.cta })} variaveis={opcoes?.variaveis ?? []} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo rotulo="Texto do botão">{a => <Entrada {...a} value={r.cta} maxLength={120} onChange={e => mudarCta(e.target.value, r.ambito)} />}</Campo>
              <Campo rotulo="O botão leva a" ajuda="O endereço é o da pessoa (ligação pessoal, passo de pagamento…).">
                {a => (
                  <Selecao {...a} vazio="Sem botão" opcoes={(opcoes?.ambitos ?? []).map(x => ({ valor: x.valor, rotulo: x.rotulo }))}
                    value={r.ambito} onChange={e => mudarCta(r.cta, (isCtaAmbito(e.target.value) ? e.target.value : ""))} />
                )}
              </Campo>
            </div>
          </fieldset>
        </Cartao>
      )}

      <div className="xl:sticky xl:top-4">
        <p className="m-0 mb-2 text-[13px] font-medium text-tinta">Como chega à caixa de correio</p>
        <MolduraEmail assunto={prev?.assunto} de={prev?.de} para={prev?.para} html={prev?.html} aCarregar={aCarregar} />
        <p className="m-0 mt-2 text-xs text-tinta-suave">Com os dados da pré-inscrição e da turma mais recentes. Para receber um envio real, use «Testar» numa regra.</p>
      </div>
    </div>
  );
}
