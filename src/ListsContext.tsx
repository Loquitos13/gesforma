import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { emitAutomation } from "./api";

export function nextListId<T extends { id: number }>(xs: T[]) {
  return Math.max(0, ...xs.map(x => x.id), 1000) + 1;
}

export type Preinscricao = {
  id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
  inicioCurso: string; concelho: string; local: string; curso: string; preco: number;
  estado: string; campanha: string; origem: string;
};
export type FormandoTurma = {
  id: number; nome: string; apelido: string; telf: string; email: string; inscrito: string;
  local: string; curso: string; turma: string; turmaId: number; estado: string;
  pago: boolean; valor: number; metodo: string;
};
export type DocOk = { ok: boolean; data: string };
export type FormandoFin = {
  id: number; nome: string; apelido: string; turma: string; telf: string; email: string;
  curso: string; estado: string; cc: DocOk; ch: DocOk; cu: DocOk; ci: DocOk; ce: DocOk;
};
export type CursoGoldRow = {
  id: number; nome: string; categoria: string; tipo: string; preco: number;
  regime: string; horas: number; estado: string;
};
export type CursoFinRow = {
  id: number; ufcdCod: string; ufcd: string; nomeComercial: string;
  regime: string; horas: number; estado: string;
};
export type BlogPostRow = { id: number; titulo: string; slug: string; data: string; status: string };
export type CampanhaRow = {
  id: number; nome: string; data: string; encarregado: string;
  preinscricoes: number; pagos: number; receita: number; custo: number;
};

type ListsCtx = {
  preinscricoes: Preinscricao[];
  addPreinscricao: (row: Preinscricao) => void;
  patchPreinscricao: (id: number, patch: Partial<Preinscricao>) => void;
  removePreinscricao: (id: number) => void;
  formandosTurmas: FormandoTurma[];
  addFormandoTurma: (row: FormandoTurma) => void;
  patchFormandoTurma: (id: number, patch: Partial<FormandoTurma>) => void;
  removeFormandoTurma: (id: number) => void;
  formandosFin: FormandoFin[];
  addFormandoFin: (row: FormandoFin) => void;
  patchFormandoFin: (id: number, patch: Partial<FormandoFin>) => void;
  removeFormandoFin: (id: number) => void;
  cursosGold: CursoGoldRow[];
  addCursoGold: (row: CursoGoldRow) => void;
  patchCursoGold: (id: number, patch: Partial<CursoGoldRow>) => void;
  removeCursoGold: (id: number) => void;
  cursosFin: CursoFinRow[];
  addCursoFin: (row: CursoFinRow) => void;
  patchCursoFin: (id: number, patch: Partial<CursoFinRow>) => void;
  removeCursoFin: (id: number) => void;
  blogPosts: BlogPostRow[];
  addBlogPost: (row: BlogPostRow) => void;
  patchBlogPost: (id: number, patch: Partial<BlogPostRow>) => void;
  removeBlogPost: (id: number) => void;
  campanhas: CampanhaRow[];
  addCampanha: (row: CampanhaRow) => void;
  patchCampanha: (id: number, patch: Partial<CampanhaRow>) => void;
  removeCampanha: (id: number) => void;
};

const Ctx = createContext<ListsCtx | null>(null);

