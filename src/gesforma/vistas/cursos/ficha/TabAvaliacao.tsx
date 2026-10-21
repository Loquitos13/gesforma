import { useState } from "react";
import { Aviso, Botao, Caixa, Campo, Cartao, Entrada, Separadores, Vazio } from "../../../../partilhado/ui";
import { AvaliacaoCcpEditor } from "../../../AvaliacaoCcpEditor";
import { fracoesPeso, novoParametroId } from "../../../avaliacaoCurso";
import { ImportarCsvAvaliacao } from "../../../ImportarCsvAvaliacao";
import { cursoTemFolhaSimulacao, slugify } from "./modelo";
import type { FichaCurso } from "./useFichaCurso";

// Classes do sistema visual para os editores antigos que recebem estilos por propriedade.
const CLASSE_ACAO = "bg-acao hover:bg-acao-forte !text-tinta";
const CLASSE_ENTRADA = "w-full h-10 px-3 text-sm rounded-controlo border border-linha-forte bg-superficie text-tinta focus:outline-none focus:ring-2 focus:ring-ligacao";

const ESCALAS = [
  { rotulo: "0 a 20 valores", escalaMin: 0, escalaMax: 20, unidade: "valores", minimoAprovacao: 10 },
  { rotulo: "0 a 100 %", escalaMin: 0, escalaMax: 100, unidade: "%", minimoAprovacao: 50 },
  { rotulo: "1 a 5 pontos", escalaMin: 1, escalaMax: 5, unidade: "pontos", minimoAprovacao: 3 },
];

