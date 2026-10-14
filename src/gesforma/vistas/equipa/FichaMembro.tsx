// Ficha de uma pessoa da equipa: perfil, objectivos, propostas, pré-inscrições e diário de contactos.
import { useEffect, useState } from "react";
import { apiCriarLead } from "../../../partilhado/api/crm";
import { apiPropostas, apiModelos, ESTADOS_PROPOSTA } from "../../../partilhado/api/crmDiretorio";
import {
  apiMembro, apiNotaMembro, apiNovaPropostaMembro, apiObjetivoMembro, apiPerfilMembro, apiPrecoInscricao, type LeadMembro,
} from "../../../partilhado/api/equipa";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  AreaTexto, Botao, Campo, Entrada, ErroCarregar, Esqueleto, Modal, PainelLateral, Selecao, Separadores, Vazio,
  dataHora, eur, num,
} from "../../../partilhado/ui";
import { EstadoDoc, numeroDe, useGestao } from "../crm/comum";

type Tab = "perfil" | "objetivos" | "propostas" | "leads" | "diario";

export function FichaMembro({ id, regime, de, ate, onFechar }: { id: string; regime: "gold" | "fin"; de: string; ate: string; onFechar: () => void }) {
  const gestao = useGestao();
  const [tab, setTab] = useState<Tab>("propostas");
  const { dados, erro, recarregar } = useRecurso(`equipa:${regime}:membro:${id}:${de}:${ate}`, signal => apiMembro(id, regime, { de: de || undefined, ate: ate || undefined }, { signal }));
  const m = dados?.membro;
  return (
    <PainelLateral aberto onFechar={onFechar} titulo={m?.nome ?? "Equipa"} subtitulo={m?.email} largura={760}>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {!m ? <Esqueleto linhas={6} /> : (
        <div className="space-y-4">
          <dl className="num m-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Carteira", num(m.carteira.leads), `${num(m.carteira.porContactar)} por contactar`],
              ["Propostas", num(m.carteira.propostas), `${num(m.carteira.aceites)} aceites`],
              ["Em aberto", eur(m.carteira.pipeline), `${num(m.carteira.propostasAbertas)} propostas`],
              ["Conversão", `${num(m.carteira.conversao)} %`, `${num(m.carteira.pagos)} pagos`],
            ].map(([r, v, s]) => (
              <div key={r} className="rounded-controlo border border-linha px-3 py-2">
                <dt className="text-xs text-tinta-suave">{r}</dt>
                <dd className="m-0 text-lg font-semibold text-tinta">{v}</dd>
                <dd className="m-0 text-xs text-tinta-suave">{s}</dd>
              </div>
            ))}
          </dl>
          <Separadores<Tab>
            rotulo="Secções da ficha"
            ativo={tab}
            onMudar={setTab}
            itens={[
              { id: "propostas", rotulo: "Propostas" },
              { id: "leads", rotulo: "Pré-inscrições", contagem: dados.leads.length },
              { id: "diario", rotulo: "Diário", contagem: dados.notas.length },
              { id: "objetivos", rotulo: "Objectivos" },
              { id: "perfil", rotulo: "Perfil" },
            ]}
          />
          {tab === "propostas" && <Propostas id={id} regime={regime} leads={dados.leads} />}
          {tab === "leads" && <Leads leads={dados.leads} />}
          {tab === "diario" && <Diario id={id} regime={regime} leads={dados.leads} notas={dados.notas} />}
          {tab === "objetivos" && <Objetivos id={id} gestao={gestao} inicial={m.objetivo} atual={m.atual} />}
          {tab === "perfil" && <Perfil id={id} gestao={gestao} inicial={{ name: m.nome, telefone: m.telefone, nota: m.nota }} />}
        </div>
      )}
    </PainelLateral>
  );
}

function Propostas({ id, regime, leads }: { id: string; regime: "gold" | "fin"; leads: LeadMembro[] }) {
  const lista = useRecurso(`crm:propostas:membro:${id}:${regime}`, signal => apiPropostas({ comercial: id, regime }, { signal }));
  const [nova, setNova] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Botao tamanho="sm" variante="primario" onClick={() => setNova(true)}>Nova proposta</Botao></div>
      {lista.erro ? <ErroCarregar erro={lista.erro} onTentar={lista.recarregar} /> : null}
      {lista.dados && lista.dados.linhas.length === 0 && <Vazio compacto titulo="Ainda sem propostas." />}
      <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
        {(lista.dados?.linhas ?? []).map(p => (
          <li key={p.id} className="py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold text-tinta">{p.clienteNome}</p>
              <p className="m-0 text-xs text-tinta-suave">{[p.curso, p.valor ? eur(p.valor) : "", dataHora(p.enviadaEm)].filter(Boolean).join(" · ")}</p>
              {p.respostaCliente && <p className="m-0 mt-1 text-[13px] text-tinta line-clamp-2">{p.respostaCliente}</p>}
            </div>
            <EstadoDoc estado={p.estado} />
          </li>
        ))}
      </ul>
      <p className="m-0 text-xs text-tinta-suave">A resposta do cliente e o estado alteram-se em CRM › Contratos › Propostas.</p>
      <NovaProposta aberto={nova} onFechar={() => setNova(false)} id={id} regime={regime} leads={leads} />
    </div>
  );
}