export function ListsProvider({
  children,
  seeds,
}: {
  children: ReactNode;
  seeds: {
    preinscricoes: Preinscricao[];
    formandosTurmas: FormandoTurma[];
    formandosFin: FormandoFin[];
    cursosGold: CursoGoldRow[];
    cursosFin: CursoFinRow[];
    blogPosts: BlogPostRow[];
    campanhas: CampanhaRow[];
  };
}) {
  const [preinscricoes, setPre] = useState(seeds.preinscricoes);
  const [formandosTurmas, setFT] = useState(seeds.formandosTurmas);
  const [formandosFin, setFF] = useState(seeds.formandosFin);
  const [cursosGold, setCG] = useState(seeds.cursosGold);
  const [cursosFin, setCF] = useState(seeds.cursosFin);
  const [blogPosts, setBlog] = useState(seeds.blogPosts);
  const [campanhas, setCamp] = useState(seeds.campanhas);

  const addPreinscricao = useCallback((row: Preinscricao) => {
    setPre(xs => [row, ...xs]);
    void emitAutomation("preinscricao.created", {
      email: row.email,
      nome: `${row.nome} ${row.apelido}`.trim(),
      curso: row.curso,
    }, `preinscricao:${row.id}:${row.email}`);
  }, []);
  const patchPreinscricao = useCallback((id: number, patch: Partial<Preinscricao>) => setPre(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removePreinscricao = useCallback((id: number) => setPre(xs => xs.filter(x => x.id !== id)), []);
  const addFormandoTurma = useCallback((row: FormandoTurma) => setFT(xs => [row, ...xs]), []);
  const patchFormandoTurma = useCallback((id: number, patch: Partial<FormandoTurma>) => setFT(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeFormandoTurma = useCallback((id: number) => setFT(xs => xs.filter(x => x.id !== id)), []);
  const addFormandoFin = useCallback((row: FormandoFin) => setFF(xs => [row, ...xs]), []);
  const patchFormandoFin = useCallback((id: number, patch: Partial<FormandoFin>) => setFF(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeFormandoFin = useCallback((id: number) => setFF(xs => xs.filter(x => x.id !== id)), []);
  const addCursoGold = useCallback((row: CursoGoldRow) => setCG(xs => [row, ...xs]), []);
  const patchCursoGold = useCallback((id: number, patch: Partial<CursoGoldRow>) => setCG(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeCursoGold = useCallback((id: number) => setCG(xs => xs.filter(x => x.id !== id)), []);
  const addCursoFin = useCallback((row: CursoFinRow) => setCF(xs => [row, ...xs]), []);
  const patchCursoFin = useCallback((id: number, patch: Partial<CursoFinRow>) => setCF(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeCursoFin = useCallback((id: number) => setCF(xs => xs.filter(x => x.id !== id)), []);
  const addBlogPost = useCallback((row: BlogPostRow) => setBlog(xs => [row, ...xs]), []);
  const patchBlogPost = useCallback((id: number, patch: Partial<BlogPostRow>) => setBlog(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeBlogPost = useCallback((id: number) => setBlog(xs => xs.filter(x => x.id !== id)), []);
  const addCampanha = useCallback((row: CampanhaRow) => setCamp(xs => [row, ...xs]), []);
  const patchCampanha = useCallback((id: number, patch: Partial<CampanhaRow>) => setCamp(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeCampanha = useCallback((id: number) => setCamp(xs => xs.filter(x => x.id !== id)), []);

  const value = useMemo(() => ({
    preinscricoes, addPreinscricao, patchPreinscricao, removePreinscricao,
    formandosTurmas, addFormandoTurma, patchFormandoTurma, removeFormandoTurma,
    formandosFin, addFormandoFin, patchFormandoFin, removeFormandoFin,
    cursosGold, addCursoGold, patchCursoGold, removeCursoGold,
    cursosFin, addCursoFin, patchCursoFin, removeCursoFin,
    blogPosts, addBlogPost, patchBlogPost, removeBlogPost,
    campanhas, addCampanha, patchCampanha, removeCampanha,
  }), [
    preinscricoes, formandosTurmas, formandosFin, cursosGold, cursosFin, blogPosts, campanhas,
    addPreinscricao, patchPreinscricao, removePreinscricao,
    addFormandoTurma, patchFormandoTurma, removeFormandoTurma,
    addFormandoFin, patchFormandoFin, removeFormandoFin,
    addCursoGold, patchCursoGold, removeCursoGold,
    addCursoFin, patchCursoFin, removeCursoFin,
    addBlogPost, patchBlogPost, removeBlogPost,
    addCampanha, patchCampanha, removeCampanha,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLists precisa de ListsProvider");
  return ctx;
}
