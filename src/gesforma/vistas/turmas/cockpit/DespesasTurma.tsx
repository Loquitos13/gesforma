// Separador Despesas da turma (Financiada): os campos do template de despesas (TemplateDespesas.xlsx), com as listas
// do template em seletores com pesquisa, e exportação para Excel com as mesmas colunas. No topo, os ficheiros do
// reembolso da turma (execução física e despesas), um de cada, guardados na Drive.
import { useMemo, useState } from "react";
import {
  apiAlterarDespesa, apiApagarDespesa, apiAssociarDespesa, apiCriarDespesa, apiDespesas, apiExportarDespesas, type Despesa,
} from "../../../../partilhado/api/despesas";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { CAMPOS_DESPESA, GRUPOS_DESPESA, OPCOES_DESPESA, type CampoDespesa, type DadosDespesa } from "../../../../partilhado/despesas";
import { SearchSelect } from "../../../../partilhado/FormKit";
import { toastError } from "../../../../partilhado/toastBus";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Modal, Tabela, Vazio, data, eur, num, type Coluna,
} from "../../../../partilhado/ui";
import { ReembolsoTurma } from "./ReembolsoTurma";

type Form = Record<string, string>;

const NOVA: Form = { nifFornecedorEstrangeiro: "Não", paisFornecedor: "Portugal" };

// Números voltam ao formulário com vírgula decimal: "1.234" (quantidade 1,234) gravado de novo não pode virar 1234.
const paraForm = (d: DadosDespesa): Form =>
  Object.fromEntries(CAMPOS_DESPESA.map(c => {
    const v = d[c.chave];
    return [c.chave, v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v)];
  }));

const texto = (d: DadosDespesa, k: string) => String(d[k] ?? "");
const valor = (d: DadosDespesa, k: string) => (typeof d[k] === "number" ? eur(d[k] as number, true) : "—");
const titulo = (d: Despesa) => [texto(d.dados, "docDespesa"), texto(d.dados, "nDocDespesa")].filter(Boolean).join(" · ") || "Sem documento";

export function DespesasTurma({ turmaId, onFicha }: { turmaId: number; onFicha?: (formandoId: number) => void }) {
  const { dados, erro, aCarregar, recarregar } = useRecurso(`despesas:turma:${turmaId}`, signal => apiDespesas(turmaId, { signal }));
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ id: number | null; valores: Form } | null>(null);
  const [apagar, setApagar] = useState<Despesa | null>(null);
  const [aExportar, setAExportar] = useState(false);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const todas = dados?.despesas ?? [];
    return t ? todas.filter(d => Object.values(d.dados).some(v => String(v ?? "").toLowerCase().includes(t)) || String(d.ordem) === t) : todas;
  }, [dados, q]);

  const colunas: Coluna<Despesa>[] = [
    { id: "ordem", titulo: "Ordem", alinhar: "dir", celula: d => num(d.ordem) },
    {
      id: "doc", titulo: "Documento", principal: true,
      celula: d => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{titulo(d)}</span>
          <span className="block text-xs text-tinta-suave truncate">{texto(d.dados, "descricao")}</span>
        </span>
      ),
    },
    { id: "data", titulo: "Data", celula: d => (d.dados.dataDocDespesa ? data(texto(d.dados, "dataDocDespesa")) : "—") },
    {
      id: "fornecedor", titulo: "Fornecedor", esconderMovel: true,
      celula: d => <span className="block min-w-0"><span className="block truncate">{texto(d.dados, "nomeFornecedor") || "—"}</span><span className="block text-xs text-tinta-suave">{texto(d.dados, "nifFornecedor")}</span></span>,
    },
    { id: "categoria", titulo: "Categoria", esconderMovel: true, celula: d => <span className="line-clamp-2 text-xs">{texto(d.dados, "categoriaCusto") || "—"}</span> },
    { id: "total", titulo: "Total", alinhar: "dir", celula: d => valor(d.dados, "totalDocDespesa") },
    { id: "elegivel", titulo: "Elegível", alinhar: "dir", esconderMovel: true, celula: d => valor(d.dados, "elegivelDocDespesa") },
    { id: "pagamento", titulo: "Pagamento", esconderMovel: true, celula: d => texto(d.dados, "docPagamento") || "—" },
  ];
  const total = lista.reduce((s, d) => s + (typeof d.dados.totalDocDespesa === "number" ? d.dados.totalDocDespesa : 0), 0);

  async function exportar() {
    setAExportar(true);
    try { await apiExportarDespesas(turmaId); } catch (e) { toastError(e, "Não foi possível exportar."); } finally { setAExportar(false); }
  }

  return (
    <div className="space-y-4">
      <ReembolsoTurma turmaId={turmaId} onFicha={onFicha} />
      <SemTurma turmaId={turmaId} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-9 min-w-0 max-w-[420px] flex-1 items-center gap-2 rounded-lg border border-linha-forte bg-white px-3 text-tinta-suave">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr-only">Pesquisar despesas</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Fornecedor, documento, descrição, NIF…" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-tinta outline-none" />
        </label>
        <span className="text-sm text-tinta-suave">{dados ? `${num(lista.length)} despesas · total ${eur(total, true)}` : ""}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Botao onClick={() => void exportar()} aCarregar={aExportar}>Exportar Excel</Botao>
          <Botao variante="primario" onClick={() => setForm({ id: null, valores: { ...NOVA } })}>Nova despesa</Botao>
        </div>
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Despesas da turma"
          linhas={lista}
          colunas={colunas}
          chave={d => d.id}
          onLinha={d => setForm({ id: d.id, valores: paraForm(d.dados) })}
          aCarregar={aCarregar && !dados}
          acoesLinha={d => <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setApagar(d)}>Apagar</Botao>}
          vazio={<Vazio titulo={q ? "Nenhuma despesa com esta pesquisa." : "Esta turma ainda não tem despesas."} descricao="Registe cada documento de despesa com os campos do template." />}
        />
      </Cartao>
      {form && <FormDespesa turmaId={turmaId} inicial={form} onFechar={() => setForm(null)} />}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Apagar despesa"
        descricao={apagar ? `A despesa nº ${apagar.ordem} deixa de existir. Esta acção não se desfaz.` : ""}
        onConfirmar={async () => {
          if (!apagar) return;
          try { await apiApagarDespesa(apagar.id); setApagar(null); recarregar(); } catch (e) { toastError(e, "Não foi possível apagar."); }
        }}
      />
    </div>
  );
}

