// Modelos dos emails: lista à esquerda, editor e pré-visualização (o mesmo HTML que sai) à direita.
import { useEffect, useMemo, useState } from "react";
import { usePode } from "../../../../partilhado/AuthGate";
import {
  apiAlterarModelo, apiApagarModelo, apiCriarModelo, apiModelosEmail, apiPrevisualizarEmail, type CtaAmbito, type ModeloEmail, type OpcoesEmail,
} from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { ROTULO_AREA_EMAIL, eAreaEmail, type AreaEmail } from "../../../../partilhado/emailAreas";
import { Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Modal, Selecao, Vazio, cx, dataHora } from "../../../../partilhado/ui";
import { EtiquetaArea } from "./EtiquetaArea";
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
  // A administração vê as três áreas (Gold, Financiada, Contabilidade) e pode filtrar; os outros só a sua.
  const areas = opcoes?.areas ?? [];
  const varias = areas.length > 1;
  const [filtroArea, setFiltroArea] = useState<AreaEmail | "">("");
  const modelos = useMemo(() => (dados?.templates ?? []).filter(m => !filtroArea || m.area === filtroArea), [dados, filtroArea]);
  const [novo, setNovo] = useState(false);
  const [apagar, setApagar] = useState<ModeloEmail | null>(null);
  const remover = useAccao(apiApagarModelo, { ok: "Email apagado.", invalidar: ["emails:"] });
  const [selId, setSelId] = useState<number | null>(null);
  const sel = modelos.find(m => m.id === selId) ?? modelos[0] ?? null;
  const [r, setR] = useState<Rascunho | null>(null);
  useEffect(() => { if (sel) setR(rascunhoDe(sel)); }, [sel]);
  const gravar = useAccao(apiAlterarModelo, { ok: "Modelo gravado.", invalidar: ["emails:"] });

  const pedido = useAtraso(r && sel ? { tipo: sel.tipo, area: sel.area, assunto: r.assunto, body_xml: r.xml, cta: r.cta, cta_ambito: r.ambito || undefined } : null);
  const { dados: prev, aCarregar } = useRecurso(
    pedido && pedido.assunto.trim().length >= 2 ? `emails:prev:modelo:${JSON.stringify(pedido)}` : null,
    signal => apiPrevisualizarEmail(pedido!, signal),
  );

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Cartao><Esqueleto linhas={8} /></Cartao>;
  if (!(dados.templates ?? []).length && !novo) {
    return (
      <Cartao>
        <Vazio titulo="Sem emails nesta área" descricao="Os emails automáticos vêm da instalação do GesForma; pode escrever os seus."
          acao={gerir ? <Botao variante="primario" onClick={() => setNovo(true)}>Novo email</Botao> : undefined} />
      </Cartao>
    );
  }

  const original = sel ? rascunhoDe(sel) : null;
  const alterado = r && original && JSON.stringify(r) !== JSON.stringify(original);
  const valido = r && r.nome.trim().length >= 2 && r.assunto.trim().length >= 2 && parseEmailXml(r.xml).paragraphs.length > 0;

  function mudarCta(cta: string, ambito: CtaAmbito | "") {
    if (!r) return;
    setR({ ...r, cta, ambito, xml: replaceCta(r.xml, cta, "", ambito || undefined) });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <Cartao semPadding titulo="Modelos" acoes={gerir ? <Botao tamanho="sm" onClick={() => setNovo(true)}>Novo email</Botao> : undefined}>
        {varias && (
          <div className="px-3 pt-2">
            <Selecao aria-label="Área" vazio="Todas as áreas" value={filtroArea}
              opcoes={areas.map(a => ({ valor: a, rotulo: ROTULO_AREA_EMAIL[a] }))}
              onChange={e => { setFiltroArea(eAreaEmail(e.target.value) ? e.target.value : ""); setSelId(null); }} />
          </div>
        )}
        <ul className="m-0 p-1.5 list-none" aria-label="Modelos de email">
          {modelos.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => setSelId(m.id)} aria-current={sel?.id === m.id ? "true" : undefined}
                className={cx("w-full text-left rounded-controlo px-3 py-2.5", sel?.id === m.id ? "bg-acao-suave/60" : "hover:bg-fundo")}>
                <span className="flex items-center gap-2 text-sm font-semibold text-tinta">
                  <span className="min-w-0 truncate">{m.nome}</span>
                  {varias && <EtiquetaArea area={m.area} className="ml-auto shrink-0" />}
                </span>
                <span className="block text-xs text-tinta-suave truncate">{m.personalizado ? "Escrito pela equipa" : m.funcao}</span>
              </button>
            </li>
          ))}
        </ul>
      </Cartao>

      {sel && r && (
        <Cartao
          titulo={sel.nome}
          subtitulo={`${varias ? `${ROTULO_AREA_EMAIL[sel.area] ?? ""} · ` : ""}Alterado em ${dataHora(sel.updated_at)}`}
          acoes={gerir ? (
            <>
              {sel.personalizado && <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setApagar(sel)}>Apagar</Botao>}
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
            <EmailXmlEditor xml={r.xml} onChange={xml => setR({ ...r, xml, cta: parseEmailXml(xml).cta || r.cta })} variaveis={[...(opcoes?.variaveis ?? []), ...(opcoes?.variaveisPorTipo?.[sel.tipo] ?? [])]} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo rotulo="Texto do botão">{a => <Entrada {...a} value={r.cta} maxLength={120} onChange={e => mudarCta(e.target.value, r.ambito)} />}</Campo>
              {opcoes?.botaoProprio?.[sel.tipo]
                ? <p className="m-0 self-end pb-2 text-[13px] text-tinta-suave">O botão leva a: <strong className="text-tinta">{opcoes.botaoProprio[sel.tipo]}</strong> (o endereço de cada pessoa).</p>
                : (
                  <Campo rotulo="O botão leva a" ajuda="O endereço é o da pessoa (ligação pessoal, passo de pagamento…).">
                    {a => (
                      <Selecao {...a} vazio="Sem botão" opcoes={(opcoes?.ambitos ?? []).map(x => ({ valor: x.valor, rotulo: x.rotulo }))}
                        value={r.ambito} onChange={e => mudarCta(r.cta, (isCtaAmbito(e.target.value) ? e.target.value : ""))} />
                    )}
                  </Campo>
                )}
            </div>
          </fieldset>
        </Cartao>
      )}

      <div className="xl:sticky xl:top-4">
        <p className="m-0 mb-2 text-[13px] font-medium text-tinta">Como chega à caixa de correio</p>
        <MolduraEmail assunto={prev?.assunto} de={prev?.de} para={prev?.para} html={prev?.html} aCarregar={aCarregar} />
        <p className="m-0 mt-2 text-xs text-tinta-suave">Com os dados da pré-inscrição e da turma mais recentes. Para receber um envio real, use «Testar» numa regra.</p>
      </div>

      {novo && <NovoModelo areas={areas} areaInicial={filtroArea || areas[0]} onFechar={id => { setNovo(false); if (id) setSelId(id); }} />}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Apagar este email?"
        descricao={`«${apagar?.nome ?? ""}» deixa de existir. Se estiver numa regra, apague a regra primeiro.`}
        onConfirmar={async () => { if (apagar) { await remover.correr(apagar.id); setSelId(null); } }}
      />
    </div>
  );
}

