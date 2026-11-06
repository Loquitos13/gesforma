// GesForma › Calendário: as sessões de formação (turma, curso, módulo e horário) de quem pede; quem gere turmas vê também
// o início, a data limite da matrícula e o fim de cada turma, e a administração os contactos marcados no CRM.
import { useMemo, useState } from "react";
import { apiCalendario } from "../../../partilhado/api/calendario";
import { useAuth } from "../../../partilhado/AuthGate";
import { CalendarioEventos, type EventoCal } from "../../../partilhado/CalendarioEventos";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { perfisDaChave, chaveDoPerfil } from "../../shell/navegacao";
import { Cartao, ErroCarregar, PageHeader, Selecao } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";

export default function Calendario({ navigate }: VistaProps) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<[string, string] | null>(null);
  const [regime, setRegime] = useState("");
  const [turma, setTurma] = useState("");
  const [formador, setFormador] = useState("");
  const r = useRecurso(periodo ? `calendario:${periodo[0]}:${periodo[1]}` : null, s => apiCalendario(periodo![0], periodo![1], s), { manterAnterior: true });
  const todos = r.dados?.eventos ?? [];
  const perfis = perfisDaChave(chaveDoPerfil(user));
  const doisRegimes = perfis.includes("admin") || (perfis.some(p => p === "secretaria" || p === "comercial") && perfis.includes("financiada"));
  const opcoes = (f: (e: (typeof todos)[number]) => string) => [...new Set(todos.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")).map(v => ({ valor: v, rotulo: v }));
  const eventos = useMemo(() => todos.filter(e =>
    (!regime || e.regime === regime) && (!turma || e.turma === turma) && (!formador || e.formadores.includes(formador))), [todos, regime, turma, formador]);

  function abrir(e: EventoCal & { turmaId?: number | null; leadId?: number }) {
    if (e.leadId) navigate({ view: e.regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes", leadId: e.leadId });
    else if (e.turmaId) navigate({ view: e.regime === "fin" ? "fin-cockpit-turma" : "gold-cockpit-turma", turmaId: e.turmaId });
  }

  return (
    <div className="space-y-4">
      <PageHeader titulo="Calendário" subtitulo="Sessões de formação com turma, curso, módulo e horário. Clique num evento para abrir a turma." />
      <div className="flex flex-wrap gap-2">
        {doisRegimes && (
          <Selecao aria-label="Regime" className="w-44" vazio="Gold e Financiada" value={regime} onChange={e => setRegime(e.target.value)}
            opcoes={[{ valor: "gold", rotulo: "Gold" }, { valor: "fin", rotulo: "Financiada" }]} />
        )}
        <Selecao aria-label="Turma" className="w-56" vazio="Todas as turmas" value={turma} onChange={e => setTurma(e.target.value)} opcoes={opcoes(e => e.turma)} />
        <Selecao aria-label="Formador" className="w-56" vazio="Todos os formadores" value={formador} onChange={e => setFormador(e.target.value)}
          opcoes={[...new Set(todos.flatMap(e => e.formadores))].sort((a, b) => a.localeCompare(b, "pt")).map(v => ({ valor: v, rotulo: v }))} />
      </div>
      {r.erro && !r.dados ? <ErroCarregar erro={r.erro} onTentar={r.recarregar} /> : (
        <Cartao>
          <CalendarioEventos eventos={eventos} aCarregar={r.aCarregar || r.aAtualizar} onPeriodo={(de, ate) => setPeriodo([de, ate])} onAbrir={abrir}
            mostrarRegime={doisRegimes} vazio="Sem sessões neste período." />
        </Cartao>
      )}
    </div>
  );
}