/** As despesas registadas antes de haver turmas: aparecem em qualquer turma até alguém as associar. */
function SemTurma({ turmaId }: { turmaId: number }) {
  const { dados } = useRecurso("despesas:sem-turma", signal => apiDespesas("sem", { signal }));
  const associar = useAccao((id: number) => apiAssociarDespesa(id, turmaId), { ok: "Despesa associada a esta turma.", invalidar: ["despesas:"] });
  const antigas = dados?.despesas ?? [];
  if (!antigas.length) return null;
  return (
    <Aviso tom="aviso" titulo={`${num(antigas.length)} despesas registadas antes de haver despesas por turma`}>
      <p className="m-0 mb-2">Associe à turma a que pertencem. Depois de associadas, deixam de aparecer aqui.</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {antigas.map(d => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 truncate"><strong>{titulo(d)}</strong>{texto(d.dados, "descricao") ? ` — ${texto(d.dados, "descricao")}` : ""} · {valor(d.dados, "totalDocDespesa")}</span>
            <Botao tamanho="sm" aCarregar={associar.aCorrer} onClick={() => void associar.correr(d.id)}>Associar a esta turma</Botao>
          </li>
        ))}
      </ul>
    </Aviso>
  );
}

function FormDespesa({ turmaId, inicial, onFechar }: { turmaId: number; inicial: { id: number | null; valores: Form }; onFechar: () => void }) {
  const [v, setV] = useState<Form>(inicial.valores);
  const gravar = useAccao(
    (d: Form) => (inicial.id ? apiAlterarDespesa(inicial.id, d) : apiCriarDespesa(turmaId, d)),
    { ok: inicial.id ? "Despesa guardada." : "Despesa registada.", invalidar: ["despesas:"] },
  );
  const mudar = (k: string, x: string) => setV(f => ({ ...f, [k]: x }));
  return (
    <Modal aberto largura="xl" onFechar={onFechar} titulo={inicial.id ? "Editar despesa" : "Nova despesa"} rodape={(
      <>
        <Botao onClick={onFechar}>Cancelar</Botao>
        <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(v).then(r => { if (r) onFechar(); })}>Guardar</Botao>
      </>
    )}>
      <div className="flex flex-col gap-6">
        {GRUPOS_DESPESA.map(g => (
          <section key={g} aria-label={g}>
            <h3 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wide text-tinta-suave">{g}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS_DESPESA.filter(c => c.grupo === g).map(c => <CampoForm key={c.chave} c={c} valor={v[c.chave] ?? ""} onMudar={x => mudar(c.chave, x)} />)}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

function CampoForm({ c, valor, onMudar }: { c: CampoDespesa; valor: string; onMudar: (v: string) => void }) {
  if (c.tipo === "opcao" && c.lista) {
    // O seletor com pesquisa não é um input: o rótulo vai à parte.
    return (
      <div className={c.lista === "rubrica" || c.lista === "categoriaCusto" ? "sm:col-span-2" : undefined}>
        <span className="mb-1 block text-[13px] font-medium text-tinta">{c.rotulo}</span>
        <SearchSelect value={valor} onChange={onMudar} allowEmpty emptyLabel="Selecionar…" placeholder="Pesquisar…"
          options={(OPCOES_DESPESA[c.lista] as string[]).map(value => ({ value }))} />
        {c.ajuda && <span className="mt-1 block text-xs text-tinta-suave">{c.ajuda}</span>}
      </div>
    );
  }
  return (
    <Campo rotulo={c.rotulo} ajuda={c.ajuda} className={c.tipo === "textoLongo" ? "sm:col-span-2" : undefined}>
      {p => c.tipo === "textoLongo"
        ? <AreaTexto {...p} rows={2} value={valor} onChange={e => onMudar(e.target.value)} />
        : <Entrada {...p} value={valor} onChange={e => onMudar(e.target.value)}
            type={c.tipo === "data" ? "date" : "text"}
            inputMode={c.tipo === "euros" || c.tipo === "numero" ? "decimal" : undefined}
            placeholder={c.tipo === "euros" ? "0,00 €" : undefined} />}
    </Campo>
  );
}
