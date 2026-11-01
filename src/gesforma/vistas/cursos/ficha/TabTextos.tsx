// Separadores de texto da ficha: conteúdo do site, programa e planos de sessão.
import { TOPICOS_CURSO } from "../../../../partilhado/topicosCurso";
import { MultiSearchSelect } from "../../../../partilhado/FormKit";
import { AreaTexto, Aviso, Botao, Campo, Cartao, Entrada, Estado, Selecao, Vazio } from "../../../../partilhado/ui";
import { codigoTopico, juntarHoras, novoTopicoId, opcoesDoPrograma, partirHoras, textoPrograma } from "../../../cursoPrograma";
import { useState, type ReactNode } from "react";
import type { MomentoField, MomentoKey } from "../../../../partilhado/TurmaExtras";
import { novoPlanoCurso } from "../../../planosCurso";
import { distribuirTempo, minutosDeTempo, textoDeMinutos } from "../../../../partilhado/duracaoSessao";
import { RESUMO_IDEAL, RESUMO_MAX, textosCurso } from "../../../../partilhado/textosCurso";
import { textoSimples } from "../../../../partilhado/textoFormatado";
import { TextoComFormatacao } from "./TextoComFormatacao";
import type { PlanoLinha } from "./modelo";
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

const MOMENTOS: { id: MomentoKey; rotulo: string }[] = [
  { id: "introducao", rotulo: "Introdução" },
  { id: "desenvolvimento", rotulo: "Desenvolvimento" },
  { id: "conclusao", rotulo: "Conclusão" },
];
const CAMPOS_MOMENTO: { id: keyof MomentoField; rotulo: string }[] = [
  { id: "conteudo", rotulo: "Conteúdo programático" },
  { id: "atividades", rotulo: "Atividades" },
  { id: "metodos", rotulo: "Métodos / técnicas pedagógicas" },
  { id: "avaliacao", rotulo: "Avaliação" },
  { id: "recursos", rotulo: "Recursos didáticos" },
  { id: "materiais", rotulo: "Materiais e equipamentos" },
];

const preenchidos = (o: Record<string, string>) => CAMPOS_MOMENTO.filter(c => String(o[c.id] ?? "").trim()).length;

/** Horas e minutos em dois campos numéricos; devolve minutos. */
function HorasMinutos({ minutos, onMudar, rotulo }: { minutos: number; onMudar: (min: number) => void; rotulo: string }) {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  const num = (v: string) => Math.max(0, Math.floor(Number(v.replace(/\D/g, "")) || 0));
  return (
    <span className="inline-flex items-center gap-1">
      <Entrada aria-label={`${rotulo}: horas`} type="number" min={0} max={23} inputMode="numeric" className="w-16" value={minutos ? String(h) : ""} placeholder="0"
        onChange={e => onMudar(Math.min(23, num(e.target.value)) * 60 + m)} />
      <span className="text-xs font-semibold text-tinta-suave">h</span>
      <Entrada aria-label={`${rotulo}: minutos`} type="number" min={0} max={59} step={5} inputMode="numeric" className="w-16" value={minutos ? String(m).padStart(2, "0") : ""} placeholder="00"
        onChange={e => onMudar(h * 60 + Math.min(59, num(e.target.value)))} />
      <span className="text-xs font-semibold text-tinta-suave">min</span>
    </span>
  );
}

