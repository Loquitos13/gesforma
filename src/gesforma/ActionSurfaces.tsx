import { useRef, useState } from "react";
import { apiDtpExport, apiFolhasPresencaFin } from "../partilhado/api";
import { dtpZipNome } from "../partilhado/dtpPasta";
import { imprimirFolhasPresencas } from "../partilhado/presencasPrint";
import { AppModal } from "../partilhado/FormKit";
import { EmptyHint, NotifKind, sortNotifs } from "../partilhado/SecretaryUX";
import { toastError, toastOk } from "../partilhado/toastBus";
import { agoraLisboa, hojeLisboa } from "../partilhado/horaLisboa";

const I = {
  download: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  warn: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
};

export type Accent = "gold" | "fin";

function tone(accent: Accent) {
  return accent === "gold"
    ? { btn: "bg-amber-500 hover:bg-amber-600", soft: "bg-amber-50 border-amber-200 text-amber-800", chip: "bg-amber-100 text-amber-700" }
    : { btn: "bg-blue-600 hover:bg-blue-700", soft: "bg-blue-50 border-blue-200 text-blue-800", chip: "bg-blue-100 text-blue-700" };
}

function toastNow() {
  return agoraLisboa();
}

function textoHtml(valor: string) {
  return valor.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

function imprimir(titulo: string, html: string) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${textoHtml(titulo)}</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; color: #0f172a; margin: 32px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p.sub { color: #64748b; font-size: 12px; margin: 0 0 24px; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
      th { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
      .total { margin-top: 20px; font-size: 20px; font-weight: 700; }
    </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

export type ConteudoPreview = {
  id: number;
  titulo: string;
  tipo: string;
  curso: string;
  modulo: string;
  tamanho: string;
  estado: string;
  origem?: string;
  driveFileId?: string;
  driveUrl?: string;
};

export type CertificadoPreview = {
  nome: string;
  curso?: string;
  nota?: number;
  data?: string;
  turma?: string;
};

export type ExportTurmaInfo = {
  nome: string;
  curso: string;
  local: string;
  formandos: number;
  accent?: Accent;
  turmaId?: number;
  regime?: "gold" | "fin";
  lista?: { nome: string; email: string; telf: string; estado: string }[];
  sessoes?: { n: number; data: string; hora: string; modulo: string; formador: string; sumario: boolean; presencas: number }[];
  dtp?: { label: string; estado: string; detalhe: string }[];
};

export function ConteudoAbrirModal({
  open, onClose, item, accent = "gold",
}: {
  open: boolean; onClose: () => void; item: ConteudoPreview | null; accent?: Accent;
}) {
  if (!item) return null;
  const t = tone(accent);
  return (
    <AppModal open={open} onClose={onClose} title={item.titulo} sub={`${item.tipo} · ${item.modulo} · ${item.curso}`} size="lg">
      <div className="p-5 space-y-4">
        <div className={`rounded-xl border px-3 py-2.5 text-xs ${t.soft}`}>
          Material do módulo {item.modulo}. {item.tamanho !== "-" ? `Tamanho: ${item.tamanho}.` : "Ligação externa."} Estado: {item.estado}.
        </div>
        {item.tipo === "PDF" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 min-h-[220px] p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-bold text-slate-800">{item.driveUrl ? "Ficheiro no arquivo" : "Pré-visualização do PDF"}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {item.driveUrl
                ? "O original está no Google Drive da entidade ou no arquivo do servidor."
                : "Este conteúdo de catálogo ainda não tem ficheiro carregado."}
            </p>
          </div>
        )}
        {item.tipo === "Vídeo" && (
          <div className="rounded-xl border border-slate-200 bg-slate-900 min-h-[220px] flex flex-col items-center justify-center text-center text-white">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center text-2xl">▶</div>
            <p className="text-sm font-semibold mt-3">{item.titulo}</p>
            <p className="text-xs text-slate-300 mt-1">{item.tamanho}</p>
          </div>
        )}
        {item.tipo === "Link" && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">URL</p>
            <p className="text-sm font-mono text-blue-700 mt-1 break-all">{item.origem || item.driveUrl || "Sem ligação registada."}</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          <button
            type="button"
            onClick={() => {
              const href = item.tipo === "Link" ? (item.origem || item.driveUrl) : item.driveUrl;
              if (href) window.open(href, "_blank", "noopener");
              else onClose();
            }}
            className={`px-4 py-2 ${t.btn} text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5`}
          >
            {item.tipo === "Link" ? "Abrir ligação" : <>{I.download} {item.driveUrl ? "Abrir ficheiro" : "Fechar"}</>}
          </button>
        </div>
      </div>
    </AppModal>
  );
}

export function CertificadoVerModal({
  open, onClose, cert, accent = "gold",
}: {
  open: boolean; onClose: () => void; cert: CertificadoPreview | null; accent?: Accent;
}) {
  if (!cert) return null;
  const t = tone(accent);
  return (
    <AppModal open={open} onClose={onClose} title="Certificado emitido" sub={cert.nome} size="lg">
      <div className="p-5 space-y-4">
        <div className="rounded-xl border-2 border-slate-200 bg-[linear-gradient(180deg,#fff, #f8fafc)] p-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-semibold">ENA · Escola de Negócios e Administração</p>
          <p className="text-lg font-bold text-slate-900 mt-3">Certificado de conclusão</p>
          <p className="text-sm text-slate-500 mt-4">Certifica-se que</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{cert.nome}</p>
          <p className="text-sm text-slate-600 mt-3">concluiu com aproveitamento</p>
          <p className="text-base font-semibold text-slate-800 mt-1">{cert.curso ?? "Formação ENA"}</p>
          <div className="flex justify-center gap-6 mt-5 text-xs text-slate-500">
            {cert.turma && <span>Turma {cert.turma}</span>}
            {cert.nota != null && <span>Nota {cert.nota}/20</span>}
            <span>{cert.data ?? "2026-09-08"}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-5">Documento de arquivo · a assinatura é aposta no portal NetForce / SIGO</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          <button
            type="button"
            onClick={() => imprimir(`Certificado ${cert.nome}`, `
              <h1>Certificado de conclusão</h1>
              <p class="sub">ENA · Escola de Negócios e Administração</p>
              <table>
                <tr><th>Formando</th><td>${textoHtml(cert.nome)}</td></tr>
                <tr><th>Formação</th><td>${textoHtml(cert.curso ?? "Formação ENA")}</td></tr>
                ${cert.turma ? `<tr><th>Turma</th><td>${textoHtml(cert.turma)}</td></tr>` : ""}
                ${cert.nota != null ? `<tr><th>Nota final</th><td>${textoHtml(String(cert.nota))}/20</td></tr>` : ""}
                <tr><th>Data</th><td>${textoHtml(cert.data ?? hojeLisboa())}</td></tr>
              </table>
            `)}
            className={`px-4 py-2 ${t.btn} text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5`}
          >
            {I.download} Imprimir / PDF
          </button>
        </div>
      </div>
    </AppModal>
  );
}

function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome.replace(/[^\w-]+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportTurmaModal({
  open, onClose, turma,
}: {
  open: boolean; onClose: () => void; turma: ExportTurmaInfo | null;
}) {
  const [done, setDone] = useState<string | null>(null);
  if (!turma) return null;
  const t = tone(turma.accent ?? "gold");
  const lista = turma.lista ?? [];
  const sessoes = turma.sessoes ?? [];
  const dtp = turma.dtp ?? [];
  // A folha de presenças / sumário sai do servidor: na Financiada no modelo da candidatura, na Gold com o logótipo da entidade.
  const regimeFolha = turma.regime ?? turma.accent ?? "gold";
  const folhaFin = turma.turmaId != null;

  const packs = [
    {
      id: "formandos",
      label: "Lista de formandos",
      detalhe: lista.length ? `CSV com ${lista.length} formandos desta turma` : "Sem formandos inscritos",
      disabled: lista.length === 0,
      run: () => baixarCsv(`formandos-${turma.nome}`, [
        ["Nome", "Email", "Telemóvel", "Estado"],
        ...lista.map(f => [f.nome, f.email, f.telf, f.estado]),
      ]),
    },
    {
      id: "cronograma",
      label: "Cronograma",
      detalhe: sessoes.length ? `CSV com ${sessoes.length} sessões, módulos e formadores` : "A turma ainda não tem cronograma",
      disabled: sessoes.length === 0,
      run: () => baixarCsv(`cronograma-${turma.nome}`, [
        ["Sessão", "Data", "Hora", "Módulos", "Formadores", "Sumário", "Presenças registadas"],
        ...sessoes.map(x => [x.n, x.data, x.hora, x.modulo, x.formador, x.sumario ? "Assinado" : "Em falta", x.presencas]),
      ]),
    },
    {
      id: "presencas",
      label: "Folhas de presença",
      detalhe: folhaFin
        ? (regimeFolha === "fin"
          ? "Folha de presenças / sumário de cada sessão, no modelo da candidatura (PDF com logótipos, programa e sumário)"
          : "Folha de presenças / sumário de cada sessão (PDF com o logótipo da entidade)")
        : lista.length
        ? (sessoes.length
          ? `Uma folha por sessão, com ${lista.length} inscritos e coluna de assinatura, disponível antes da sessão`
          : `Folha da turma com ${lista.length} inscritos e coluna de assinatura`)
        : "Inscreva formandos para gerar a folha",
      disabled: lista.length === 0 && !folhaFin,
      run: () => folhaFin ? apiFolhasPresencaFin(turma.turmaId!, undefined, regimeFolha) : imprimirFolhasPresencas({
        turma: turma.nome,
        curso: turma.curso,
        formandos: lista,
        sessoes: sessoes.map(sx => ({ n: sx.n, data: sx.data, hora: sx.hora, modulo: sx.modulo, formador: sx.formador })),
      }),
    },
    {
      id: "dtp",
      label: "Pasta DTP (ZIP)",
      detalhe: turma.turmaId != null
        ? `ZIP ${turma.nome}: identificação, formandos, formador, pedagogia, avaliação e certificação${dtp.length ? ` · ${dtp.length} documentos no índice` : ""}`
        : "Abra o cockpit de uma turma para gerar o ZIP",
      disabled: turma.turmaId == null,
      run: async () => {
        if (turma.turmaId == null) return;
        await apiDtpExport(turma.regime ?? turma.accent ?? "gold", turma.turmaId, dtpZipNome(turma.regime ?? turma.accent ?? "gold", turma.nome));
      },
    },
  ];

  return (
    <AppModal open={open} onClose={() => { setDone(null); onClose(); }} title="Exportar turma" sub={`${turma.nome} · ${turma.curso}`} size="lg">
      <div className="p-5 space-y-3">
        <p className="text-sm text-slate-600">{turma.formandos} formandos · {turma.local}. Escolha o pacote: o ficheiro é gerado com os dados desta turma.</p>
        {packs.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{p.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{p.detalhe}</p>
            </div>
            <button
              type="button"
              disabled={p.disabled}
              onClick={() => {
                void Promise.resolve(p.run())
                  .then(() => setDone(p.label))
                  .catch(err => toastError(err, "Não foi possível exportar."));
              }}
              className={`px-3 py-1.5 ${t.btn} disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1`}
            >
              {I.download} {p.id === "presencas" ? "Imprimir" : "Descarregar"}
            </button>
          </div>
        ))}
        {done && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            {I.check} «{done}» gerado · {toastNow()}
          </div>
        )}
        <div className="flex justify-end pt-1">
          <button type="button" onClick={() => { setDone(null); onClose(); }} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
        </div>
      </div>
    </AppModal>
  );
}

