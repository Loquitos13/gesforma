import {
  ROTULOS_ELEMENTO,
  ROTULOS_QUIZ,
  type ElementoPedagogico,
  type MidiaRef,
  type TipoQuiz,
} from "../partilhado/conteudosPedagogicos";
type CursoAccent = "gold" | "fin";

function idNovo(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function EditorElementoPedagogico({
  accent,
  elemento,
  indice,
  inputCls,
  expandido,
  onToggle,
  onChange,
  onRemover,
  onSubir,
  onDescer,
  podeSubir,
  podeDescer,
  onEscolherDrive,
  onCarregarFicheiro,
}: {
  accent: CursoAccent;
  elemento: ElementoPedagogico;
  indice: number;
  inputCls: string;
  expandido: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ElementoPedagogico>) => void;
  onRemover: () => void;
  onSubir: () => void;
  onDescer: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
  onEscolherDrive: (destino: "midia") => void;
  onCarregarFicheiro: (ficheiro: File) => void;
}) {
  const rotulo = elemento.tipo === "quiz" && elemento.quizTipo
    ? `${ROTULOS_ELEMENTO.quiz} · ${ROTULOS_QUIZ[elemento.quizTipo]}`
    : ROTULOS_ELEMENTO[elemento.tipo];
  const chip = accent === "fin" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900";

  function patchMidia(patch: Partial<MidiaRef>) {
    onChange({ midia: { origem: "url", ...elemento.midia, ...patch } });
  }

  function patchOpcao(id: string, patch: Partial<{ texto: string; correta: boolean }>) {
    const opcoes = (elemento.opcoes ?? []).map(o => o.id === id ? { ...o, ...patch } : o);
    onChange({ opcoes });
  }

  function definirCorretaUnica(id: string) {
    onChange({ opcoes: (elemento.opcoes ?? []).map(o => ({ ...o, correta: o.id === id })) });
  }

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <span className="text-xs font-bold tabular-nums text-slate-400">{String(indice + 1).padStart(2, "0")}</span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip}`}>{rotulo}</span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800">
          {elemento.titulo.trim() || "Sem título"}
          {elemento.duracaoMin ? <span className="ml-2 text-xs font-normal text-slate-400">{elemento.duracaoMin} min</span> : null}
        </button>
        <div className="flex gap-1">
          <button type="button" disabled={!podeSubir} onClick={onSubir} className="px-2 py-1 text-xs font-semibold text-slate-500 disabled:opacity-30">Subir</button>
          <button type="button" disabled={!podeDescer} onClick={onDescer} className="px-2 py-1 text-xs font-semibold text-slate-500 disabled:opacity-30">Descer</button>
          <button type="button" onClick={onRemover} className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-red-600">Remover</button>
        </div>
      </div>
      {expandido && (
        <div className="space-y-3 bg-slate-50/60 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <input className={inputCls} value={elemento.titulo} onChange={e => onChange({ titulo: e.target.value })} placeholder="Título do elemento" />
            <input
              className={inputCls}
              type="number"
              min={1}
              max={999}
              value={elemento.duracaoMin ?? ""}
              onChange={e => onChange({ duracaoMin: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Minutos"
            />
          </div>

          {(elemento.tipo === "video" || elemento.tipo === "manual" || elemento.tipo === "scorm" || elemento.tipo === "h5p") && (
            <SecaoMidia
              inputCls={inputCls}
              accept={elemento.tipo === "video" ? "video/*" : elemento.tipo === "manual" ? ".pdf,application/pdf" : ".zip,.h5p,application/zip"}
              midia={elemento.midia}
              onUrl={url => patchMidia({ origem: "url", url })}
              onDrive={() => onEscolherDrive("midia")}
              onFicheiro={onCarregarFicheiro}
            />
          )}

          {(elemento.tipo === "texto" || elemento.tipo === "webinar" || elemento.tipo === "atividade") && (
            <textarea
              className={`${inputCls} min-h-24`}
              value={elemento.corpo ?? ""}
              onChange={e => onChange({ corpo: e.target.value })}
              placeholder={elemento.tipo === "webinar" ? "Notas da sessão síncrona com o formador." : "Conteúdo visível ao formando."}
            />
          )}

          {elemento.tipo === "quiz" && (
            <EditorQuiz
              inputCls={inputCls}
              elemento={elemento}
              onChange={onChange}
              patchOpcao={patchOpcao}
              definirCorretaUnica={definirCorretaUnica}
            />
          )}

          {elemento.tipo === "flashcards" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(elemento.flashOrdemAleatoria)} onChange={e => onChange({ flashOrdemAleatoria: e.target.checked })} className="accent-[#1C3350]" />
                  Ordem aleatória
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(elemento.flashRepetirDificeis)} onChange={e => onChange({ flashRepetirDificeis: e.target.checked })} className="accent-[#1C3350]" />
                  Repetir cartões difíceis
                </label>
              </div>
              {(elemento.cartasFlash ?? []).map((carta, i) => (
                <div key={carta.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
                  <input className={inputCls} value={carta.frente} placeholder={`Cartão ${i + 1} — pergunta`} onChange={e => onChange({
                    cartasFlash: (elemento.cartasFlash ?? []).map(x => x.id === carta.id ? { ...x, frente: e.target.value } : x),
                  })} />
                  <input className={inputCls} value={carta.verso} placeholder="Resposta" onChange={e => onChange({
                    cartasFlash: (elemento.cartasFlash ?? []).map(x => x.id === carta.id ? { ...x, verso: e.target.value } : x),
                  })} />
                  <button type="button" className="text-left text-xs font-semibold text-red-500 sm:col-span-2" onClick={() => onChange({
                    cartasFlash: (elemento.cartasFlash ?? []).filter(x => x.id !== carta.id),
                  })}>Remover cartão</button>
                </div>
              ))}
              <button type="button" className="text-xs font-semibold text-[#1C3350] underline" onClick={() => onChange({
                cartasFlash: [...(elemento.cartasFlash ?? []), { id: idNovo("f"), frente: "", verso: "" }],
              })}>+ Cartão</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SecaoMidia({
  inputCls, accept, midia, onUrl, onDrive, onFicheiro,
}: {
  inputCls: string;
  accept: string;
  midia?: MidiaRef;
  onUrl: (url: string) => void;
  onDrive: () => void;
  onFicheiro: (f: File) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ficheiro ou ligação</p>
      {midia?.nome && <p className="truncate text-sm font-medium text-slate-700">{midia.nome}{midia.origem === "drive" ? " · Drive" : ""}</p>}
      <input className={inputCls} value={midia?.url ?? ""} onChange={e => onUrl(e.target.value)} placeholder="https://… ou endereço interno" />
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Carregar ficheiro
          <input type="file" className="hidden" accept={accept} onChange={e => { const f = e.target.files?.[0]; if (f) onFicheiro(f); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={onDrive} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Biblioteca multimédia</button>
      </div>
    </div>
  );
}

function EditorQuiz({
  inputCls, elemento, onChange, patchOpcao, definirCorretaUnica,
}: {
  inputCls: string;
  elemento: ElementoPedagogico;
  onChange: (p: Partial<ElementoPedagogico>) => void;
  patchOpcao: (id: string, patch: Partial<{ texto: string; correta: boolean }>) => void;
  definirCorretaUnica: (id: string) => void;
}) {
  const qt = elemento.quizTipo ?? "escolha_unica";

  function mudarTipo(novo: TipoQuiz) {
    onChange({
      quizTipo: novo,
      opcoes: novo === "verdadeiro_falso"
        ? [
          { id: idNovo("o"), texto: "Verdadeiro", correta: true },
          { id: idNovo("o"), texto: "Falso", correta: false },
        ]
        : novo === "escolha_unica" || novo === "escolha_multipla"
          ? (elemento.opcoes?.length ? elemento.opcoes : [
            { id: idNovo("o"), texto: "", correta: true },
            { id: idNovo("o"), texto: "", correta: false },
          ])
          : [],
      pares: novo === "correspondencia"
        ? (elemento.pares?.length ? elemento.pares : [{ id: idNovo("p"), esquerda: "", direita: "" }])
        : [],
      cartasOrdenacao: novo === "ordenacao"
        ? (elemento.cartasOrdenacao?.length ? elemento.cartasOrdenacao : [{ id: idNovo("c"), texto: "", ordem: 1 }])
        : [],
    });
  }

  return (
    <div className="space-y-3">
      <SearchSelectQuiz tipo={qt} onChange={mudarTipo} inputCls={inputCls} />
      <textarea className={`${inputCls} min-h-20`} value={elemento.pergunta ?? ""} onChange={e => onChange({ pergunta: e.target.value })} placeholder="Enunciado da pergunta" />

      {(qt === "escolha_unica" || qt === "escolha_multipla" || qt === "verdadeiro_falso") && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {qt === "escolha_multipla" ? "Opções (várias corretas)" : "Opções (uma correta)"}
          </p>
          {(elemento.opcoes ?? []).map(opcao => (
            <div key={opcao.id} className="flex items-center gap-2">
              <input
                type={qt === "escolha_multipla" ? "checkbox" : "radio"}
                name={`quiz-${elemento.id}`}
                checked={Boolean(opcao.correta)}
                onChange={() => {
                  if (qt === "escolha_multipla") patchOpcao(opcao.id, { correta: !opcao.correta });
                  else definirCorretaUnica(opcao.id);
                }}
                className="accent-[#1C3350]"
              />
              <input
                className={`${inputCls} flex-1`}
                value={opcao.texto}
                disabled={qt === "verdadeiro_falso"}
                onChange={e => patchOpcao(opcao.id, { texto: e.target.value })}
                placeholder="Texto da opção"
              />
              {qt !== "verdadeiro_falso" && (
                <button type="button" className="text-xs text-slate-400 hover:text-red-500" onClick={() => onChange({
                  opcoes: (elemento.opcoes ?? []).filter(o => o.id !== opcao.id),
                })}>×</button>
              )}
            </div>
          ))}
          {qt !== "verdadeiro_falso" && (
            <button type="button" className="text-xs font-semibold text-[#1C3350] underline" onClick={() => onChange({
              opcoes: [...(elemento.opcoes ?? []), { id: idNovo("o"), texto: "", correta: false }],
            })}>+ Opção</button>
          )}
        </div>
      )}

      {qt === "resposta_aberta" && (
        <textarea className={`${inputCls} min-h-16`} value={elemento.corpo ?? ""} onChange={e => onChange({ corpo: e.target.value })} placeholder="Resposta modelo ou critérios de correção (opcional)" />
      )}

      {qt === "correspondencia" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pares termo · definição</p>
          {(elemento.pares ?? []).map(par => (
            <div key={par.id} className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} value={par.esquerda} placeholder="Termo" onChange={e => onChange({
                pares: (elemento.pares ?? []).map(p => p.id === par.id ? { ...p, esquerda: e.target.value } : p),
              })} />
              <input className={inputCls} value={par.direita} placeholder="Definição correta" onChange={e => onChange({
                pares: (elemento.pares ?? []).map(p => p.id === par.id ? { ...p, direita: e.target.value } : p),
              })} />
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-[#1C3350] underline" onClick={() => onChange({
            pares: [...(elemento.pares ?? []), { id: idNovo("p"), esquerda: "", direita: "" }],
          })}>+ Par</button>
        </div>
      )}

      {qt === "ordenacao" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cartões por ordem correta</p>
          {(elemento.cartasOrdenacao ?? []).map((carta, i) => (
            <div key={carta.id} className="flex gap-2">
              <span className="mt-2 w-6 text-xs font-bold text-slate-400">{i + 1}</span>
              <input className={`${inputCls} flex-1`} value={carta.texto} onChange={e => onChange({
                cartasOrdenacao: (elemento.cartasOrdenacao ?? []).map(x => x.id === carta.id ? { ...x, texto: e.target.value, ordem: i + 1 } : x),
              })} placeholder="Texto do cartão" />
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-[#1C3350] underline" onClick={() => onChange({
            cartasOrdenacao: [...(elemento.cartasOrdenacao ?? []), { id: idNovo("c"), texto: "", ordem: (elemento.cartasOrdenacao?.length ?? 0) + 1 }],
          })}>+ Cartão</button>
        </div>
      )}
    </div>
  );
}

function SearchSelectQuiz({ tipo, onChange, inputCls }: { tipo: TipoQuiz; onChange: (t: TipoQuiz) => void; inputCls: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de quiz</span>
      <select className={`${inputCls} mt-1`} value={tipo} onChange={e => onChange(e.target.value as TipoQuiz)}>
        {Object.entries(ROTULOS_QUIZ).map(([id, nome]) => (
          <option key={id} value={id}>{nome}</option>
        ))}
      </select>
    </label>
  );
}
