// Estado e gravação da ficha do curso: dados do curso (tabela), ficha (site, programa, avaliação) e imagens.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiCriarCursoFin, apiCriarCursoGold, apiCursoFin, apiCursoGold, apiEditarCursoFin, apiEditarCursoGold, apiFichaCurso,
  apiGravarFichaCurso, apiImagemCurso, type TurmaDoCurso,
} from "../../../../partilhado/api/cursos";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import type { CriterioAvaliacao } from "../../../../partilhado/TurmaExtras";
import { criteriosDoModelo } from "../../../criteriosModelo";
import type { AvaliacaoCurso } from "../../../avaliacaoCurso";
import { textoPrograma } from "../../../cursoPrograma";
import {
  camposObrigatorios, cursoTemFolhaSimulacao, fichaInicial, fundirGuardado, mediaGuardada, podeCriarRascunho, prontidao,
  type CursoBase, type CursoSite, type Regime, type TabId,
} from "./modelo";

export type FichaCurso = ReturnType<typeof useFichaCurso>;

export function useFichaCurso(regime: Regime, cursoIdParam: number | "new" | undefined, aoCriar: (id: number) => void) {
  const idInicial = typeof cursoIdParam === "number" ? cursoIdParam : undefined;
  const [cursoId, setCursoId] = useState<number | undefined>(idInicial);
  const cursoRes = useRecurso<{ curso: CursoBase & { uso?: unknown }; turmas: TurmaDoCurso[] }>(
    cursoId != null ? `cursos:${regime}:ficha:${cursoId}` : null,
    async signal => {
      if (regime === "gold") return apiCursoGold(cursoId!, signal);
      const r = await apiCursoFin(cursoId!, signal);
      return { ...r, curso: { ...r.curso, nome: r.curso.nomeComercial || r.curso.ufcd } };
    },
  );
  const fichaRes = useRecurso(cursoId != null ? `cursos:${regime}:fichadados:${cursoId}` : null, signal => apiFichaCurso(regime, cursoId!, signal));
  const modelos = useOpcoes("modelos_conteudo", { regime });

  const [data, setData] = useState<CursoSite>(() => fichaInicial(null, regime, []));
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>([]);
  const [entidadeId, setEntidadeId] = useState<number | null>(null);
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [tab, setTab] = useState<TabId>("identidade");
  const [imagemAGravar, setImagemAGravar] = useState<"" | "banner" | "capa" | "miniatura">("");
  const inicializado = useRef(false);
  const comModelos = useRef(false);
  // Id e «a gravar» também em ref: dois cliques (ou blur + mudar de separador) seguidos ainda veem o estado
  // antigo e criariam o curso duas vezes.
  const idRef = useRef<number | undefined>(idInicial);
  const aGravar = useRef(false);

  // Montagem dos dados: espera pelo curso e pela ficha gravada. Se os modelos de conteúdo chegarem
  // depois e ainda nada foi alterado, volta a montar para os aproveitar.
  useEffect(() => {
    const temModelos = modelos.opcoes.length > 0;
    if (inicializado.current && (alterado || comModelos.current || !temModelos)) return;
    comModelos.current = temModelos;
    if (cursoId == null) {
      setData(fichaInicial(null, regime, modelos.opcoes));
      inicializado.current = true;
      return;
    }
    if (!cursoRes.dados || fichaRes.dados === undefined) return;
    const curso = cursoRes.dados.curso;
    const base = fichaInicial(curso, regime, modelos.opcoes);
    const guardado = (fichaRes.dados.ficha?.payload ?? {}) as Record<string, unknown>;
    const fundido = fundirGuardado(base, guardado, regime, curso.nome);
    if (!fundido.locais.length) fundido.locais = [...new Set(cursoRes.dados.turmas.map(t => t.local).filter(Boolean))];
    setData(fundido);
    const gravados = fichaRes.dados.ficha?.criterios ?? [];
    setCriterios(gravados.length ? gravados : criteriosDoModelo(modelos.opcoes, curso.nome));
    setEntidadeId(curso.entidadeResponsavelId ?? null);
    inicializado.current = true;
  }, [cursoId, regime, cursoRes.dados, fichaRes.dados, modelos.opcoes, alterado]);

  const carregado = inicializado.current;
  const turmas = cursoRes.dados?.turmas ?? [];
  const pronto = useMemo(() => prontidao(data, regime), [data, regime]);

  function patch(p: Partial<CursoSite>) {
    setData(prev => ({ ...prev, ...p }));
    setAlterado(true);
    setErro("");
    setFalhas(prev => {
      const next = { ...prev };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  }

  function patchAv(p: Partial<AvaliacaoCurso>) {
    patch({ avaliacaoCurso: { ...data.avaliacaoCurso, ...p } });
  }

  function mudarCriterios(next: CriterioAvaliacao[]) {
    setCriterios(next);
    setAlterado(true);
  }

  /** Grava o curso (tabela) e devolve o id. Na primeira gravação cria o curso. */
  async function gravarCurso(): Promise<number> {
    const cursoId = idRef.current;
    const comum = { regime: data.regime, horas: Number(data.horas) || 0, estado: data.estado || "Ativo" };
    if (regime === "gold") {
      const corpo = {
        ...comum, nome: data.titulo.trim(), categoria: data.categoria, tipo: data.tipo, preco: Number(data.preco) || 0, entidadeResponsavelId: entidadeId,
      };
      const r = cursoId != null ? await apiEditarCursoGold(cursoId, corpo) : await apiCriarCursoGold(corpo);
      return r.curso.id;
    }
    const corpo = {
      ...comum, nomeComercial: data.titulo.trim(), ufcdCod: data.ufcdCod.trim(), ufcd: data.ufcd.trim() || data.titulo.trim(), areaCnaef: data.areaCnaef,
    };
    const r = cursoId != null ? await apiEditarCursoFin(cursoId, corpo) : await apiCriarCursoFin(corpo);
    return r.curso.id;
  }

  async function guardar(opts: { rascunho?: boolean } = {}) {
    if (aGravar.current) return false;
    // Rascunho de um curso novo: só com o que o servidor exige para o criar (sem pedido nem erro antes disso).
    if (opts.rascunho && idRef.current == null && !podeCriarRascunho(data, regime)) return false;
    if (opts.rascunho && !data.titulo.trim()) return false;
    const faltas = opts.rascunho ? [] : camposObrigatorios(data, regime);
    if (faltas.length) {
      setFalhas(Object.fromEntries(faltas.map(f => [f.chave, `${f.rotulo}: obrigatório.`])));
      setErro(`Falta preencher: ${faltas.map(f => f.rotulo).join(", ")}.`);
      setTab(faltas[0]!.tab);
      return false;
    }
    if (!opts.rascunho && regime === "gold" && data.precosOferta.some(p => (!p.local && !p.horario) || p.preco.trim() === "" || Number(p.preco) < 0 || Number.isNaN(Number(p.preco)))) {
      setFalhas({ precosOferta: "Cada preço especial precisa de um local, de um horário (ou dos dois) e de um valor." });
      setErro("Há um preço por local ou horário incompleto.");
      setTab("oferta");
      return false;
    }
    if (regime === "fin" && opts.rascunho && !data.ufcdCod.trim()) return false;
    setFalhas({});
    aGravar.current = true;
    setGravando(true);
    setErro("");
    let criado: number | undefined;
    try {
      const novo = idRef.current == null;
      const id = await gravarCurso();
      if (novo) {
        // O curso já existe: a partir daqui grava-se por id, mesmo que a ficha falhe.
        idRef.current = id;
        criado = id;
        setCursoId(id);
      }
      const organizacao = regime === "fin" ? "modular" : data.organizacaoPrograma;
      await apiGravarFichaCurso(regime, id, {
        payload: {
          ...data,
          banner: mediaGuardada(data.banner), capa: mediaGuardada(data.capa), miniatura: mediaGuardada(data.miniatura),
          organizacaoPrograma: organizacao,
          programa: textoPrograma(organizacao, data.topicosPrograma) || data.programa,
        } as unknown as Record<string, unknown>,
        criterios: cursoTemFolhaSimulacao(data, regime) ? criterios.filter(c => c.label.trim()) : [],
      });
      setAlterado(false);
      invalidar("cursos:");
      invalidar("opcoes:cursos");
      if (!opts.rascunho) toastOk("Curso gravado.");
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gravar.");
      toastError(e, "Não foi possível gravar o curso.");
      return false;
    } finally {
      aGravar.current = false;
      setGravando(false);
      if (criado != null) {
        invalidar("cursos:");
        aoCriar(criado);
      }
    }
  }

  async function carregarImagem(slot: "banner" | "capa" | "miniatura", ficheiro: File) {
    if (cursoId == null) {
      setErro("Grave o curso antes de carregar imagens.");
      return false;
    }
    setImagemAGravar(slot);
    try {
      const g = await apiImagemCurso(regime, cursoId, slot, ficheiro);
      setData(prev => (slot === "capa" ? { ...prev, capa: { name: g.nome, url: g.url }, miniatura: null } : { ...prev, [slot]: { name: g.nome, url: g.url } }));
      return true;
    } catch (e) {
      toastError(e, "Não foi possível gravar a imagem.");
      return false;
    } finally {
      setImagemAGravar("");
    }
  }

  /** Muda a entidade responsável (Gold). Com o curso gravado, grava logo. */
  async function mudarEntidade(id: number | null) {
    setEntidadeId(id);
    if (cursoId == null || regime !== "gold") return;
    try {
      await apiEditarCursoGold(cursoId, { entidadeResponsavelId: id });
      invalidar(`cursos:${regime}`);
      toastOk(id ? "Entidade responsável definida." : "Entidade responsável retirada.");
    } catch (e) {
      toastError(e, "Não foi possível mudar a entidade.");
    }
  }

  const erroCarregar = cursoRes.erro ?? fichaRes.erro;
  return {
    regime, cursoId, data, patch, patchAv, criterios, mudarCriterios, entidadeId, mudarEntidade,
    falhas, erro, gravando, alterado, tab, setTab, guardar, carregarImagem, imagemAGravar,
    turmas, pronto, carregado, erroCarregar, recarregar: () => { cursoRes.recarregar(); fichaRes.recarregar(); },
  };
}
