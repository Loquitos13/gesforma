// Módulos (ou UFCD) de cada curso, com horas e número de conteúdos.
import { useMemo, useState } from "react";
import { apiCatalogo, type ItemCatalogo } from "../../../partilhado/api/catalogos";
import { apiCursosFin, apiCursosGold } from "../../../partilhado/api/cursos";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, PageHeader, Estado, cx, useFiltrosUrl } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { CatalogoTabela, chaveCatalogo, type ConfigCatalogo } from "./CatalogoTabela";

const txt = (v: unknown) => String(v ?? "");

/** Próximo código livre no curso: mantém o prefixo dos módulos que já existem (M, U, EX…), ou "M". */
export function proximoCodigo(itens: ItemCatalogo[], curso: string) {
  const doCurso = itens.filter(m => txt(m.curso) === curso);
  const prefixo = txt(doCurso[0]?.codigo).match(/^[A-Za-z]+/)?.[0] ?? "M";
  const numeros = doCurso.map(m => Number(txt(m.codigo).match(/\d+/)?.[0] ?? 0)).filter(n => Number.isFinite(n));
  return `${prefixo}${(numeros.length ? Math.max(...numeros) : 0) + 1}`;
}

/** Aplica o curso vindo da ficha do curso ao filtro do URL, antes do primeiro desenho. */
function usarCursoInicial(curso: string | undefined) {
  useState(() => {
    if (!curso) return null;
    const q = new URLSearchParams(window.location.search);
    if (!q.get("curso")) {
      q.set("curso", curso);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}`);
    }
    return null;
  });
}

export default function Modulos({ view, params }: VistaProps) {
  const regime = view.startsWith("fin-") ? "fin" : "gold";
  usarCursoInicial(params.cursoNome);
  const cursos = useOpcoes("cursos", { regime });
  const tipos = useOpcoes("lista", { lista: "tipos_modulo" });

  const config = useMemo((): ConfigCatalogo => ({
    kind: "modulos", regime, singular: "módulo", plural: "módulos", campoEstado: "estado",
    capacidade: regime === "gold" ? "cursos.editar" : "cursosFin.editar",
    rotulo: i => `${txt(i.codigo)} · ${txt(i.nome)}`,
    pesquisa: i => `${txt(i.codigo)} ${txt(i.nome)} ${txt(i.curso)}`,
    filtros: [{ chave: "curso", rotulo: "Curso", vazio: regime === "gold" ? "Todos os cursos" : "Todas as UFCD", opcoes: cursos.selecao }],
    novo: f => ({ curso: f.curso ?? "", horas: "", tipo: "" }),
    campos: [
      { chave: "curso", rotulo: regime === "gold" ? "Curso" : "Curso / UFCD", tipo: "opcoes", opcoes: cursos.selecao, obrigatorio: true },
      { chave: "codigo", rotulo: "Código", metade: true, ajuda: "Vazio: gera o próximo (M1, M2…)." },
      { chave: "horas", rotulo: "Horas", tipo: "numero", metade: true, obrigatorio: true },
      { chave: "nome", rotulo: "Nome do módulo", obrigatorio: true },
      { chave: "tipo", rotulo: "Tipo", tipo: "opcoes", opcoes: tipos.selecao },
    ],
    completar: (v, itens) => (txt(v.codigo).trim() ? v : { ...v, codigo: proximoCodigo(itens, txt(v.curso)) }),
    validar: (v, itens, id) => {
      if (Number(v.horas) <= 0) return "As horas têm de ser maiores que zero.";
      const repetido = itens.some(m => m.id !== id && txt(m.curso) === txt(v.curso) && txt(m.codigo).toLowerCase() === txt(v.codigo).trim().toLowerCase());
      return repetido ? "Já existe um módulo com esse código neste curso." : null;
    },
    colunas: [
      { id: "codigo", titulo: "Código", largura: "90px", celula: i => <span className="font-semibold">{txt(i.codigo)}</span> },
      { id: "nome", titulo: "Módulo", principal: true, celula: i => txt(i.nome) },
      { id: "curso", titulo: "Curso", esconderMovel: true, celula: i => <span className="block max-w-[180px] truncate text-tinta-suave" title={txt(i.curso)}>{txt(i.curso)}</span> },
      { id: "tipo", titulo: "Tipo", esconderMovel: true, celula: i => (i.tipo ? <Estado tom="info">{txt(i.tipo)}</Estado> : "—") },
      { id: "horas", titulo: "Horas", alinhar: "dir", celula: i => `${Number(i.horas ?? 0)} h` },
    ],
    nota: f => <ResumoHoras regime={regime} curso={f.curso ?? ""} />,
  }), [regime, cursos.selecao, tipos.selecao]);

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "gold" ? "Gold" : "Financiada" }, { rotulo: "Edição de cursos" }, { rotulo: "Módulos" }]}
        titulo="Módulos"
        subtitulo="O percurso de cada curso. Os conteúdos, o cronograma e a avaliação por módulo usam estes códigos."
      />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
        <NavCursos regime={regime} cursos={cursos.selecao} />
        <div className="min-w-0"><CatalogoTabela config={config} /></div>
      </div>
    </div>
  );
}

/** Soma das horas dos módulos do curso filtrado, comparada com as horas do curso. */
function ResumoHoras({ regime, curso }: { regime: "gold" | "fin"; curso: string }) {
  const modulos = useRecurso(chaveCatalogo("modulos", regime), signal => apiCatalogo("modulos", regime, signal));
  const cursos = useRecurso<{ cursos: { horas: number; nome?: string; nomeComercial?: string; ufcd?: string }[] }>(
    `cursos:${regime}:{}`,
    signal => (regime === "gold" ? apiCursosGold({}, signal) : apiCursosFin({}, signal)),
  );
  if (!curso || !modulos.dados || !cursos.dados) return null;
  const soma = modulos.dados.itens.filter(m => txt(m.curso) === curso && !/^inactiv|^inativ/i.test(txt(m.estado))).reduce((a, m) => a + Number(m.horas ?? 0), 0);
  const alvo = cursos.dados.cursos.find(c => c.nome === curso || c.nomeComercial === curso || c.ufcd === curso)?.horas ?? 0;
  if (!alvo) return null;
  const tom = soma === alvo ? "sucesso" : soma > alvo ? "perigo" : "aviso";
  return (
    <Aviso tom={tom}>
      Os módulos activos de «{curso}» somam <strong>{soma} h</strong> de <strong>{alvo} h</strong> do curso.
      {soma < alvo ? ` Faltam ${alvo - soma} h.` : soma > alvo ? ` Passam ${soma - alvo} h.` : " Está completo."}
    </Aviso>
  );
}

/** Lista de cursos à esquerda (como no canvas): escolhe o curso do filtro e mostra quantos módulos tem. */
function NavCursos({ regime, cursos }: { regime: "gold" | "fin"; cursos: { valor: string; rotulo: string }[] }) {
  const [f, setF] = useFiltrosUrl({ curso: "" });
  const modulos = useRecurso(chaveCatalogo("modulos", regime), signal => apiCatalogo("modulos", regime, signal));
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of modulos.dados?.itens ?? []) m.set(txt(i.curso), (m.get(txt(i.curso)) ?? 0) + 1);
    return m;
  }, [modulos.dados]);
  const total = modulos.dados?.itens.length ?? 0;
  const itens = [{ valor: "", rotulo: regime === "gold" ? "Todos os cursos" : "Todas as UFCD" }, ...cursos];
  return (
    <nav aria-label="Cursos" className="bg-superficie border border-linha rounded-cartao p-2 lg:sticky lg:top-4">
      <p className="m-0 mx-2.5 mt-1.5 mb-2 text-xs font-semibold text-tinta-suave">{regime === "gold" ? "Curso" : "Curso / UFCD"}</p>
      {itens.map(c => {
        const ativo = f.curso === c.valor;
        const n = c.valor ? contagem.get(c.valor) ?? 0 : total;
        return (
          <button key={c.valor || "todos"} type="button" aria-pressed={ativo} onClick={() => setF({ curso: c.valor })}
            className={cx("num w-full flex items-center gap-2 px-2.5 py-2 rounded-controlo text-left text-[13px]", ativo ? "bg-acao-suave text-tinta font-semibold" : "text-tinta hover:bg-fundo")}>
            <span className="flex-1 min-w-0 truncate">{c.rotulo}</span>
            <span className="text-xs text-tinta-suave">{n}</span>
          </button>
        );
      })}
    </nav>
  );
}
