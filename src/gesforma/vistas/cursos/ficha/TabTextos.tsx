// Separadores de texto da ficha: conteúdo do site e programa (os planos de sessão estão em TabPlanos.tsx).
import { TOPICOS_CURSO } from "../../../../partilhado/topicosCurso";
import { AreaTexto, Aviso, Botao, Campo, Cartao, Entrada, Estado, Selecao, Vazio } from "../../../../partilhado/ui";
import { codigoTopico, juntarHoras, novoTopicoId, partirHoras, textoPrograma } from "../../../cursoPrograma";
import { useState } from "react";
import { RESUMO_IDEAL, RESUMO_MAX, textosCurso } from "../../../../partilhado/textosCurso";
import { textoSimples } from "../../../../partilhado/textoFormatado";
import { TextoComFormatacao } from "./TextoComFormatacao";
import type { FichaCurso } from "./useFichaCurso";

function BlocoTexto({ rotulo, ajuda, valor, onMudar, linhas = 7 }: { rotulo: string; ajuda: string; valor: string; onMudar: (v: string) => void; linhas?: number }) {
  return (
    <Cartao titulo={rotulo} subtitulo={ajuda} acoes={<Estado tom={valor.trim() ? "sucesso" : "aviso"}>{valor.trim() ? "Preenchido" : "Em falta"}</Estado>}>
      <TextoComFormatacao rotulo={rotulo} linhas={linhas} valor={valor} onMudar={onMudar} placeholder="Este texto aparece na página pública do curso." />
      <p className="num m-0 mt-1 text-right text-xs text-tinta-suave">{valor.trim().length} caracteres</p>
    </Cartao>
  );
}

/** Texto de destaque (catálogo): curto, com contador; vazio, o site corta o texto completo e mostra-o aqui como sugestão. */
function TextoDestaque({ f }: { f: FichaCurso }) {
  const { data, patch } = f;
  // O limite conta as marcas (é o que o servidor confere); o aviso do cartão conta só o texto que se vê.
  const n = data.resumo.trim().length;
  const visivel = textoSimples(data.resumo).length;
  const derivado = textosCurso({ sintese: data.sintese }).resumo;
  const tom = visivel === 0 ? "neutro" : visivel > RESUMO_IDEAL ? "aviso" : "sucesso";
  return (
    <Cartao titulo="Texto de destaque (catálogo)" subtitulo="Uma ou duas frases para os cartões do curso, o catálogo e as listagens do site. Também serve de descrição na pesquisa da Google (sem a formatação)."
      acoes={<Estado tom={tom}>{visivel ? "Próprio" : derivado ? "Do enquadramento" : "Em falta"}</Estado>}>
      <TextoComFormatacao rotulo="Texto de destaque (catálogo)" linhas={3} valor={data.resumo}
        placeholder={derivado || "Ex.: Formação certificada para quem quer ser formador, em b-learning, com simulação pedagógica."}
        onMudar={v => patch({ resumo: v.slice(0, RESUMO_MAX) })} />
      <p className={`num m-0 mt-1 flex justify-between gap-2 text-xs ${visivel > RESUMO_IDEAL ? "text-aviso" : "text-tinta-suave"}`}>
        <span>{visivel ? (visivel > RESUMO_IDEAL ? `Acima de ${RESUMO_IDEAL}: em alguns cartões pode ficar cortado.` : "") : "Vazio: o site usa o início do enquadramento (o que se vê a cinzento)."}</span>
        <span aria-live="polite">{n}/{RESUMO_MAX}</span>
      </p>
    </Cartao>
  );
}

