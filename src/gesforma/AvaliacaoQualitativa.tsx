// Ficha individual de avaliação da aprendizagem (qualitativa): as competências a adquirir (da turma) e, por formando,
// três critérios de 1 a 5 com o comentário do formador. Cada ficha imprime-se para o dossiê (ou todas de uma vez).
import { useEffect, useState } from "react";
import {
  apiAvaliacaoQualitativa, apiGravarCompetencias, apiGravarFichaQualitativa, apiPdfAvaliacaoQualitativa,
  type CriterioQualitativo, type FichaQualitativa, type Regime,
} from "../partilhado/api/pedagogia";
import { useRecurso } from "../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../partilhado/toastBus";
import { AreaTexto, Botao, Campo, Cartao, ErroCarregar, Esqueleto, Estado, Modal, cx } from "../partilhado/ui";

const CRITERIOS = [
  { id: "aquisicao", titulo: "Aquisição de competências (saber e saber fazer)", esquerda: "Não adquiriu as competências desejadas", direita: "Adquiriu as competências desejadas" },
  { id: "autonomiaAprendizagens", titulo: "Autonomia na realização das aprendizagens", esquerda: "Não conseguiu autonomia", direita: "Conseguiu autonomia" },
  { id: "autonomiaProblemas", titulo: "Autonomia na resolução de problemas", esquerda: "Não conseguiu autonomia", direita: "Conseguiu autonomia" },
] as const;
type IdCriterio = (typeof CRITERIOS)[number]["id"];

const preenchida = (f: FichaQualitativa | undefined) => Boolean(f && CRITERIOS.every(c => f[c.id]?.nivel != null));

