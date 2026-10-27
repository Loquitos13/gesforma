import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../partilhado/AuthGate";
import { cx } from "../../partilhado/ui";
import type { Vista } from "../rotasGesforma";
import { roleLabel } from "../UsersView";
import { AlterarPalavraPasse } from "./AlterarPalavraPasse";
import { Icone } from "./Icones";
import { menuDoPerfil, painelDoPerfil, vistaDoMenu, type GrupoMenu, type ItemMenu } from "./navegacao";
import { preCarregarVista } from "./rotas";
import type { Navegar } from "./tipos";

/** Grupos e submenus abertos: o da vista actual abre sempre; o resto fica como a pessoa deixou. */
function abertosIniciais(menu: GrupoMenu[], ativo: Vista) {
  const grupos = new Set<string>();
  const subs = new Set<string>();
  for (const g of menu) {
    for (const item of g.items) {
      if (item.view === ativo) grupos.add(g.group);
      if (item.children?.some(c => c.view === ativo)) { grupos.add(g.group); subs.add(`${g.group}/${item.label}`); }
    }
  }
  if (!grupos.size && menu[0]) grupos.add(menu[0].group);
  return { grupos, subs };
}

export function Sidebar({ view, onNavigate, onFechar, compacta = false, onAlternar }: {
  view: Vista; onNavigate: Navegar; onFechar?: () => void;
  /** Só ícones (nav recolhida); `onAlternar` mostra o botão de recolher/expandir. */
  compacta?: boolean; onAlternar?: () => void;
}) {
  const { user, logout } = useAuth();
  const [mudarPasse, setMudarPasse] = useState(false);
  const botaoPasse = (
    <button type="button" aria-label="Alterar palavra-passe" title="Alterar palavra-passe" onClick={() => setMudarPasse(true)} className="p-1.5 rounded-controlo text-nav-fraco hover:text-white hover:bg-white/10">
      <Icone nome="chave" />
    </button>
  );
  const modalPasse = <AlterarPalavraPasse aberto={mudarPasse} onFechar={() => setMudarPasse(false)} />;
  const menu = useMemo(() => menuDoPerfil(user.role), [user.role]);
  const ativo = vistaDoMenu(view);
  const [abertos, setAbertos] = useState(() => abertosIniciais(menu, ativo));

  useEffect(() => {
    const atual = abertosIniciais(menu, ativo);
    setAbertos(prev => ({
      grupos: new Set([...prev.grupos, ...atual.grupos]),
      subs: new Set([...prev.subs, ...atual.subs]),
    }));
  }, [menu, ativo]);

  function alternar(tipo: "grupos" | "subs", chave: string) {
    setAbertos(prev => {
      const s = new Set(prev[tipo]);
      if (s.has(chave)) s.delete(chave); else s.add(chave);
      return { ...prev, [tipo]: s };
    });
  }
  function ir(v: Vista) {
    onNavigate(v);
    onFechar?.();
  }
  const temAtivo = (item: ItemMenu) => item.view === ativo || Boolean(item.children?.some(c => c.view === ativo));
  const alternarBotao = onAlternar && (
    <button type="button" onClick={onAlternar} aria-label={compacta ? "Expandir o menu" : "Recolher o menu"} title={compacta ? "Expandir o menu" : "Recolher o menu"}
      className="p-1.5 rounded-controlo text-nav-fraco hover:text-white hover:bg-white/10">
      <Icone nome="seta" tamanho={16} className={compacta ? "" : "rotate-180"} />
    </button>
  );

  if (compacta) {
    return (
      <div className="flex flex-col h-full bg-nav text-nav-texto text-xs items-center">
        <div className="h-14 flex items-center justify-center border-b border-white/10 w-full shrink-0">{alternarBotao}</div>
        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1 w-full">
          {menu.map((g, gi) => (
            <div key={g.group} className={cx("flex flex-col items-center gap-1 w-full", gi > 0 && "border-t border-white/10 pt-1")}>
              {g.items.map(item => {
                const destino = item.view ?? item.children?.[0]?.view;
                const a = temAtivo(item);
                return (
                  <button key={item.label} type="button" title={`${g.group} · ${item.label}`} aria-label={item.label} aria-current={a ? "page" : undefined}
                    onClick={() => destino && ir(destino)} onMouseEnter={() => destino && preCarregarVista(destino)}
                    className={cx("p-2 rounded-controlo", a ? "bg-nav-ativo text-white" : "hover:text-white hover:bg-white/10")}>
                    <Icone nome={item.icon} tamanho={17} />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 py-3 w-full flex flex-col items-center gap-1 shrink-0">
          {botaoPasse}
          {modalPasse}
          <button type="button" aria-label="Terminar sessão" title="Terminar sessão" onClick={() => void logout()} className="p-1.5 rounded-controlo text-nav-fraco hover:text-white hover:bg-white/10">
            <Icone nome="sair" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-nav text-nav-texto text-xs">
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => ir(painelDoPerfil(user.role))}
          className="bg-nav-ativo text-white font-extrabold text-[13px] tracking-[0.18em] px-3.5 py-1.5 rounded-controlo hover:brightness-110"
        >
          GESFORMA
        </button>
        {alternarBotao}
        {onFechar && (
          <button type="button" onClick={onFechar} aria-label="Fechar menu" className="lg:hidden p-1.5 rounded-controlo text-nav-texto hover:text-white hover:bg-white/10">
            <Icone nome="fechar" />
          </button>
        )}
      </div>

      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {menu.map(g => {
          const aberto = abertos.grupos.has(g.group);
          const contem = g.items.some(temAtivo);
          return (
            <div key={g.group}>
              <button
                type="button"
                onClick={() => alternar("grupos", g.group)}
                aria-expanded={aberto}
                className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-controlo", aberto && "bg-white/10")}
              >
                <span className={cx("flex-1 text-left font-bold tracking-[0.14em] uppercase", aberto || contem ? "text-slate-300" : "text-nav-fraco")}>{g.group}</span>
                {contem && !aberto && <span className="h-1.5 w-1.5 rounded-full bg-nav-ativo" aria-hidden="true" />}
                <Icone nome="seta" tamanho={14} className={cx("text-nav-fraco transition-transform", aberto && "rotate-90")} />
              </button>
              {aberto && (
                <ul className="m-0 mt-0.5 ml-2 pl-2 list-none border-l border-white/10 flex flex-col gap-0.5">
                  {g.items.map(item => {
                    if (!item.children) {
                      const a = item.view === ativo;
                      return (
                        <li key={item.label}>
                          <button
                            type="button"
                            aria-current={a ? "page" : undefined}
                            onClick={() => item.view && ir(item.view)}
                            onMouseEnter={() => item.view && preCarregarVista(item.view)}
                            onFocus={() => item.view && preCarregarVista(item.view)}
                            className={cx("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-controlo text-left",
                              a ? "bg-nav-ativo text-white font-semibold" : "hover:text-white hover:bg-white/10")}
                          >
                            <Icone nome={item.icon} tamanho={15} className="opacity-70 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        </li>
                      );
                    }
                    const chave = `${g.group}/${item.label}`;
                    const subAberto = abertos.subs.has(chave);
                    return (
                      <li key={item.label}>
                        <button
                          type="button"
                          aria-expanded={subAberto}
                          onClick={() => alternar("subs", chave)}
                          className={cx("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-controlo text-left", temAtivo(item) ? "text-white" : "hover:text-white hover:bg-white/10")}
                        >
                          <Icone nome={item.icon} tamanho={15} className="opacity-70 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          <Icone nome="seta" tamanho={13} className={cx("transition-transform", subAberto && "rotate-90")} />
                        </button>
                        {subAberto && (
                          <ul className="m-0 ml-6 mt-0.5 p-0 list-none flex flex-col gap-0.5">
                            {item.children.map(c => {
                              const a = c.view === ativo;
                              return (
                                <li key={c.view}>
                                  <button
                                    type="button"
                                    aria-current={a ? "page" : undefined}
                                    onClick={() => ir(c.view)}
                                    onMouseEnter={() => preCarregarVista(c.view)}
                                    onFocus={() => preCarregarVista(c.view)}
                                    className={cx("w-full text-left px-2.5 py-1.5 rounded-controlo",
                                      a ? "bg-nav-ativo text-white font-semibold" : "text-nav-fraco hover:text-white hover:bg-white/10")}
                                  >
                                    {c.label}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 shrink-0">
        <div className="flex items-center gap-3 p-2">
          <span className="h-8 w-8 rounded-full bg-nav-ativo text-white font-bold text-sm inline-flex items-center justify-center" aria-hidden="true">{user.name.slice(0, 1)}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-white truncate">{user.name}</span>
            <span className="block text-nav-fraco truncate">{roleLabel(user.role)}</span>
          </span>
          {botaoPasse}
          {modalPasse}
          <button type="button" aria-label="Terminar sessão" title="Terminar sessão" onClick={() => void logout()} className="p-1.5 rounded-controlo text-nav-fraco hover:text-white hover:bg-white/10">
            <Icone nome="sair" />
          </button>
        </div>
      </div>
    </div>
  );
}
