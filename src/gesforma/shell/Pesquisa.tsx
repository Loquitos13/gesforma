import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../partilhado/AuthGate";
import { apiGlobalSearch, type GlobalSearchHit } from "../../partilhado/api";
import { apiPainel, type RegimePainel } from "../../partilhado/api/painel";
import { useRecurso } from "../../partilhado/dados/useRecurso";
import { cx } from "../../partilhado/ui";
import type { Destino, Vista } from "../rotasGesforma";
import { TAREFAS, destinoTarefa } from "../vistas/painel/painelDados";
import { Icone } from "./Icones";
import { VISTAS_FORMADOR, vistaNoMenuDoPerfil } from "./navegacao";

type Linha = { tipo: string; nome: string; sub: string; grupo?: string } & Destino;

function deResultado(h: GlobalSearchHit): Linha {
  return {
    tipo: h.tipo, nome: h.nome, sub: h.sub, grupo: h.grupo,
    view: h.view as Vista, turmaId: h.turmaId, tab: h.tab, cursoId: h.cursoId,
    formandoId: h.formandoId, formandoOrigem: h.formandoOrigem, formadorId: h.formadorId, leadId: h.leadId,
  };
}

/** Regimes cujo trabalho o perfil vê. */
function regimesDoPerfil(role: string): RegimePainel[] {
  if (role === "comercial") return ["gold"];
  if (role === "financiada") return ["fin"];
  if (role === "admin" || role === "secretaria") return ["gold", "fin"];
  return [];
}

/** Atalhos do dia: as filas de "a tratar hoje" dos painéis, só as que têm trabalho. */
function useAtalhosDoDia(aberta: boolean): Linha[] {
  const { user } = useAuth();
  const regimes = regimesDoPerfil(user.role);
  const { dados } = useRecurso(
    aberta && regimes.length ? `pesquisa:atalhos:${regimes.join(",")}` : null,
    signal => Promise.all(regimes.map(r => apiPainel(r, {}, signal).then(p => ({ regime: r, tarefas: p.aTratar })).catch(() => ({ regime: r, tarefas: [] })))),
  );

  return useMemo(() => {
    if (user.role === "formador") {
      return [{ tipo: "Atalho", nome: "As minhas turmas", sub: "Sessões e avaliação", view: "formador-turmas" as Vista }];
    }
    const out: Linha[] = [];
    for (const { regime, tarefas } of dados ?? []) {
      for (const t of tarefas) {
        const info = TAREFAS[regime][t.id];
        const destino = destinoTarefa(regime, t.id, t.leadId);
        if (!info || !destino || t.n <= 0) continue;
        out.push({ tipo: "Atalho", nome: `${t.n} · ${info.titulo}`, sub: `${regime === "gold" ? "Gold" : "Financiada"} · ${t.detalhe}`, ...destino });
      }
    }
    if (!out.length) out.push({ tipo: "Atalho", nome: "Painel", sub: "Sem pendências sinalizadas", view: user.role === "financiada" ? "fin-painel" : "gold-painel" });
    return out;
  }, [dados, user.role]);
}