export type NotifRow = {
  chave: string;
  tipo: string;
  titulo: string;
  texto: string;
  lida: boolean;
  view: string;
  turmaId?: number;
  leadId?: number;
  tab?: string;
};

export function NotificacoesView({
  items,
  estado = "ready",
  onOpen,
  onMarcarLida,
  onMarcarTodas,
}: {
  items: NotifRow[];
  estado?: "loading" | "ready" | "offline";
  onOpen: (n: NotifRow) => void;
  onMarcarLida: (chave: string) => void;
  onMarcarTodas: () => void;
}) {
  const [filtro, setFiltro] = useState<"Todas" | "Não lidas" | "Bloqueio" | "Aviso" | "Info" | "Gold" | "Financiada">("Todas");
  const naoLidas = items.filter(n => !n.lida).length;
  const f = sortNotifs(items.filter(n => {
    if (filtro === "Não lidas") return !n.lida;
    if (filtro === "Bloqueio") return n.tipo === "error";
    if (filtro === "Aviso") return n.tipo === "warn";
    if (filtro === "Info") return n.tipo === "info";
    if (filtro === "Gold") return n.view.startsWith("gold") || n.view === "pagamentos";
    if (filtro === "Financiada") return n.view.startsWith("fin");
    return true;
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-tight">Notificações</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {naoLidas === 0 ? "Tudo lido." : `${naoLidas} por ler.`} Vagas, DTP, pagamentos e documentos em falta, calculados a partir dos dados da secretaria.
          </p>
        </div>
        {naoLidas > 0 && (
          <button type="button" onClick={onMarcarTodas} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["Todas", "Não lidas", "Bloqueio", "Aviso", "Info", "Gold", "Financiada"] as const).map(o => (
          <button key={o} type="button" onClick={() => setFiltro(o)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${filtro === o ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {o}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {estado === "loading" && <p className="px-4 py-10 text-center text-sm text-slate-400">A ler as notificações…</p>}
        {estado === "offline" && <p className="px-4 py-10 text-center text-sm text-amber-700">Sem ligação à API: não há notificações para mostrar.</p>}
        {estado === "ready" && f.length === 0 && <EmptyHint text="Nenhuma notificação neste filtro." action="Ver todas" onAction={() => setFiltro("Todas")} />}
        {f.map(n => (
          <button
            key={n.chave}
            type="button"
            onClick={() => { onMarcarLida(n.chave); onOpen(n); }}
            className={`w-full flex gap-3 px-4 py-3.5 text-left hover:bg-slate-50 ${n.lida ? "opacity-70" : ""}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.tipo === "warn" ? "bg-amber-100 text-amber-600" : n.tipo === "error" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
              {n.tipo === "info" ? I.info : I.warn}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{n.titulo}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <NotifKind tipo={n.tipo} />
                  {!n.lida && <span className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{n.texto}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
