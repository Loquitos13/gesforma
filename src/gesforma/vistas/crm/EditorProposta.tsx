// Nova proposta / editar proposta: dados à esquerda, a página A4 à direita (o PDF sai desta página).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiAlterarProposta, apiCliente, apiModelos, apiProposta, apiPropostaCliente,
} from "../../../partilhado/api/crmDiretorio";
import { apiPrecoInscricao } from "../../../partilhado/api/equipa";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Botao, ErroCarregar, Esqueleto } from "../../../partilhado/ui";
import { numeroDe, useEu } from "./comum";
import { EscolherCliente } from "./EscolherCliente";
import { BarraFormatacao, BotaoTexto } from "./documento/BarraFormatacao";
import { tabelaInvestimento, useEntidade } from "./documento/comum";
import { CampoLateral, CartaoLateral, CONTROLO, EcraDocumento, RodapePagina } from "./documento/EcraDocumento";
import { imprimirDocumento } from "./documento/imprimir";
import { propostaInicial, BLOCO_INVESTIMENTO } from "./documento/inicial";
import {
  CAMPOS, DEFINICOES_PADRAO, corpoParaGuardar, dataLonga, escreverDocumento, euros, lerDocumento, numeroDoc, type Definicoes,
} from "./documento/modelo";
import { PaginaA4, type PaginaRef } from "./documento/PaginaA4";
import { hojeLisboa, somarDias } from "../../../partilhado/horaLisboa";

const CAMPOS_PROPOSTA = CAMPOS.filter(c => !["sede", "representante", "turma", "plano", "datas", "local"].includes(c.chave));
const DESCONTOS = [0, 5, 10, 15, 20];

export function EditorProposta({ propostaId, clienteInicial, regime, onFechar, trilho }: {
  propostaId: number | null;
  clienteInicial?: number | null;
  /** Regime do ecrã (Gold ou Financiada): a proposta nova fica nele. */
  regime: "gold" | "fin";
  onFechar: () => void;
  trilho: string;
}) {
  const proposta = useRecurso(propostaId ? `crm:proposta:${propostaId}` : null, signal => apiProposta(propostaId!, { signal }));
  if (propostaId && proposta.erro) return <ErroCarregar erro={proposta.erro} onTentar={proposta.recarregar} />;
  if (propostaId && !proposta.dados) return <Esqueleto linhas={8} />;
  return <Editor proposta={proposta.dados?.proposta ?? null} clienteInicial={clienteInicial ?? null} regime={regime} onFechar={onFechar} trilho={trilho} />;
}

