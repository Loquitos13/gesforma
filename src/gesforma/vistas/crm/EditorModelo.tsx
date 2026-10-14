// Editor de modelos (proposta ou contrato): definições e cabeçalho à esquerda, o texto do modelo na página A4.
import { useMemo, useRef, useState } from "react";
import { apiApagarLogo, apiCarregarLogo, apiLogo } from "../../../partilhado/api/configuracoes";
import { apiAlterarModelo, apiApagarModelo, apiClientes, apiCriarModelo, type Modelo, type TipoModelo } from "../../../partilhado/api/crmDiretorio";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { urlLogoEntidade } from "../../../partilhado/logoEntidade";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, ConfirmarPerigo, data } from "../../../partilhado/ui";
import { numeroDe, useEu, useGestao } from "./comum";
import { BarraFormatacao, BotaoTexto, ChipCampo, CLAUSULA, clausulaOpcional } from "./documento/BarraFormatacao";
import { tabelaInvestimento, useEntidade } from "./documento/comum";
import { CampoLateral, CartaoLateral, CONTROLO, EcraDocumento, RodapePagina } from "./documento/EcraDocumento";
import { BLOCO_ASSINATURAS, BLOCO_INVESTIMENTO, contratoInicial, propostaInicial } from "./documento/inicial";
import {
  CAMPOS, alternarOpcional, corpoParaGuardar, dataLonga, escreverDocumento, euros, lerDocumento, opcionaisDe, type Definicoes, type PosicaoLogo,
} from "./documento/modelo";
import { PaginaA4, type PaginaRef } from "./documento/PaginaA4";

const POSICOES: { id: PosicaoLogo; rotulo: string }[] = [{ id: "esquerda", rotulo: "Esquerda" }, { id: "centro", rotulo: "Centro" }, { id: "direita", rotulo: "Direita" }];