/** Pesquisa global (Ctrl+K): pessoas, turmas, cursos e atalhos do dia (o comercial: pré-inscrições). */
export function Pesquisa({ aberta, onFechar, onNavigate }: { aberta: boolean; onFechar: () => void; onNavigate: (d: Destino) => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [indice, setIndice] = useState(0);
  const [aProcurar, setAProcurar] = useState(false);
  const [tipoProcura, setTipoProcura] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<{ label: string; items: Linha[] }[]>([]);
  const atalhos = useAtalhosDoDia(aberta);
  const resultados = grupos.flatMap(g => g.items);
  const comTexto = q.trim().length >= 2;
  const mostrados = comTexto ? resultados : atalhos;
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberta) { setQ(""); setIndice(0); setGrupos([]); setTipoProcura(null); setTimeout(() => entrada.current?.focus(), 30); }
  }, [aberta]);
  useEffect(() => { setIndice(0); }, [q]);

  useEffect(() => {
    const termo = q.trim();
    if (!aberta || termo.length < 2) { setGrupos([]); setTipoProcura(null); setAProcurar(false); return; }
    setAProcurar(true);
    const t = window.setTimeout(() => {
      apiGlobalSearch(termo).then(r => {
        setTipoProcura(r.kindLabel);
        setGrupos(r.groups.map(g => ({
          label: g.label,
          // Só o que o perfil abre (o servidor já filtra; o comercial, por exemplo, só encontra pré-inscrições).
          items: g.items.map(deResultado).filter(i => user.role === "formador"
            ? VISTAS_FORMADOR.has(i.view) && i.tab !== "dtp"
            : vistaNoMenuDoPerfil(user.role, i.view)),
        })).filter(g => g.items.length));
      }).catch(() => { setTipoProcura(null); setGrupos([]); }).finally(() => setAProcurar(false));
    }, 180);
    return () => window.clearTimeout(t);
  }, [q, aberta, user.role]);

  function abrir(l: Linha) {
    onNavigate({
      view: l.view, turmaId: l.turmaId, tab: l.tab, cursoId: l.cursoId,
      formandoId: l.formandoId, formandoOrigem: l.formandoOrigem, formadorId: l.formadorId, leadId: l.leadId, filtros: l.filtros,
    });
    onFechar();
  }

  useEffect(() => {
    if (!aberta) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onFechar(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setIndice(i => Math.min(Math.max(mostrados.length - 1, 0), i + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setIndice(i => Math.max(0, i - 1)); }
      if (e.key === "Enter" && mostrados[indice]) { e.preventDefault(); abrir(mostrados[indice]); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  });

  if (!aberta) return null;
  let plano = 0;
  const linhaUI = (l: Linha, i: number, chave: string) => (
    <li key={chave}>
      <button
        type="button"
        onClick={() => abrir(l)}
        aria-selected={i === indice}
        className={cx("w-full flex items-center gap-3 px-5 py-3 text-left border-b border-linha-suave", i === indice ? "bg-fundo" : "hover:bg-fundo")}
      >
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-linha-suave text-tinta-suave">{l.tipo}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-tinta truncate">{l.nome}</span>
          <span className="block text-xs text-tinta-suave truncate">{l.sub}</span>
        </span>
        <Icone nome="seta" className="text-tinta-fraca" />
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-16 px-3 sm:px-6">
      <div className="absolute inset-0 bg-nav/50" onClick={onFechar} />
      <div role="dialog" aria-modal="true" aria-label="Pesquisar no GesForma" className="relative w-full max-w-3xl bg-superficie rounded-painel shadow-flutuante overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-linha">
          <Icone nome="lupa" className="text-tinta-suave" />
          <input
            ref={entrada}
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Pesquisar"
            placeholder="Nome, telemóvel, email, formação ou turma…"
            className="flex-1 text-base text-tinta placeholder:text-tinta-fraca bg-transparent border-0 outline-none"
          />
          {tipoProcura && comTexto && (
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wide text-acao-texto bg-acao-suave px-2 py-0.5 rounded-full whitespace-nowrap">{tipoProcura}</span>
          )}
          <kbd className="text-xs text-tinta-suave bg-linha-suave px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        {!comTexto && <p className="m-0 px-5 pt-3 text-[11px] font-bold uppercase tracking-wider text-tinta-fraca">Atalhos do dia</p>}
        <div className="max-h-[min(70vh,560px)] overflow-y-auto" role="listbox" aria-label="Resultados">
          {comTexto && aProcurar && mostrados.length === 0 && <p className="text-center text-sm text-tinta-suave py-10">A pesquisar…</p>}
          {comTexto && !aProcurar && mostrados.length === 0 && <p className="text-center text-sm text-tinta-suave py-10">Sem resultados para “{q}”.</p>}
          {comTexto
            ? grupos.map(g => (
              <div key={g.label}>
                <p className="m-0 px-5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-tinta-fraca sticky top-0 bg-superficie">{g.label}</p>
                <ul className="m-0 p-0 list-none">{g.items.map((l, i) => linhaUI(l, plano++, `${l.tipo}-${l.nome}-${i}`))}</ul>
              </div>
            ))
            : <ul className="m-0 p-0 list-none">{mostrados.map((l, i) => linhaUI(l, i, `${l.nome}-${i}`))}</ul>}
        </div>
        <div className="px-5 py-2 bg-fundo border-t border-linha flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
}
