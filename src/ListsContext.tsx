import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  apiCreateCurso,
  apiCreateFormandoFin,
  apiCreateFormandoTurma,
  apiCreatePreinscricao,
  apiDeleteCurso,
  apiDeleteFormandoFin,
  apiDeleteFormandoTurma,
  apiDeletePreinscricao,
  apiGetCatalogo,
  apiCreateCatalogo,
  apiDeleteCatalogo,
  apiGetCursos,
  apiGetFormandosFin,
  apiGetFormandosTurmas,
  apiGetPreinscricoes,
  apiPatchCurso,
  apiPatchFormandoFin,
  apiPatchFormandoTurma,
  apiPatchPreinscricao,
  emitAutomation,
} from "./api";

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

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      apiGetPreinscricoes(),
      apiGetFormandosTurmas(),
      apiGetFormandosFin(),
      apiGetCursos(),
      apiGetCatalogo("blog_posts"),
      apiGetCatalogo("campanhas"),
    ]).then(([preRes, ftRes, ffRes, cursosRes, blogRes, campRes]) => {
      if (!alive) return;
      if (preRes.status === "fulfilled" && preRes.value?.preinscricoes?.length) {
        setPre(preRes.value.preinscricoes);
      }
      if (ftRes.status === "fulfilled" && ftRes.value?.formandosTurmas?.length) {
        setFT(ftRes.value.formandosTurmas);
      }
      if (ffRes.status === "fulfilled" && ffRes.value?.formandosFin?.length) {
        setFF(ffRes.value.formandosFin);
      }
      if (cursosRes.status === "fulfilled" && cursosRes.value?.cursos?.length) {
        const rows = cursosRes.value.cursos;
        const goldList: CursoGoldRow[] = rows
          .filter((c: any) => c.regime === "gold")
          .map((c: any) => ({
            id: c.id,
            nome: c.nome,
            categoria: c.categoria,
            tipo: c.tipo,
            preco: Number(c.preco),
            regime: c.regime,
            horas: Number(c.horas),
            estado: c.estado,
          }));
        const finList: CursoFinRow[] = rows
          .filter((c: any) => c.regime === "fin")
          .map((c: any) => ({
            id: c.id,
            ufcdCod: c.ufcd_cod || c.ufcdCod,
            ufcd: c.ufcd,
            nomeComercial: c.nome_comercial || c.nomeComercial,
            regime: c.regime,
            horas: Number(c.horas),
            estado: c.estado,
          }));
        if (goldList.length) setCG(goldList);
        if (finList.length) setCF(finList);
      }
      if (blogRes.status === "fulfilled" && blogRes.value?.items?.length) {
        setBlog(blogRes.value.items.map((i: any) => i.dados || i));
      }
      if (campRes.status === "fulfilled" && campRes.value?.items?.length) {
        setCamp(campRes.value.items.map((i: any) => i.dados || i));
      }
    });
    return () => { alive = false; };
  }, []);

  const addPreinscricao = useCallback((row: Preinscricao) => {
    setPre(xs => [row, ...xs]);
    void apiCreatePreinscricao(row).catch(() => undefined);
    void emitAutomation("preinscricao.created", {
      email: row.email,
      nome: `${row.nome} ${row.apelido}`.trim(),
      curso: row.curso,
    }, `preinscricao:${row.id}:${row.email}`);
  }, []);

  const patchPreinscricao = useCallback((id: number, patch: Partial<Preinscricao>) => {
    setPre(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchPreinscricao(id, patch).catch(() => undefined);
  }, []);

  const removePreinscricao = useCallback((id: number) => {
    setPre(xs => xs.filter(x => x.id !== id));
    void apiDeletePreinscricao(id).catch(() => undefined);
  }, []);

  const addFormandoTurma = useCallback((row: FormandoTurma) => {
    setFT(xs => [row, ...xs]);
    void apiCreateFormandoTurma(row).catch(() => undefined);
  }, []);

  const patchFormandoTurma = useCallback((id: number, patch: Partial<FormandoTurma>) => {
    setFT(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchFormandoTurma(id, patch).catch(() => undefined);
  }, []);

  const removeFormandoTurma = useCallback((id: number) => {
    setFT(xs => xs.filter(x => x.id !== id));
    void apiDeleteFormandoTurma(id).catch(() => undefined);
  }, []);

  const addFormandoFin = useCallback((row: FormandoFin) => {
    setFF(xs => [row, ...xs]);
    void apiCreateFormandoFin(row).catch(() => undefined);
  }, []);

  const patchFormandoFin = useCallback((id: number, patch: Partial<FormandoFin>) => {
    setFF(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchFormandoFin(id, patch).catch(() => undefined);
  }, []);

  const removeFormandoFin = useCallback((id: number) => {
    setFF(xs => xs.filter(x => x.id !== id));
    void apiDeleteFormandoFin(id).catch(() => undefined);
  }, []);

  const addCursoGold = useCallback((row: CursoGoldRow) => {
    setCG(xs => [row, ...xs]);
    void apiCreateCurso(row).catch(() => undefined);
  }, []);

  const patchCursoGold = useCallback((id: number, patch: Partial<CursoGoldRow>) => {
    setCG(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchCurso(id, patch).catch(() => undefined);
  }, []);

  const removeCursoGold = useCallback((id: number) => {
    setCG(xs => xs.filter(x => x.id !== id));
    void apiDeleteCurso(id).catch(() => undefined);
  }, []);

  const addCursoFin = useCallback((row: CursoFinRow) => {
    setCF(xs => [row, ...xs]);
    void apiCreateCurso({ ...row, regime: "fin" }).catch(() => undefined);
  }, []);

  const patchCursoFin = useCallback((id: number, patch: Partial<CursoFinRow>) => {
    setCF(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchCurso(id, patch).catch(() => undefined);
  }, []);

  const removeCursoFin = useCallback((id: number) => {
    setCF(xs => xs.filter(x => x.id !== id));
    void apiDeleteCurso(id).catch(() => undefined);
  }, []);

  const addBlogPost = useCallback((row: BlogPostRow) => {
    setBlog(xs => [row, ...xs]);
    void apiCreateCatalogo("blog_posts", row).catch(() => undefined);
  }, []);
  const patchBlogPost = useCallback((id: number, patch: Partial<BlogPostRow>) => setBlog(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeBlogPost = useCallback((id: number) => {
    setBlog(xs => xs.filter(x => x.id !== id));
    void apiDeleteCatalogo("blog_posts", id).catch(() => undefined);
  }, []);
  const addCampanha = useCallback((row: CampanhaRow) => {
    setCamp(xs => [row, ...xs]);
    void apiCreateCatalogo("campanhas", row).catch(() => undefined);
  }, []);
  const patchCampanha = useCallback((id: number, patch: Partial<CampanhaRow>) => setCamp(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x)), []);
  const removeCampanha = useCallback((id: number) => {
    setCamp(xs => xs.filter(x => x.id !== id));
    void apiDeleteCatalogo("campanhas", id).catch(() => undefined);
  }, []);

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
