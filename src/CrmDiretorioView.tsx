import { useEffect, useState, type ReactNode } from "react";
import {
  apiContratoTemplates,
  apiContratos,
  apiCreateCliente,
  apiCreateClienteProposta,
  apiCreateContrato,
  apiCreateContratoTemplate,
  apiCreateParceiro,
  apiCreatePropostaTemplate,
  apiCrmClientes,
  apiCrmComerciais,
  apiCrmParceiros,
  apiDeleteCliente,
  apiDeleteParceiro,
  apiPropostaTemplates,
  type ContratoTemplate,
  type CrmCliente,
  type CrmContrato,
  type CrmParceiro,
  type PropostaTemplate,
} from "./api";
import { AppModal, SearchSelect } from "./FormKit";
import { criarComercialRapido } from "./criarComercialRapido";
import { EmptyHint } from "./SecretaryUX";

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-500 uppercase">{label}<div className="mt-1 normal-case">{children}</div></label>;
}

function PageHeader({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function NewBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white">{label}</button>;
}

export function CrmClientesView() {
  const [items, setItems] = useState<CrmCliente[]>([]);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [nif, setNif] = useState("");
  const [erro, setErro] = useState("");
  const [propostaDe, setPropostaDe] = useState<CrmCliente | null>(null);
  const [cursoProp, setCursoProp] = useState("");
  const [valorProp, setValorProp] = useState("");
  const [corpoProp, setCorpoProp] = useState("");

  function load() {
    apiCrmClientes().then(r => setItems(r.clientes)).catch(() => setErro("Não foi possível ler os clientes."));
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!nome.trim()) return;
    await apiCreateCliente({ nome: nome.trim(), email, telf, nif, notas: "" });
    setOpen(false);
    setNome(""); setEmail(""); setTelf(""); setNif("");
    load();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" sub="Empresas e instituições. Cada cliente pode ter propostas e, a partir delas, um contrato." action={<NewBtn label="+ Novo cliente" onClick={() => setOpen(true)} />} />
      {erro && <p className="text-xs text-amber-700">{erro}</p>}
      {items.length === 0 && <EmptyHint text="Ainda sem clientes. Registe quem já compra formação ou pede propostas." action="Novo cliente" onAction={() => setOpen(true)} />}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-400 border-b"><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Telemóvel</th><th className="px-3 py-2">NIF</th><th className="px-3 py-2">Propostas</th><th /></tr></thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{c.nome}</td>
                <td className="px-3 py-2 text-slate-600">{c.email || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.telf || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.nif || "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  <button type="button" className="text-xs font-semibold text-amber-700" onClick={() => { setPropostaDe(c); setCursoProp(""); setValorProp(""); setCorpoProp(""); }}>
                    {(c.propostas ?? []).length} · nova
                  </button>
                  {(c.propostas ?? []).slice(0, 2).map(p => (
                    <p key={p.id} className="text-[11px] text-slate-500 truncate max-w-[180px]">{p.curso || "Proposta"} · {p.estado}</p>
                  ))}
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-xs text-red-600" onClick={() => { void apiDeleteCliente(c.id).then(load); }}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AppModal open={open} onClose={() => setOpen(false)} title="Novo cliente">
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
          <Field label="Email"><input className={iCls} value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Telemóvel"><input className={iCls} value={telf} onChange={e => setTelf(e.target.value)} /></Field>
          <Field label="NIF"><input className={iCls} value={nif} onChange={e => setNif(e.target.value)} /></Field>
          <button type="button" disabled={!nome.trim()} onClick={() => void guardar()} className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40">Guardar</button>
        </div>
      </AppModal>
      <AppModal open={!!propostaDe} onClose={() => setPropostaDe(null)} title={propostaDe ? `Proposta · ${propostaDe.nome}` : "Proposta"}>
        <div className="p-5 space-y-3">
          {(propostaDe?.propostas ?? []).length === 0 && <p className="text-xs text-slate-400">Ainda sem propostas neste cliente.</p>}
          {(propostaDe?.propostas ?? []).map(p => (
            <p key={p.id} className="text-xs text-slate-600">{p.curso || "Sem curso"} · {p.estado} · € {p.valor}</p>
          ))}
          <Field label="Curso"><input className={iCls} value={cursoProp} onChange={e => setCursoProp(e.target.value)} /></Field>
          <Field label="Valor (€)"><input className={iCls} value={valorProp} onChange={e => setValorProp(e.target.value)} /></Field>
          <Field label="Texto"><textarea className={iCls + " min-h-[100px]"} value={corpoProp} onChange={e => setCorpoProp(e.target.value)} /></Field>
          <button type="button" disabled={!propostaDe} onClick={() => {
            if (!propostaDe) return;
            void apiCreateClienteProposta(propostaDe.id, { curso: cursoProp, valor: Number(valorProp) || 0, corpo: corpoProp }).then(() => {
              setPropostaDe(null);
              load();
            });
          }} className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg">Guardar proposta</button>
        </div>
      </AppModal>
    </div>
  );
}

export function CrmParceirosView() {
  const [items, setItems] = useState<CrmParceiro[]>([]);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState("");
  const [comercialId, setComercialId] = useState("");
  const [retribuicao, setRetribuicao] = useState("");
  const [comerciais, setComerciais] = useState<{ id: string; name: string }[]>([]);
  const [erro, setErro] = useState("");

  function load() {
    apiCrmParceiros().then(r => setItems(r.parceiros)).catch(() => setErro("Não foi possível ler os parceiros."));
    apiCrmComerciais("gold").then(r => setComerciais(r.comerciais)).catch(() => undefined);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Parceiros" sub="Cada parceiro fica ligado a um comercial e às condições de retribuição." action={<NewBtn label="+ Novo parceiro" onClick={() => setOpen(true)} />} />
      {erro && <p className="text-xs text-amber-700">{erro}</p>}
      {items.length === 0 && <EmptyHint text="Ainda sem parceiros." action="Novo parceiro" onAction={() => setOpen(true)} />}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map(p => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{p.nome}</p>
              <p className="text-xs text-slate-500">{[p.tipo, p.comercial, p.email].filter(Boolean).join(" · ") || "Sem contacto"}</p>
              {p.retribuicao && <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{p.retribuicao}</p>}
            </div>
            <button type="button" className="text-xs text-red-600" onClick={() => { void apiDeleteParceiro(p.id).then(load); }}>Remover</button>
          </div>
        ))}
      </div>
      <AppModal open={open} onClose={() => setOpen(false)} title="Novo parceiro">
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
          <Field label="Email"><input className={iCls} value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Tipo"><input className={iCls} value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Empresa, câmara, associação…" /></Field>
          <Field label="Comercial">
            <SearchSelect
              value={comercialId}
              allowEmpty
              emptyLabel="Sem comercial"
              placeholder="Pesquisar comercial…"
              options={comerciais.map(c => ({ value: c.id, label: c.name }))}
              onChange={setComercialId}
              onAdd={() => {
                void criarComercialRapido().then(c => {
                  if (!c) return;
                  setComerciais(xs => xs.some(x => x.id === c.id) ? xs : [...xs, c]);
                  setComercialId(c.id);
                });
              }}
              addLabel="Novo comercial"
            />
          </Field>
          <Field label="Condições de retribuição"><textarea className={iCls + " min-h-[80px]"} value={retribuicao} onChange={e => setRetribuicao(e.target.value)} placeholder="Percentagem, valor por formando, prazo de pagamento…" /></Field>
          <button type="button" disabled={!nome.trim()} onClick={() => {
            void apiCreateParceiro({ nome: nome.trim(), email, tipo, comercialId: comercialId || null, retribuicao }).then(() => {
              setOpen(false); setNome(""); setEmail(""); setTipo(""); setComercialId(""); setRetribuicao(""); load();
            });
          }} className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40">Guardar</button>
        </div>
      </AppModal>
    </div>
  );
}

