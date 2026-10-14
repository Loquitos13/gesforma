// Separadores de texto da ficha: conteúdo do site, programa e planos de sessão.
import { AreaTexto, Aviso, Botao, Campo, Cartao, Entrada, Estado, Selecao, Vazio } from "../../../../partilhado/ui";
import { codigoTopico, juntarHoras, novoTopicoId, partirHoras, textoPrograma } from "../../../cursoPrograma";
import type { FichaCurso } from "./useFichaCurso";

function BlocoTexto({ rotulo, ajuda, valor, onMudar, linhas = 7 }: { rotulo: string; ajuda: string; valor: string; onMudar: (v: string) => void; linhas?: number }) {
  return (
    <Cartao titulo={rotulo} subtitulo={ajuda} acoes={<Estado tom={valor.trim() ? "sucesso" : "aviso"}>{valor.trim() ? "Preenchido" : "Em falta"}</Estado>}>
      <AreaTexto aria-label={rotulo} rows={linhas} value={valor} onChange={e => onMudar(e.target.value)} placeholder="Este texto aparece na página pública do curso." />
      <p className="num m-0 mt-1 text-right text-xs text-tinta-suave">{valor.trim().length} caracteres</p>
    </Cartao>
  );
}

export function TabConteudo({ f }: { f: FichaCurso }) {
  const { data, patch, regime } = f;
  const gerado = textoPrograma(regime === "fin" ? "modular" : data.organizacaoPrograma, data.topicosPrograma);
  return (
    <div className="space-y-4">
      <Aviso tom="info">Cada bloco é uma secção da página pública. Escreva para o formando, não para a operação interna.</Aviso>
      <BlocoTexto rotulo="Síntese" ajuda="Primeiro parágrafo abaixo do banner: para quem é e o que se leva daqui." valor={data.sintese} onMudar={v => patch({ sintese: v })} />
      <BlocoTexto rotulo="Objetivos" ajuda="O que o formando será capaz de fazer. Uma ideia por linha." valor={data.objetivos} onMudar={v => patch({ objetivos: v })} />
      {gerado ? (
        <Cartao titulo="Programa no site" subtitulo="Gerado a partir do separador Programa, pela mesma ordem.">
          <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-tinta">{gerado}</pre>
        </Cartao>
      ) : (
        <BlocoTexto rotulo="Programa no site" ajuda="Ainda sem módulos. Defina o percurso no separador Programa e este texto passa a ser gerado." valor={data.programa} onMudar={v => patch({ programa: v })} linhas={10} />
      )}
      <BlocoTexto rotulo="Funcionamento" ajuda="Sessões, plataforma, assiduidade e certificado." valor={data.funcionamento} onMudar={v => patch({ funcionamento: v })} />
    </div>
  );
}

