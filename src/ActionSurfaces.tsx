import { useState } from "react";
import { AppModal } from "./FormKit";
import { EmptyHint, NotifKind, sortNotifs } from "./SecretaryUX";

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
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function refMb(seed: string) {
  const n = seed.replace(/\D/g, "").padEnd(9, "7").slice(0, 9);
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)}`;
}

export type TransacaoPreview = {
  id: string;
  nome: string;
  valor: number;
  metodo: string;
  curso: string;
  data: string;
  estado: string;
};

export type ConteudoPreview = {
  id: number;
  titulo: string;
  tipo: string;
  curso: string;
  modulo: string;
  tamanho: string;
  estado: string;
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
};

function Badge({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
      {label}
    </span>
  );
}

function ReciboPaper({ t }: { t: TransacaoPreview }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 bg-slate-900 text-white flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400">ENA · Escola de Negócios e Administração</p>
          <p className="text-sm font-bold mt-0.5">Recibo de pagamento</p>
        </div>
        <p className="text-xs font-mono text-slate-300">{t.id}</p>
      </div>
      <div className="p-5 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "Formando", v: t.nome },
            { l: "Curso", v: t.curso },
            { l: "Método", v: t.metodo },
            { l: "Data", v: t.data },
          ].map(f => (
            <div key={f.l}>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{f.l}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{f.v}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">IVA incluído · documento de tesouraria (protótipo)</p>
          <p className="text-xl font-bold text-slate-900">€ {t.valor}</p>
        </div>
      </div>
    </div>
  );
}

export function PagamentoDetalheModal({
  open, onClose, transacao, onRecibo,
}: {
  open: boolean; onClose: () => void; transacao: TransacaoPreview | null; onRecibo?: () => void;
}) {
  if (!transacao) return null;
  const pago = transacao.estado === "Pago";
  return (
    <AppModal open={open} onClose={onClose} title="Detalhe da transação" sub={transacao.id} size="lg">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-slate-800">{transacao.nome}</p>
            <p className="text-sm text-slate-500 mt-0.5">{transacao.curso}</p>
          </div>
          <Badge label={transacao.estado} ok={pago} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "Valor", v: `€ ${transacao.valor}` },
            { l: "Método", v: transacao.metodo },
            { l: "Registado em", v: transacao.data },
            { l: "Referência", v: transacao.id },
          ].map(f => (
            <div key={f.l} className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{f.l}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{f.v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {pago
            ? "O pagamento está conciliado. Pode emitir ou reenviar o recibo ao formando."
            : "Ainda pendente. Gere uma referência MB ou um pedido MB Way a partir da ficha do formando."}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          {pago && (
            <button type="button" onClick={onRecibo} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
              {I.mail} Ver recibo
            </button>
          )}
        </div>
      </div>
    </AppModal>
  );
}

export function ReciboModal({
  open, onClose, transacao,
}: {
  open: boolean; onClose: () => void; transacao: TransacaoPreview | null;
}) {
  const [enviado, setEnviado] = useState(false);
  if (!transacao) return null;
  return (
    <AppModal open={open} onClose={() => { setEnviado(false); onClose(); }} title="Recibo" sub={`${transacao.id} · ${transacao.nome}`} size="lg">
      <div className="p-5 space-y-4">
        <ReciboPaper t={transacao} />
        {enviado && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            {I.check} Recibo enviado para o email do formando · {toastNow()}
          </div>
        )}
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button type="button" onClick={() => { setEnviado(false); onClose(); }} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          <button type="button" onClick={() => setEnviado(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
            {I.download} Descarregar PDF
          </button>
          <button type="button" onClick={() => setEnviado(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
            {I.mail} Enviar por email
          </button>
        </div>
      </div>
    </AppModal>
  );
}

export function ReferenciaMbModal({
  open, onClose, nome, valor, curso, modo = "mb",
}: {
  open: boolean; onClose: () => void; nome: string; valor: number; curso: string; modo?: "mb" | "mbway";
}) {
  const [copied, setCopied] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const entidade = "12345";
  const referencia = refMb(nome + String(valor));
  const isWay = modo === "mbway";
  return (
    <AppModal
      open={open}
      onClose={() => { setCopied(false); setEnviado(false); onClose(); }}
      title={isWay ? "Pedido MB Way" : "Referência Multibanco"}
      sub={`${nome} · ${curso}`}
    >
      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          {isWay ? (
            <>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Link MB Way</p>
              <p className="text-sm text-amber-800 mt-1">O formando recebe um pedido no telemóvel associado. Valor € {valor}.</p>
            </>
          ) : (
            <div className="space-y-2 font-mono">
              <div className="flex justify-between text-sm"><span className="text-amber-700">Entidade</span><span className="font-bold text-slate-900">{entidade}</span></div>
              <div className="flex justify-between text-sm"><span className="text-amber-700">Referência</span><span className="font-bold text-slate-900">{referencia}</span></div>
              <div className="flex justify-between text-sm"><span className="text-amber-700">Valor</span><span className="font-bold text-slate-900">€ {valor.toFixed(2)}</span></div>
              <p className="text-[11px] text-amber-700 font-sans pt-1">Válida até 72 horas. Protótipo — não gera cobrança real.</p>
            </div>
          )}
        </div>
        {(copied || enviado) && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            {I.check} {enviado ? (isWay ? "Pedido MB Way enviado." : "Referência enviada por email e SMS.") : "Copiado para a área de transferência."}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setCopied(false); setEnviado(false); onClose(); }} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          {!isWay && (
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${entidade} ${referencia} €${valor}`); setCopied(true); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
              {I.copy} Copiar
            </button>
          )}
          <button type="button" onClick={() => setEnviado(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">
            {isWay ? "Enviar pedido" : "Enviar ao formando"}
          </button>
        </div>
      </div>
    </AppModal>
  );
}