function Editor({ proposta, clienteInicial, regime, onFechar, trilho }: {
  proposta: Awaited<ReturnType<typeof apiProposta>>["proposta"] | null;
  clienteInicial: number | null;
  regime: "gold" | "fin";
  onFechar: () => void;
  trilho: string;
}) {
  const eu = useEu();
  const entidade = useEntidade();
  const pagina = useRef<PaginaRef>(null);
  const inicial = useMemo(() => lerDocumento(proposta?.corpo ?? ""), [proposta]);
  const [def, setDef] = useState<Definicoes>(inicial.def);
  const d0 = inicial.def.dados;
  const [clienteId, setClienteId] = useState(String(proposta?.clienteId ?? clienteInicial ?? ""));
  const [contacto, setContacto] = useState(d0.contacto ?? "");
  const [email, setEmail] = useState(d0.email ?? proposta?.clienteEmail ?? "");
  const [curso, setCurso] = useState(proposta?.curso ?? "");
  const [formandos, setFormandos] = useState(Number(d0.formandos) || 1);
  const [preco, setPreco] = useState(d0.preco ?? "");
  const [desconto, setDesconto] = useState(Number(d0.desconto) || 0);
  const [inicio, setInicio] = useState(d0.inicio ?? "");
  const [validade, setValidade] = useState(d0.validade ?? somarDias(hojeLisboa(), 20));
  const [templateId, setTemplateId] = useState(proposta?.templateId ? String(proposta.templateId) : "");
  const [realce, setRealce] = useState(true);
  const [paginas, setPaginas] = useState(1);
  const [sujo, setSujo] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [chave, setChave] = useState(`p:${proposta?.id ?? "nova"}`);
  const [htmlInicial, setHtmlInicial] = useState(inicial.html);

  const ficha = useRecurso(clienteId ? `crm:cliente:${clienteId}` : null, signal => apiCliente(Number(clienteId), { signal }));
  const modelos = useRecurso("crm:modelos:proposta", signal => apiModelos("proposta", { signal }));
  const regimeDoc = proposta ? (proposta.regime === "fin" ? "fin" : "gold") : regime;
  const cursos = useOpcoes("cursos", { regime: regimeDoc });
  const cliente = ficha.dados?.cliente;
  const horas = Number(cursos.opcoes.find(o => o.valor === curso)?.extra?.horas) || 0;

  // Proposta nova: começa pelo primeiro modelo (ou pelo texto de partida, quando ainda não há modelos).
  const arrancou = useRef(Boolean(proposta));
  useEffect(() => {
    if (arrancou.current || !modelos.dados) return;
    arrancou.current = true;
    const m = modelos.dados.modelos[0];
    if (m) aplicarModelo(String(m.id));
    else { setHtmlInicial(propostaInicial()); setChave("p:nova:inicial"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos.dados]);

  useEffect(() => {
    if (cliente && !proposta) setEmail(e => e || cliente.email);
  }, [cliente, proposta]);

  // Preço por formando: o da oferta do curso (quando ainda não foi escrito).
  useEffect(() => {
    if (!curso || preco) return;
    let vivo = true;
    apiPrecoInscricao(curso).then(r => { if (vivo && r.preco) setPreco(String(r.preco)); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [curso, preco]);

  function aplicarModelo(id: string) {
    setTemplateId(id);
    const m = modelos.dados?.modelos.find(x => String(x.id) === id);
    if (!m) {
      pagina.current?.repor(id === "branco" ? "<p><br></p>" : propostaInicial());
      return;
    }
    const doc = lerDocumento(m.corpo);
    setDef(d => ({ ...doc.def, dados: d.dados }));
    if (!curso && m.curso) setCurso(m.curso);
    if (!preco && m.valor) setPreco(String(m.valor));
    setHtmlInicial(doc.html || propostaInicial());
    setChave(`p:modelo:${id}:${Date.now()}`);
    setSujo(true);
  }

  const precoN = numeroDe(preco);
  const inv = tabelaInvestimento(formandos, precoN, desconto);
  const numero = numeroDoc("proposta", proposta?.id);
  const nomeCliente = cliente?.nome ?? proposta?.clienteNome ?? "";
  const valores = {
    cliente: nomeCliente, nif: cliente?.nif ?? "", email, contacto, curso,
    horas: horas ? `${horas} horas` : "", formandos: `${formandos} ${formandos === 1 ? "formando" : "formandos"}`,
    inicio: inicio ? dataLonga(inicio) : "", valor: euros(inv.total), desconto: desconto ? `${desconto} %` : "",
    validade: validade ? dataLonga(validade) : "", data: dataLonga(proposta?.enviadaEm), numero: proposta ? numero : "",
    comercial: proposta?.comercial || eu.name, entidade,
  };
  const meta = [`Proposta ${proposta ? numero : ""}`.trim(), dataLonga(proposta?.enviadaEm)];

  function corpo() {
    const dados = { contacto, email, formandos: String(formandos), preco, desconto: String(desconto), inicio, validade };
    return escreverDocumento({ ...def, dados }, corpoParaGuardar(pagina.current?.html() ?? "", valores));
  }

  async function gravar() {
    if (!proposta && !clienteId) return toastError(null, "Escolha o cliente.");
    if (!curso.trim()) return toastError(null, "Indique o curso.");
    setAGravar(true);
    try {
      if (proposta) {
        await apiAlterarProposta(proposta.id, { curso: curso.trim(), valor: inv.total, corpo: corpo() });
        toastOk("Proposta guardada.");
      } else {
        await apiPropostaCliente(Number(clienteId), {
          curso: curso.trim(), valor: inv.total, corpo: corpo(), templateId: templateId && templateId !== "branco" ? Number(templateId) : null, comercialId: eu.id, notas: "", regime,
        });
        toastOk("Proposta registada como enviada.");
      }
      for (const p of ["crm:propostas", "crm:clientes", "crm:proposta", "equipa:"]) invalidar(p);
      setSujo(false);
      onFechar();
    } catch (e) {
      toastError(e, "Não foi possível guardar a proposta.");
    } finally {
      setAGravar(false);
    }
  }

  function pdf() {
    const ok = imprimirDocumento({ titulo: `Proposta ${numero} · ${nomeCliente}`, htmlEditor: pagina.current?.html() ?? "", def, valores, entidade, metaLinhas: meta });
    if (!ok) toastError(null, "O browser bloqueou a janela. Permita janelas deste site.");
  }

  const assunto = encodeURIComponent(`Proposta de formação · ${curso || "formação"}`);

  return (
    <EcraDocumento
      trilho={trilho}
      titulo={proposta ? `Proposta ${numero}` : "Nova proposta"}
      detalhe={proposta ? `${nomeCliente} · ${sujo ? "alterações por guardar" : "guardada"}` : sujo ? "rascunho por guardar" : "rascunho"}
      onVoltar={onFechar}
      rotuloLateral="Dados da proposta"
      acoes={(
        <>
          <Botao onClick={pdf}>Descarregar PDF</Botao>
          {email && proposta && <a className="inline-flex items-center h-10 px-3.5 rounded-lg border border-linha-forte bg-white text-tinta no-underline text-sm hover:bg-fundo" href={`mailto:${email}?subject=${assunto}`}>Enviar por email</a>}
          <Botao variante="primario" aCarregar={aGravar} onClick={() => void gravar()}>{proposta ? "Guardar proposta" : "Guardar e enviar ao cliente"}</Botao>
        </>
      )}
      lateral={(
        <>
          <CartaoLateral titulo="Para quem">
            <CampoLateral rotulo="Cliente">
              {proposta ? (
                <input className={CONTROLO} value={cliente?.nome ?? proposta.clienteNome} readOnly />
              ) : (
                <EscolherCliente valor={clienteId} nomeAtual={cliente?.nome ?? ""} onEscolher={c => { setClienteId(c ? String(c.id) : ""); setEmail(""); setSujo(true); }} />
              )}
            </CampoLateral>
            <CampoLateral rotulo="A/C">
              <input className={CONTROLO} value={contacto} onChange={e => { setContacto(e.target.value); setSujo(true); }} placeholder="Nome e função de quem recebe" />
            </CampoLateral>
            <CampoLateral rotulo="Email para envio">
              <input className={CONTROLO} type="email" value={email} onChange={e => { setEmail(e.target.value); setSujo(true); }} />
            </CampoLateral>
          </CartaoLateral>

          <CartaoLateral titulo="Formação e valor">
            <CampoLateral rotulo="Curso">
              <select className={CONTROLO} value={curso} onChange={e => { setCurso(e.target.value); setPreco(""); setSujo(true); }}>
                <option value="">Escolher curso</option>
                {curso && !cursos.opcoes.some(o => o.valor === curso) && <option value={curso}>{curso}</option>}
                {cursos.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}{o.extra?.horas ? ` · ${String(o.extra.horas)} h` : ""}</option>)}
              </select>
            </CampoLateral>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-tinta-suave">
                Formandos
                <span className="flex items-center border border-linha-forte rounded-lg h-[38px] overflow-hidden">
                  <button type="button" aria-label="Menos um formando" onClick={() => { setFormandos(n => Math.max(1, n - 1)); setSujo(true); }} className="w-9 h-full border-0 bg-fundo cursor-pointer text-base">−</button>
                  <span className="num flex-1 text-center text-tinta text-sm font-semibold" aria-live="polite">{formandos}</span>
                  <button type="button" aria-label="Mais um formando" onClick={() => { setFormandos(n => Math.min(200, n + 1)); setSujo(true); }} className="w-9 h-full border-0 bg-fundo cursor-pointer text-base">+</button>
                </span>
              </div>
              <CampoLateral rotulo="Desconto">
                <select className={CONTROLO} value={desconto} onChange={e => { setDesconto(Number(e.target.value)); setSujo(true); }}>
                  {DESCONTOS.map(d => <option key={d} value={d}>{d ? `${d} %` : "Sem desconto"}</option>)}
                </select>
              </CampoLateral>
            </div>
            <CampoLateral rotulo="Preço por formando (€)">
              <input className={CONTROLO} inputMode="decimal" value={preco} onChange={e => { setPreco(e.target.value); setSujo(true); }} placeholder="0,00" />
            </CampoLateral>
            <dl className="num m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 text-[13px] pt-2.5 border-t border-[#EEF0F3]">
              <dt className="text-tinta-suave">{formandos} × {euros(precoN)}</dt><dd className="m-0 text-right">{euros(inv.bruto)}</dd>
              <dt className="text-tinta-suave">Desconto</dt><dd className="m-0 text-right">{desconto ? `− ${euros(inv.desconto)}` : "—"}</dd>
              <dt className="font-semibold text-tinta">Total</dt><dd className="m-0 text-right font-bold text-tinta">{euros(inv.total)}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-2.5">
              <CampoLateral rotulo="Início previsto">
                <input className={CONTROLO} type="date" value={inicio} onChange={e => { setInicio(e.target.value); setSujo(true); }} />
              </CampoLateral>
              <CampoLateral rotulo="Válida até">
                <input className={CONTROLO} type="date" value={validade} onChange={e => { setValidade(e.target.value); setSujo(true); }} />
              </CampoLateral>
            </div>
          </CartaoLateral>
          <p className="m-0 text-xs text-tinta-suave leading-normal">
            Os campos realçados na página vêm destes dados e actualizam-se sozinhos. O resto do texto escreve-se e formata-se directamente na página.
          </p>
        </>
      )}
      barra={(
        <BarraFormatacao
          pagina={pagina}
          estilos={{ h3: "Subtítulo" }}
          campos={CAMPOS_PROPOSTA}
          antes={(
            <label className="inline-flex items-center gap-1.5 text-xs text-tinta-suave pr-1.5 mr-0.5 border-r border-linha">
              Modelo
              <select className="h-8 border border-linha-forte rounded-md px-1.5 text-[13px] text-tinta bg-white max-w-[200px]" value={templateId} onChange={e => aplicarModelo(e.target.value)}>
                <option value="" disabled>Escolher</option>
                {(modelos.dados?.modelos ?? []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                <option value="branco">Em branco</option>
              </select>
            </label>
          )}
          extra={(
            <>
              <BotaoTexto onClick={() => pagina.current?.inserirHtml(`<h3>Investimento</h3>${BLOCO_INVESTIMENTO}<p><br></p>`)}>Tabela</BotaoTexto>
              <BotaoTexto onClick={() => pagina.current?.inserirHtml('<div data-quebra="1" contenteditable="false"></div><p><br></p>')}>Quebra de página</BotaoTexto>
            </>
          )}
        />
      )}
      pagina={(
        <PaginaA4
          ref={pagina}
          chave={chave}
          htmlInicial={htmlInicial}
          def={def.logoAltura ? def : DEFINICOES_PADRAO}
          valores={valores}
          blocos={{ investimento: inv.html }}
          entidade={entidade}
          meta={<>{meta[0]}<br />{meta[1]}</>}
          realce={realce}
          rotulo="Texto da proposta"
          onMudar={() => setSujo(true)}
          onPaginas={setPaginas}
        />
      )}
      rodape={<RodapePagina paginas={paginas} realce={realce} onRealce={setRealce} nota="O PDF sai desta página: as mesmas margens, letra, quebras de página e formatação. O realce dos campos não aparece no PDF." />}
    />
  );
}