function Duracao({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  const p = partirHoras(valor);
  return (
    <div className="flex items-center gap-1">
      <Entrada aria-label="Horas" inputMode="numeric" className="w-16" value={p.horas} placeholder="0" onChange={e => onMudar(juntarHoras(e.target.value, p.minutos))} />
      <span className="text-xs font-semibold text-tinta-suave">h</span>
      <Entrada aria-label="Minutos" inputMode="numeric" className="w-16" value={p.minutos || "00"} onChange={e => onMudar(juntarHoras(p.horas, e.target.value))} />
      <span className="text-xs font-semibold text-tinta-suave">min</span>
    </div>
  );
}

export function TabPrograma({ f }: { f: FichaCurso }) {
  const { data, patch, regime } = f;
  const organizacao = regime === "fin" ? "modular" : data.organizacaoPrograma;
  const unidade = organizacao === "livre" ? "capítulo" : "módulo";
  const mover = (i: number, d: -1 | 1) => {
    const next = [...data.topicosPrograma];
    [next[i + d], next[i]] = [next[i]!, next[i + d]!];
    patch({ topicosPrograma: next });
  };
  const somaMinutos = data.topicosPrograma.reduce((a, t) => { const p = partirHoras(t.horas); return a + (Number(p.horas) || 0) * 60 + (Number(p.minutos) || 0); }, 0);
  const horasCurso = Number(data.horas) || 0;
  return (
    <Cartao titulo="Programa pedagógico" subtitulo="O percurso do curso. Entra no cronograma, na avaliação por módulo e no programa público.">
      <div className="space-y-3">
        {regime === "gold" ? (
          <Campo rotulo="Organização" ajuda="Modular numera M1, M2…; programa livre numera C1, C2… (capítulos).">
            {p => (
              <Selecao {...p} opcoes={[{ valor: "modular", rotulo: "Modular" }, { valor: "livre", rotulo: "Programa livre" }]} value={data.organizacaoPrograma}
                onChange={e => patch({ organizacaoPrograma: e.target.value === "livre" ? "livre" : "modular" })} />
            )}
          </Campo>
        ) : <Aviso tom="info">Os cursos financiados são sempre modulares (M1, M2, M3…).</Aviso>}
        {horasCurso > 0 && data.topicosPrograma.length > 0 && (
          <p className="num m-0 text-[13px] text-tinta-suave">
            Os {unidade}s somam {Math.floor(somaMinutos / 60)} h{somaMinutos % 60 ? ` ${somaMinutos % 60} min` : ""} de {horasCurso} h do curso.
          </p>
        )}
        {data.topicosPrograma.length === 0 && <Vazio compacto titulo={`Ainda não há ${unidade}s.`} descricao="Acrescente o primeiro." />}
        <ol className="m-0 list-none space-y-2 p-0">
          {data.topicosPrograma.map((t, i) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-controlo border border-linha bg-fundo p-2.5">
              <span className="w-10 shrink-0 text-xs font-bold text-tinta-suave">{codigoTopico(organizacao, i)}</span>
              <Entrada aria-label={`Título do ${unidade} ${i + 1}`} className="min-w-[12rem] flex-1" value={t.titulo} placeholder={`Título do ${unidade}`}
                onChange={e => patch({ topicosPrograma: data.topicosPrograma.map(x => (x.id === t.id ? { ...x, titulo: e.target.value } : x)) })} />
              <Duracao valor={t.horas} onMudar={horas => patch({ topicosPrograma: data.topicosPrograma.map(x => (x.id === t.id ? { ...x, horas } : x)) })} />
              <span className="flex gap-1">
                <Botao tamanho="sm" variante="fantasma" soIcone aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</Botao>
                <Botao tamanho="sm" variante="fantasma" soIcone aria-label="Descer" disabled={i === data.topicosPrograma.length - 1} onClick={() => mover(i, 1)}>↓</Botao>
                <Botao tamanho="sm" variante="fantasma" onClick={() => patch({ topicosPrograma: data.topicosPrograma.filter(x => x.id !== t.id) })}>Remover</Botao>
              </span>
            </li>
          ))}
        </ol>
        <Botao variante="secundario" tamanho="sm" onClick={() => patch({ topicosPrograma: [...data.topicosPrograma, { id: novoTopicoId(), titulo: "", horas: "" }] })}>
          Acrescentar {unidade}
        </Botao>
      </div>
    </Cartao>
  );
}

export function TabPlanos({ f }: { f: FichaCurso }) {
  const { data, patch } = f;
  const mudar = (i: number, p: Partial<(typeof data.planosSessao)[number]>) => patch({ planosSessao: data.planosSessao.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <Cartao titulo="Plano de cada sessão" subtitulo="A turma herda este plano pela ordem da sessão, enquanto a sessão não tiver plano próprio.">
      <div className="space-y-3">
        {data.planosSessao.length === 0 && <Vazio compacto titulo="Ainda sem planos." descricao="Acrescente a primeira sessão." />}
        {data.planosSessao.map((linha, i) => (
          <div key={linha.ordem} className="space-y-2 rounded-controlo border border-linha p-3">
            <div className="flex items-center justify-between">
              <p className="m-0 text-[13px] font-semibold">Sessão {linha.ordem}</p>
              <Botao tamanho="sm" variante="fantasma" onClick={() => patch({ planosSessao: data.planosSessao.filter((_, j) => j !== i).map((p, j) => ({ ...p, ordem: j + 1 })) })}>Remover</Botao>
            </div>
            <AreaTexto aria-label="Objetivos gerais" rows={2} placeholder="Objetivos gerais" value={linha.objetivosGerais} onChange={e => mudar(i, { objetivosGerais: e.target.value })} />
            <AreaTexto aria-label="Objetivos específicos" rows={2} placeholder="Objetivos específicos" value={linha.objetivosEspecificos} onChange={e => mudar(i, { objetivosEspecificos: e.target.value })} />
            <AreaTexto aria-label="Conteúdo do desenvolvimento" rows={3} placeholder="Conteúdo do desenvolvimento" value={linha.conteudo} onChange={e => mudar(i, { conteudo: e.target.value })} />
          </div>
        ))}
        <Botao variante="secundario" tamanho="sm" onClick={() => patch({ planosSessao: [...data.planosSessao, { ordem: data.planosSessao.length + 1, objetivosGerais: "", objetivosEspecificos: "", conteudo: "" }] })}>
          Acrescentar sessão
        </Botao>
      </div>
    </Cartao>
  );
}
