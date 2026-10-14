// Catálogo de cursos (Gold) e de UFCD (Financiada), com o uso de cada curso contado no servidor.
import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiApagarCurso, apiCursosFin, apiCursosGold, type CursoFin, type CursoGold, type UsoCurso } from "../../../partilhado/api/cursos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ConfirmarPerigo, ErroCarregar, Estado, Filtros, MenuLinha, PageHeader, Tabela, Vazio, eur, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";

type Linha = (CursoGold | CursoFin) & { uso: UsoCurso };

const ativo = (estado: string) => !/^(inactiv|inativ)/i.test(estado);
const nomeDe = (c: Linha) => ("nome" in c ? c.nome : c.nomeComercial || c.ufcd);

export default function Cursos({ view, navigate }: VistaProps) {
  const regime = view.startsWith("fin-") ? "fin" : "gold";
  const pode = usePode();
  const podeEditar = pode(regime === "gold" ? "cursos.editar" : "cursosFin.editar");
  const podeApagar = pode(regime === "gold" ? "cursos.apagar" : "cursosFin.editar");
  const [f, setF, limpar] = useFiltrosUrl({ q: "", estado: "", categoria: "", tipo: "", modalidade: "", ordem: "" });
  const chave = `cursos:${regime}:${JSON.stringify(f)}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso<{ cursos: Linha[]; resumo: { total: number; ativos: number; comTurmas: number } }>(
    chave,
    signal => (regime === "gold" ? apiCursosGold(f, signal) : apiCursosFin(f, signal)),
  );
  const categorias = useOpcoes("lista", { lista: regime === "gold" ? "categorias_gold" : "areas_fin" });
  const tipos = useOpcoes("lista", { lista: "tipos_curso" });
  const modalidades = useOpcoes("lista", { lista: "regimes_curso" });
  const [apagar, setApagar] = useState<Linha | null>(null);
  const apagarAccao = useAccao((id: number) => apiApagarCurso(regime, id), { ok: "Curso eliminado.", invalidar: ["cursos:", "opcoes:cursos"] });

  const abrir = (id: number | "new") => navigate({ view: regime === "gold" ? "gold-curso-ficha" : "fin-curso-ficha", cursoId: id });
  const linhas = dados?.cursos ?? [];
  const nFiltros = [f.q, f.estado, f.categoria, f.tipo, f.modalidade].filter(Boolean).length;

  const colunas: Coluna<Linha>[] = [
    ...(regime === "fin" ? [{ id: "ufcd", titulo: "UFCD", largura: "90px", ordenavel: true, celula: (c: Linha) => <Estado tom="info">{"ufcdCod" in c ? c.ufcdCod : ""}</Estado> }] : []),
    {
      id: "nome", titulo: regime === "gold" ? "Curso" : "Nome comercial", principal: true, ordenavel: true,
      celula: c => (
        <span className="flex flex-col">
          <span className="font-semibold text-ligacao">{nomeDe(c)}</span>
          <span className="text-xs text-tinta-fraca">#{c.id} · {"categoria" in c ? c.categoria : "ufcd" in c ? c.ufcd : ""}</span>
        </span>
      ),
    },
    ...(regime === "gold" ? [{ id: "tipo", titulo: "Tipo", esconderMovel: true, celula: (c: Linha) => ("tipo" in c && c.tipo ? <Estado tom={c.tipo === "Gold" ? "acao" : "info"}>{c.tipo}</Estado> : "") }] : []),
    { id: "modalidade", titulo: "Modalidade", esconderMovel: true, celula: c => c.regime },
    { id: "horas", titulo: "Horas", alinhar: "dir", ordenavel: true, celula: c => `${c.horas} h` },
    ...(regime === "gold" ? [{ id: "preco", titulo: "Preço", alinhar: "dir" as const, ordenavel: true, celula: (c: Linha) => ("preco" in c ? eur(c.preco) : "") }] : []),
    {
      id: "turmas", titulo: "Turmas abertas", alinhar: "dir", ordenavel: true,
      celula: c => <span className={c.uso.turmasAbertas ? "font-semibold" : "text-tinta-fraca"}>{c.uso.turmasAbertas}</span>,
    },
    { id: "formandos", titulo: "Formandos", alinhar: "dir", esconderMovel: true, celula: c => c.uso.formandos },
    {
      id: "estado", titulo: "Site", ordenavel: true,
      celula: c => <Estado tom={ativo(c.estado) ? "sucesso" : "neutro"} ponto>{ativo(c.estado) ? "Publicado" : "Inactivo"}</Estado>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "gold" ? "Gold" : "Financiada" }, { rotulo: "Edição de cursos" }, { rotulo: "Cursos" }]}
        titulo={regime === "gold" ? "Cursos Gold" : "Cursos financiados"}
        subtitulo={dados ? `${num(dados.resumo.total)} cursos no catálogo · ${num(dados.resumo.ativos)} publicados no site · ${num(dados.resumo.comTurmas)} com turmas abertas` : "A carregar…"}
        acoes={podeEditar && <Botao variante="primario" onClick={() => abrir("new")}>Novo curso</Botao>}
      />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: regime === "gold" ? "Pesquisar curso ou categoria…" : "Pesquisar UFCD ou nome…" }}
        selecoes={[
          ...(regime === "gold" ? [
            { chave: "categoria", rotulo: "Categoria", vazio: "Todas as categorias", opcoes: categorias.selecao, valor: f.categoria, onMudar: (v: string) => setF({ categoria: v }) },
            { chave: "tipo", rotulo: "Tipo", vazio: "Todos os tipos", opcoes: tipos.selecao, valor: f.tipo, onMudar: (v: string) => setF({ tipo: v }) },
          ] : []),
          { chave: "modalidade", rotulo: "Modalidade", vazio: "Todas as modalidades", opcoes: modalidades.selecao, valor: f.modalidade, onMudar: v => setF({ modalidade: v }) },
          { chave: "estado", rotulo: "Estado", vazio: "Todos", opcoes: [{ valor: "Ativo", rotulo: "Activos" }, { valor: "Inactivo", rotulo: "Inactivos" }], valor: f.estado, onMudar: v => setF({ estado: v }) },
        ]}
        ativos={nFiltros}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : (
        <Cartao semPadding>
          <Tabela
            rotulo={regime === "gold" ? "Cursos Gold" : "Cursos financiados"}
            linhas={linhas}
            colunas={colunas}
            chave={c => c.id}
            ordem={f.ordem}
            onOrdenar={o => setF({ ordem: o })}
            aCarregar={aCarregar}
            onLinha={c => abrir(c.id)}
            acoesLinha={c => (
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="text-[13px] font-semibold text-ligacao hover:underline" onClick={e => { e.stopPropagation(); abrir(c.id); }}>Editar</button>
                <MenuLinha rotulo={`Acções de ${nomeDe(c)}`} acoes={[
                  { rotulo: "Módulos do curso", onClick: () => navigate({ view: regime === "gold" ? "gold-modulos" : "fin-modulos", cursoNome: nomeDe(c) }) },
                  ...(podeApagar ? [{ rotulo: "Eliminar curso", perigo: true, onClick: () => setApagar(c) }] : []),
                ]} />
              </div>
            )}
            vazio={(
              <Vazio
                titulo={nFiltros ? "Nenhum curso corresponde aos filtros." : "Ainda não há cursos."}
                acao={nFiltros ? <Botao variante="secundario" onClick={limpar}>Limpar filtros</Botao>
                  : podeEditar ? <Botao variante="primario" onClick={() => abrir("new")}>Criar o primeiro curso</Botao> : undefined}
              />
            )}
          />
        </Cartao>
      )}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Eliminar curso"
        descricao={apagar ? (apagar.uso.turmasTotal || apagar.uso.formandos || apagar.uso.preinscricoes
          ? `«${nomeDe(apagar)}» tem ${apagar.uso.turmasTotal} turmas, ${apagar.uso.formandos} formandos e ${apagar.uso.preinscricoes} pré-inscrições em aberto. O servidor não deixa apagar um curso em uso: desactive-o na ficha (Publicação).`
          : `«${nomeDe(apagar)}» e a sua página deixam de existir. Esta acção não se desfaz.`) : ""}
        onConfirmar={async () => { if (apagar) { await apagarAccao.correr(apagar.id); setApagar(null); } }}
      />
    </div>
  );
}
