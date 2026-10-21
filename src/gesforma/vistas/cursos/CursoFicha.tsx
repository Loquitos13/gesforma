// Ficha do curso (Gold ou Financiada): página pública, oferta, programa, avaliação, documentos e dossiê.
import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { Aviso, Botao, ErroCarregar, Esqueleto, PageHeader, Separadores } from "../../../partilhado/ui";
import { ConteudosMoodle } from "../../ConteudosMoodle";
import { CursoDocumentos } from "../../CursoDocumentos";
import { DtpModeloEditor } from "../../DtpModeloEditor";
import type { VistaProps } from "../../shell/tipos";
import { TABS } from "./ficha/modelo";
import { PreviewSite, TabPublicacao } from "./ficha/PreviewSite";
import { TabAvaliacao } from "./ficha/TabAvaliacao";
import { TabIdentidade } from "./ficha/TabIdentidade";
import { TabOferta } from "./ficha/TabOferta";
import { TabConteudo, TabPlanos, TabPrograma } from "./ficha/TabTextos";
import { useFichaCurso } from "./ficha/useFichaCurso";
import { rotuloCodigoCurso } from "../../../partilhado/codigoCurso";

const CLASSE_ENTRADA = "w-full h-10 px-3 text-sm rounded-controlo border border-linha-forte bg-superficie text-tinta focus:outline-none focus:ring-2 focus:ring-ligacao";

export default function CursoFicha({ view, params, navigate }: VistaProps) {
  const regime = view === "fin-curso-ficha" ? "fin" : "gold";
  const pode = usePode();
  const podeEditar = pode(regime === "gold" ? "cursos.editar" : "cursosFin.editar");
  const lista = regime === "gold" ? "gold-cursos" : "fin-cursos";
  const f = useFichaCurso(regime, params.cursoId, id => navigate({ view, cursoId: id }));
  const [verSite, setVerSite] = useState(false);
  const { data, tab, setTab, pronto } = f;

  const titulo = data.titulo || (params.cursoId === "new" || params.cursoId == null ? (regime === "fin" ? "Nova UFCD" : "Novo curso") : "Curso");
  const meta = [regime === "fin" ? (data.ufcdCod ? `${rotuloCodigoCurso(data.ufcdCod)}` : "") : data.tipo, data.horas ? `${data.horas} h` : "", data.regime].filter(Boolean).join(" · ");

  function mudarTab(id: typeof tab) {
    const def = TABS.find(t => t.id === id);
    if (def?.precisaId && f.cursoId == null) void f.guardar({ rascunho: true });
    setTab(id);
    setVerSite(false);
  }

  if (f.erroCarregar) return <ErroCarregar erro={f.erroCarregar} onTentar={f.recarregar} />;

  return (
    <div className="space-y-4">
      <PageHeader
        trilho={[
          { rotulo: regime === "gold" ? "Gold" : "Financiada" },
          { rotulo: regime === "gold" ? "Cursos Gold" : "Cursos financiados", onClick: () => navigate(lista) },
          { rotulo: titulo },
        ]}
        titulo={titulo}
        subtitulo={meta || "Preencha a identidade e a oferta para criar o curso."}
        acoes={(
          <>
            <div className="hidden min-w-[160px] sm:block" aria-label={`Página pronta a ${pronto.pct}%`}>
              <div className="mb-1 flex justify-between text-[11px]"><span className="text-tinta-suave">Pronto para o site</span><span className="num font-semibold">{pronto.pct}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-linha-suave"><div className={`h-full rounded-full ${pronto.pct === 100 ? "bg-sucesso" : "bg-acao"}`} style={{ width: `${pronto.pct}%` }} /></div>
            </div>
            {data.titulo && (
              <Botao variante="secundario" onClick={() => navigate({ view: regime === "gold" ? "gold-modulos" : "fin-modulos", cursoNome: data.titulo })}>Módulos</Botao>
            )}
            <Botao variante="secundario" className="xl:hidden" onClick={() => setVerSite(v => !v)}>{verSite ? "Editar" : "Ver página"}</Botao>
            {podeEditar && (
              <Botao variante="primario" aCarregar={f.gravando} onClick={() => void f.guardar()}>{f.alterado || f.cursoId == null ? "Guardar" : "Guardado"}</Botao>
            )}
          </>
        )}
      />
      {f.erro && <Aviso tom="perigo">{f.erro}</Aviso>}
      {!podeEditar && <Aviso tom="info">Pode consultar esta ficha, mas não alterá-la com o seu perfil.</Aviso>}
      <Separadores rotulo="Secções da ficha" itens={TABS.map(t => ({ id: t.id, rotulo: t.rotulo }))} ativo={tab} onMudar={mudarTab} />

      {!f.carregado ? <Esqueleto linhas={8} /> : (
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div className={`min-w-0 flex-1 ${verSite ? "hidden xl:block" : ""}`}>
            <fieldset disabled={!podeEditar} className="m-0 min-w-0 border-0 p-0">
              {tab === "identidade" && <TabIdentidade f={f} />}
              {tab === "oferta" && <TabOferta f={f} />}
              {tab === "conteudo" && <TabConteudo f={f} />}
              {tab === "programa" && <TabPrograma f={f} />}
              {tab === "moodle" && (
                <div className="space-y-4">
                  <Aviso tom="info" titulo="Integração com o Moodle em pausa">Pode planear os conteúdos de cada módulo; a publicação no Moodle está suspensa.</Aviso>
                  <ConteudosMoodle
                    accent={regime}
                    organizacao={data.organizacaoPrograma}
                    modulos={data.topicosPrograma}
                    conteudos={data.conteudosMoodle}
                    inputCls={CLASSE_ENTRADA}
                    onChange={conteudosMoodle => f.patch({ conteudosMoodle })}
                    onIrPrograma={() => setTab("programa")}
                    cursoId={f.cursoId}
                    cursoTitulo={data.titulo}
                  />
                </div>
              )}
              {tab === "planos" && <TabPlanos f={f} />}
              {tab === "avaliacao" && <TabAvaliacao f={f} />}
              {tab === "documentos" && <CursoDocumentos accent={regime} cursoId={f.cursoId} tipo={data.tipo} />}
              {tab === "dtp" && <DtpModeloEditor key={`${f.cursoId ?? "novo"}-${f.entidadeId ?? "nenhuma"}`} accent={regime} cursoId={f.cursoId} />}
              {tab === "publicacao" && <TabPublicacao f={f} />}
            </fieldset>
          </div>
          <aside className={`w-full shrink-0 xl:sticky xl:top-4 xl:w-[380px] ${verSite ? "" : "hidden xl:block"}`} aria-label="Pré-visualização da página do curso">
            <PreviewSite f={f} />
          </aside>
        </div>
      )}
    </div>
  );
}
