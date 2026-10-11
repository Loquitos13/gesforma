import { useEffect, useMemo, useState } from "react";
import { apiDriveFiles, apiUploadDrive, type DriveFile } from "../partilhado/api";
import {
  conteudoModuloVazio,
  elementoVazio,
  eMultimediaDrive,
  midiaDeDrive,
  moduloTemConteudo,
  parseConteudosMoodle,
  ROTULOS_ELEMENTO,
  ROTULOS_QUIZ,
  type ConteudoMoodle,
  type ElementoPedagogico,
  type TipoElementoPedagogico,
  type TipoQuiz,
} from "../partilhado/conteudosPedagogicos";
import { useDrive } from "../partilhado/DriveContext";
import { AppModal } from "../partilhado/FormKit";
import { codigoTopico, type OrganizacaoPrograma, type TopicoPrograma } from "./cursoPrograma";
import type { CursoAccent } from "./CursoFichaView";
import { EditorElementoPedagogico } from "./ConteudosMoodleElemento";

export { parseConteudosMoodle, type ConteudoMoodle, type ElementoPedagogico } from "../partilhado/conteudosPedagogicos";

const NOVOS_TIPOS: { id: TipoElementoPedagogico; nome: string }[] = [
  { id: "video", nome: "Vídeo" },
  { id: "manual", nome: "Manual PDF" },
  { id: "texto", nome: "Texto" },
  { id: "flashcards", nome: "Flashcards" },
  { id: "quiz", nome: "Quiz" },
  { id: "webinar", nome: "Webinar" },
  { id: "atividade", nome: "Atividade" },
];

type DestinoMidia = { elementoId: string } | { novoTipo: TipoElementoPedagogico };

