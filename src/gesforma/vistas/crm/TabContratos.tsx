// Separador Contratos: lista por estado, novo contrato e editor do contrato.
import { useEffect, useRef, useState } from "react";
import {
  apiAlterarContrato, apiApagarContrato, apiCliente, apiClientes, apiContratos, apiCriarContrato, apiModelos, ESTADOS_CONTRATO,
  type Contrato,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Aviso, Botao, Campo, Cartao, Chip, ConfirmarPerigo, Entrada, ErroCarregar, Filtros, Modal, PainelLateral, Paginacao, Selecao,
  Tabela, Vazio, data, eur, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import { EstadoDoc, numeroDe, useGestao } from "./comum";
import { PainelAssinatura } from "../assinaturas/PainelAssinatura";
import { EditorDocumento } from "./EditorDocumento";

export function TabContratos({ novo }: { novo: number }) {
  const [f, setF, limpar] = useFiltrosUrl({ kq: "", kestado: "", kpag: "1" });
  const pagina = Number(f.kpag) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `crm:contratos:${f.kq}:${f.kestado}:${pagina}`,
    signal => apiContratos({ q: f.kq, estado: f.kestado, pagina }, { signal }),
  );
  const [aberto, setAberto] = useState<Contrato | null>(null);
  const [criar, setCriar] = useState(false);
  const inicial = useRef(novo);
  useEffect(() => { if (novo !== inicial.current) setCriar(true); }, [novo]);

  const colunas: Coluna<Contrato>[] = [
    { id: "cliente", titulo: "Cliente", principal: true, celula: k => <span className="font-semibold text-tinta">{k.clienteNome}</span> },
    { id: "curso", titulo: "Curso", celula: k => k.curso || "—" },
    { id: "comercial", titulo: "Comercial", celula: k => k.comercial || "—", esconderMovel: true },
    { id: "origem", titulo: "Origem", celula: k => (k.propostaId ? `Proposta #${k.propostaId}` : k.modelo ? `Modelo · ${k.modelo}` : "Directo"), esconderMovel: true },
    { id: "estado", titulo: "Estado", celula: k => <EstadoDoc estado={k.estado} /> },
    { id: "valor", titulo: "Valor", alinhar: "dir", celula: k => (k.valor ? eur(k.valor) : "—") },
  ];
  const ativos = [f.kq, f.kestado].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {ESTADOS_CONTRATO.map(e => (
          <Chip key={e} ativo={f.kestado === e} contagem={dados?.fases.find(x => x.estado === e)?.n ?? 0}
            onClick={() => setF({ kestado: f.kestado === e ? "" : e, kpag: "1" })}>
            {e}
          </Chip>
        ))}
      </div>
      <Filtros
        pesquisa={{ valor: f.kq, onMudar: kq => setF({ kq, kpag: "1" }), placeholder: "Cliente, email ou curso…", rotulo: "Pesquisar contratos" }}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Contratos"
          linhas={dados?.linhas ?? []}
          colunas={colunas}
          chave={k => k.id}
          onLinha={setAberto}
          linhaAtiva={aberto?.id ?? null}
          aCarregar={aCarregar}
          vazio={<Vazio titulo={ativos ? "Nenhum contrato com estes filtros." : "Ainda sem contratos."} descricao={ativos ? undefined : "Crie um contrato a partir de uma proposta aceite ou de um modelo."} />}
        />
        {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ kpag: String(p) })} />}
      </Cartao>
      <EditorContrato contrato={aberto} onFechar={() => setAberto(null)} />
      <NovoContrato aberto={criar} onFechar={() => setCriar(false)} onCriado={k => { setCriar(false); setAberto(k); }} />
    </div>
  );
}