export function AvaliacaoQualitativa({ regime, turmaId, formandos }: { regime: Regime; turmaId: number; formandos: { id: number; nome: string }[] }) {
  const chave = `cockpit:${regime}:${turmaId}:avaliacao-qualitativa`;
  const { dados, erro, recarregar } = useRecurso(chave, s => apiAvaliacaoQualitativa(regime, turmaId, s));
  const [competencias, setCompetencias] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [aberto, setAberto] = useState<{ id: number; nome: string } | null>(null);
  const [aImprimir, setAImprimir] = useState<number | "todas" | null>(null);
  useEffect(() => { if (dados) setCompetencias(dados.competencias); }, [dados]);

  async function gravarCompetencias() {
    setAGravar(true);
    try { await apiGravarCompetencias(regime, turmaId, competencias); toastOk("Competências gravadas."); recarregar(); }
    catch (e) { toastError(e, "Não foi possível gravar."); }
    finally { setAGravar(false); }
  }
  async function imprimir(id?: number) {
    setAImprimir(id ?? "todas");
    try { await apiPdfAvaliacaoQualitativa(regime, turmaId, id); } catch (e) { toastError(e, "Não foi possível gerar a ficha."); } finally { setAImprimir(null); }
  }

  const feitas = formandos.filter(f => preenchida(dados?.formandos[f.id])).length;
  return (
    <Cartao titulo="Ficha individual de avaliação (qualitativa)" subtitulo={`${feitas}/${formandos.length} preenchidas · uma página por formando para o dossiê`}
      acoes={<Botao tamanho="sm" disabled={!formandos.length} aCarregar={aImprimir === "todas"} onClick={() => void imprimir()}>Imprimir todas</Botao>}>
      {erro && !dados ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !dados ? <Esqueleto linhas={4} /> : (
        <div className="space-y-4">
          <Campo rotulo="Competências a adquirir (iguais para todos os formandos)" ajuda="Os objectivos/competências que o formando deveria adquirir nesta UFCD.">
            {p => <AreaTexto {...p} rows={3} maxLength={4000} value={competencias} onChange={e => setCompetencias(e.target.value)} />}
          </Campo>
          <div className="flex justify-end">
            <Botao tamanho="sm" variante="secundario" disabled={competencias === dados.competencias} aCarregar={aGravar} onClick={() => void gravarCompetencias()}>Gravar competências</Botao>
          </div>
          <ul className="m-0 list-none divide-y divide-linha-suave rounded-controlo border border-linha p-0">
            {formandos.length === 0 && <li className="px-4 py-3 text-sm text-tinta-suave">Ainda sem formandos nesta turma.</li>}
            {formandos.map((f, i) => {
              const ficha = dados.formandos[f.id];
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-right text-xs text-tinta-suave num">{i + 1}</span>
                  <span className="min-w-[10rem] flex-1 text-sm text-tinta">{f.nome}</span>
                  <Estado tom={preenchida(ficha) ? "sucesso" : "aviso"}>{preenchida(ficha) ? "Preenchida" : "Por preencher"}</Estado>
                  <Botao tamanho="sm" variante="primario" onClick={() => setAberto(f)}>{ficha ? "Editar avaliação" : "Avaliar"}</Botao>
                  <Botao tamanho="sm" aCarregar={aImprimir === f.id} onClick={() => void imprimir(f.id)}>Imprimir ficha</Botao>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <FichaModal regime={regime} turmaId={turmaId} formando={aberto} ficha={aberto ? dados?.formandos[aberto.id] : undefined}
        onFechar={() => setAberto(null)} onGravado={() => { setAberto(null); recarregar(); }} />
    </Cartao>
  );
}

function FichaModal({ regime, turmaId, formando, ficha, onFechar, onGravado }: {
  regime: Regime; turmaId: number; formando: { id: number; nome: string } | null; ficha: FichaQualitativa | undefined;
  onFechar: () => void; onGravado: () => void;
}) {
  const vazio = (): Record<IdCriterio, CriterioQualitativo> => ({
    aquisicao: { nivel: null, texto: "" }, autonomiaAprendizagens: { nivel: null, texto: "" }, autonomiaProblemas: { nivel: null, texto: "" },
  });
  const [valores, setValores] = useState(vazio);
  const [aGravar, setAGravar] = useState(false);
  useEffect(() => {
    if (!formando) return;
    const v = vazio();
    for (const c of CRITERIOS) if (ficha?.[c.id]) v[c.id] = { nivel: ficha[c.id]!.nivel ?? null, texto: ficha[c.id]!.texto ?? "" };
    setValores(v);
  }, [formando, ficha]); // eslint-disable-line react-hooks/exhaustive-deps

  async function gravar() {
    if (!formando) return;
    setAGravar(true);
    try { await apiGravarFichaQualitativa(regime, turmaId, formando.id, valores); toastOk("Avaliação gravada."); onGravado(); }
    catch (e) { toastError(e, "Não foi possível gravar a avaliação."); }
    finally { setAGravar(false); }
  }
  const mudar = (id: IdCriterio, parte: Partial<CriterioQualitativo>) => setValores(v => ({ ...v, [id]: { ...v[id], ...parte } }));

  return (
    <Modal aberto={Boolean(formando)} onFechar={onFechar} largura="lg" titulo="Avaliação da aprendizagem" subtitulo={formando?.nome}
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={aGravar} onClick={() => void gravar()}>Gravar</Botao></>}>
      <div className="space-y-5">
        {CRITERIOS.map(c => (
          <fieldset key={c.id} className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-tinta">{c.titulo}</legend>
            <div className="flex flex-wrap items-center gap-3 text-xs text-tinta-suave">
              <span className="min-w-[8rem] flex-1 text-right">{c.esquerda}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={c.titulo}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" role="radio" aria-checked={valores[c.id].nivel === n} onClick={() => mudar(c.id, { nivel: n })}
                    className={cx("h-8 w-8 rounded-controlo border text-sm font-bold", valores[c.id].nivel === n ? "border-tinta bg-tinta text-white" : "border-linha-forte bg-superficie text-tinta hover:bg-fundo")}>{n}</button>
                ))}
              </div>
              <span className="min-w-[8rem] flex-1">{c.direita}</span>
            </div>
            <AreaTexto aria-label={`Comentário: ${c.titulo}`} className="mt-2" rows={3} maxLength={4000} placeholder="Comentário do formador"
              value={valores[c.id].texto} onChange={e => mudar(c.id, { texto: e.target.value })} />
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}