export function EditorModelo({ tipo, modelo, onFechar, trilho }: { tipo: TipoModelo; modelo: Modelo | null; onFechar: () => void; trilho: string }) {
  const gestao = useGestao();
  const eu = useEu();
  const entidade = useEntidade();
  const pagina = useRef<PaginaRef>(null);
  const ficheiro = useRef<HTMLInputElement>(null);
  const inicial = useMemo(() => {
    const doc = lerDocumento(modelo?.corpo ?? "");
    return { def: doc.def, html: doc.html || (tipo === "proposta" ? propostaInicial() : contratoInicial()) };
  }, [modelo, tipo]);
  const [def, setDef] = useState<Definicoes>(inicial.def);
  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [curso, setCurso] = useState(modelo?.curso ?? "");
  const [valor, setValor] = useState(modelo?.valor ? String(modelo.valor) : "");
  const [opcionais, setOpcionais] = useState(() => opcionaisDe(inicial.html));
  const [modo, setModo] = useState<"campos" | "exemplo">("campos");
  const [paginas, setPaginas] = useState(1);
  const [sujo, setSujo] = useState(false);
  const [guardadoEm, setGuardadoEm] = useState<string | null>(modelo?.alteradoEm ?? null);
  const [aGravar, setAGravar] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [atual, setAtual] = useState<Modelo | null>(modelo);
  const logo = useRecurso("configuracoes:logo", signal => apiLogo(signal));
  const cursos = useOpcoes("cursos", { regime: def.regime === "fin" ? "fin" : "gold" });
  const exemploCliente = useRecurso(modo === "exemplo" ? "crm:clientes:exemplo" : null, signal => apiClientes({ porPagina: 1, ordem: "nome" }, { signal }));

  const mudar = (patch: Partial<Definicoes>) => { setDef(d => ({ ...d, ...patch })); setSujo(true); };

  // "Com exemplo": dados reais quando existem (entidade, primeiro cliente, curso do modelo); os outros mostram o nome do campo.
  const c = exemploCliente.dados?.linhas[0];
  const cursoEx = curso || cursos.opcoes[0]?.valor || "";
  const horas = Number(cursos.opcoes.find(o => o.valor === cursoEx)?.extra?.horas) || 0;
  const valorN = numeroDe(valor);
  const valores: Record<string, string> = modo === "exemplo" ? {
    entidade, cliente: c?.nome ?? "", nif: c?.nif ?? "", email: c?.email ?? "", curso: cursoEx, horas: horas ? `${horas} horas` : "",
    valor: valorN ? euros(valorN) : "", data: dataLonga(), comercial: eu.name,
  } : {};
  const inv = tabelaInvestimento(1, valorN, 0);

  function ligarOpcional(id: string, ligada: boolean) {
    const html = alternarOpcional(pagina.current?.html() ?? "", id, ligada);
    pagina.current?.repor(html);
    setOpcionais(opcionaisDe(html));
  }

  async function guardar(copia = false) {
    if (!nome.trim()) return toastError(null, "Indique o nome do modelo.");
    setAGravar(true);
    try {
      const corpo = escreverDocumento(def, corpoParaGuardar(pagina.current?.html() ?? "", {}));
      const dados = { nome: copia ? `${nome.trim()} (cópia)` : nome.trim(), curso: curso.trim(), valor: valorN, corpo };
      const r = atual && !copia ? await apiAlterarModelo(tipo, atual.id, dados) : await apiCriarModelo(tipo, dados);
      invalidar("crm:modelos");
      setSujo(false);
      setGuardadoEm(new Date().toISOString());
      if (copia) {
        toastOk("Cópia criada.");
        onFechar();
      } else {
        toastOk("Modelo guardado.");
        if (r.modelo) setAtual(r.modelo);
      }
    } catch (e) {
      toastError(e, "Não foi possível guardar o modelo.");
    } finally {
      setAGravar(false);
    }
  }

  async function trocarLogo(f: File | undefined) {
    if (!f) return;
    try {
      await apiCarregarLogo(f);
      logo.recarregar();
      toastOk("Logotipo actualizado. É o mesmo em todos os documentos da entidade.");
    } catch (e) {
      toastError(e, "Não foi possível carregar o logotipo (só a administração o pode trocar).");
    }
  }

  const titulo = atual?.nome || (tipo === "proposta" ? "Novo modelo de proposta" : "Novo modelo de contrato");
  const detalhe = `modelo de ${tipo}${atual ? ` · usado ${atual.usos}×` : ""}`;
  const meta = tipo === "proposta" ? ["Proposta", dataLonga()] : ["Contrato"];

  return (
    <>
    <EcraDocumento
      trilho={`${trilho} · Modelos`}
      titulo={titulo}
      detalhe={detalhe}
      onVoltar={onFechar}
      rotuloLateral="Definições do modelo"
      acoes={(
        <>
          <div role="group" aria-label="Mostrar" className="inline-flex border border-linha-forte rounded-lg overflow-hidden">
            {(["campos", "exemplo"] as const).map((m, i) => (
              <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)}
                className={`h-10 px-3 border-0 text-[13px] font-semibold cursor-pointer ${i ? "border-l border-linha-forte" : ""} ${modo === m ? "bg-tinta text-white" : "bg-white text-tinta"}`}>
                {m === "campos" ? "Campos" : "Com exemplo"}
              </button>
            ))}
          </div>
          {gestao && atual && <Botao onClick={() => void guardar(true)}>Duplicar</Botao>}
          {gestao && <Botao variante="primario" aCarregar={aGravar} onClick={() => void guardar()}>Guardar modelo</Botao>}
        </>
      )}
      lateral={(
        <>
          {!gestao && <Aviso tom="info">Os modelos são geridos pela administração e pela secretaria. Pode consultá-los.</Aviso>}
          <CartaoLateral titulo="Modelo">
            <CampoLateral rotulo="Nome">
              <input className={CONTROLO} value={nome} disabled={!gestao} onChange={e => { setNome(e.target.value); setSujo(true); }} placeholder={tipo === "proposta" ? "Proposta empresas · intra" : "Contrato de prestação de serviços"} />
            </CampoLateral>
            <div className="grid grid-cols-2 gap-2.5">
              <CampoLateral rotulo="Tipo">
                <select className={CONTROLO} value={tipo} disabled><option value="proposta">Proposta</option><option value="contrato">Contrato</option></select>
              </CampoLateral>
              <CampoLateral rotulo="Regime">
                <select className={CONTROLO} value={def.regime} disabled={!gestao} onChange={e => mudar({ regime: e.target.value as Definicoes["regime"] })}>
                  <option value="gold">Gold</option><option value="fin">Financiada</option><option value="ambos">Ambos</option>
                </select>
              </CampoLateral>
            </div>
            {tipo === "contrato" && (
              <CampoLateral rotulo="Assinatura por omissão">
                <select className={CONTROLO} value={def.assinatura} disabled={!gestao} onChange={e => mudar({ assinatura: e.target.value as Definicoes["assinatura"] })}>
                  <option value="digital">Digital (GesForma, CMD ou CC)</option><option value="papel">Em papel</option>
                </select>
              </CampoLateral>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5">
              <CampoLateral rotulo="Curso (opcional)">
                <select className={CONTROLO} value={curso} disabled={!gestao} onChange={e => { setCurso(e.target.value); setSujo(true); }}>
                  <option value="">Qualquer curso</option>
                  {curso && !cursos.opcoes.some(o => o.valor === curso) && <option value={curso}>{curso}</option>}
                  {cursos.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </select>
              </CampoLateral>
              <CampoLateral rotulo={tipo === "proposta" ? "Preço (€)" : "Valor (€)"}>
                <input className={CONTROLO} inputMode="decimal" value={valor} disabled={!gestao} onChange={e => { setValor(e.target.value); setSujo(true); }} />
              </CampoLateral>
            </div>
          </CartaoLateral>

          <CartaoLateral titulo="Cabeçalho do documento">
            <div className="h-[72px] rounded-lg border border-dashed border-linha-forte bg-fundo flex items-center justify-center overflow-hidden">
              <img src={urlLogoEntidade(logo.dados?.logo?.versao)} alt="Pré-visualização do logotipo" className="max-h-[52px] max-w-[85%] object-contain" />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 h-[34px] inline-flex items-center justify-center rounded-lg border border-linha-forte bg-white text-[13px] text-tinta cursor-pointer hover:bg-fundo">
                Carregar imagem
                <input ref={ficheiro} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={e => void trocarLogo(e.target.files?.[0])} />
              </label>
              <Botao tamanho="sm" variante="fantasma" onClick={async () => { try { await apiApagarLogo(); logo.recarregar(); toastOk("Logotipo removido."); } catch (e) { toastError(e, "Não foi possível remover o logotipo."); } }}>Remover</Botao>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-tinta-suave">
              <span>Tamanho · <span className="num">{def.logoAltura} px</span></span>
              <input type="range" min={24} max={80} step={2} value={def.logoAltura} disabled={!gestao} onChange={e => mudar({ logoAltura: Number(e.target.value) })} />
            </label>
            <div className="flex items-center gap-2 text-xs font-semibold text-tinta-suave">
              Posição
              <span role="group" aria-label="Posição do logotipo" className="ml-auto inline-flex border border-linha-forte rounded-lg overflow-hidden">
                {POSICOES.map((p, i) => (
                  <button key={p.id} type="button" aria-pressed={def.logoPos === p.id} disabled={!gestao} onClick={() => mudar({ logoPos: p.id })}
                    className={`h-8 px-2.5 border-0 text-xs font-semibold cursor-pointer ${i ? "border-l border-linha-forte" : ""} ${def.logoPos === p.id ? "bg-tinta text-white" : "bg-white text-tinta"}`}>
                    {p.rotulo}
                  </button>
                ))}
              </span>
            </div>
            <label className="flex gap-2 items-center text-[13px] text-tinta cursor-pointer">
              <input type="checkbox" checked={def.mostrarNome} disabled={!gestao} onChange={e => mudar({ mostrarNome: e.target.checked })} />
              Mostrar o nome da entidade por baixo do logotipo
            </label>
            {def.mostrarNome && (
              <CampoLateral rotulo="Linha por baixo do nome (opcional)">
                <input className={CONTROLO} value={def.subtitulo} disabled={!gestao} onChange={e => mudar({ subtitulo: e.target.value })} placeholder="Entidade formadora certificada pela DGERT" />
              </CampoLateral>
            )}
            <p className="m-0 text-xs text-tinta-suave">PNG ou JPG, de preferência com fundo transparente. O logotipo é o da entidade (Configurações › Entidade); também pode clicar nele na página.</p>
          </CartaoLateral>

          {tipo === "contrato" && (
            <CartaoLateral titulo="Cláusulas opcionais" acao={gestao ? <button type="button" onClick={() => { pagina.current?.inserirHtml(clausulaOpcional()); setOpcionais(opcionaisDe(pagina.current?.html() ?? "")); }} className="border-0 bg-transparent text-ligacao text-[13px] font-semibold cursor-pointer">+ Nova</button> : undefined}>
              <p className="m-0 text-xs text-tinta-suave">Em cada contrato, a secretaria liga ou desliga estas cláusulas. Aqui define-se se começam ligadas.</p>
              {opcionais.length === 0 && <p className="m-0 text-xs text-tinta-suave">Ainda sem cláusulas opcionais.</p>}
              {opcionais.map(o => (
                <label key={o.id} className="flex items-center gap-2 py-1.5 border-t border-[#EEF0F3] text-[13px] text-tinta cursor-pointer">
                  <span className="flex-1 min-w-0 truncate">{o.titulo}</span>
                  <span className="text-xs text-tinta-suave">ligada por omissão</span>
                  <input type="checkbox" className="w-4 h-4" checked={o.ligada} disabled={!gestao} onChange={e => { ligarOpcional(o.id, e.target.checked); setSujo(true); }} />
                </label>
              ))}
            </CartaoLateral>
          )}

          <CartaoLateral titulo="Campos automáticos">
            <p className="m-0 text-xs text-tinta-suave">Coloque o cursor na página e clique num campo. Ao criar o documento, o campo é trocado pelo valor real.</p>
            {[...new Set(CAMPOS.map(x => x.grupo))].map(g => (
              <div key={g} className="space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-tinta-suave">{g}</span>
                <div className="flex flex-wrap gap-1.5">
                  {CAMPOS.filter(x => x.grupo === g).map(x => <ChipCampo key={x.chave} campo={x} onInserir={() => pagina.current?.inserirCampo(x.chave)} />)}
                </div>
              </div>
            ))}
          </CartaoLateral>
          {gestao && atual && <button type="button" onClick={() => setApagar(true)} className="self-start border-0 bg-transparent text-perigo text-[13px] cursor-pointer">Apagar modelo</button>}
        </>
      )}
      barra={(
        <BarraFormatacao
          pagina={pagina}
          estilos={{ h3: tipo === "contrato" ? "Cláusula" : "Subtítulo" }}
          mostrarCampos={false}
          extra={(
            <>
              {tipo === "contrato" ? (
                <>
                  <BotaoTexto onClick={() => pagina.current?.inserirHtml(CLAUSULA)}>+ Cláusula</BotaoTexto>
                  <BotaoTexto onClick={() => { pagina.current?.inserirHtml(clausulaOpcional()); setOpcionais(opcionaisDe(pagina.current?.html() ?? "")); }}>+ Cláusula opcional</BotaoTexto>
                  <BotaoTexto onClick={() => pagina.current?.inserirHtml(BLOCO_ASSINATURAS)}>Assinaturas</BotaoTexto>
                </>
              ) : <BotaoTexto onClick={() => pagina.current?.inserirHtml(`${BLOCO_INVESTIMENTO}<p><br></p>`)}>Tabela do investimento</BotaoTexto>}
              <BotaoTexto onClick={() => pagina.current?.inserirHtml('<div data-quebra="1" contenteditable="false"></div><p><br></p>')}>Quebra de página</BotaoTexto>
              <span className="text-xs text-tinta-suave px-1">
                {sujo ? "Alterações por guardar" : guardadoEm ? `Guardado a ${data(guardadoEm)}` : ""}
                {tipo === "contrato" ? " · a numeração das cláusulas é automática" : ""}
              </span>
            </>
          )}
        />
      )}
      pagina={(
        <PaginaA4
          ref={pagina}
          chave={`m:${tipo}:${modelo?.id ?? "novo"}`}
          htmlInicial={inicial.html}
          def={def}
          valores={valores}
          blocos={{ investimento: inv.html }}
          modoCampos={modo === "campos"}
          entidade={entidade}
          meta={<>{meta[0]}{meta[1] ? <><br />{meta[1]}</> : null}</>}
          editavel={gestao}
          realce
          modelo
          logoVersao={logo.dados?.logo?.versao}
          rotulo={tipo === "proposta" ? "Texto do modelo de proposta" : "Texto do modelo de contrato"}
          onMudar={() => setSujo(true)}
          onPaginas={setPaginas}
          onLogo={gestao ? () => ficheiro.current?.click() : undefined}
        />
      )}
      rodape={<RodapePagina paginas={paginas} realce onRealce={() => undefined} nota="Alterar o modelo não mexe em documentos já criados ou enviados. Os próximos documentos criados com ele usam este texto." />}
    />
    {atual && (
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo="Apagar modelo"
        descricao={atual.usos
          ? `Este modelo foi usado em ${atual.usos} documentos. Esses documentos guardam o seu texto; só perdem a ligação ao modelo.`
          : "O modelo deixa de aparecer na lista. Esta acção não se desfaz."}
        onConfirmar={async () => {
          try {
            await apiApagarModelo(tipo, atual.id);
            invalidar("crm:modelos");
            toastOk("Modelo apagado.");
            onFechar();
          } catch (e) {
            toastError(e, "Não foi possível apagar o modelo.");
          }
        }}
      />
    )}
    </>
  );
}