/** Email novo, escrito pela coordenação ou pela contabilidade (fica na sua área; a administração escolhe a área). */
function NovoModelo({ areas, areaInicial, onFechar }: { areas: AreaEmail[]; areaInicial?: AreaEmail; onFechar: (id?: number) => void }) {
  const [f, setF] = useState({ area: areaInicial ?? areas[0] ?? "gold", nome: "", assunto: "" });
  const criar = useAccao(apiCriarModelo, { ok: "Email criado: escreva o texto e grave.", invalidar: ["emails:"] });
  const valido = f.nome.trim().length >= 2 && f.assunto.trim().length >= 2;
  async function gravar() {
    const r = await criar.correr({
      area: areas.length > 1 ? f.area : undefined, nome: f.nome.trim(), assunto: f.assunto.trim(),
      body_xml: "<email>\n  <p>Olá {{nome}},</p>\n  <p>Escreva aqui o texto do email.</p>\n</email>\n",
    });
    if (r) onFechar(r.template.id);
  }
  return (
    <Modal aberto onFechar={() => onFechar()} titulo="Novo email"
      rodape={(
        <>
          <Botao onClick={() => onFechar()}>Cancelar</Botao>
          <Botao variante="primario" disabled={!valido} aCarregar={criar.aCorrer} onClick={() => void gravar()}>Criar</Botao>
        </>
      )}>
      <div className="space-y-3">
        {areas.length > 1 && (
          <Campo rotulo="Área">{a => <Selecao {...a} value={f.area} opcoes={areas.map(x => ({ valor: x, rotulo: ROTULO_AREA_EMAIL[x] }))} onChange={e => setF({ ...f, area: eAreaEmail(e.target.value) ? e.target.value : f.area })} />}</Campo>
        )}
        <Campo rotulo="Nome do email" obrigatorio ajuda="Para o reconhecer na lista e nas regras.">{a => <Entrada {...a} value={f.nome} maxLength={120} onChange={e => setF({ ...f, nome: e.target.value })} data-autofocus />}</Campo>
        <Campo rotulo="Assunto" obrigatorio ajuda="Pode usar variáveis, por exemplo {{nome}} ou {{curso}}.">{a => <Entrada {...a} value={f.assunto} maxLength={200} onChange={e => setF({ ...f, assunto: e.target.value })} />}</Campo>
        <p className="m-0 text-[13px] text-tinta-suave">Depois de criado, escreva o texto no editor e ligue-o a uma regra (separador Regras) para começar a sair.</p>
      </div>
    </Modal>
  );
}