export function TabAvaliacao({ f }: { f: FichaCurso }) {
  const { data, patchAv, regime, criterios, mudarCriterios } = f;
  const av = data.avaliacaoCurso;
  const ccp = av.estrutura === "ccp";
  const unidadePrograma = data.organizacaoPrograma === "livre" ? "capítulo" : "módulo";
  const [novoCriterio, setNovoCriterio] = useState("");
  const pesos = fracoesPeso(av);

  function juntarCriterio() {
    const label = novoCriterio.trim();
    if (!label) return;
    let id = slugify(label) || "criterio";
    for (let n = 2; criterios.some(c => c.id === id); n += 1) id = `${slugify(label)}-${n}`;
    mudarCriterios([...criterios, { id, label }]);
    setNovoCriterio("");
  }

  return (
    <div className="space-y-4">
      <Cartao
        titulo="Parâmetros de avaliação"
        subtitulo={ccp
          ? "No CCP a escala vale para todos os instrumentos. A nota final calcula-se a partir do e-learning, das simulações e do projeto."
          : "A avaliação é por formando e todos os parâmetros têm de ser preenchidos. O formador lança as notas nesta grelha."}
      >
        <div className="space-y-4">
          {!ccp && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="m-0 mb-1 text-[13px] font-medium">Modo</p>
                <Separadores
                  rotulo="Modo de avaliação"
                  estilo="pilula"
                  itens={[{ id: "final", rotulo: "Avaliação final" }, { id: "modulos", rotulo: unidadePrograma === "capítulo" ? "Por capítulo" : "Por módulo" }]}
                  ativo={av.modo}
                  onMudar={modo => patchAv({ modo })}
                />
                <p className="m-0 mt-1 text-xs text-tinta-suave">
                  {av.modo === "modulos" ? `Nota de cada ${unidadePrograma} = soma (nota × peso); nota final = média.` : "Cada parâmetro avalia-se uma vez; nota final = soma (nota × peso)."}
                </p>
              </div>
              <Campo rotulo="Unidade da escala" ajuda="Ex.: valores, %, pontos.">{p => <Entrada {...p} value={av.unidade} onChange={e => patchAv({ unidade: e.target.value })} />}</Campo>
            </div>
          )}
          {ccp && <Campo rotulo="Unidade da escala">{p => <Entrada {...p} value={av.unidade} onChange={e => patchAv({ unidade: e.target.value })} />}</Campo>}
          <div className="grid grid-cols-3 gap-3">
            <Campo rotulo="Mínimo">{p => <Entrada {...p} type="number" value={av.escalaMin} onChange={e => patchAv({ escalaMin: Number(e.target.value) })} />}</Campo>
            <Campo rotulo="Máximo">{p => <Entrada {...p} type="number" value={av.escalaMax} onChange={e => patchAv({ escalaMax: Number(e.target.value) })} />}</Campo>
            <Campo rotulo="Aprovação a partir de">{p => <Entrada {...p} type="number" value={av.minimoAprovacao} onChange={e => patchAv({ minimoAprovacao: Number(e.target.value) })} />}</Campo>
          </div>
          {av.minimoAprovacao < av.escalaMin || av.minimoAprovacao > av.escalaMax ? (
            <Aviso tom="aviso">O mínimo de aprovação está fora da escala.</Aviso>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {ESCALAS.map(({ rotulo, ...e }) => <Botao key={rotulo} tamanho="sm" variante="secundario" onClick={() => patchAv(e)}>{rotulo}</Botao>)}
          </div>

          {!ccp && (
            <>
              <Caixa rotulo="Pesos iguais" ajuda="Cada parâmetro vale o mesmo. Desligue para dar um peso a cada um."
                checked={av.pesosEquitativos} onChange={e => patchAv({ pesosEquitativos: e.target.checked })} />
              {av.parametros.length === 0 && <Vazio compacto titulo="Ainda não há parâmetros." descricao="Ex.: Assiduidade, Trabalho prático, Teste." />}
              <ul className="m-0 list-none space-y-2 p-0">
                {av.parametros.map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">
                    <span className="num w-5 text-xs text-tinta-suave">{i + 1}</span>
                    <Entrada aria-label={`Parâmetro ${i + 1}`} className="min-w-[10rem] flex-1" value={p.label} placeholder="Nome do parâmetro"
                      onChange={e => patchAv({ parametros: av.parametros.map(x => (x.id === p.id ? { ...x, label: e.target.value } : x)) })} />
                    <Entrada aria-label="Peso" className="w-24" type="number" min={0} step="0.1" disabled={av.pesosEquitativos} value={p.peso}
                      onChange={e => patchAv({ parametros: av.parametros.map(x => (x.id === p.id ? { ...x, peso: Number(e.target.value) || 0 } : x)) })} />
                    <span className="num w-12 text-right text-xs text-tinta-suave">{Math.round((pesos[p.id] ?? 0) * 100)}%</span>
                    <Botao tamanho="sm" variante={p.moodle ? "primario" : "secundario"} aria-pressed={Boolean(p.moodle)}
                      onClick={() => patchAv({ parametros: av.parametros.map(x => ({ ...x, moodle: !p.moodle && x.id === p.id })) })}>
                      {p.moodle ? "Nota do Moodle" : "Marcar Moodle"}
                    </Botao>
                    <Botao tamanho="sm" variante="fantasma" onClick={() => patchAv({ parametros: av.parametros.filter(x => x.id !== p.id) })}>Remover</Botao>
                  </li>
                ))}
              </ul>
              {av.parametros.some(p => p.moodle) && (
                <Aviso tom="info">A integração com o Moodle está em pausa: a turma lança este valor à mão.</Aviso>
              )}
              <Botao variante="secundario" tamanho="sm" onClick={() => patchAv({ parametros: [...av.parametros, { id: novoParametroId(), label: "", peso: 1 }] })}>Acrescentar parâmetro</Botao>
            </>
          )}
        </div>
      </Cartao>

      {!ccp && (
        <ImportarCsvAvaliacao
          modo={av.modo}
          unidade={unidadePrograma}
          saveClass={CLASSE_ACAO}
          onAplicar={parametros => patchAv({ parametros, pesosEquitativos: parametros.length > 0 && parametros.every(p => p.peso === parametros[0]?.peso) })}
        />
      )}
      {ccp && av.ccp && (
        <AvaliacaoCcpEditor
          ccp={av.ccp}
          topicos={data.topicosPrograma}
          cursoNome={data.titulo}
          escalaMin={av.escalaMin}
          escalaMax={av.escalaMax}
          accent={regime}
          saveClass={CLASSE_ACAO}
          inputClass={CLASSE_ENTRADA}
          onChange={c => patchAv({ ccp: c, estrutura: "ccp" })}
        />
      )}

      {cursoTemFolhaSimulacao(data, regime) && (
        <Cartao titulo="Folha de simulação (escala 1 a 5)" subtitulo={regime === "fin"
          ? "Critérios das entregas práticas desta UFCD. Não entram na pauta ponderada acima."
          : "Folha de observação das simulações, anexada aos documentos da turma."}>
          {criterios.length === 0 && <Vazio compacto titulo="Ainda não há critérios." />}
          <ol className="m-0 list-none space-y-2 p-0">
            {criterios.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="num w-5 text-xs text-tinta-suave">{i + 1}</span>
                <Entrada aria-label={`Critério ${i + 1}`} value={c.label} onChange={e => mudarCriterios(criterios.map(x => (x.id === c.id ? { ...x, label: e.target.value } : x)))} />
                <Botao tamanho="sm" variante="fantasma" onClick={() => mudarCriterios(criterios.filter(x => x.id !== c.id))}>Remover</Botao>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <Entrada aria-label="Novo critério" value={novoCriterio} placeholder="Novo critério (ex.: Gestão do tempo)" onChange={e => setNovoCriterio(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); juntarCriterio(); } }} />
            <Botao variante="secundario" onClick={juntarCriterio}>Acrescentar</Botao>
          </div>
        </Cartao>
      )}
    </div>
  );
}
