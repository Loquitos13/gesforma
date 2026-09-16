import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  apiContactarPreinscricao,
  apiCreateBlog,
  apiCreateCampanha,
  apiCreateCursoFin,
  apiCreateCursoGold,
  apiCreateFormandoFin,
  apiCreateFormandoGold,
  apiCreatePagamento,
  apiCreatePreinscricao,
  apiDeleteBlog,
  apiDeleteCampanha,
  apiDeleteCursoFin,
  apiDeleteCursoGold,
  apiDeleteFormandoFin,
  apiDeleteFormandoGold,
  apiDeletePagamento,
  apiDeletePreinscricao,
  apiPatchBlog,
  apiPatchCampanha,
  apiPatchCursoFin,
  apiPatchCursoGold,
  apiPatchFormandoFin,
  apiPatchFormandoGold,
  apiPatchPagamento,
  apiPatchPreinscricao,
  emitAutomation,
} from "./api";
import { loadOps } from "./opsCache";

export function nextListId<T extends { id: number }>(xs: T[]) {
  return Math.max(0, ...xs.map(x => x.id), 1000) + 1;
}

export type Preinscricao = {
  id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
  inicioCurso: string; concelho: string; local: string; curso: string; preco: number;
  estado: string; campanha: string; origem: string;
  contactadoEm?: string | null; notas?: string;
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
export type PagamentoRow = {
  id: string; nome: string; valor: number; metodo: string; curso: string; data: string; estado: string;
};

type ListsCtx = {
  preinscricoes: Preinscricao[];
  addPreinscricao: (row: Preinscricao) => void;
  patchPreinscricao: (id: number, patch: Partial<Preinscricao>) => void;
  removePreinscricao: (id: number) => void;
  contactarPreinscricao: (id: number, nota?: string) => void;
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
  pagamentos: PagamentoRow[];
  addPagamento: (row: PagamentoRow, email?: string) => void;
  patchPagamento: (id: string, patch: Partial<PagamentoRow>) => void;
  removePagamento: (id: string) => void;
};

const Ctx = createContext<ListsCtx | null>(null);

function replaceById<T extends { id: number }>(xs: T[], oldId: number, next: T) {
  return xs.map(x => x.id === oldId ? next : x);
}

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
    pagamentos?: PagamentoRow[];
  };
}) {
  const [preinscricoes, setPre] = useState(seeds.preinscricoes);
  const [formandosTurmas, setFT] = useState(seeds.formandosTurmas);
  const [formandosFin, setFF] = useState(seeds.formandosFin);
  const [cursosGold, setCG] = useState(seeds.cursosGold);
  const [cursosFin, setCF] = useState(seeds.cursosFin);
  const [blogPosts, setBlog] = useState(seeds.blogPosts);
  const [campanhas, setCamp] = useState(seeds.campanhas);
  const [pagamentos, setPag] = useState(seeds.pagamentos ?? []);

  useEffect(() => {
    let alive = true;
    loadOps().then(snap => {
      if (!alive) return;
      setPre(snap.preinscricoes);
      setFT(snap.formandosTurmas);
      setFF(snap.formandosFin);
      setCG(snap.cursosGold);
      setCF(snap.cursosFin);
      setBlog(snap.blogPosts);
      setCamp(snap.campanhas);
      setPag(snap.pagamentos);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const addPreinscricao = useCallback((row: Preinscricao) => {
    setPre(xs => [row, ...xs]);
    void apiCreatePreinscricao(row).then(r => {
      if (r.preinscricao) setPre(xs => replaceById(xs, row.id, r.preinscricao));
    }).catch(() => {
      void emitAutomation("preinscricao.created", {
        email: row.email,
        nome: `${row.nome} ${row.apelido}`.trim(),
        curso: row.curso,
      }, `preinscricao:${row.id}:${row.email}`);
    });
  }, []);
  const patchPreinscricao = useCallback((id: number, patch: Partial<Preinscricao>) => {
    setPre(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchPreinscricao(id, patch).catch(() => undefined);
  }, []);
  const removePreinscricao = useCallback((id: number) => {
    setPre(xs => xs.filter(x => x.id !== id));
    void apiDeletePreinscricao(id).catch(() => undefined);
  }, []);
  const contactarPreinscricao = useCallback((id: number, nota = "") => {
    setPre(xs => xs.map(x => x.id === id && x.estado === "Não contactado" ? { ...x, estado: "1º Contacto", notas: [x.notas, nota].filter(Boolean).join("\n") } : x));
    void apiContactarPreinscricao(id, nota).then(r => {
      if (r.preinscricao) setPre(xs => xs.map(x => x.id === id ? r.preinscricao! : x));
    }).catch(() => undefined);
  }, []);

  const addFormandoTurma = useCallback((row: FormandoTurma) => {
    setFT(xs => [row, ...xs]);
    void apiCreateFormandoGold(row).then(r => {
      if (r.formando) setFT(xs => replaceById(xs, row.id, r.formando));
    }).catch(() => undefined);
  }, []);
  const patchFormandoTurma = useCallback((id: number, patch: Partial<FormandoTurma>) => {
    setFT(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchFormandoGold(id, patch).catch(() => undefined);
  }, []);
  const removeFormandoTurma = useCallback((id: number) => {
    setFT(xs => xs.filter(x => x.id !== id));
    void apiDeleteFormandoGold(id).catch(() => undefined);
  }, []);

  const addFormandoFin = useCallback((row: FormandoFin) => {
    setFF(xs => [row, ...xs]);
    void apiCreateFormandoFin(row).then(r => {
      if (r.formando) setFF(xs => replaceById(xs, row.id, r.formando));
    }).catch(() => undefined);
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
    void apiCreateCursoGold(row).then(r => {
      if (r.curso) setCG(xs => replaceById(xs, row.id, r.curso));
    }).catch(() => undefined);
  }, []);
  const patchCursoGold = useCallback((id: number, patch: Partial<CursoGoldRow>) => {
    setCG(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchCursoGold(id, patch).catch(() => undefined);
  }, []);
  const removeCursoGold = useCallback((id: number) => {
    setCG(xs => xs.filter(x => x.id !== id));
    void apiDeleteCursoGold(id).catch(() => undefined);
  }, []);

  const addCursoFin = useCallback((row: CursoFinRow) => {
    setCF(xs => [row, ...xs]);
    void apiCreateCursoFin(row).then(r => {
      if (r.curso) setCF(xs => replaceById(xs, row.id, r.curso));
    }).catch(() => undefined);
  }, []);
  const patchCursoFin = useCallback((id: number, patch: Partial<CursoFinRow>) => {
    setCF(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchCursoFin(id, patch).catch(() => undefined);
  }, []);
  const removeCursoFin = useCallback((id: number) => {
    setCF(xs => xs.filter(x => x.id !== id));
    void apiDeleteCursoFin(id).catch(() => undefined);
  }, []);

  const addBlogPost = useCallback((row: BlogPostRow) => {
    setBlog(xs => [row, ...xs]);
    void apiCreateBlog(row).then(r => {
      if (r.post) setBlog(xs => replaceById(xs, row.id, r.post));
    }).catch(() => undefined);
  }, []);
  const patchBlogPost = useCallback((id: number, patch: Partial<BlogPostRow>) => {
    setBlog(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchBlog(id, patch).catch(() => undefined);
  }, []);
  const removeBlogPost = useCallback((id: number) => {
    setBlog(xs => xs.filter(x => x.id !== id));
    void apiDeleteBlog(id).catch(() => undefined);
  }, []);

  const addCampanha = useCallback((row: CampanhaRow) => {
    setCamp(xs => [row, ...xs]);
    void apiCreateCampanha(row).then(r => {
      if (r.campanha) setCamp(xs => replaceById(xs, row.id, r.campanha));
    }).catch(() => undefined);
  }, []);
  const patchCampanha = useCallback((id: number, patch: Partial<CampanhaRow>) => {
    setCamp(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchCampanha(id, patch).catch(() => undefined);
  }, []);
  const removeCampanha = useCallback((id: number) => {
    setCamp(xs => xs.filter(x => x.id !== id));
    void apiDeleteCampanha(id).catch(() => undefined);
  }, []);

  const addPagamento = useCallback((row: PagamentoRow, email?: string) => {
    setPag(xs => [row, ...xs]);
    void apiCreatePagamento({ ...row, email }).then(r => {
      if (r.pagamento) setPag(xs => xs.map(x => x.id === row.id ? r.pagamento : x));
    }).catch(() => {
      if (email) {
        void emitAutomation("payment.confirmed", { email, nome: row.nome, curso: row.curso }, `payment:${row.id}:${email}`);
      }
    });
  }, []);
  const patchPagamento = useCallback((id: string, patch: Partial<PagamentoRow>) => {
    setPag(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
    void apiPatchPagamento(id, patch).catch(() => undefined);
  }, []);
  const removePagamento = useCallback((id: string) => {
    setPag(xs => xs.filter(x => x.id !== id));
    void apiDeletePagamento(id).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({
    preinscricoes, addPreinscricao, patchPreinscricao, removePreinscricao, contactarPreinscricao,
    formandosTurmas, addFormandoTurma, patchFormandoTurma, removeFormandoTurma,
    formandosFin, addFormandoFin, patchFormandoFin, removeFormandoFin,
    cursosGold, addCursoGold, patchCursoGold, removeCursoGold,
    cursosFin, addCursoFin, patchCursoFin, removeCursoFin,
    blogPosts, addBlogPost, patchBlogPost, removeBlogPost,
    campanhas, addCampanha, patchCampanha, removeCampanha,
    pagamentos, addPagamento, patchPagamento, removePagamento,
  }), [
    preinscricoes, formandosTurmas, formandosFin, cursosGold, cursosFin, blogPosts, campanhas, pagamentos,
    addPreinscricao, patchPreinscricao, removePreinscricao, contactarPreinscricao,
    addFormandoTurma, patchFormandoTurma, removeFormandoTurma,
    addFormandoFin, patchFormandoFin, removeFormandoFin,
    addCursoGold, patchCursoGold, removeCursoGold,
    addCursoFin, patchCursoFin, removeCursoFin,
    addBlogPost, patchBlogPost, removeBlogPost,
    addCampanha, patchCampanha, removeCampanha,
    addPagamento, patchPagamento, removePagamento,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLists precisa de ListsProvider");
  return ctx;
}