export function CrmContratosView() {
  const [items, setItems] = useState<CrmContrato[]>([]);
  const [templates, setTemplates] = useState<ContratoTemplate[]>([]);
  const [propostaTemplates, setPropostaTemplates] = useState<PropostaTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState<"contrato" | "proposta" | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clientes, setClientes] = useState<CrmCliente[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [propostaId, setPropostaId] = useState<number | "">("");
  const [curso, setCurso] = useState("");
  const [valor, setValor] = useState("");
  const [corpo, setCorpo] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [tplNome, setTplNome] = useState("");
  const [tplCorpo, setTplCorpo] = useState("");
  const [erro, setErro] = useState("");

  function load() {
    apiContratos().then(r => setItems(r.contratos)).catch(() => setErro("Não foi possível ler os contratos."));
    apiContratoTemplates().then(r => setTemplates(r.templates)).catch(() => undefined);
    apiPropostaTemplates().then(r => setPropostaTemplates(r.templates)).catch(() => undefined);
    apiCrmClientes().then(r => setClientes(r.clientes)).catch(() => undefined);
  }
  useEffect(() => { load(); }, []);

  function aplicarTemplate(id: number) {
    const t = templates.find(x => x.id === id);
    setTemplateId(id);
    if (!t) return;
    if (!curso) setCurso(t.curso);
    if (!valor) setValor(String(t.valor || ""));
    if (!corpo) setCorpo(t.corpo);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contratos"
        sub="Contratos reutilizam um template. Os templates de proposta ficam aqui para a equipa comercial os aplicar."
        action={<NewBtn label="+ Novo contrato" onClick={() => setOpen(true)} />}
      />
      {erro && <p className="text-xs text-amber-700">{erro}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TemplateLista titulo="Templates de contrato" items={templates} onNovo={() => setTplOpen("contrato")} />
        <TemplateLista titulo="Templates de proposta" items={propostaTemplates} onNovo={() => setTplOpen("proposta")} />
      </div>
      {items.length === 0 && <EmptyHint text="Ainda sem contratos. Crie um template e aplique-o a um cliente." action="Novo contrato" onAction={() => setOpen(true)} />}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map(c => (
          <div key={c.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{c.clienteNome}</p>
              <span className="text-xs font-semibold text-slate-500">{c.estado}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{[c.curso, c.valor ? `€ ${c.valor}` : "", c.comercial, c.propostaId ? `proposta ${c.propostaId}` : ""].filter(Boolean).join(" · ")}</p>
            {c.corpo && <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap line-clamp-3">{c.corpo}</p>}
          </div>
        ))}
      </div>
      <AppModal open={open} onClose={() => setOpen(false)} title="Novo contrato" size="lg">
        <div className="p-5 space-y-3">
          <Field label="Template">
            <SearchSelect
              value={templateId === "" ? "" : String(templateId)}
              allowEmpty
              emptyLabel="Sem template"
              placeholder="Pesquisar template…"
              options={templates.map(t => ({ value: String(t.id), label: t.nome }))}
              onChange={v => { if (!v) { setTemplateId(""); return; } aplicarTemplate(Number(v)); }}
              onAdd={() => {
                const nomeTpl = window.prompt("Nome do template de contrato");
                if (!nomeTpl?.trim()) return;
                void apiCreateContratoTemplate({ nome: nomeTpl.trim(), corpo: "", curso: "", valor: 0 }).then(r => {
                  setTemplates(xs => [...xs, r.template]);
                  aplicarTemplate(r.template.id);
                }).catch(e => window.alert(e instanceof Error ? e.message : "Não foi possível criar o template."));
              }}
              addLabel="Novo template"
            />
          </Field>
          <Field label="Cliente institucional">
            <SearchSelect
              value={clienteId === "" ? "" : String(clienteId)}
              allowEmpty
              emptyLabel="Escolher cliente"
              placeholder="Pesquisar cliente…"
              options={clientes.map(c => ({ value: String(c.id), label: c.nome }))}
              onChange={v => {
                const id = v ? Number(v) : "";
                setClienteId(id);
                setPropostaId("");
                const c = clientes.find(x => x.id === id);
                if (c) setClienteNome(c.nome);
              }}
              onAdd={() => {
                const nomeCli = window.prompt("Nome do cliente");
                if (!nomeCli?.trim()) return;
                void apiCreateCliente({ nome: nomeCli.trim(), email: "", telf: "", nif: "", notas: "" }).then(r => {
                  setClientes(xs => [...xs, r.cliente]);
                  setClienteId(r.cliente.id);
                  setClienteNome(r.cliente.nome);
                  setPropostaId("");
                }).catch(e => window.alert(e instanceof Error ? e.message : "Não foi possível criar o cliente."));
              }}
              addLabel="Novo cliente"
            />
          </Field>
          <Field label="Proposta de origem">
            <SearchSelect
              value={propostaId === "" ? "" : String(propostaId)}
              allowEmpty
              emptyLabel="Sem proposta"
              placeholder="Pesquisar proposta…"
              options={(clientes.find(c => c.id === clienteId)?.propostas ?? []).map(p => ({
                value: String(p.id),
                label: `${p.curso || "Proposta"} · ${p.estado} · € ${p.valor}`,
              }))}
              onChange={v => {
                const id = v ? Number(v) : "";
                setPropostaId(id);
                const p = clientes.find(c => c.id === clienteId)?.propostas?.find(x => x.id === id);
                if (!p) return;
                if (p.curso) setCurso(p.curso);
                if (p.valor) setValor(String(p.valor));
                if (p.corpo) setCorpo(p.corpo);
              }}
              onAdd={() => {
                if (clienteId === "") {
                  window.alert("Escolha primeiro o cliente.");
                  return;
                }
                const cursoProp = window.prompt("Curso da proposta") ?? "";
                void apiCreateClienteProposta(clienteId, { curso: cursoProp, valor: 0, corpo: "" }).then(r => {
                  setClientes(xs => xs.map(c => c.id === clienteId ? { ...c, propostas: [...(c.propostas ?? []), r.proposta] } : c));
                  setPropostaId(r.proposta.id);
                  if (r.proposta.curso) setCurso(r.proposta.curso);
                }).catch(e => window.alert(e instanceof Error ? e.message : "Não foi possível criar a proposta."));
              }}
              addLabel="Nova proposta"
            />
          </Field>
          <Field label="Nome no contrato"><input className={iCls} value={clienteNome} onChange={e => setClienteNome(e.target.value)} /></Field>
          <Field label="Curso"><input className={iCls} value={curso} onChange={e => setCurso(e.target.value)} /></Field>
          <Field label="Valor (€)"><input className={iCls} value={valor} onChange={e => setValor(e.target.value)} /></Field>
          <Field label="Texto"><textarea className={iCls + " min-h-[120px]"} value={corpo} onChange={e => setCorpo(e.target.value)} /></Field>
          <button type="button" disabled={!clienteNome.trim()} onClick={() => {
            void apiCreateContrato({
              clienteNome: clienteNome.trim(),
              curso,
              valor: Number(valor) || 0,
              corpo,
              templateId: templateId === "" ? null : templateId,
              clienteId: clienteId === "" ? null : clienteId,
              propostaId: propostaId === "" ? null : propostaId,
            }).then(() => { setOpen(false); setClienteNome(""); setCorpo(""); setClienteId(""); setPropostaId(""); load(); });
          }} className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40">Guardar contrato</button>
        </div>
      </AppModal>
      <AppModal open={!!tplOpen} onClose={() => setTplOpen(null)} title={tplOpen === "proposta" ? "Template de proposta" : "Template de contrato"}>
        <div className="p-5 space-y-3">
          <Field label="Nome do template"><input className={iCls} value={tplNome} onChange={e => setTplNome(e.target.value)} /></Field>
          <Field label="Texto reutilizável"><textarea className={iCls + " min-h-[140px]"} value={tplCorpo} onChange={e => setTplCorpo(e.target.value)} /></Field>
          <button type="button" disabled={!tplNome.trim()} onClick={() => {
            const body = { nome: tplNome.trim(), corpo: tplCorpo, curso: "", valor: 0 };
            const req = tplOpen === "proposta" ? apiCreatePropostaTemplate(body) : apiCreateContratoTemplate(body);
            void req.then(() => { setTplOpen(null); setTplNome(""); setTplCorpo(""); load(); });
          }} className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40">Guardar template</button>
        </div>
      </AppModal>
    </div>
  );
}

function TemplateLista({ titulo, items, onNovo }: { titulo: string; items: { id: number; nome: string; corpo: string }[]; onNovo: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800">{titulo}</p>
        <button type="button" onClick={onNovo} className="text-xs font-semibold text-amber-700">+ Template</button>
      </div>
      {items.length === 0 && <p className="text-xs text-slate-400">Nenhum template. Crie um para reutilizar o texto.</p>}
      <ul className="space-y-1">
        {items.map(t => <li key={t.id} className="text-xs text-slate-700">{t.nome}</li>)}
      </ul>
    </div>
  );
}
