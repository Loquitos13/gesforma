import { NotifKind, sortNotifs } from "../../partilhado/SecretaryUX";
import { cx } from "../../partilhado/ui";
import { NotificacoesView, type NotifRow } from "../ActionSurfaces";
import { useNotificacoes } from "../NotificacoesContext";
import type { Destino, Separador, Vista } from "../rotasGesforma";
import { Icone } from "./Icones";
import type { VistaProps } from "./tipos";

function destinoDe(n: { view: string; turmaId?: number; leadId?: number; tab?: string }): Destino {
  return { view: n.view as Vista, turmaId: n.turmaId, leadId: n.leadId, tab: n.tab as Separador | undefined };
}

/** Página "Notificações" (todas). */
export default function NotificacoesPagina({ navigate }: VistaProps) {
  const { items, estado, marcarLida, marcarTodas } = useNotificacoes();
  return (
    <NotificacoesView
      items={items as NotifRow[]}
      estado={estado}
      onMarcarLida={marcarLida}
      onMarcarTodas={marcarTodas}
      onOpen={n => navigate(destinoDe(n))}
    />
  );
}

/** Painel do sino no cabeçalho. */
export function PainelNotificacoes({ onNavigate, onFechar }: { onNavigate: (d: Destino) => void; onFechar: () => void }) {
  const { items, naoLidas, estado, marcarLida, marcarTodas } = useNotificacoes();
  return (
    <div role="dialog" aria-label="Notificações" className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-1.5rem))] bg-superficie text-tinta rounded-painel shadow-flutuante border border-linha overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-linha">
        <p className="m-0 text-sm font-semibold flex items-center gap-2">
          Notificações
          {naoLidas > 0 && <span className="num bg-perigo text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{naoLidas}</span>}
        </p>
        {naoLidas > 0 && <button type="button" onClick={marcarTodas} className="text-xs font-semibold text-ligacao hover:underline">Marcar todas como lidas</button>}
      </div>
      <ul className="m-0 p-0 list-none max-h-80 overflow-y-auto divide-y divide-linha-suave">
        {estado === "loading" && <li className="px-4 py-6 text-center text-xs text-tinta-suave">A carregar…</li>}
        {estado === "offline" && <li className="px-4 py-6 text-center text-xs text-aviso">Sem ligação ao servidor.</li>}
        {estado === "ready" && items.length === 0 && <li className="px-4 py-6 text-center text-xs text-tinta-suave">Nada a sinalizar.</li>}
        {sortNotifs(items).map(n => (
          <li key={n.chave}>
            <button
              type="button"
              onClick={() => { marcarLida(n.chave); onNavigate(destinoDe(n)); onFechar(); }}
              className={cx("w-full flex gap-3 px-4 py-3 text-left hover:bg-fundo", n.lida && "opacity-60")}
            >
              <span className={cx("h-8 w-8 rounded-controlo inline-flex items-center justify-center shrink-0 mt-0.5",
                n.tipo === "error" ? "bg-perigo-suave text-perigo" : n.tipo === "warn" ? "bg-aviso-suave text-aviso" : "bg-ligacao-suave text-ligacao")}>
                <Icone nome={n.tipo === "info" ? "info" : "aviso"} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-start justify-between gap-1">
                  <span className="text-xs font-semibold leading-snug">{n.titulo}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <NotifKind tipo={n.tipo} />
                    {!n.lida && <span className="h-2 w-2 rounded-full bg-perigo" aria-label="Por ler" />}
                  </span>
                </span>
                <span className="block text-xs text-tinta-suave mt-0.5 line-clamp-2">{n.texto}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="px-4 py-2 border-t border-linha text-center">
        <button type="button" onClick={() => { onNavigate({ view: "notificacoes" }); onFechar(); }} className="text-xs font-semibold text-ligacao hover:underline">
          Ver todas as notificações
        </button>
      </div>
    </div>
  );
}