export function TabConteudo({ f }: { f: FichaCurso }) {
  const { data, patch } = f;
  const gerado = textoPrograma(data.organizacaoPrograma, data.topicosPrograma);
  return (
    <div className="space-y-4">
      <Aviso tom="info">Cada bloco é uma secção da página pública. Escreva para o formando, não para a operação interna.</Aviso>
      <TextoDestaque f={f} />
      <BlocoTexto rotulo="Enquadramento" ajuda="O primeiro texto da página do curso, abaixo do banner: para quem é, o que se leva daqui e como funciona. Pode ser longo e ter vários parágrafos." valor={data.sintese} onMudar={v => patch({ sintese: v })} linhas={9} />
      <BlocoTexto rotulo="Objetivos" ajuda="O que o formando será capaz de fazer. Uma ideia por linha." valor={data.objetivos} onMudar={v => patch({ objetivos: v })} />
      {gerado ? (
        <Cartao titulo="Programa no site" subtitulo="Gerado a partir do separador Programa, pela mesma ordem.">
          <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-tinta">{gerado}</pre>
        </Cartao>
      ) : (
        <BlocoTexto rotulo="Programa no site" ajuda="Ainda sem módulos. Defina o percurso no separador Programa e este texto passa a ser gerado." valor={data.programa} onMudar={v => patch({ programa: v })} linhas={10} />
      )}
      {TOPICOS_CURSO.map(t => (
        <BlocoTexto key={t.chave} rotulo={t.rotulo} ajuda={t.ajuda} valor={data[t.chave]} onMudar={v => patch({ [t.chave]: v })} />
      ))}
      <Cartao titulo="Pesquisa na Google e partilha" subtitulo="Como o curso aparece nos resultados da Google e quando é partilhado (Facebook, LinkedIn, WhatsApp). Vazio: o título e o texto de destaque do curso.">
        <div className="grid gap-3">
          <Campo rotulo="Título na pesquisa" ajuda={`${data.seoTitulo.length}/60 caracteres. A Google corta títulos mais longos.`}>
            {p => <Entrada {...p} maxLength={70} value={data.seoTitulo} placeholder={data.titulo} onChange={e => patch({ seoTitulo: e.target.value })} />}
          </Campo>
          <Campo rotulo="Descrição na pesquisa" ajuda={`${data.seoDescricao.length}/160 caracteres. Diga para quem é, o que se ganha e o formato. Vazia: o texto de destaque.`}>
            {p => <AreaTexto {...p} rows={3} maxLength={200} value={data.seoDescricao} placeholder={textosCurso(data).resumoSimples} onChange={e => patch({ seoDescricao: e.target.value })} />}
          </Campo>
        </div>
      </Cartao>
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
  const { data, patch } = f;
  const organizacao = data.organizacaoPrograma;
  const unidade = organizacao === "livre" ? "capítulo" : "módulo";
  // Arrastar pela pega (⠿) ou usar os botões ↑ ↓ (teclado). A ordem gravada é a da lista.
  const [arrastado, setArrastado] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const moverPara = (de: number, para: number) => {
    if (de === para || para < 0 || para >= data.topicosPrograma.length) return;
    const next = [...data.topicosPrograma];
    const [item] = next.splice(de, 1);
    next.splice(para, 0, item!);
    patch({ topicosPrograma: next });
  };
  const mover = (i: number, d: -1 | 1) => moverPara(i, i + d);
  const largar = () => { setArrastado(null); setAlvo(null); };
  const somaMinutos = data.topicosPrograma.reduce((a, t) => { const p = partirHoras(t.horas); return a + (Number(p.horas) || 0) * 60 + (Number(p.minutos) || 0); }, 0);
  const horasCurso = Number(data.horas) || 0;
  return (
    <Cartao titulo="Programa pedagógico" subtitulo="O percurso do curso. Entra no cronograma, na avaliação por módulo e no programa público.">
      <div className="space-y-3">
        <Campo rotulo="Tipo de programa" ajuda="Modular numera os módulos M1, M2…; no programa livre os capítulos não têm código. Arraste os cartões para mudar a ordem.">
          {p => (
            <Selecao {...p} opcoes={[{ valor: "modular", rotulo: "Modular" }, { valor: "livre", rotulo: "Livre" }]} value={data.organizacaoPrograma}
              onChange={e => patch({ organizacaoPrograma: e.target.value === "livre" ? "livre" : "modular" })} />
          )}
        </Campo>
        {horasCurso > 0 && data.topicosPrograma.length > 0 && (
          <p className="num m-0 text-[13px] text-tinta-suave">
            Os {unidade}s somam {Math.floor(somaMinutos / 60)} h{somaMinutos % 60 ? ` ${somaMinutos % 60} min` : ""} de {horasCurso} h do curso.
          </p>
        )}
        {data.topicosPrograma.length === 0 && <Vazio compacto titulo={`Ainda não há ${unidade}s.`} descricao="Acrescente o primeiro." />}
        <ol className="m-0 list-none space-y-2 p-0">
          {data.topicosPrograma.map((t, i) => (
            <li key={t.id}
              className={`flex flex-wrap items-center gap-2 rounded-controlo border bg-fundo p-2.5 ${alvo === i && arrastado !== i ? "border-acao" : "border-linha"} ${arrastado === i ? "opacity-50" : ""}`}
              onDragOver={e => { if (arrastado == null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (alvo !== i) setAlvo(i); }}
              onDrop={e => { e.preventDefault(); if (arrastado != null) moverPara(arrastado, i); largar(); }}>
              <span draggable aria-hidden="true" title="Arrastar para mudar a ordem" className="cursor-grab select-none px-1 text-tinta-suave active:cursor-grabbing"
                onDragStart={e => {
                  // Sem permissão de edição (fieldset desactivado) não se arrasta.
                  if (e.currentTarget.closest("fieldset")?.disabled) { e.preventDefault(); return; }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", t.id);
                  const li = e.currentTarget.closest("li");
                  if (li) e.dataTransfer.setDragImage(li, 16, 16);
                  setArrastado(i);
                }}
                onDragEnd={largar}>⠿</span>
              {codigoTopico(organizacao, i) && <span className="w-8 shrink-0 text-xs font-bold text-tinta-suave">{codigoTopico(organizacao, i)}</span>}
              <Entrada aria-label={`Título do ${unidade} ${i + 1}`} className="min-w-[12rem] flex-1" value={t.titulo} placeholder={`Título do ${unidade}`}
                onChange={e => patch({ topicosPrograma: data.topicosPrograma.map(x => (x.id === t.id ? { ...x, titulo: e.target.value } : x)) })} />
              <Duracao valor={t.horas} onMudar={horas => patch({ topicosPrograma: data.topicosPrograma.map(x => (x.id === t.id ? { ...x, horas } : x)) })} />
              <span className="flex gap-1">
                <Botao tamanho="sm" variante="fantasma" soIcone aria-label={`Subir o ${unidade} ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)}>↑</Botao>
                <Botao tamanho="sm" variante="fantasma" soIcone aria-label={`Descer o ${unidade} ${i + 1}`} disabled={i === data.topicosPrograma.length - 1} onClick={() => mover(i, 1)}>↓</Botao>
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
