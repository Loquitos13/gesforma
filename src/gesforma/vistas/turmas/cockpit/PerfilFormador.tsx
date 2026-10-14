// Perfil do formador aberto a partir do cockpit da turma: calendário, disponibilidade, cursos e documentos.
import { useEffect, useMemo, useState } from "react";
import { apiDriveFiles, apiDtpModelo, apiFormadorDocs, apiSaveFormadorDocs, type DriveFile } from "../../../../partilhado/api";
import { apiAlterarFormador, apiFichaFormador, apiMeuFormador } from "../../../../partilhado/api/formadores";
import { useAuth } from "../../../../partilhado/AuthGate";
import { useCursosRef, useFormadoresTodos } from "../../../../partilhado/dados/comuns";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { DisponibilidadeEditor } from "../../../../partilhado/DisponibilidadeEditor";
import { DOCS_FORMADOR, fundirDocTipos } from "../../../../partilhado/dossierDocs";
import { FormadorCalendario, eventosDoFormador } from "../../../../partilhado/FormadorCalendario";
import { AppModal } from "../../../../partilhado/FormKit";
import { idCursoPorNome } from "../../../../partilhado/cursoLocais";
import { persist } from "../../../../partilhado/toastBus";
import { FileUploadModal } from "../../../../partilhado/TurmaExtras";
import { I } from "../../../../partilhado/turmaIcones";
import type { SessaoCronograma } from "../../../../partilhado/turmaModel";

type DocField = { id: string; label: string; required: boolean; uploaded: boolean; fileName?: string; driveUrl?: string; driveFileId?: string };