export function ConteudosMoodle({
  accent, organizacao, modulos, conteudos, inputCls, onChange, onIrPrograma, cursoId, cursoTitulo,
}: {
  accent: CursoAccent;
  organizacao: OrganizacaoPrograma;
  modulos: TopicoPrograma[];
  conteudos: ConteudoMoodle[];
  inputCls: string;
  onChange: (conteudos: ConteudoMoodle[]) => void;
  onIrPrograma: () => void;
  cursoId?: number | null;
  cursoTitulo: string;
}) {
  const [activo, setActivo] = useState(0);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoElementoPedagogico>("video");
  const [novoQuizTipo, setNovoQuizTipo] = useState<TipoQuiz>("escolha_unica");
  const [novoTitulo, setNovoTitulo] = useState("");
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [destinoMidia, setDestinoMidia] = useState<DestinoMidia | null>(null);
  const [ficheirosDrive, setFicheirosDrive] = useState<DriveFile[]>([]);
  const [pesquisaDrive, setPesquisaDrive] = useState("");
  const [aCarregarDrive, setACarregarDrive] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const { status: driveStatus } = useDrive();

  const indice = Math.min(activo, Math.max(0, modulos.length - 1));
  const modulo = modulos[indice];
  const tom = accent === "fin" ? "text-blue-700" : "text-amber-700";
  const fundo = accent === "fin" ? "bg-blue-50" : "bg-amber-50";
  const btn = accent === "fin" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-500 hover:bg-amber-600";

  const ctxDrive = useMemo(() => ({
    kind: "curso-multimedia",
    regime: accent,
    label: cursoTitulo.slice(0, 120) || "Curso",
    itemId: cursoId != null ? String(cursoId) : undefined,
  }), [accent, cursoTitulo, cursoId]);

  function doModulo(id: string): ConteudoMoodle {
    return conteudos.find(item => item.moduloId === id) ?? conteudoModuloVazio(id);
  }

  function gravar(id: string, seguinte: ConteudoMoodle) {
    const outros = conteudos.filter(item => item.moduloId !== id);
    onChange(moduloTemConteudo(seguinte) ? [...outros, seguinte] : outros);
  }

  useEffect(() => {
    if (!bibliotecaAberta) return;
    let alive = true;
    setACarregarDrive(true);
    apiDriveFiles({ kind: "" })
      .then(r => { if (alive) setFicheirosDrive(r.files.filter(f => eMultimediaDrive(f.mimeType))); })
      .catch(() => { if (alive) setFicheirosDrive([]); })
      .finally(() => { if (alive) setACarregarDrive(false); });
    return () => { alive = false; };
  }, [bibliotecaAberta]);

  const ficheirosFiltrados = useMemo(() => {
    const q = pesquisaDrive.trim().toLowerCase();
    if (!q) return ficheirosDrive;
    return ficheirosDrive.filter(f => f.name.toLowerCase().includes(q) || f.folderPath.toLowerCase().includes(q));
  }, [ficheirosDrive, pesquisaDrive]);

  if (!modulo) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Este curso ainda não tem módulos.</p>
        <p className="mt-1 text-xs text-slate-500">Os conteúdos Moodle acompanham cada módulo do programa.</p>
        <button type="button" onClick={onIrPrograma} className="mt-4 text-sm font-semibold text-[#1C3350] underline">Definir o programa</button>
      </div>
    );
  }

  const conteudo = doModulo(modulo.id);
  const codigo = codigoTopico(organizacao, indice);

  function patchModulo(patch: Partial<ConteudoMoodle>) {
    gravar(modulo.id, { ...conteudo, ...patch });
  }

  function patchElemento(id: string, patch: Partial<ElementoPedagogico>) {
    patchModulo({
      elementos: conteudo.elementos.map(el => el.id === id ? { ...el, ...patch } : el),
    });
  }

  function moverElemento(id: string, direcao: -1 | 1) {
    const elementos = [...conteudo.elementos];
    const i = elementos.findIndex(el => el.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= elementos.length) return;
    const [el] = elementos.splice(i, 1);
    elementos.splice(j, 0, el);
    patchModulo({ elementos });
  }

  function acrescentarElemento(el: ElementoPedagogico) {
    if (conteudo.elementos.length >= 40) return;
    patchModulo({ elementos: [...conteudo.elementos, el] });
    setExpandido(el.id);
  }

  function confirmarNovoElemento() {
    const el = elementoVazio(novoTipo, novoTipo === "quiz" ? novoQuizTipo : undefined);
    el.titulo = novoTitulo.trim();
    acrescentarElemento(el);
    setNovoAberto(false);
    setNovoTitulo("");
  }

  async function importarPacote(tipo: "scorm" | "h5p", file: File) {
    setImportBusy(true);
    try {
      const uploaded = await apiUploadDrive(file, { ...ctxDrive, label: `${cursoTitulo} · ${tipo.toUpperCase()}` });
      acrescentarElemento({
        ...elementoVazio(tipo),
        titulo: file.name.replace(/\.[^.]+$/, ""),
        midia: midiaDeDrive(uploaded),
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function carregarMidiaElemento(elementoId: string, file: File) {
    setImportBusy(true);
    try {
      const uploaded = await apiUploadDrive(file, ctxDrive);
      patchElemento(elementoId, { midia: midiaDeDrive(uploaded) });
    } finally {
      setImportBusy(false);
    }
  }

  function aplicarFicheiroDrive(file: DriveFile) {
    const midia = midiaDeDrive(file);
    if (destinoMidia && "elementoId" in destinoMidia) {
      patchElemento(destinoMidia.elementoId, { midia });
    } else if (destinoMidia && "novoTipo" in destinoMidia) {
      acrescentarElemento({ ...elementoVazio(destinoMidia.novoTipo), titulo: file.name.replace(/\.[^.]+$/, ""), midia });
    }
    setBibliotecaAberta(false);
    setDestinoMidia(null);
  }

  function abrirBiblioteca(destino: DestinoMidia) {
    setDestinoMidia(destino);
    setBibliotecaAberta(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${importBusy ? "opacity-50" : btn}`}>
          Importar SCORM
          <input type="file" className="hidden" accept=".zip,application/zip" disabled={importBusy} onChange={e => { const f = e.target.files?.[0]; if (f) void importarPacote("scorm", f); e.target.value = ""; }} />
        </label>
        <label className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${importBusy ? "opacity-50" : btn}`}>
          Importar H5P
          <input type="file" className="hidden" accept=".h5p,.zip,application/zip" disabled={importBusy} onChange={e => { const f = e.target.files?.[0]; if (f) void importarPacote("h5p", f); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={() => abrirBiblioteca({ novoTipo: "video" })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Biblioteca multimédia
        </button>
        <span className="self-center text-[11px] text-slate-400">
          {driveStatus.connected ? "Lista ficheiros do Drive da entidade" : "Sem Drive: carregamentos ficam em disco local"}
        </span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Seleccionar módulo</p>
          <ol className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {modulos.map((item, i) => {
              const cheio = moduloTemConteudo(doModulo(item.id));
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => { setActivo(i); setExpandido(null); }}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left ${i === indice ? fundo : "hover:bg-slate-50"}`}
                  >
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-bold ${tom}`}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{codigoTopico(organizacao, i)}{item.horas ? ` · ${item.horas}` : ""}</span>
                      <span className="block truncate text-sm font-semibold text-slate-800">{item.titulo.trim() || "Módulo sem título"}</span>
                    </span>
                    {cheio && <span className="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Com conteúdo" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wide ${tom}`}>{codigo}{modulo.horas ? ` · ${modulo.horas}` : ""}</p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">{modulo.titulo.trim() || "Módulo sem título"}</h2>
                <p className="mt-1 text-xs text-slate-500">Estrutura pedagógica gravada na ficha. Não sincroniza com o Moodle.</p>
              </div>
              <button type="button" onClick={() => setNovoAberto(true)} className={`rounded-lg px-4 py-2 text-xs font-bold text-white ${btn}`}>Adicionar elemento +</button>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Introdução</span>
              <textarea className={`${inputCls} mt-1.5 min-h-20`} value={conteudo.introducao} onChange={e => patchModulo({ introducao: e.target.value })} placeholder="O texto que abre o módulo." />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objectivo do módulo</span>
                <textarea className={`${inputCls} mt-1.5 min-h-16`} value={conteudo.objetivoModulo} onChange={e => patchModulo({ objetivoModulo: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critério de conclusão</span>
                <textarea className={`${inputCls} mt-1.5 min-h-16`} value={conteudo.criterioConclusao} onChange={e => patchModulo({ criterioConclusao: e.target.value })} placeholder="Ex.: nota mínima nos quizzes." />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={conteudo.percursoSequencial} onChange={e => patchModulo({ percursoSequencial: e.target.checked })} className="accent-[#1C3350]" />
                Percurso sequencial obrigatório
              </label>
              <label className="flex items-center gap-2">
                <span>Nota mínima nos quizzes (%)</span>
                <input
                  className={`${inputCls} !w-20 py-1`}
                  type="number"
                  min={0}
                  max={100}
                  value={conteudo.notaMinimaQuiz ?? ""}
                  onChange={e => patchModulo({ notaMinimaQuiz: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {conteudo.elementos.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Este módulo ainda não tem elementos. Use Adicionar elemento ou importe SCORM/H5P.</p>
            )}
            {conteudo.elementos.map((elemento, i) => (
              <EditorElementoPedagogico
                key={elemento.id}
                accent={accent}
                elemento={elemento}
                indice={i}
                inputCls={inputCls}
                expandido={expandido === elemento.id}
                onToggle={() => setExpandido(expandido === elemento.id ? null : elemento.id)}
                onChange={patch => patchElemento(elemento.id, patch)}
                onRemover={() => patchModulo({ elementos: conteudo.elementos.filter(el => el.id !== elemento.id) })}
                onSubir={() => moverElemento(elemento.id, -1)}
                onDescer={() => moverElemento(elemento.id, 1)}
                podeSubir={i > 0}
                podeDescer={i < conteudo.elementos.length - 1}
                onEscolherDrive={() => abrirBiblioteca({ elementoId: elemento.id })}
                onCarregarFicheiro={f => void carregarMidiaElemento(elemento.id, f)}
              />
            ))}
          </div>
        </section>
      </div>

      <AppModal open={novoAberto} onClose={() => setNovoAberto(false)} title="Novo elemento" sub="Escolha o tipo e o título. Depois pode editar o conteúdo na sequência." size="md">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
            <select className={`${inputCls} mt-1`} value={novoTipo} onChange={e => setNovoTipo(e.target.value as TipoElementoPedagogico)}>
              {NOVOS_TIPOS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          {novoTipo === "quiz" && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato do quiz</span>
              <select className={`${inputCls} mt-1`} value={novoQuizTipo} onChange={e => setNovoQuizTipo(e.target.value as TipoQuiz)}>
                {Object.entries(ROTULOS_QUIZ).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Título</span>
            <input className={`${inputCls} mt-1`} value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} placeholder={ROTULOS_ELEMENTO[novoTipo]} />
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setNovoAberto(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600">Cancelar</button>
            <button type="button" onClick={confirmarNovoElemento} className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white ${btn}`}>Adicionar à sequência</button>
          </div>
        </div>
      </AppModal>

      <AppModal open={bibliotecaAberta} onClose={() => { setBibliotecaAberta(false); setDestinoMidia(null); }} title="Biblioteca multimédia" sub="Vídeos, imagens, áudio, PDF e pacotes ZIP já enviados para o Drive da entidade." size="lg">
        <div className="space-y-3">
          <input className={inputCls} value={pesquisaDrive} onChange={e => setPesquisaDrive(e.target.value)} placeholder="Procurar por nome ou pasta" />
          {aCarregarDrive && <p className="text-sm text-slate-500">A carregar ficheiros…</p>}
          {!aCarregarDrive && ficheirosFiltrados.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Não há multimédia no Drive. Carregue um ficheiro num elemento ou ligue o Google Drive em Configurações.</p>
          )}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {ficheirosFiltrados.map(file => (
              <li key={file.id}>
                <button type="button" onClick={() => aplicarFicheiroDrive(file)} className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-500">{file.mimeType.split("/")[0]?.slice(0, 3) ?? "arq"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{file.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{file.folderPath || file.mimeType}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </AppModal>
    </div>
  );
}
