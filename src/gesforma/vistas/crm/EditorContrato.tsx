// Novo contrato / editar contrato: dados do cliente, formação, pagamento e cláusulas opcionais à esquerda,
// a página A4 à direita. O PDF para assinatura sai desta página.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiAlterarContrato, apiCliente, apiContrato, apiCriarContrato, apiModelos, apiProposta, type Contrato,
} from "../../../partilhado/api/crmDiretorio";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, ErroCarregar, Esqueleto, data } from "../../../partilhado/ui";
import { EnviarAssinatura } from "../assinaturas/EnviarAssinatura";
import { numeroDe, useEu } from "./comum";
import { EscolherCliente } from "./EscolherCliente";
import { BarraFormatacao, BotaoTexto, CLAUSULA, clausulaOpcional } from "./documento/BarraFormatacao";
import { useEntidade } from "./documento/comum";
import { CampoLateral, CartaoLateral, CONTROLO, EcraDocumento, RodapePagina } from "./documento/EcraDocumento";
import { imprimirDocumento } from "./documento/imprimir";
import { contratoInicial } from "./documento/inicial";
import {
  alternarOpcional, corpoParaGuardar, dataLonga, escreverDocumento, euros, lerDocumento, numeroDoc, opcionaisDe, type Definicoes,
} from "./documento/modelo";
import { PaginaA4, type PaginaRef } from "./documento/PaginaA4";

type Plano = "1" | "2" | "3";

/** "16 e 27 de novembro de 2026" (mesmo mês), "30 de outubro e 5 de novembro de 2026" (mesmo ano). */
function intervalo(de: string, ate: string) {
  const [a, b] = [dataLonga(de), dataLonga(ate)];
  const [d1, m1, y1] = [de.slice(8, 10), de.slice(5, 7), de.slice(0, 4)];
  const [, m2, y2] = [ate.slice(8, 10), ate.slice(5, 7), ate.slice(0, 4)];
  if (y1 === y2 && m1 === m2) return `${Number(d1)} e ${b}`;
  if (y1 === y2) return `${a.replace(/ de \d{4}$/, "")} e ${b}`;
  return `${a} e ${b}`;
}

export function EditorContrato({ contratoId, propostaId, regime, onFechar, trilho }: {
  contratoId: number | null;
  propostaId?: number | null;
  /** Regime do ecrã (Gold ou Financiada): o contrato novo fica nele. */
  regime: "gold" | "fin";
  onFechar: () => void;
  trilho: string;
}) {
  const k = useRecurso(contratoId ? `crm:contrato:${contratoId}` : null, signal => apiContrato(contratoId!, { signal }));
  const p = useRecurso(!contratoId && propostaId ? `crm:proposta:${propostaId}` : null, signal => apiProposta(propostaId!, { signal }));
  const erro = k.erro ?? p.erro;
  if (erro) return <ErroCarregar erro={erro} onTentar={() => { k.recarregar(); p.recarregar(); }} />;
  if ((contratoId && !k.dados) || (!contratoId && propostaId && !p.dados)) return <Esqueleto linhas={8} />;
  return <Editor contrato={k.dados?.contrato ?? null} proposta={p.dados?.proposta ?? null} regime={regime} onFechar={onFechar} trilho={trilho} />;
}

