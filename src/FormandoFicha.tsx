import { useState } from "react";
import { EnviarReciboModal, ReferenciaMbModal } from "./ActionSurfaces";
import { useTurmas } from "./TurmasContext";
import { isTurmaActiva } from "./turmaModel";
import type { FormandoTurma } from "./ListsContext";

const I = {
  check: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>,
  warn: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  phone: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.529 5.855L0 24l6.335-1.502A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.168-1.399l-.371-.22-3.766.893.936-3.652-.242-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>,
  mail: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>,
  receipt: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1 1 0 100 2 1 1 0 000-2zm2.25 1a1 1 0 011-1h2.5a1 1 0 110 2h-2.5a1 1 0 01-1-1zm-2.25 3a1 1 0 100 2 1 1 0 000-2zm2.25 1a1 1 0 011-1h2.5a1 1 0 110 2h-2.5a1 1 0 01-1-1zm-2.25 3a1 1 0 100 2 1 1 0 000-2zm2.25 1a1 1 0 011-1h2.5a1 1 0 110 2h-2.5a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
};

type BadgeVariant = "green" | "gray" | "blue" | "amber" | "teal" | "orange" | "violet" | "red";
const badgeCls: Record<BadgeVariant, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  gray: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  red: "bg-red-50 text-red-600 border-red-200",
};
function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${badgeCls[variant]}`}>{label}</span>;
}
function estadoBadge(estado: string) {
  const m: Record<string, BadgeVariant> = {
    Ativo: "green", Inactivo: "gray", Pago: "teal", Pendente: "orange", Formando: "green", Elegível: "teal",
  };
  return <Badge label={estado} variant={m[estado] ?? "gray"} />;
}

function DocumentosGoldPanel({ formando, avulso }: { formando: FormandoTurma; avulso?: boolean }) {
  const [docs, setDocs] = useState(() => [
    { id: "cc", label: "Cartão de Cidadão", ok: true, data: formando.inscrito.slice(0, 10) },
    { id: "contrato", label: "Contrato de formação", ok: formando.pago, data: formando.pago ? formando.inscrito.slice(0, 10) : "" },
    { id: "pip", label: "PIP - Projeto de Intervenção Pedagógica", ok: avulso ? formando.pago : formando.id % 3 !== 0, data: avulso ? (formando.pago ? "2026-08-20" : "") : (formando.id % 3 !== 0 ? "2026-08-20" : "") },
    { id: "exp", label: "Comprovativo de 5 anos de experiência", ok: avulso ? true : formando.id % 2 === 0, data: avulso ? formando.inscrito.slice(0, 10) : (formando.id % 2 === 0 ? "2026-08-12" : "") },
    { id: "regulamento", label: "Regulamento de formação aceite", ok: true, data: formando.inscrito.slice(0, 10) },
  ]);
  const emFalta = docs.filter(d => !d.ok).length;
  return (
    <div className="space-y-3">
      <div className={`rounded-xl p-4 flex items-center gap-3 ${emFalta === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${emFalta === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
          {emFalta === 0 ? I.check : I.warn}
        </div>
        <div>
          <p className={`text-sm font-bold ${emFalta === 0 ? "text-emerald-700" : "text-amber-700"}`}>
            {emFalta === 0 ? "Documentos completos" : `${emFalta} documentos em falta`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{formando.nome} {formando.apelido} · {avulso ? "venda avulso" : formando.turma}</p>
        </div>
      </div>
      <div className="space-y-2">
        {docs.map(d => (
          <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${d.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <button type="button" onClick={() => setDocs(xs => xs.map(x => x.id === d.id ? { ...x, ok: !x.ok, data: !x.ok ? new Date().toISOString().slice(0, 10) : "" } : x))}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${d.ok ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-red-300"}`}>
              {d.ok && I.check}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${d.ok ? "text-emerald-700" : "text-red-600"}`}>{d.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{d.ok && d.data ? `Validado em ${d.data}` : "Em falta"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FichaFormando({ formando, tipo = "gold", onClose, initialTab = "documentos", avulso = false }: {
  formando: FormandoTurma; tipo?: "gold" | "fin"; onClose: () => void;
  initialTab?: "info" | "documentos" | "pagamentos" | "historico" | "notas";
  avulso?: boolean;
}) {
  const [tab, setTab] = useState<"info" | "documentos" | "pagamentos" | "historico" | "notas">(initialTab);
  const [nota, setNota] = useState("");
  const [notas, setNotas] = useState([
    { id: 1, texto: avulso ? "Inscrição avulso pelo site. Pediu fatura no email pessoal." : "Ligou a questionar sobre o horário de sábado. Confirmou presença.", data: "2026-09-02 10:15", autor: "Tania" },
  ]);
  const [pay, setPay] = useState<"mb" | "mbway" | "recibo" | null>(null);

  const { gold } = useTurmas();
  const turma = avulso ? undefined : gold.find(t => t.id === formando.turmaId);
  const turmaLabel = avulso ? "Sem turma · venda avulso" : formando.turma;

  return (
    <div className="flex flex-col h-full">
      <div className={`px-5 py-4 border-b ${tipo === "gold" ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 ${tipo === "gold" ? "bg-amber-500" : "bg-blue-600"}`}>
            {formando.nome[0]}{formando.apelido[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800">{formando.nome} {formando.apelido}</p>
            <p className="text-xs text-slate-500 truncate">{formando.email}</p>
            <div className="flex items-center gap-2 mt-1">{estadoBadge(formando.estado)}<span className="text-xs text-slate-400">{turmaLabel}{turma && !isTurmaActiva(turma) ? " · turma inativa" : ""}</span></div>
          </div>
          <div className={`text-right flex-shrink-0 ${formando.pago ? "text-emerald-600" : "text-amber-600"}`}>
            <p className="text-lg font-bold">€{formando.valor}</p>
            <p className="text-xs">{formando.pago ? "Pago" : "Pendente"}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <a href={`tel:${formando.telf}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">{I.phone} {formando.telf}</a>
          <a href={`https://wa.me/351${formando.telf}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 rounded-lg text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">{I.whatsapp} WhatsApp</a>
          <a href={`mailto:${formando.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white hover:bg-blue-700 transition-colors">{I.mail} Email</a>
        </div>
      </div>

      <div className="flex border-b border-slate-100 px-5 bg-white flex-shrink-0 overflow-x-auto">
        {(["info", "documentos", "pagamentos", "historico", "notas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "info" ? "Informação" : t === "documentos" ? "Documentos" : t === "pagamentos" ? "Pagamento" : t === "historico" ? "Histórico" : "Notas"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === "info" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "Curso", v: formando.curso },
                { l: "Turma", v: turmaLabel },
                { l: "Local", v: formando.local },
                { l: "Inscrito a", v: formando.inscrito },
                { l: "Telemóvel", v: formando.telf },
                { l: "Email", v: formando.email },
              ].map(f => (
                <div key={f.l} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{f.l}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5 break-all">{f.v}</p>
                </div>
              ))}
            </div>
            {turma && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Turma</p>
                <p className="text-sm font-bold text-slate-800">{turma.nome}</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div><p className="text-xs text-slate-400">Início</p><p className="text-xs font-semibold">{turma.dataInicio}</p></div>
                  <div><p className="text-xs text-slate-400">Local</p><p className="text-xs font-semibold">{turma.local}</p></div>
                  <div><p className="text-xs text-slate-400">Vagas</p><p className="text-xs font-semibold">{turma.totalAlunos}/{turma.vagas}</p></div>
                </div>
              </div>
            )}
            {avulso && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Venda avulso</p>
                <p className="text-xs text-slate-600">Este formando não está numa turma. Os documentos e o pagamento ficam nesta ficha — o mesmo modelo da lista da turma.</p>
              </div>
            )}
          </>
        )}

        {tab === "documentos" && <DocumentosGoldPanel formando={formando} avulso={avulso} />}

        {tab === "pagamentos" && (
          <div className="space-y-3">
            <div className={`rounded-xl p-4 border ${formando.pago ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">€ {formando.valor}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formando.metodo}</p>
                </div>
                {formando.pago ? <Badge label="Pago" variant="green" /> : <Badge label="Pendente" variant="amber" />}
              </div>
            </div>
            {!formando.pago && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPay("mb")} className="py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">Gerar referência MB</button>
                <button type="button" onClick={() => setPay("mbway")} className="py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Link MB Way</button>
              </div>
            )}
            {formando.pago && (
              <button type="button" onClick={() => setPay("recibo")} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">{I.receipt} Enviar recibo</button>
            )}
          </div>
        )}

        {tab === "historico" && (
          <div className="space-y-2">
            {[
              { acao: avulso ? "Inscrição avulso recebida" : "Pré-inscrição recebida", data: formando.inscrito, tipo: "inscricao" },
              { acao: "Email de boas-vindas enviado", data: formando.inscrito, tipo: "email" },
              { acao: "Pagamento confirmado (" + formando.metodo + ")", data: "2026-09-03 18:00", tipo: "pagamento" },
              { acao: avulso ? "Curso e-learning libertado" : "Atribuído à turma " + formando.turma, data: "2026-09-03 18:05", tipo: "turma" },
            ].filter(h => formando.pago || h.tipo !== "pagamento").map((h, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h.tipo === "pagamento" ? "bg-emerald-500" : h.tipo === "email" ? "bg-blue-500" : h.tipo === "turma" ? "bg-violet-500" : "bg-amber-500"}`} />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{h.acao}</p>
                  <p className="text-xs text-slate-400">{h.data}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "notas" && (
          <div className="space-y-3">
            <div className="space-y-2">
              {notas.map(n => (
                <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-slate-700">{n.texto}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.autor} · {n.data}</p>
                </div>
              ))}
            </div>
            <div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} placeholder="Adicionar nota de chamada, email ou observação…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              <button onClick={() => { if (nota.trim()) { setNotas(p => [...p, { id: Date.now(), texto: nota, data: new Date().toISOString().slice(0, 16).replace("T", " "), autor: "Tania" }]); setNota(""); } }}
                className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">Guardar nota</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Fechar</button>
      </div>

      <ReferenciaMbModal
        open={pay === "mb" || pay === "mbway"}
        onClose={() => setPay(null)}
        nome={`${formando.nome} ${formando.apelido}`}
        valor={formando.valor}
        curso={formando.curso}
        modo={pay === "mbway" ? "mbway" : "mb"}
      />
      <EnviarReciboModal
        open={pay === "recibo"}
        onClose={() => setPay(null)}
        nome={`${formando.nome} ${formando.apelido}`}
        valor={formando.valor}
        curso={formando.curso}
        metodo={formando.metodo}
      />
    </div>
  );
}