/** Duração da sessão e o tempo de cada momento (tem de somar a duração). */
function TempoDoPlano({ linha, onMudar }: { linha: PlanoLinha; onMudar: (p: Partial<PlanoLinha>) => void }) {
  const tempos = Object.fromEntries(MOMENTOS.map(m => [m.id, minutosDeTempo(linha.momentos[m.id].tempo)])) as Record<MomentoKey, number>;
  const soma = MOMENTOS.reduce((a, m) => a + tempos[m.id], 0);
  const comTempos = (t: Record<MomentoKey, number>) => Object.fromEntries(MOMENTOS.map(m => [m.id, { ...linha.momentos[m.id], tempo: textoDeMinutos(t[m.id]) }])) as PlanoLinha["momentos"];
  const mudarDuracao = (duracaoMin: number) => {
    // Momentos ainda vazios, ou repartidos pela duração anterior: repartem-se de novo pela nova.
    const auto = !soma || soma === linha.duracaoMin;
    onMudar(auto ? { duracaoMin, momentos: comTempos(distribuirTempo(duracaoMin)) } : { duracaoMin });
  };
  const falta = linha.duracaoMin - soma;
  return (
    <div className="space-y-2 rounded-controlo border border-linha-suave bg-fundo/40 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold">Duração da sessão</span>
        <HorasMinutos rotulo={`Sessão ${linha.ordem}: duração`} minutos={linha.duracaoMin} onMudar={mudarDuracao} />
        <span className="text-xs text-tinta-suave">A sessão marcada no cronograma da turma dura este tempo.</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {MOMENTOS.map(m => (
          <label key={m.id} className="flex items-center gap-1.5 text-xs font-semibold text-tinta-suave">
            {m.rotulo}
            <HorasMinutos rotulo={`Sessão ${linha.ordem}, ${m.rotulo}: tempo`} minutos={tempos[m.id]} onMudar={v => onMudar({ momentos: comTempos({ ...tempos, [m.id]: v }) })} />
          </label>
        ))}
      </div>
      {linha.duracaoMin > 0 && (
        <p className={`m-0 flex flex-wrap items-center gap-2 text-xs ${falta === 0 ? "text-tinta-suave" : "text-red-700"}`}>
          {falta === 0
            ? `Os momentos somam ${textoDeMinutos(soma)}: o tempo da sessão está todo distribuído.`
            : falta > 0
              ? `Faltam distribuir ${textoDeMinutos(falta)} pelos momentos (somam ${textoDeMinutos(soma) || "0 min"} de ${textoDeMinutos(linha.duracaoMin)}).`
              : `Os momentos passam ${textoDeMinutos(-falta)} da duração da sessão (${textoDeMinutos(soma)} de ${textoDeMinutos(linha.duracaoMin)}).`}
          {falta !== 0 && (
            <button type="button" className="font-semibold text-ligacao hover:underline" onClick={() => onMudar({ momentos: comTempos(distribuirTempo(linha.duracaoMin)) })}>
              Distribuir automaticamente
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function Recolhivel({ titulo, resumo, children }: { titulo: string; resumo: string; children: ReactNode }) {
  return (
    <details className="group rounded-controlo border border-linha-suave bg-fundo/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] font-semibold text-tinta">
        <span aria-hidden="true" className="text-tinta-suave transition-transform group-open:rotate-90">›</span>
        {titulo}
        <span className="ml-auto text-xs font-normal text-tinta-suave">{resumo}</span>
      </summary>
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

export function TabPlanos({ f }: { f: FichaCurso }) {
  const { data, patch } = f;
  const mudar = (i: number, p: Partial<PlanoLinha>) => patch({ planosSessao: data.planosSessao.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const mudarMomento = (i: number, m: MomentoKey, campo: keyof MomentoField, valor: string) => {
    const linha = data.planosSessao[i]!;
    mudar(i, { momentos: { ...linha.momentos, [m]: { ...linha.momentos[m], [campo]: valor } } });
  };
  const renumerar = (lista: PlanoLinha[]) => lista.map((p, j) => ({ ...p, ordem: j + 1 }));
  // Cada plano recolhe-se (como um «collapse»): abrem-se só os que se estão a escrever; os vazios começam abertos.
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set(data.planosSessao.filter(p => !p.objetivosGerais.trim()).map(p => p.ordem)));
  // Módulos / temas do programa (separador Programa): cada plano pode ficar ligado a um ou mais, e vai para as sessões deles.
  const modulos = opcoesDoPrograma(data.organizacaoPrograma, data.topicosPrograma);
  const unidade = data.organizacaoPrograma === "livre" ? "tema" : "módulo";
  const codigos = (lista: string[]) => lista.map(m => m.split("·")[0]!.trim()).join(" + ");
  return (
    <Cartao titulo="Plano de cada sessão" subtitulo="Cada plano é uma sessão. Nas turmas criadas daqui em diante, os planos ficam «por agendar» no cronograma: ao clicar num dia escolhe-se a sessão, que leva a duração, os módulos e o plano (e o sumário), já aprovado. E-learning, avaliações e outras sessões marcam-se como personalizadas. As turmas que já existem não mudam.">
      <div className="space-y-3">
        {data.planosSessao.length === 0 && <Vazio compacto titulo="Ainda sem planos." descricao="Acrescente a primeira sessão." />}
        {data.planosSessao.length > 1 && (
          <div className="flex justify-end gap-3 text-xs">
            <button type="button" className="font-semibold text-ligacao hover:underline" onClick={() => setAbertos(new Set(data.planosSessao.map(p => p.ordem)))}>Abrir todos</button>
            <button type="button" className="font-semibold text-ligacao hover:underline" onClick={() => setAbertos(new Set())}>Recolher todos</button>
          </div>
        )}
        {data.planosSessao.map((linha, i) => (
          <details key={linha.ordem} open={abertos.has(linha.ordem)}
            onToggle={e => { const aberto = (e.currentTarget as HTMLDetailsElement).open; setAbertos(prev => { const n = new Set(prev); if (aberto) n.add(linha.ordem); else n.delete(linha.ordem); return n; }); }}
            className="group/plano rounded-controlo border border-linha">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
              <p className="m-0 min-w-0 text-[13px] font-semibold">
                <span aria-hidden="true" className="mr-1.5 inline-block text-tinta-suave transition-transform group-open/plano:rotate-90">›</span>
                Plano {linha.ordem}
                <span className="font-normal text-tinta-suave">
                  {linha.modulos.length ? ` · ${codigos(linha.modulos)}` : ""}
                  {linha.duracaoMin ? ` · ${textoDeMinutos(linha.duracaoMin)}` : " · duração por definir"}
                </span>
                {!abertos.has(linha.ordem) && linha.objetivosGerais.trim() && (
                  <span className="mt-0.5 block truncate text-xs font-normal text-tinta-suave">{linha.objetivosGerais.trim()}</span>
                )}
              </p>
              <span className="flex shrink-0 gap-1">
                <Botao tamanho="sm" variante="fantasma" onClick={e => { e.preventDefault(); patch({ planosSessao: renumerar([...data.planosSessao.slice(0, i + 1), { ...linha }, ...data.planosSessao.slice(i + 1)]) }); setAbertos(prev => new Set(prev).add(linha.ordem + 1)); }}>Duplicar</Botao>
                <Botao tamanho="sm" variante="fantasma" onClick={e => { e.preventDefault(); patch({ planosSessao: renumerar(data.planosSessao.filter((_, j) => j !== i)) }); }}>Remover</Botao>
              </span>
            </summary>
            <div className="space-y-2 border-t border-linha-suave p-3">
            {modulos.length > 0 && (
              <Campo rotulo={unidade === "tema" ? "Temas" : "Módulos"} ajuda={`A sessão marcada com este plano fica com estes ${unidade}s no cronograma.`}>
                {() => (
                  <MultiSearchSelect values={linha.modulos} onChange={v => mudar(i, { modulos: v })} options={modulos}
                    placeholder={`Pesquisar ${unidade}…`} noneLabel={`Sem ${unidade}`} unitSingular={unidade} unitPlural={`${unidade}s`} />
                )}
              </Campo>
            )}
            <TempoDoPlano linha={linha} onMudar={p => mudar(i, p)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <AreaTexto aria-label={`Sessão ${linha.ordem}: objetivos gerais`} rows={2} placeholder="Objetivos gerais" value={linha.objetivosGerais} onChange={e => mudar(i, { objetivosGerais: e.target.value })} />
              <AreaTexto aria-label={`Sessão ${linha.ordem}: objetivos específicos`} rows={2} placeholder="Objetivos específicos" value={linha.objetivosEspecificos} onChange={e => mudar(i, { objetivosEspecificos: e.target.value })} />
            </div>
            {MOMENTOS.map(m => (
              <Recolhivel key={m.id} titulo={m.rotulo} resumo={`${preenchidos(linha.momentos[m.id])} de ${CAMPOS_MOMENTO.length} campos`}>
                {CAMPOS_MOMENTO.map(c => (
                  <AreaTexto key={c.id} aria-label={`Sessão ${linha.ordem}, ${m.rotulo}: ${c.rotulo}`} rows={2} placeholder={c.rotulo}
                    value={linha.momentos[m.id][c.id]} onChange={e => mudarMomento(i, m.id, c.id, e.target.value)} />
                ))}
              </Recolhivel>
            ))}
            <Recolhivel titulo="Sumário padrão" resumo={linha.sumario.conteudos.trim() || linha.sumario.atividades.trim() ? "Preenchido" : "Opcional"}>
              <AreaTexto aria-label={`Sessão ${linha.ordem}: sumário, conteúdos`} rows={3} placeholder="Conteúdos abordados" value={linha.sumario.conteudos}
                onChange={e => mudar(i, { sumario: { ...linha.sumario, conteudos: e.target.value } })} />
              <AreaTexto aria-label={`Sessão ${linha.ordem}: sumário, atividades`} rows={3} placeholder="Atividades realizadas" value={linha.sumario.atividades}
                onChange={e => mudar(i, { sumario: { ...linha.sumario, atividades: e.target.value } })} />
              <p className="m-0 text-xs text-tinta-suave sm:col-span-2">Gold: fica como sumário da sessão em todas as turmas do curso; o formador só tem de o assinar (ou acrescentar as observações).</p>
            </Recolhivel>
            </div>
          </details>
        ))}
        <Botao variante="secundario" tamanho="sm" onClick={() => { const n = data.planosSessao.length + 1; patch({ planosSessao: [...data.planosSessao, novoPlanoCurso(n)] }); setAbertos(prev => new Set(prev).add(n)); }}>
          Acrescentar sessão
        </Botao>
      </div>
    </Cartao>
  );
}