function Editor({ contrato, proposta, regime, onFechar, trilho }: {
  contrato: Contrato | null;
  proposta: Awaited<ReturnType<typeof apiProposta>>["proposta"] | null;
  regime: "gold" | "fin";
  onFechar: () => void;
  trilho: string;
}) {
  const eu = useEu();
  const entidade = useEntidade();
  const pagina = useRef<PaginaRef>(null);
  const inicial = useMemo(() => lerDocumento(contrato?.corpo ?? ""), [contrato]);
  const [def, setDef] = useState<Definicoes>(inicial.def);
  const d0 = inicial.def.dados;
  const [atual, setAtual] = useState<Contrato | null>(contrato);
  const [clienteId, setClienteId] = useState(String(contrato?.clienteId ?? proposta?.clienteId ?? ""));
  const [clienteNome, setClienteNome] = useState(contrato?.clienteNome ?? proposta?.clienteNome ?? "");
  const [clienteEmail, setClienteEmail] = useState(contrato?.clienteEmail ?? proposta?.clienteEmail ?? "");
  const [sede, setSede] = useState(d0.sede ?? "");
  const [representante, setRepresentante] = useState(d0.representante ?? "");
  const [cargo, setCargo] = useState(d0.cargo ?? "");
  const [curso, setCurso] = useState(contrato?.curso ?? proposta?.curso ?? "");
  const [turma, setTurma] = useState(d0.turma ?? "");
  const [inicio, setInicio] = useState(d0.inicio ?? "");
  const [fim, setFim] = useState(d0.fim ?? "");
  const [formandos, setFormandos] = useState(d0.formandos ?? "");
  const [local, setLocal] = useState(d0.local ?? "");
  const [valor, setValor] = useState(contrato?.valor ? String(contrato.valor) : proposta?.valor ? String(proposta.valor) : "");
  const [plano, setPlano] = useState<Plano>((d0.plano as Plano) || "1");
  const [templateId, setTemplateId] = useState(contrato?.templateId ? String(contrato.templateId) : "");
  const [opcionais, setOpcionais] = useState(() => opcionaisDe(inicial.html));
  const [realce, setRealce] = useState(true);
  const [paginas, setPaginas] = useState(1);
  const [sujo, setSujo] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [enviar, setEnviar] = useState(false);
  const [chave, setChave] = useState(`k:${contrato?.id ?? "novo"}`);
  const [htmlInicial, setHtmlInicial] = useState(inicial.html);

  const ficha = useRecurso(clienteId ? `crm:cliente:${clienteId}` : null, signal => apiCliente(Number(clienteId), { signal }));
  const modelos = useRecurso("crm:modelos:contrato", signal => apiModelos("contrato", { signal }));
  const regimeDoc = proposta ? (proposta.regime === "fin" ? "fin" : "gold") : regime;
  const cursos = useOpcoes("cursos", { regime: regimeDoc });
  const turmas = useOpcoes("turmas", { regime: regimeDoc });
  const horas = Number(cursos.opcoes.find(o => o.valor === curso)?.extra?.horas) || 0;
  const estado = atual?.estado ?? "Rascunho";
  // Assinado uma vez, fica fechado mesmo depois de cancelado (o servidor recusa alterações).
  const bloqueado = estado === "Assinado" || estado === "Por assinar" || Boolean(atual?.assinadoEm);

  const arrancou = useRef(Boolean(contrato));
  useEffect(() => {
    if (arrancou.current || !modelos.dados) return;
    arrancou.current = true;
    const m = modelos.dados.modelos[0];
    if (m) aplicarModelo(String(m.id));
    else trocarTexto(contratoInicial(), "inicial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos.dados]);

  useEffect(() => {
    const c = ficha.dados?.cliente;
    if (!c || contrato) return;
    setClienteNome(n => n || c.nome);
    setClienteEmail(e => e || c.email);
  }, [ficha.dados, contrato]);

  function trocarTexto(html: string, marca: string) {
    setHtmlInicial(html);
    setOpcionais(opcionaisDe(html));
    setChave(`k:${marca}:${Date.now()}`);
  }

  function aplicarModelo(id: string) {
    setTemplateId(id);
    if (id === "branco") return trocarTexto("<p><br></p>", "branco");
    const m = modelos.dados?.modelos.find(x => String(x.id) === id);
    if (!m) return;
    const doc = lerDocumento(m.corpo);
    setDef(d => ({ ...doc.def, dados: d.dados }));
    if (!curso && m.curso) setCurso(m.curso);
    if (!valor && m.valor) setValor(String(m.valor));
    trocarTexto(doc.html || contratoInicial(), `modelo:${id}`);
    setSujo(true);
  }

  function ligarOpcional(id: string, ligada: boolean) {
    const html = alternarOpcional(pagina.current?.html() ?? "", id, ligada);
    pagina.current?.repor(html);
    setOpcionais(opcionaisDe(html));
  }

  const total = numeroDe(valor);
  const prestacoes = plano === "1"
    ? [{ rotulo: "Pagamento único", quando: "na assinatura", v: total }]
    : plano === "2"
      ? [{ rotulo: "1.ª prestação", quando: "na assinatura", v: total / 2 }, { rotulo: "2.ª prestação", quando: fim ? `a ${data(fim)}` : "no fim da formação", v: total / 2 }]
      : [{ rotulo: "1.ª prestação", quando: "na assinatura", v: total / 3 }, { rotulo: "2.ª prestação", quando: inicio ? `a ${data(inicio)}` : "no início", v: total / 3 }, { rotulo: "3.ª prestação", quando: fim ? `a ${data(fim)}` : "no fim", v: total / 3 }];
  const planoTexto = plano === "1"
    ? "a pagar de uma só vez, na assinatura do contrato"
    : `em ${plano === "2" ? "duas" : "três"} prestações de ${euros(total / Number(plano))}: ${prestacoes.map(x => x.quando).join(", ").replace(/, ([^,]*)$/, " e $1")}`;
  const numero = numeroDoc("contrato", atual?.id);
  const turmaRot = turmas.opcoes.find(o => o.valor === turma)?.rotulo ?? turma;
  const valores = {
    cliente: clienteNome, nif: ficha.dados?.cliente.nif ?? "", email: clienteEmail, sede,
    representante: [representante, cargo].filter(Boolean).join(", "), curso, turma: turmaRot,
    horas: horas ? `${horas} horas` : "", formandos: formandos ? `${formandos} formandos` : "", local,
    inicio: inicio ? dataLonga(inicio) : "",
    datas: inicio && fim ? intervalo(inicio, fim) : "",
    valor: total ? euros(total) : "", plano: total ? planoTexto : "", data: dataLonga(), numero: atual ? numero : "",
    comercial: atual?.comercial || eu.name, entidade,
  };
  const meta = [`Contrato ${atual ? numero : ""}`.trim(), dataLonga()];

  function corpo() {
    const dados = { sede, representante, cargo, turma, inicio, fim, formandos, local, plano };
    return escreverDocumento({ ...def, dados }, corpoParaGuardar(pagina.current?.html() ?? "", valores));
  }

  async function gravar(): Promise<Contrato | null> {
    if (!clienteNome.trim()) { toastError(null, "Indique o cliente (o nome que fica no contrato)."); return null; }
    setAGravar(true);
    try {
      let k: Contrato;
      if (atual) {
        k = (await apiAlterarContrato(atual.id, bloqueado ? { clienteEmail: clienteEmail.trim() } : {
          clienteNome: clienteNome.trim(), clienteEmail: clienteEmail.trim(), curso: curso.trim(), valor: total, corpo: corpo(),
        })).contrato;
      } else {
        k = (await apiCriarContrato({
          clienteNome: clienteNome.trim(), clienteEmail: clienteEmail.trim(), curso: curso.trim(), valor: total, corpo: corpo(),
          templateId: templateId && templateId !== "branco" ? Number(templateId) : null, clienteId: clienteId ? Number(clienteId) : null,
          propostaId: proposta?.id ?? null, comercialId: eu.id, regime,
        })).contrato;
      }
      for (const x of ["crm:contratos", "crm:contrato", "crm:clientes", "crm:propostas", "crm:modelos"]) invalidar(x);
      setAtual(k);
      setSujo(false);
      toastOk(atual ? "Contrato guardado." : "Contrato criado em rascunho.");
      return k;
    } catch (e) {
      toastError(e, "Não foi possível guardar o contrato.");
      return null;
    } finally {
      setAGravar(false);
    }
  }

  function pdf() {
    const ok = imprimirDocumento({ titulo: `Contrato ${numero} · ${clienteNome}`, htmlEditor: pagina.current?.html() ?? "", def, valores, entidade, metaLinhas: meta });
    if (!ok) toastError(null, "O browser bloqueou a janela. Permita janelas deste site.");
  }

  const passos = (["Rascunho", "Para assinatura", "Assinado"] as const).map((r, i) => {
    const idx = estado === "Assinado" ? 2 : estado === "Por assinar" ? 1 : 0;
    return { rotulo: r, estado: (i < idx ? "feito" : i === idx ? "atual" : "futuro") as "feito" | "atual" | "futuro" };
  });

  return (
    <>
      <EcraDocumento
        trilho={trilho}
        titulo={atual ? `Contrato ${numero}` : "Novo contrato"}
        detalhe={`${clienteNome || "sem cliente"}${sujo ? " · alterações por guardar" : ""}`}
        passos={passos}
        onVoltar={onFechar}
        rotuloLateral="Dados do contrato"
        acoes={(
          <>
            <Botao onClick={pdf}>Descarregar PDF</Botao>
            {!bloqueado && <Botao aCarregar={aGravar} onClick={() => void gravar()}>Guardar</Botao>}
            {estado !== "Assinado" && def.assinatura === "digital" && (
              <Botao variante="primario" onClick={async () => { const k = sujo || !atual ? await gravar() : atual; if (k) setEnviar(true); }}>
                {estado === "Por assinar" ? "Reenviar para assinatura" : "Enviar para assinatura"}
              </Botao>
            )}
          </>
        )}
        lateral={(
          <>
            {proposta && (
              <div className="flex gap-2.5 items-start p-3 rounded-[10px] bg-[#EEF4FB] border border-[#C9DAEE] text-[13px] text-tinta leading-normal">
                <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full bg-[#1D4E89] shrink-0" />
                <span>Preenchido a partir da proposta <strong>{numeroDoc("proposta", proposta.id)}</strong>{proposta.respostaEm ? `, aceite a ${data(proposta.respostaEm)}` : ""}.</span>
              </div>
            )}
            {bloqueado && (
              <Aviso tom={estado === "Assinado" ? "sucesso" : "info"}>
                {estado === "Assinado" ? "Contrato assinado: o texto fica fechado." : "Enviado para assinatura: o texto fica bloqueado. Para mudar, cancele o envio no contrato e crie uma nova versão."}
              </Aviso>
            )}
            <CartaoLateral titulo="Cliente">
              {!contrato && !proposta && (
                <CampoLateral rotulo="Cliente registado">
                  <EscolherCliente valor={clienteId} nomeAtual={ficha.dados?.cliente.nome ?? ""} onEscolher={c => { setClienteId(c ? String(c.id) : ""); if (c) { setClienteNome(c.nome); setClienteEmail(c.email); } setSujo(true); }} />
                </CampoLateral>
              )}
              <CampoLateral rotulo="Nome no contrato">
                <input className={CONTROLO} value={clienteNome} disabled={bloqueado} onChange={e => { setClienteNome(e.target.value); setSujo(true); }} />
              </CampoLateral>
              <CampoLateral rotulo="Email (para o código de assinatura)">
                <input className={CONTROLO} type="email" value={clienteEmail} onChange={e => { setClienteEmail(e.target.value); setSujo(true); }} />
              </CampoLateral>
              <CampoLateral rotulo="Sede">
                <input className={CONTROLO} value={sede} disabled={bloqueado} onChange={e => { setSede(e.target.value); setSujo(true); }} placeholder="Rua, número · código postal e localidade" />
              </CampoLateral>
              <div className="grid grid-cols-2 gap-2.5">
                <CampoLateral rotulo="Representante">
                  <input className={CONTROLO} value={representante} disabled={bloqueado} onChange={e => { setRepresentante(e.target.value); setSujo(true); }} />
                </CampoLateral>
                <CampoLateral rotulo="Cargo">
                  <input className={CONTROLO} value={cargo} disabled={bloqueado} onChange={e => { setCargo(e.target.value); setSujo(true); }} />
                </CampoLateral>
              </div>
            </CartaoLateral>

            <CartaoLateral titulo="Formação">
              <CampoLateral rotulo="Curso">
                <select className={CONTROLO} value={curso} disabled={bloqueado} onChange={e => { setCurso(e.target.value); setSujo(true); }}>
                  <option value="">Escolher curso</option>
                  {curso && !cursos.opcoes.some(o => o.valor === curso) && <option value={curso}>{curso}</option>}
                  {cursos.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </select>
              </CampoLateral>
              <CampoLateral rotulo="Turma">
                <select className={CONTROLO} value={turma} disabled={bloqueado} onChange={e => {
                  const t = turmas.opcoes.find(o => o.valor === e.target.value);
                  setTurma(e.target.value);
                  if (t?.extra?.inicio && !inicio) setInicio(String(t.extra.inicio).slice(0, 10));
                  setSujo(true);
                }}>
                  <option value="">Turma própria para este contrato</option>
                  {turmas.opcoes.filter(o => !curso || !o.extra?.curso || o.extra.curso === curso).map(o => (
                    <option key={o.valor} value={o.valor}>{o.rotulo}{o.extra?.inicio ? ` · ${data(String(o.extra.inicio))}` : ""}</option>
                  ))}
                </select>
              </CampoLateral>
              <div className="grid grid-cols-2 gap-2.5">
                <CampoLateral rotulo="Início"><input className={CONTROLO} type="date" value={inicio} disabled={bloqueado} onChange={e => { setInicio(e.target.value); setSujo(true); }} /></CampoLateral>
                <CampoLateral rotulo="Fim"><input className={CONTROLO} type="date" value={fim} disabled={bloqueado} onChange={e => { setFim(e.target.value); setSujo(true); }} /></CampoLateral>
                <CampoLateral rotulo="Formandos"><input className={CONTROLO} inputMode="numeric" value={formandos} disabled={bloqueado} onChange={e => { setFormandos(e.target.value.replace(/\D/g, "")); setSujo(true); }} /></CampoLateral>
                <CampoLateral rotulo="Local"><input className={CONTROLO} value={local} disabled={bloqueado} onChange={e => { setLocal(e.target.value); setSujo(true); }} placeholder="Instalações do cliente" /></CampoLateral>
              </div>
            </CartaoLateral>

            <CartaoLateral titulo="Pagamento" acao={<span className="num text-sm font-semibold text-tinta">{total ? euros(total) : "—"}</span>}>
              <CampoLateral rotulo="Valor total (€)">
                <input className={CONTROLO} inputMode="decimal" value={valor} disabled={bloqueado} onChange={e => { setValor(e.target.value); setSujo(true); }} />
              </CampoLateral>
              <div role="group" aria-label="Plano de pagamento" className="inline-flex border border-linha-forte rounded-lg overflow-hidden">
                {(["1", "2", "3"] as Plano[]).map((x, i) => (
                  <button key={x} type="button" aria-pressed={plano === x} disabled={bloqueado} onClick={() => { setPlano(x); setSujo(true); }}
                    className={`flex-1 h-[34px] px-2 border-0 text-xs font-semibold whitespace-nowrap cursor-pointer ${i ? "border-l border-linha-forte" : ""} ${plano === x ? "bg-tinta text-white" : "bg-white text-tinta"}`}>
                    {x === "1" ? "Pagamento único" : `${x} prestações`}
                  </button>
                ))}
              </div>
              {total > 0 && prestacoes.map(r => (
                <div key={r.rotulo} className="num flex justify-between text-[13px]"><span className="text-tinta-suave">{r.rotulo} · {r.quando}</span><span>{euros(r.v)}</span></div>
              ))}
              <p className="m-0 text-xs text-tinta-suave">O plano entra no texto do contrato. Os pagamentos registam-se em Sistema › Pagamentos.</p>
            </CartaoLateral>

            <CartaoLateral titulo="Cláusulas opcionais do modelo">
              {opcionais.length === 0 ? (
                <p className="m-0 text-xs text-tinta-suave">Este texto não tem cláusulas opcionais. Acrescentam-se no modelo (Contratos › Modelos).</p>
              ) : opcionais.map(c => (
                <label key={c.id} className="flex gap-2 items-center text-[13px] text-tinta cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" checked={c.ligada} disabled={bloqueado} onChange={e => { ligarOpcional(c.id, e.target.checked); setSujo(true); }} />
                  {c.titulo}
                </label>
              ))}
            </CartaoLateral>

            <CartaoLateral titulo="Assinatura">
              <label className="flex gap-2 items-center text-[13px] text-tinta cursor-pointer">
                <input type="radio" name="assinatura" checked={def.assinatura === "digital"} disabled={bloqueado} onChange={() => { setDef({ ...def, assinatura: "digital" }); setSujo(true); }} />
                Digital (no GesForma, ou Chave Móvel Digital / CC)
              </label>
              <label className="flex gap-2 items-center text-[13px] text-tinta cursor-pointer">
                <input type="radio" name="assinatura" checked={def.assinatura === "papel"} disabled={bloqueado} onChange={() => { setDef({ ...def, assinatura: "papel" }); setSujo(true); }} />
                Em papel (imprime-se o PDF e marca-se como assinado no contrato)
              </label>
            </CartaoLateral>
          </>
        )}
        barra={bloqueado ? <div className="px-3 py-2.5 border-b border-linha text-[13px] text-tinta-suave">Texto bloqueado · {estado === "Assinado" ? "contrato assinado" : "enviado para assinatura"}</div> : (
          <BarraFormatacao
            pagina={pagina}
            estilos={{ h3: "Cláusula" }}
            antes={(
              <label className="inline-flex items-center gap-1.5 text-xs text-tinta-suave pr-1.5 mr-0.5 border-r border-linha">
                Modelo
                <select className="h-8 border border-linha-forte rounded-md px-1.5 text-[13px] text-tinta bg-white max-w-[220px]" value={templateId} onChange={e => aplicarModelo(e.target.value)}>
                  <option value="" disabled>Escolher</option>
                  {(modelos.dados?.modelos ?? []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  <option value="branco">Em branco</option>
                </select>
              </label>
            )}
            extra={(
              <>
                <BotaoTexto onClick={() => pagina.current?.inserirHtml(CLAUSULA)}>+ Cláusula</BotaoTexto>
                <BotaoTexto onClick={() => { pagina.current?.inserirHtml(clausulaOpcional()); setOpcionais(opcionaisDe(pagina.current?.html() ?? "")); }}>+ Cláusula opcional</BotaoTexto>
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
            def={def}
            valores={valores}
            entidade={entidade}
            meta={<>{meta[0]}<br />{meta[1]}</>}
            editavel={!bloqueado}
            realce={realce}
            rotulo="Texto do contrato"
            onMudar={() => setSujo(true)}
            onPaginas={setPaginas}
          />
        )}
        rodape={<RodapePagina paginas={paginas} realce={realce} onRealce={setRealce} nota="O PDF para assinatura sai desta página, tal como está. Depois de enviado, o texto fica bloqueado; uma alteração cria uma nova versão." />}
      />
      {atual && <EnviarAssinatura contratoId={atual.id} aberto={enviar} onFechar={() => setEnviar(false)} contrato={{ ...atual, clienteNome, clienteEmail, curso }} />}
    </>
  );
}