function ActBtn({ icon, label, cinza, onClick }: { icon: React.ReactNode; label: string; cinza?: boolean; onClick?: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${cinza ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
      {icon}
    </button>
  );
}

export function FormadorProfileSlideOver({ open, onClose, nome, telf, accent = "gold", turma, horas, embutido = false }: {
  open: boolean; onClose: () => void; nome: string; telf?: string; accent?: "gold" | "fin"; turma?: string; horas?: number; embutido?: boolean;
}) {
  const { user } = useAuth();
  const formadores = useFormadoresTodos();
  const linha = formadores.find(f => f.nome === nome);
  const { dados: eu } = useRecurso(user.role === "formador" && open ? "formador:eu" : null, signal => apiMeuFormador(signal));
  const formadorId = linha?.id ?? eu?.id;
  const { dados: ficha } = useRecurso(open && formadorId ? `formador:${formadorId}` : null, signal => apiFichaFormador(formadorId!, signal));
  const formador = ficha?.formador ?? linha;
  const cursosGold = useCursosRef("gold");
  const cursosFin = useCursosRef("fin");
  const [docs, setDocs] = useState<DocField[]>(() => DOCS_FORMADOR.map(d => ({ ...d, uploaded: false, required: Boolean(d.required) })));
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [ficheiros, setFicheiros] = useState<DriveFile[]>([]);

  const cursos = useMemo(() => [...new Set((ficha?.turmas ?? []).map(t => t.curso).filter(Boolean))], [ficha]);

  useEffect(() => {
    if (!open || !formadorId) return;
    let alive = true;
    apiFormadorDocs(formadorId)
      .then(async r => {
        if (!alive) return;
        const extras: { id: string; label: string }[] = [];
        for (const t of ficha?.turmas ?? []) {
          const id = idCursoPorNome(t.regime, t.curso, cursosGold, cursosFin);
          if (id == null) continue;
          const m = await apiDtpModelo(t.regime, id).catch(() => null);
          extras.push(...(m?.modelo.extra.filter(x => x.ambito === "formador").map(x => ({ id: x.id, label: x.label })) ?? []));
        }
        if (!alive) return;
        const lista = fundirDocTipos(DOCS_FORMADOR, extras).map(d => ({ ...d, required: Boolean(d.required), uploaded: false as boolean }));
        setDocs(lista.map(d => {
          const saved = r.docs.find(x => x.id === d.id);
          return { ...d, uploaded: saved?.uploaded ?? false, fileName: saved?.fileName, driveUrl: saved?.driveUrl, driveFileId: saved?.driveFileId };
        }));
      })
      .catch(() => undefined);
    apiDriveFiles({ kind: "formador-doc", regime: accent, formando: nome })
      .then(r => { if (alive) setFicheiros(r.files); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [accent, cursosFin, cursosGold, ficha, formadorId, nome, open]);

  function markUploaded(id: string, file: DriveFile) {
    const next = docs.map(d => d.id === id ? { ...d, uploaded: true, fileName: file.name, driveUrl: file.openUrl, driveFileId: file.id } : d);
    setDocs(next);
    setUploadFor(null);
    if (formadorId) {
      void persist(apiSaveFormadorDocs(formadorId, next.map(d => ({
        id: d.id, uploaded: d.uploaded, fileName: d.fileName ?? "", driveFileId: d.driveFileId ?? "", driveUrl: d.driveUrl ?? "",
      }))));
    }
  }

  function gravarDisponibilidade(slots: string[]) {
    if (!formadorId) return;
    void persist(apiAlterarFormador(formadorId, { disponibilidade: slots }).then(r => {
      invalidar(`formador:${formadorId}`);
      invalidar("formadores:");
      return r;
    }));
  }

  function abrirFicheiro(doc: DocField) {
    const url = doc.driveUrl || ficheiros.find(f => f.label === doc.label || f.name === doc.fileName)?.openUrl;
    if (url) window.open(url, "_blank", "noreferrer");
  }

  const verCalendario = user.role === "admin" || user.role === "secretaria" || user.role === "financiada" || user.role === "formador";
  const eventos = useMemo(() => {
    const porTurma = new Map<string, { nome: string; cronograma: SessaoCronograma[] }>();
    (ficha?.sessoes ?? []).forEach((s, i) => {
      const chave = `${s.regime}:${s.turmaId}`;
      if (!porTurma.has(chave)) porTurma.set(chave, { nome: s.turma, cronograma: [] });
      porTurma.get(chave)!.cronograma.push({ id: `${chave}:${i}`, data: s.data, horaInicio: s.horaInicio, horaFim: s.horaFim, modulos: [], formadores: [nome] });
    });
    return eventosDoFormador(nome, [...porTurma.values()]);
  }, [ficha, nome]);

  const corpo = (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
        <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">{nome[0]}</div>
        <div>
          <p className="text-sm font-bold text-slate-800">{nome}</p>
          <p className="text-xs text-slate-500">{formador?.especialidade || "Formador / Formadora"}</p>
          <p className="text-xs text-violet-600 font-medium mt-1">
            {formador?.ccp ? `CCP ${formador.ccp}` : "CCP não registado"}{(telf || formador?.telf) ? ` · ${telf || formador?.telf}` : ""}
          </p>
          {horas != null && <p className="text-xs font-semibold text-slate-700 mt-1">{horas} h de formação nesta turma</p>}
        </div>
      </div>
      {verCalendario && <FormadorCalendario nome={nome} eventos={eventos} slots={formador?.disponibilidade} />}
      {formador && formadorId && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Disponibilidade CCP</p>
          <DisponibilidadeEditor
            value={formador.disponibilidade}
            onChange={gravarDisponibilidade}
            nota="O formador regista estes horários no GesForma. A secretaria continua a poder ajustá-los. Laboral 9h a 13h, pós-laboral 16h30 a 23h, sábado de manhã 9h a 13h e sábado à tarde 14h a 19h."
          />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cursos atribuídos</p>
        <div className="space-y-1.5">
          {cursos.length === 0 && <p className="text-xs text-slate-400">Sem turmas atribuídas no cronograma.</p>}
          {cursos.map(c => (
            <div key={c} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-xs text-slate-700">{c}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Documentos</p>
          <span className="text-xs text-slate-500">{docs.filter(d => d.uploaded).length}/{docs.length} entregues</span>
        </div>
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${doc.uploaded ? "bg-emerald-500" : doc.required ? "bg-red-400" : "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-slate-800">{doc.label}</p>
                  {doc.required && <span className="text-xs text-red-500 font-bold">*</span>}
                </div>
                {doc.uploaded && doc.fileName
                  ? <p className="text-xs text-emerald-600 mt-0.5 truncate">{doc.fileName}</p>
                  : <p className="text-xs text-slate-400 mt-0.5">{doc.required ? "Obrigatório" : "Opcional"}</p>}
              </div>
              {doc.uploaded
                ? <div className="flex gap-1">
                    <ActBtn icon={I.eye} label="Ver" cinza onClick={() => abrirFicheiro(doc)} />
                    <ActBtn icon={I.edit} label="Substituir" onClick={() => setUploadFor(doc.id)} />
                  </div>
                : <button type="button" onClick={() => setUploadFor(doc.id)} disabled={!formadorId} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap disabled:opacity-40">Upload</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return (
    <>
      {embutido ? corpo : <AppModal open={open} onClose={onClose} title={`Perfil - ${nome}`} sub="Ficha do formador" size="2xl">{corpo}</AppModal>}
      <FileUploadModal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title={`Carregar: ${docs.find(d => d.id === uploadFor)?.label ?? ""}`}
        accent={accent}
        context={{ kind: "formador-doc", regime: accent, turma, formando: nome, label: docs.find(d => d.id === uploadFor)?.label }}
        onConfirm={file => { if (uploadFor) markUploaded(uploadFor, file); }}
      />
    </>
  );
}
