// Dados partilhados por vários ecrãs (cursos, formadores, a conta do formador), sempre lidos da API.
import { useMemo } from "react";
import { useAuth, usePode } from "../AuthGate";
import { apiFichaFormador, apiFormadores, apiOcupacaoFormador, apiMeuFormador, type LinhaFormador, type Regime } from "../api/formadores";
import { idCursoPorNome } from "../cursoLocais";
import type { SessaoCronograma } from "../turmaModel";
import { useOpcoes } from "./useOpcoes";
import { useRecurso } from "./useRecurso";

type CursoRef = { id: number; nome: string; nomeComercial?: string; ufcd?: string; ufcdCod?: string };

/** Cursos de um regime (id + nome) para resolver o id a partir do nome gravado nas turmas. */
export function useCursosRef(regime: Regime) {
  const { opcoes } = useOpcoes("cursos", { regime, todos: true });
  return useMemo<CursoRef[]>(() => opcoes.filter(o => o.id != null).map(o => ({
    id: Number(o.id),
    nome: o.rotulo,
    nomeComercial: o.rotulo,
    ufcd: String(o.extra?.ufcd ?? ""),
    ufcdCod: String(o.extra?.ufcdCod ?? ""),
  })), [opcoes]);
}

/** Id do curso com este nome (ou null enquanto não se sabe / não existe). */
export function useCursoId(regime: Regime, cursoNome: string | undefined) {
  const cursos = useCursosRef(regime);
  return useMemo(
    () => idCursoPorNome(regime, cursoNome, regime === "gold" ? cursos : [], regime === "fin" ? cursos : []),
    [cursoNome, cursos, regime],
  );
}

/** Todos os formadores de um regime (ficha resumida). Vazio se o perfil não os pode ver. */
export function useFormadoresDoRegime(regime: Regime) {
  const { user } = useAuth();
  const pode = usePode();
  // Cada perfil só lê os formadores do regime que vê (a comercial não vê a Financiada).
  const podeVer = user.role !== "formador" && user.role !== "formando" && pode(regime === "fin" ? "fin.ver" : "gold.ver");
  const { dados } = useRecurso(
    podeVer ? `formadores:todos:${regime}` : null,
    signal => apiFormadores({ regime, porPagina: 200 }, signal).catch(() => ({ linhas: [] as LinhaFormador[] })),
  );
  return useMemo(() => dados?.linhas ?? [], [dados]);
}

/**
 * Nomes com que o utilizador aparece nos cronogramas. Para o formador vem da sua ficha
 * (nome e email), para a equipa basta o nome da conta.
 */
export function useNomesEu() {
  const { user } = useAuth();
  const formador = user.role === "formador";
  const { dados: eu } = useRecurso(formador ? "formador:eu" : null, signal => apiMeuFormador(signal));
  const { dados: ficha } = useRecurso(
    eu?.id ? `formador:${eu.id}` : null,
    signal => apiFichaFormador(eu!.id, signal),
  );
  return useMemo(() => {
    const nomes = new Set<string>();
    if (ficha?.formador.nome.trim()) nomes.add(ficha.formador.nome.trim());
    if (user.name.trim()) nomes.add(user.name.trim());
    return nomes;
  }, [ficha, user.name]);
}

/** Formadores dos dois regimes, sem repetidos (para opções de selects e disponibilidade). */
export function useFormadoresTodos() {
  const gold = useFormadoresDoRegime("gold");
  const fin = useFormadoresDoRegime("fin");
  return useMemo(() => {
    const vistos = new Map<number, LinhaFormador>();
    for (const f of [...gold, ...fin]) if (!vistos.has(f.id)) vistos.set(f.id, f);
    return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }, [fin, gold]);
}

/** Opções de formador para selects: os activos do regime, mais os já atribuídos que não estejam na lista. */
export function useOpcoesFormador(atual?: string | string[], regime?: Regime) {
  const todos = useFormadoresTodos();
  return useMemo(() => {
    const base = todos
      .filter(f => f.estado === "Ativo" && (!regime || !f.regimes.length || f.regimes.includes(regime)))
      .map(f => ({ value: f.nome, sub: [f.telf, f.especialidade || (f.ccp ? `CCP ${f.ccp}` : "")].filter(Boolean).join(" · ") || undefined }));
    const extras = (Array.isArray(atual) ? atual : atual ? [atual] : [])
      .map(v => v.trim())
      .filter(v => v && !base.some(o => o.value === v));
    return [...extras.map(value => ({ value, sub: "Atribuído nesta turma" })), ...base];
  }, [atual, regime, todos]);
}

/** Janela de datas consultada para conflitos: do último ano aos dois anos seguintes. */
function janelaOcupacao() {
  const hoje = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const de = new Date(hoje); de.setFullYear(de.getFullYear() - 1);
  const ate = new Date(hoje); ate.setFullYear(ate.getFullYear() + 2);
  return { de: iso(de), ate: iso(ate) };
}

/**
 * Sessões que os formadores indicados já têm noutras turmas, no formato de cronograma,
 * para marcar como indisponíveis os horários que se cruzam. Lê a ocupação de cada formador no servidor.
 */
export function useSessoesNoutrasTurmas(nomes: string[], turma: { regime: Regime; id?: number }) {
  const todos = useFormadoresTodos();
  const ids = useMemo(() => {
    const alvo = new Set(nomes.map(n => n.trim().toLowerCase()).filter(Boolean));
    return todos.filter(f => alvo.has(f.nome.trim().toLowerCase())).map(f => f.id).sort((a, b) => a - b);
  }, [nomes, todos]);
  const chave = ids.length ? `formadores:ocupacao:${ids.join(",")}` : null;
  const { dados } = useRecurso(chave, signal => {
    const { de, ate } = janelaOcupacao();
    return Promise.all(ids.map(id => apiOcupacaoFormador(id, de, ate, signal).catch(() => null)));
  });
  return useMemo(() => {
    const out: { cronograma: SessaoCronograma[] }[] = [];
    for (const oc of dados ?? []) {
      if (!oc) continue;
      const nome = oc.formador.nome;
      const sessoes = oc.sessoes
        .filter(s => !(s.regime === turma.regime && s.turmaId === turma.id))
        .map((s, i) => ({ id: `outra-${s.regime}-${s.turmaId}-${i}`, data: s.data, horaInicio: s.horaInicio, horaFim: s.horaFim, modulos: [], formadores: [nome] }));
      out.push({ cronograma: sessoes });
    }
    return out;
  }, [dados, turma.id, turma.regime]);
}