function NovaProposta({ aberto, onFechar, id, regime, leads }: { aberto: boolean; onFechar: () => void; id: string; regime: "gold" | "fin"; leads: LeadMembro[] }) {
  const modelos = useRecurso(aberto ? "crm:modelos:proposta" : null, signal => apiModelos("proposta", { signal }));
  const cursos = useOpcoes("cursos", { regime });
  const locais = useOpcoes("locais", { regime });
  const horarios = useOpcoes("horarios", { regime });
  const vazio = { templateId: "", preinscricaoId: "", clienteNome: "", clienteEmail: "", curso: "", local: "", horario: "", valor: "", estado: "Enviada", resposta: "", notas: "" };
  const [d, setD] = useState(vazio);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (aberto) { setD(vazio); setErro(null); } }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const criar = useAccao(apiNovaPropostaMembro, { ok: "Proposta registada.", invalidar: ["crm:propostas", "equipa:"] });

  async function precoPara(x: typeof d) {
    if (regime !== "gold" || !x.curso) return;
    const r = await apiPrecoInscricao(x.curso, x.local, x.horario).catch(() => null);
    if (r?.preco) setD(y => ({ ...y, valor: String(r.preco) }));
  }
  function mudar(patch: Partial<typeof d>, recalcular = false) {
    const novo = { ...d, ...patch };
    setD(novo);
    if (recalcular) void precoPara(novo);
  }
  function escolherLead(v: string) {
    const l = leads.find(x => String(x.id) === v);
    mudar({ preinscricaoId: v, clienteNome: l ? `${l.nome} ${l.apelido}`.trim() : d.clienteNome, clienteEmail: l?.email ?? d.clienteEmail, curso: l?.curso ?? d.curso, valor: l?.preco ? String(l.preco) : d.valor });
  }
  function escolherModelo(v: string) {
    const t = modelos.dados?.modelos.find(x => String(x.id) === v);
    mudar({ templateId: v, curso: d.curso || t?.curso || "", valor: d.valor || (t?.valor ? String(t.valor) : "") });
  }
  async function gravar() {
    if (d.clienteNome.trim().length < 2) return setErro("Indique o cliente.");
    const r = await criar.correr(id, {
      clienteNome: d.clienteNome.trim(), clienteEmail: d.clienteEmail.trim(), curso: d.curso.trim(), valor: numeroDe(d.valor),
      estado: d.estado, respostaCliente: d.resposta.trim(), notas: d.notas.trim(), regime,
      preinscricaoId: d.preinscricaoId ? Number(d.preinscricaoId) : null, templateId: d.templateId ? Number(d.templateId) : null,
    });
    if (r) onFechar();
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Nova proposta" largura="lg"
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={criar.aCorrer} onClick={() => void gravar()}>Guardar proposta</Botao></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Pré-inscrição (opcional)" ajuda="Preenche o cliente, o curso e o valor.">
          {p => <Selecao {...p} value={d.preinscricaoId} onChange={e => escolherLead(e.target.value)} vazio="Sem ligação" opcoes={leads.map(l => ({ valor: String(l.id), rotulo: `${l.nome} ${l.apelido}`.trim() + (l.curso ? ` · ${l.curso}` : "") }))} />}
        </Campo>
        <Campo rotulo="Modelo">
          {p => <Selecao {...p} value={d.templateId} onChange={e => escolherModelo(e.target.value)} vazio="Sem modelo" opcoes={(modelos.dados?.modelos ?? []).map(t => ({ valor: String(t.id), rotulo: t.nome }))} />}
        </Campo>
        <Campo rotulo="Cliente" obrigatorio erro={erro}>{p => <Entrada {...p} value={d.clienteNome} onChange={e => mudar({ clienteNome: e.target.value })} />}</Campo>
        <Campo rotulo="Email">{p => <Entrada {...p} type="email" value={d.clienteEmail} onChange={e => mudar({ clienteEmail: e.target.value })} />}</Campo>
        <Campo rotulo="Curso">
          {p => <Selecao {...p} value={d.curso} onChange={e => mudar({ curso: e.target.value }, true)} vazio="Escolher curso"
            opcoes={d.curso && !cursos.selecao.some(o => o.valor === d.curso) ? [{ valor: d.curso, rotulo: d.curso }, ...cursos.selecao] : cursos.selecao} />}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Local">{p => <Selecao {...p} value={d.local} onChange={e => mudar({ local: e.target.value }, true)} vazio="—" opcoes={locais.selecao} />}</Campo>
          <Campo rotulo="Horário">{p => <Selecao {...p} value={d.horario} onChange={e => mudar({ horario: e.target.value }, true)} vazio="—" opcoes={horarios.selecao} />}</Campo>
        </div>
        <Campo rotulo="Valor (€)" ajuda={regime === "gold" ? "Sugerido pelo preço do curso e da edição." : undefined}>
          {p => <Entrada {...p} inputMode="decimal" value={d.valor} onChange={e => mudar({ valor: e.target.value })} />}
        </Campo>
        <Campo rotulo="Estado">
          {p => <Selecao {...p} value={d.estado} onChange={e => mudar({ estado: e.target.value })} opcoes={ESTADOS_PROPOSTA.map(e => ({ valor: e, rotulo: e === "Negociação" ? "Em negociação" : e }))} />}
        </Campo>
        <Campo rotulo="Resposta do cliente" className="sm:col-span-2">{p => <AreaTexto {...p} value={d.resposta} onChange={e => mudar({ resposta: e.target.value })} />}</Campo>
      </div>
    </Modal>
  );
}