export function EnviarReciboModal({
  open, onClose, nome, valor, curso, metodo,
}: {
  open: boolean; onClose: () => void; nome: string; valor: number; curso: string; metodo: string;
}) {
  const [ok, setOk] = useState(false);
  const t: TransacaoPreview = {
    id: `REC-${String(valor).padStart(4, "0")}`,
    nome, valor, metodo, curso, data: toastNow(), estado: "Pago",
  };
  return (
    <AppModal open={open} onClose={() => { setOk(false); onClose(); }} title="Enviar recibo" sub={nome} size="lg">
      <div className="p-5 space-y-4">
        <ReciboPaper t={t} />
        {ok && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            {I.check} Recibo enviado · {toastNow()}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setOk(false); onClose(); }} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          <button type="button" onClick={() => setOk(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5">
            {I.mail} Enviar recibo
          </button>
        </div>
      </div>
    </AppModal>
  );
}

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
            <p className="text-sm font-bold text-slate-800">Pré-visualização do PDF</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">Página 1 de {item.titulo}. Neste protótipo o ficheiro não está alojado — o botão descarrega um comprovativo local.</p>
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
            <p className="text-sm font-mono text-blue-700 mt-1 break-all">https://moodle.ena.pt/{item.curso.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/{item.modulo.toLowerCase()}</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          <button type="button" onClick={onClose} className={`px-4 py-2 ${t.btn} text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5`}>
            {item.tipo === "Link" ? "Abrir ligação" : <>{I.download} Descarregar</>}
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
          <p className="text-[11px] text-slate-400 mt-5">Documento de arquivo · protótipo sem assinatura digital</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
          <button type="button" onClick={onClose} className={`px-4 py-2 ${t.btn} text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5`}>
            {I.download} Descarregar PDF
          </button>
        </div>
      </div>
    </AppModal>
  );
}

export function ExportTurmaModal({
  open, onClose, turma,
}: {
  open: boolean; onClose: () => void; turma: ExportTurmaInfo | null;
}) {
  const [done, setDone] = useState<string | null>(null);
  if (!turma) return null;
  const t = tone(turma.accent ?? "gold");
  const packs = [
    { id: "formandos", label: "Lista de formandos", detalhe: "CSV com nome, email, telemóvel e estado" },
    { id: "cronograma", label: "Cronograma", detalhe: "PDF das sessões, módulos e formadores" },
    { id: "presencas", label: "Folhas de presença", detalhe: "PDF por sessão, pronto a assinar" },
    { id: "dtp", label: "Dossiê TP (índice)", detalhe: "ZIP com o índice e os ficheiros já no dossiê" },
  ];
  return (
    <AppModal open={open} onClose={() => { setDone(null); onClose(); }} title="Exportar turma" sub={`${turma.nome} · ${turma.curso}`} size="lg">
      <div className="p-5 space-y-3">
        <p className="text-sm text-slate-600">{turma.formandos} formandos · {turma.local}. Escolha o pacote. Neste protótipo o download fica registado, sem ficheiro real.</p>
        {packs.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{p.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{p.detalhe}</p>
            </div>
            <button type="button" onClick={() => setDone(p.label)} className={`px-3 py-1.5 ${t.btn} text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1`}>
              {I.download} Descarregar
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
  id: number;
  tipo: string;
  titulo: string;
  texto: string;
  tempo: string;
  lida: boolean;
  view: string;
  turmaId?: number;
  tab?: string;
};

export function NotificacoesView({
  items,
  onOpen,
}: {
  items: NotifRow[];
  onOpen: (n: NotifRow) => void;
}) {
  const [lista, setLista] = useState(items);
  const [filtro, setFiltro] = useState<"Todas" | "Não lidas" | "Bloqueio" | "Aviso" | "Info" | "Gold" | "Financiada">("Todas");
  const naoLidas = lista.filter(n => !n.lida).length;
  const f = sortNotifs(lista.filter(n => {
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
            {naoLidas === 0 ? "Tudo lido." : `${naoLidas} por ler.`} Acompanhe vagas, DTP, pagamentos e novas inscrições.
          </p>
        </div>
        {naoLidas > 0 && (
          <button type="button" onClick={() => setLista(xs => xs.map(n => ({ ...n, lida: true })))} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
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
        {f.length === 0 && <EmptyHint text="Nenhuma notificação neste filtro." action="Ver todas" onAction={() => setFiltro("Todas")} />}
        {f.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => { setLista(xs => xs.map(x => x.id === n.id ? { ...x, lida: true } : x)); onOpen(n); }}
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
              <p className="text-xs text-slate-400 mt-1">há {n.tempo}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
