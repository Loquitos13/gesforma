import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../partilhado/AuthGate";
import { cockpitTabLabel } from "../../partilhado/SecretaryUX";
import { apiTurmaGravada } from "../../partilhado/api/turmas";
import { useRecurso } from "../../partilhado/dados/useRecurso";
import { Migalhas, type Migalha } from "../../partilhado/ui";
import { useNotificacoes } from "../NotificacoesContext";
import type { Destino, Vista } from "../rotasGesforma";
import { Icone } from "./Icones";
import { caminhoNoMenu, TITULOS } from "./navegacao";
import { PainelNotificacoes } from "./Notificacoes";
import type { Navegar, ParamsVista } from "./tipos";

function useMigalhas(view: Vista, params: ParamsVista, navigate: Navegar): { itens: Migalha[]; detalhe?: string } {
  const { user } = useAuth();
  const ehFormador = user.role === "formador";
  const naTurma = view === "gold-cockpit-turma" || view === "fin-cockpit-turma" || view === "fin-presencas";
  const regimeTurma = view === "gold-cockpit-turma" ? "gold" : "fin";
  // A mesma chave do cockpit: o nome da turma vem da cache, sem segundo pedido.
  const { dados } = useRecurso(
    naTurma && params.turmaId ? `turma:${regimeTurma}:${params.turmaId}` : null,
    signal => apiTurmaGravada(regimeTurma, params.turmaId!, signal),
  );

  if (naTurma) {
    const ehGold = view === "gold-cockpit-turma";
    const turma = dados?.turma;
    const separador = view === "fin-presencas" ? "Sessões" : (cockpitTabLabel[params.tab] ?? "Visão geral");
    const base: Migalha[] = ehFormador
      ? [{ rotulo: "As minhas turmas", onClick: () => navigate("formador-turmas") }]
      : [
        { rotulo: ehGold ? "Gold" : "Financiada", onClick: () => navigate(ehGold ? "gold-painel" : "fin-painel") },
        { rotulo: "Turmas", onClick: () => navigate(ehGold ? "gold-turmas" : "fin-turmas") },
      ];
    if (!turma) return { itens: [...base, { rotulo: "Turma" }] };
    return {
      itens: [...base, { rotulo: turma.nome, onClick: () => navigate({ view: ehGold ? "gold-cockpit-turma" : "fin-cockpit-turma", turmaId: turma.id, tab: "overview" }) }, { rotulo: separador }],
      detalhe: ehGold ? `${turma.curso} · ${turma.local}` : `UFCD ${turma.ufcdCod ?? ""} · ${turma.curso}`,
    };
  }

  const titulo = TITULOS[view] ?? "GesForma";
  const { grupo, pai, painel } = caminhoNoMenu(view);
  const itens: Migalha[] = [];
  if (grupo) itens.push({ rotulo: grupo, onClick: painel && painel !== view ? () => navigate(painel) : undefined });
  if (pai) itens.push({ rotulo: pai });
  if (!grupo || titulo !== grupo) itens.push({ rotulo: titulo });
  return { itens };
}

/** Barra de topo: menu (telemóvel), migalhas, pesquisa global e notificações. */
export function Cabecalho({ view, params, navigate, onMenu, onPesquisa }: {
  view: Vista;
  params: ParamsVista;
  navigate: Navegar;
  onMenu: () => void;
  onPesquisa: () => void;
}) {
  const { itens, detalhe } = useMigalhas(view, params, navigate);
  const { naoLidas, bloqueios } = useNotificacoes();
  const [notifAberto, setNotifAberto] = useState(false);
  const zona = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifAberto) return;
    const fora = (e: MouseEvent) => { if (zona.current && !zona.current.contains(e.target as Node)) setNotifAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setNotifAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [notifAberto]);

  return (
    <header className="sticky top-0 z-30 bg-superficie border-b border-linha flex items-center gap-3 px-4 sm:px-6 min-h-14 py-2 shrink-0">
      <button type="button" onClick={onMenu} aria-label="Abrir menu" className="lg:hidden p-2 -ml-1 rounded-controlo text-tinta-suave hover:text-tinta hover:bg-linha-suave">
        <Icone nome="menu" tamanho={18} />
      </button>
      <div className="min-w-0 shrink">
        <Migalhas itens={itens} />
        {detalhe && <p className="m-0 text-[11px] text-tinta-fraca truncate hidden md:block">{detalhe}</p>}
      </div>
      <button
        type="button"
        onClick={onPesquisa}
        className="hidden sm:flex ml-auto items-center gap-2 h-9 px-3 w-[340px] max-w-[45%] rounded-controlo border border-linha bg-fundo text-tinta-suave text-sm hover:border-linha-forte"
      >
        <Icone nome="lupa" />
        <span className="flex-1 text-left truncate">Nome, telemóvel, email, formação ou turma…</span>
        <kbd className="text-[11px] border border-linha rounded px-1.5">Ctrl K</kbd>
      </button>
      <div className="flex items-center gap-2 ml-auto sm:ml-0 shrink-0">
        <button type="button" onClick={onPesquisa} aria-label="Pesquisar" className="sm:hidden p-2 rounded-controlo text-tinta-suave hover:bg-linha-suave">
          <Icone nome="lupa" />
        </button>
        <div ref={zona} className="relative">
          <button
            type="button"
            onClick={() => setNotifAberto(a => !a)}
            aria-label={naoLidas ? `Notificações (${naoLidas} por ler)` : "Notificações"}
            aria-expanded={notifAberto}
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-controlo border border-linha text-tinta-suave hover:bg-fundo"
          >
            <Icone nome="sino" />
            {naoLidas > 0 && <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${bloqueios > 0 ? "bg-perigo" : "bg-acao"}`} aria-hidden="true" />}
          </button>
          {notifAberto && (
            <PainelNotificacoes onNavigate={(d: Destino) => { navigate(d); setNotifAberto(false); }} onFechar={() => setNotifAberto(false)} />
          )}
        </div>
      </div>
    </header>
  );
}