function Leads({ leads }: { leads: LeadMembro[] }) {
  if (!leads.length) return <Vazio compacto titulo="Sem pré-inscrições atribuídas." />;
  return (
    <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
      {leads.map(l => (
        <li key={l.id} className="py-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold text-tinta">{`${l.nome} ${l.apelido}`.trim()}</p>
              <p className="m-0 text-xs text-tinta-suave truncate">{[l.curso, l.email, l.telf].filter(Boolean).join(" · ")}</p>
            </div>
            <EstadoDoc estado={l.estado} />
          </div>
          {l.notas && <p className="m-0 mt-1.5 text-xs text-tinta whitespace-pre-wrap rounded-controlo bg-fundo px-2.5 py-1.5">{l.notas}</p>}
        </li>
      ))}
    </ul>
  );
}

function Diario({ id, regime, leads, notas }: { id: string; regime: "gold" | "fin"; leads: LeadMembro[]; notas: { id: number; leadNome: string; leadCurso: string; nota: string; criadaEm: string | null }[] }) {
  const [lead, setLead] = useState("");
  const [texto, setTexto] = useState("");
  const [novaLead, setNovaLead] = useState(false);
  const registar = useAccao(apiNotaMembro, { ok: "Nota registada.", invalidar: ["equipa:"] });
  const criarLead = useAccao(apiCriarLead, { ok: "Pré-inscrição criada.", invalidar: ["equipa:", "crm:"] });
  const [nl, setNl] = useState({ nome: "", contacto: "" });
  return (
    <div className="space-y-4">
      <div className="rounded-cartao border border-linha bg-fundo p-3 space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <Campo rotulo="Pré-inscrição" className="flex-1 min-w-[220px]">
            {p => <Selecao {...p} value={lead} onChange={e => setLead(e.target.value)} vazio="Escolher pré-inscrição" opcoes={leads.map(l => ({ valor: String(l.id), rotulo: `${l.nome} ${l.apelido}`.trim() + (l.curso ? ` · ${l.curso}` : "") }))} />}
          </Campo>
          <Botao tamanho="sm" variante="ligacao" onClick={() => setNovaLead(true)}>Nova pré-inscrição</Botao>
        </div>
        <AreaTexto aria-label="Nota" value={texto} onChange={e => setTexto(e.target.value)} placeholder="O que ficou combinado, objecções, próximo passo…" />
        <div className="flex justify-end">
          <Botao variante="primario" tamanho="sm" disabled={!lead || !texto.trim()} aCarregar={registar.aCorrer}
            onClick={async () => { if (await registar.correr(id, { preinscricaoId: Number(lead), nota: texto.trim() })) setTexto(""); }}>
            Registar nota
          </Botao>
        </div>
      </div>
      {notas.length === 0 ? <Vazio compacto titulo="Ainda sem notas no diário." /> : (
        <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
          {notas.map(n => (
            <li key={n.id} className="py-2.5">
              <div className="flex gap-2"><p className="m-0 flex-1 text-sm font-semibold text-tinta">{n.leadNome}</p><span className="text-xs text-tinta-suave">{dataHora(n.criadaEm)}</span></div>
              {n.leadCurso && <p className="m-0 text-xs text-tinta-suave">{n.leadCurso}</p>}
              <p className="m-0 mt-1 text-sm text-tinta whitespace-pre-wrap">{n.nota}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal aberto={novaLead} onFechar={() => setNovaLead(false)} titulo="Nova pré-inscrição" largura="sm"
        rodape={<><Botao onClick={() => setNovaLead(false)}>Cancelar</Botao><Botao variante="primario" aCarregar={criarLead.aCorrer} disabled={!nl.nome.trim() || !nl.contacto.trim()}
          onClick={async () => {
            const partes = nl.nome.trim().split(/\s+/);
            const email = nl.contacto.includes("@") ? nl.contacto.trim() : "";
            const r = await criarLead.correr({ nome: partes[0], apelido: partes.slice(1).join(" "), email, telf: email ? "" : nl.contacto.trim(), curso: "", comercialId: id, origem: "Telefone", regime });
            if (r) { setNovaLead(false); setNl({ nome: "", contacto: "" }); if (r.preinscricao?.id) setLead(String(r.preinscricao.id)); }
          }}>Criar</Botao></>}>
        <div className="grid gap-4">
          <Campo rotulo="Nome">{p => <Entrada {...p} value={nl.nome} onChange={e => setNl({ ...nl, nome: e.target.value })} data-autofocus />}</Campo>
          <Campo rotulo="Email ou telemóvel">{p => <Entrada {...p} value={nl.contacto} onChange={e => setNl({ ...nl, contacto: e.target.value })} />}</Campo>
        </div>
      </Modal>
    </div>
  );
}

function Objetivos({ id, gestao, inicial, atual }: { id: string; gestao: boolean; inicial: { conversao: number | null; leads: number; propostas: number }; atual: { conversao: number; leads: number; propostas: number } }) {
  const [d, setD] = useState({ pct: inicial.conversao == null ? "" : String(inicial.conversao), leads: String(inicial.leads || ""), propostas: String(inicial.propostas || "") });
  const gravar = useAccao(apiObjetivoMembro, { ok: "Objectivos guardados.", invalidar: ["equipa:"] });
  return (
    <div className="space-y-4">
      <p className="m-0 text-[13px] text-tinta-suave">No período: conversão {num(atual.conversao)} %, {num(atual.leads)} pré-inscrições e {num(atual.propostas)} propostas enviadas.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Conversão (%)">{p => <Entrada {...p} disabled={!gestao} type="number" min={0} max={100} value={d.pct} onChange={e => setD({ ...d, pct: e.target.value })} />}</Campo>
        <Campo rotulo="Pré-inscrições">{p => <Entrada {...p} disabled={!gestao} type="number" min={0} value={d.leads} onChange={e => setD({ ...d, leads: e.target.value })} />}</Campo>
        <Campo rotulo="Propostas">{p => <Entrada {...p} disabled={!gestao} type="number" min={0} value={d.propostas} onChange={e => setD({ ...d, propostas: e.target.value })} />}</Campo>
      </div>
      {gestao ? (
        <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(id, {
          metaPct: Math.min(100, Math.max(0, numeroDe(d.pct))), metaLeads: Math.max(0, Math.round(numeroDe(d.leads))), metaPropostas: Math.max(0, Math.round(numeroDe(d.propostas))),
        })}>Guardar objectivos</Botao>
      ) : <p className="m-0 text-xs text-tinta-suave">Os objectivos são definidos pela administração ou pela secretaria.</p>}
    </div>
  );
}

function Perfil({ id, gestao, inicial }: { id: string; gestao: boolean; inicial: { name: string; telefone: string; nota: string } }) {
  const [d, setD] = useState(inicial);
  const gravar = useAccao(apiPerfilMembro, { ok: "Perfil guardado.", invalidar: ["equipa:"] });
  return (
    <div className="space-y-4">
      <Campo rotulo="Nome">{p => <Entrada {...p} disabled={!gestao} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} />}</Campo>
      <Campo rotulo="Telefone">{p => <Entrada {...p} disabled={!gestao} type="tel" value={d.telefone} onChange={e => setD({ ...d, telefone: e.target.value })} />}</Campo>
      <Campo rotulo="Nota interna">{p => <AreaTexto {...p} disabled={!gestao} value={d.nota} onChange={e => setD({ ...d, nota: e.target.value })} />}</Campo>
      {gestao && <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(id, { name: d.name.trim(), telefone: d.telefone.trim(), nota: d.nota.trim() })}>Guardar perfil</Botao>}
    </div>
  );
}
