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
import { persist, toastError } from "./toastBus";

export function nextListId<T extends { id: number }>(xs: T[]) {
  return Math.max(0, ...xs.map(x => x.id), 1000) + 1;
}

/** ID local até a API devolver o `nextOpsId`. Nunca gravar PATCH contra este valor. */
export function tempNumericId() {
  return -Date.now();
}

export type Preinscricao = {
  id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
  inicioCurso: string; concelho: string; local: string; curso: string; preco: number;
  estado: string; campanha: string; origem: string;
  horario?: string; turmaId?: number;
  entrada?: "preinscricao" | "manual";
  meioContacto?: string;
  etiquetaId?: number | null;
  etiquetaNome?: string;
  etiquetaCor?: string;
  contactadoEm?: string | null; notas?: string; proximoContacto?: string;
  comercialId?: string | null;
  comercialNome?: string;
  nif?: string; moradaFiscal?: string; codigoPostal?: string;
  motivoDesistencia?: string; pagamentoMetodo?: string;
  secretariaEm?: string | null;
  ultimaNota?: string; ultimaActividadeEm?: string | null; ultimaResultado?: string;
  regime?: "gold" | "fin";
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
export type BlogPostRow = { id: number; titulo: string; slug: string; data: string; status: string; tematica?: string };
export type CampanhaRow = {
  id: number; nome: string; data: string; encarregado: string;
  curso?: string; preinscricoes: number; pagos: number; receita: number; custo: number;
  fim?: string; canal?: string; notas?: string;
};
export type PagamentoRow = {
  id: string; nome: string; valor: number; metodo: string; curso: string; data: string; estado: string;
};

type ListsCtx = {
  preinscricoes: Preinscricao[];
  addPreinscricao: (row: Preinscricao, extra?: { nota?: string }) => Promise<number | undefined>;
  patchPreinscricao: (id: number, patch: Partial<Preinscricao>) => void;
  removePreinscricao: (id: number) => void;
  contactarPreinscricao: (id: number, nota?: string, meio?: string) => void;
  formandosTurmas: FormandoTurma[];
  addFormandoTurma: (row: FormandoTurma) => Promise<number | undefined>;
  patchFormandoTurma: (id: number, patch: Partial<FormandoTurma>) => void;
  removeFormandoTurma: (id: number) => void;
  formandosFin: FormandoFin[];
  addFormandoFin: (row: FormandoFin) => Promise<number | undefined>;
  patchFormandoFin: (id: number, patch: Partial<FormandoFin>) => void;
  removeFormandoFin: (id: number) => void;
  cursosGold: CursoGoldRow[];
  addCursoGold: (row: CursoGoldRow) => Promise<number | undefined>;
  patchCursoGold: (id: number, patch: Partial<CursoGoldRow>) => void;
  removeCursoGold: (id: number) => void;
  cursosFin: CursoFinRow[];
  addCursoFin: (row: CursoFinRow) => Promise<number | undefined>;
  patchCursoFin: (id: number, patch: Partial<CursoFinRow>) => void;
  removeCursoFin: (id: number) => void;
  blogPosts: BlogPostRow[];
  addBlogPost: (row: BlogPostRow) => Promise<number | undefined>;
  patchBlogPost: (id: number, patch: Partial<BlogPostRow>) => void;
  removeBlogPost: (id: number) => void;
  campanhas: CampanhaRow[];
  addCampanha: (row: CampanhaRow) => Promise<number | undefined>;
  patchCampanha: (id: number, patch: Partial<CampanhaRow>) => void;
  removeCampanha: (id: number) => void;
  pagamentos: PagamentoRow[];
  addPagamento: (row: PagamentoRow, extra?: string | { email?: string; referencia?: string }) => Promise<string | undefined>;
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
    }).catch(() => {
      if (!alive) return;
      toastError(new Error("A API não respondeu. As listas ficam vazias - os números de demonstração não entram."));
      setPre([]);
      setFT([]);
      setFF([]);
      setCG([]);
      setCF([]);
      setBlog([]);
      setCamp([]);
      setPag([]);
    });
    return () => { alive = false; };
  }, []);

  const addPreinscricao = useCallback(async (row: Preinscricao, extra?: { nota?: string }) => {
    setPre(xs => [row, ...xs]);
    const r = await persist(apiCreatePreinscricao({ ...row, entrada: row.entrada ?? "manual", nota: extra?.nota }).then(res => {
      if (res.preinscricao) setPre(xs => replaceById(xs, row.id, res.preinscricao));
      return res;
    }), () => setPre(xs => xs.filter(x => x.id !== row.id)));
    return r?.preinscricao?.id;
  }, []);
  const patchPreinscricao = useCallback((id: number, patch: Partial<Preinscricao>) => {
    if (id < 0) return;
    let before: Preinscricao | undefined;
    setPre(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchPreinscricao(id, patch).then(r => {
      if (r.preinscricao) setPre(xs => xs.map(x => x.id === id ? { ...x, ...r.preinscricao } : x));
      return r;
    }), () => {
      if (before) setPre(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removePreinscricao = useCallback((id: number) => {
    let before: Preinscricao | undefined;
    setPre(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeletePreinscricao(id), () => {
      if (before) setPre(xs => [before!, ...xs]);
    });
  }, []);
  const contactarPreinscricao = useCallback((id: number, nota = "", meio = "") => {
    let before: Preinscricao | undefined;
    setPre(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id && x.estado === "Não contactado" ? { ...x, estado: "1º Contacto", notas: [x.notas, nota].filter(Boolean).join("\n"), meioContacto: meio || x.meioContacto } : x);
    });
    void persist(apiContactarPreinscricao(id, nota, meio).then(r => {
      if (r.preinscricao) setPre(xs => xs.map(x => x.id === id ? r.preinscricao! : x));
    }), () => {
      if (before) setPre(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);

  const addFormandoTurma = useCallback(async (row: FormandoTurma) => {
    setFT(xs => [row, ...xs]);
    const r = await persist(apiCreateFormandoGold(row).then(res => {
      if (res.formando) setFT(xs => replaceById(xs, row.id, res.formando));
      return res;
    }), () => setFT(xs => xs.filter(x => x.id !== row.id)));
    return r?.formando?.id;
  }, []);
  const patchFormandoTurma = useCallback((id: number, patch: Partial<FormandoTurma>) => {
    if (id < 0) return;
    let before: FormandoTurma | undefined;
    setFT(xs => {
      before = xs.find(x => x.id === id);
      const next = xs.map(x => x.id === id ? { ...x, ...patch } : x);
      const row = next.find(x => x.id === id);
      if (row && patch.estado && /conclu/i.test(patch.estado) && row.email) {
        void emitAutomation("formando.completed", {
          email: row.email,
          nome: `${row.nome} ${row.apelido}`.trim(),
          curso: row.curso,
          turma: row.turma,
        }, `formando.completed:${id}`);
      }
      return next;
    });
    void persist(apiPatchFormandoGold(id, patch), () => {
      if (before) setFT(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removeFormandoTurma = useCallback((id: number) => {
    let before: FormandoTurma | undefined;
    setFT(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeleteFormandoGold(id), () => {
      if (before) setFT(xs => [before!, ...xs]);
    });
  }, []);

  const addFormandoFin = useCallback(async (row: FormandoFin) => {
    setFF(xs => [row, ...xs]);
    const r = await persist(apiCreateFormandoFin(row).then(res => {
      if (res.formando) setFF(xs => replaceById(xs, row.id, res.formando));
      return res;
    }), () => setFF(xs => xs.filter(x => x.id !== row.id)));
    return r?.formando?.id;
  }, []);
  const patchFormandoFin = useCallback((id: number, patch: Partial<FormandoFin>) => {
    if (id < 0) return;
    let before: FormandoFin | undefined;
    setFF(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchFormandoFin(id, patch), () => {
      if (before) setFF(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removeFormandoFin = useCallback((id: number) => {
    let before: FormandoFin | undefined;
    setFF(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeleteFormandoFin(id), () => {
      if (before) setFF(xs => [before!, ...xs]);
    });
  }, []);

  const addCursoGold = useCallback(async (row: CursoGoldRow) => {
    setCG(xs => [row, ...xs]);
    const r = await persist(apiCreateCursoGold(row).then(res => {
      if (res.curso) setCG(xs => replaceById(xs, row.id, res.curso));
      return res;
    }), () => setCG(xs => xs.filter(x => x.id !== row.id)));
    return r?.curso?.id;
  }, []);
  const patchCursoGold = useCallback((id: number, patch: Partial<CursoGoldRow>) => {
    if (id < 0) return;
    let before: CursoGoldRow | undefined;
    setCG(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchCursoGold(id, patch), () => {
      if (before) setCG(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removeCursoGold = useCallback((id: number) => {
    let before: CursoGoldRow | undefined;
    setCG(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeleteCursoGold(id), () => {
      if (before) setCG(xs => [before!, ...xs]);
    });
  }, []);

  const addCursoFin = useCallback(async (row: CursoFinRow) => {
    setCF(xs => [row, ...xs]);
    const r = await persist(apiCreateCursoFin(row).then(res => {
      if (res.curso) setCF(xs => replaceById(xs, row.id, res.curso));
      return res;
    }), () => setCF(xs => xs.filter(x => x.id !== row.id)));
    return r?.curso?.id;
  }, []);
  const patchCursoFin = useCallback((id: number, patch: Partial<CursoFinRow>) => {
    if (id < 0) return;
    let before: CursoFinRow | undefined;
    setCF(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchCursoFin(id, patch), () => {
      if (before) setCF(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removeCursoFin = useCallback((id: number) => {
    let before: CursoFinRow | undefined;
    setCF(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeleteCursoFin(id), () => {
      if (before) setCF(xs => [before!, ...xs]);
    });
  }, []);

  const addBlogPost = useCallback(async (row: BlogPostRow) => {
    setBlog(xs => [row, ...xs]);
    const r = await persist(apiCreateBlog(row).then(res => {
      if (res.post) setBlog(xs => replaceById(xs, row.id, res.post));
      return res;
    }), () => setBlog(xs => xs.filter(x => x.id !== row.id)));
    return r?.post?.id;
  }, []);
  const patchBlogPost = useCallback((id: number, patch: Partial<BlogPostRow>) => {
    if (id < 0) return;
    let before: BlogPostRow | undefined;
    setBlog(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchBlog(id, patch), () => {
      if (before) setBlog(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removeBlogPost = useCallback((id: number) => {
    let before: BlogPostRow | undefined;
    setBlog(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeleteBlog(id), () => {
      if (before) setBlog(xs => [before!, ...xs]);
    });
  }, []);

  const addCampanha = useCallback(async (row: CampanhaRow) => {
    setCamp(xs => [row, ...xs]);
    const r = await persist(apiCreateCampanha(row).then(res => {
      if (res.campanha) setCamp(xs => replaceById(xs, row.id, res.campanha));
      return res;
    }), () => setCamp(xs => xs.filter(x => x.id !== row.id)));
    return r?.campanha?.id;
  }, []);
  const patchCampanha = useCallback((id: number, patch: Partial<CampanhaRow>) => {
    if (id < 0) return;
    let before: CampanhaRow | undefined;
    setCamp(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchCampanha(id, patch), () => {
      if (before) setCamp(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removeCampanha = useCallback((id: number) => {
    let before: CampanhaRow | undefined;
    setCamp(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeleteCampanha(id), () => {
      if (before) setCamp(xs => [before!, ...xs]);
    });
  }, []);

  const addPagamento = useCallback(async (row: PagamentoRow, extra?: string | { email?: string; referencia?: string }) => {
    const email = typeof extra === "string" ? extra : extra?.email;
    const referencia = typeof extra === "object" ? extra?.referencia : undefined;
    setPag(xs => [row, ...xs]);
    const r = await persist(apiCreatePagamento({ ...row, email, referencia }).then(res => {
      if (res.pagamento) setPag(xs => xs.map(x => x.id === row.id ? res.pagamento : x));
      return res;
    }), () => setPag(xs => xs.filter(x => x.id !== row.id)));
    return r?.pagamento?.id;
  }, []);
  const patchPagamento = useCallback((id: string, patch: Partial<PagamentoRow>) => {
    if (id.startsWith("tmp-")) return;
    let before: PagamentoRow | undefined;
    setPag(xs => {
      before = xs.find(x => x.id === id);
      return xs.map(x => x.id === id ? { ...x, ...patch } : x);
    });
    void persist(apiPatchPagamento(id, patch), () => {
      if (before) setPag(xs => xs.map(x => x.id === id ? before! : x));
    });
  }, []);
  const removePagamento = useCallback((id: string) => {
    let before: PagamentoRow | undefined;
    setPag(xs => {
      before = xs.find(x => x.id === id);
      return xs.filter(x => x.id !== id);
    });
    void persist(apiDeletePagamento(id), () => {
      if (before) setPag(xs => [before!, ...xs]);
    });
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