function EditorContrato({ contrato, onFechar }: { contrato: Contrato | null; onFechar: () => void }) {
  const gestao = useGestao();
  const [d, setD] = useState({ clienteNome: "", clienteEmail: "", curso: "", valor: "", estado: "Rascunho", notas: "", corpo: "" });
  const [apagar, setApagar] = useState(false);
  useEffect(() => {
    if (!contrato) return;
    setD({
      clienteNome: contrato.clienteNome, clienteEmail: contrato.clienteEmail, curso: contrato.curso,
      valor: contrato.valor ? String(contrato.valor) : "", estado: contrato.estado, notas: contrato.notas, corpo: contrato.corpo,
    });
  }, [contrato]);
  const guardar = useAccao(apiAlterarContrato, { ok: "Contrato guardado.", invalidar: ["crm:contratos", "crm:clientes"] });
  if (!contrato) return null;
  const assinado = contrato.estado === "Assinado";

  async function gravar() {
    const corpo = assinado ? {} : { curso: d.curso.trim(), valor: numeroDe(d.valor), corpo: d.corpo };
    const r = await guardar.correr(contrato!.id, { clienteNome: d.clienteNome.trim(), clienteEmail: d.clienteEmail.trim(), estado: d.estado, notas: d.notas, ...corpo });
    if (r) onFechar();
  }

  return (
    <PainelLateral
      aberto
      onFechar={onFechar}
      titulo={`Contrato · ${contrato.clienteNome}`}
      subtitulo={`Criado a ${data(contrato.criadoEm)}${contrato.assinadoEm ? ` · assinado a ${data(contrato.assinadoEm)}` : ""}`}
      largura={760}
      rodape={(
        <>
          {gestao && !assinado && <Botao variante="fantasma" className="mr-auto text-perigo" onClick={() => setApagar(true)}>Apagar</Botao>}
          <Botao onClick={onFechar}>Fechar</Botao>
          <Botao variante="primario" aCarregar={guardar.aCorrer} onClick={() => void gravar()}>Guardar</Botao>
        </>
      )}
    >
      <div className="space-y-5">
        <PainelAssinatura contratoId={contrato.id} estadoContrato={contrato.estado} temTexto={Boolean(contrato.corpo.trim())} />
        {contrato.estado === "Por assinar" && (
          <Aviso tom="info">O contrato está à espera de assinatura: as alterações ao texto só valem se o enviar de novo.</Aviso>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome no contrato">{p => <Entrada {...p} value={d.clienteNome} onChange={e => setD({ ...d, clienteNome: e.target.value })} />}</Campo>
          <Campo rotulo="Email">{p => <Entrada {...p} type="email" value={d.clienteEmail} onChange={e => setD({ ...d, clienteEmail: e.target.value })} />}</Campo>
          <Campo rotulo="Curso">{p => <Entrada {...p} disabled={assinado} value={d.curso} onChange={e => setD({ ...d, curso: e.target.value })} />}</Campo>
          <Campo rotulo="Valor (€)">{p => <Entrada {...p} disabled={assinado} inputMode="decimal" value={d.valor} onChange={e => setD({ ...d, valor: e.target.value })} />}</Campo>
          <Campo rotulo="Estado" ajuda={assinado ? "Assinado: o texto, o curso e o valor ficam fechados." : undefined}>
            {p => <Selecao {...p} value={d.estado} onChange={e => setD({ ...d, estado: e.target.value })} opcoes={ESTADOS_CONTRATO.map(e => ({ valor: e, rotulo: e }))} />}
          </Campo>
          <Campo rotulo="Notas">{p => <Entrada {...p} value={d.notas} onChange={e => setD({ ...d, notas: e.target.value })} />}</Campo>
        </div>
        <EditorDocumento
          titulo={`Contrato de formação · ${d.clienteNome}`}
          valor={d.corpo}
          onMudar={corpo => setD({ ...d, corpo })}
          soLeitura={assinado}
          valores={{ cliente: d.clienteNome, email: d.clienteEmail, curso: d.curso, valor: numeroDe(d.valor), data: contrato.criadoEm?.slice(0, 10) }}
        />
      </div>
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo="Apagar contrato"
        descricao="O contrato em rascunho é apagado. Esta acção não se desfaz."
        onConfirmar={async () => {
          try {
            await apiApagarContrato(contrato.id);
            invalidar("crm:contratos");
            invalidar("crm:clientes");
            toastOk("Contrato apagado.");
            onFechar();
          } catch (e) {
            toastError(e, "Não foi possível apagar o contrato.");
          }
        }}
      />
    </PainelLateral>
  );
}

function NovoContrato({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (k: Contrato) => void }) {
  const modelos = useRecurso(aberto ? "crm:modelos:contrato" : null, signal => apiModelos("contrato", { signal }));
  const clientes = useRecurso(aberto ? "crm:clientes:todos" : null, signal => apiClientes({ porPagina: 200, ordem: "nome" }, { signal }));
  const [d, setD] = useState({ templateId: "", clienteId: "", propostaId: "", clienteNome: "", clienteEmail: "", curso: "", valor: "" });
  const [erro, setErro] = useState<string | null>(null);
  const ficha = useRecurso(d.clienteId ? `crm:clientes:ficha:${d.clienteId}` : null, signal => apiCliente(Number(d.clienteId), { signal }));
  useEffect(() => { if (aberto) { setD({ templateId: "", clienteId: "", propostaId: "", clienteNome: "", clienteEmail: "", curso: "", valor: "" }); setErro(null); } }, [aberto]);
  const criar = useAccao(apiCriarContrato, { ok: "Contrato criado em rascunho.", invalidar: ["crm:contratos", "crm:clientes", "crm:propostas", "crm:modelos"] });
  const propostas = (ficha.dados?.cliente.propostas ?? []).filter(p => !p.contratoId);

  function escolherCliente(id: string) {
    const c = clientes.dados?.linhas.find(x => String(x.id) === id);
    setD(x => ({ ...x, clienteId: id, propostaId: "", clienteNome: c?.nome ?? x.clienteNome, clienteEmail: c?.email ?? x.clienteEmail }));
  }
  function escolherProposta(id: string) {
    const p = propostas.find(x => String(x.id) === id);
    setD(x => ({ ...x, propostaId: id, curso: p?.curso || x.curso, valor: p?.valor ? String(p.valor) : x.valor }));
  }
  function escolherModelo(id: string) {
    const m = modelos.dados?.modelos.find(x => String(x.id) === id);
    setD(x => ({ ...x, templateId: id, curso: x.curso || m?.curso || "", valor: x.valor || (m?.valor ? String(m.valor) : "") }));
  }
  async function gravar() {
    if (!d.clienteNome.trim()) return setErro("Indique o nome que fica no contrato.");
    const r = await criar.correr({
      clienteNome: d.clienteNome.trim(), clienteEmail: d.clienteEmail.trim(), curso: d.curso.trim(), valor: numeroDe(d.valor),
      templateId: d.templateId ? Number(d.templateId) : null, clienteId: d.clienteId ? Number(d.clienteId) : null,
      propostaId: d.propostaId ? Number(d.propostaId) : null,
    });
    if (r) onCriado(r.contrato);
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Novo contrato"
      largura="lg"
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={criar.aCorrer} onClick={() => void gravar()}>Criar e abrir</Botao></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Cliente" ajuda="Opcional: liga o contrato à ficha do cliente.">
          {p => <Selecao {...p} value={d.clienteId} onChange={e => escolherCliente(e.target.value)} vazio="Sem cliente registado" opcoes={(clientes.dados?.linhas ?? []).map(c => ({ valor: String(c.id), rotulo: c.nome }))} />}
        </Campo>
        <Campo rotulo="Proposta de origem" ajuda={d.clienteId && !propostas.length ? "Este cliente não tem propostas sem contrato." : undefined}>
          {p => <Selecao {...p} disabled={!d.clienteId} value={d.propostaId} onChange={e => escolherProposta(e.target.value)} vazio="Sem proposta"
            opcoes={propostas.map(x => ({ valor: String(x.id), rotulo: `${x.curso || "Proposta"} · ${x.estado} · ${eur(x.valor)}` }))} />}
        </Campo>
        <Campo rotulo="Modelo" ajuda="O texto do modelo entra no contrato; depois pode editá-lo.">
          {p => <Selecao {...p} value={d.templateId} onChange={e => escolherModelo(e.target.value)} vazio="Sem modelo" opcoes={(modelos.dados?.modelos ?? []).map(m => ({ valor: String(m.id), rotulo: m.nome }))} />}
        </Campo>
        <Campo rotulo="Nome no contrato" obrigatorio erro={erro}>{p => <Entrada {...p} value={d.clienteNome} onChange={e => setD({ ...d, clienteNome: e.target.value })} />}</Campo>
        <Campo rotulo="Email">{p => <Entrada {...p} type="email" value={d.clienteEmail} onChange={e => setD({ ...d, clienteEmail: e.target.value })} />}</Campo>
        <Campo rotulo="Curso">{p => <Entrada {...p} value={d.curso} onChange={e => setD({ ...d, curso: e.target.value })} />}</Campo>
        <Campo rotulo="Valor (€)">{p => <Entrada {...p} inputMode="decimal" value={d.valor} onChange={e => setD({ ...d, valor: e.target.value })} />}</Campo>
      </div>
    </Modal>
  );
}
