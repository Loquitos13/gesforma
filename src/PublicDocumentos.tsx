import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiPublicDocumentoUpload, apiPublicDocumentos, apiPublicEscolherTurma, type PercursoTurma, type PercursoVista } from "./api";

type TipoDoc = { id: string; label: string; required?: boolean };
type Ficheiro = { id: number; tipo: string; nome: string; estado?: string; observacao?: string };
type Passo = "documentos" | "turma" | "pagamento";

function fmtData(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function rotuloSessao(modalidade: string) {
  if (modalidade === "matricula") return "Limite de matrícula";
  if (modalidade === "sincrona") return "Sessão síncrona";
  if (modalidade === "auto") return "Trabalho autónomo";
  return "Sessão";
}

export function PublicDocumentos({ token }: { token: string }) {
  const [vista, setVista] = useState<PercursoVista | null>(null);
  const [passoLocal, setPassoLocal] = useState<Passo>("documentos");
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [foco, setFoco] = useState<string | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [comprovativo, setComprovativo] = useState<File | null>(null);
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function aplicar(r: PercursoVista) {
    setVista(r);
    setTurmaId(r.turmaEscolhida?.id ?? null);
    if (r.passo === "correcao" || r.passo === "documentos") setPassoLocal("documentos");
    else if (r.passo === "turma" || r.passo === "pagamento") setPassoLocal(r.passo);
    setEstado("ready");
  }

  function recarregar() {
    apiPublicDocumentos(token)
      .then(aplicar)
      .catch(err => setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error"));
  }

  useEffect(() => { recarregar(); }, [token]);

  const tipos = vista?.tipos ?? [];
  const ficheiros = vista?.ficheiros ?? [];
  const porTipo = useMemo(() => {
    const map = new Map<string, Ficheiro>();
    for (const f of ficheiros) map.set(f.tipo, f);
    return map;
  }, [ficheiros]);

  const correcao = Boolean(vista?.correcao);
  const precisaPagamento = Boolean(vista?.precisaPagamento);
  const passos: Passo[] = precisaPagamento ? ["documentos", "turma", "pagamento"] : ["documentos", "turma"];
  const passoServidor: Passo = vista?.passo === "pagamento" || vista?.passo === "turma" ? vista.passo : "documentos";
  const indiceServidor = passos.indexOf(passoServidor);
  const activo = passos.includes(passoLocal) ? passoLocal : "documentos";

  function aceite(id: string) {
    const f = porTipo.get(id);
    return Boolean(f) && f?.estado !== "recusado";
  }
  const obrigatorios = tipos.filter(t => t.required || correcao);
  const feitosObrigatorios = obrigatorios.filter(t => aceite(t.id)).length;
  const proximo = tipos.find(t => (t.required || correcao) && !aceite(t.id)) ?? tipos.find(t => !aceite(t.id));
  const activoId = foco && tipos.some(t => t.id === foco) ? foco : proximo?.id ?? null;

  async function submitDoc(e: FormEvent, tipo: TipoDoc) {
    e.preventDefault();
    if (!ficheiro) { setError("Escolha o ficheiro deste documento."); return; }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const r = await apiPublicDocumentoUpload(token, ficheiro, tipo.id);
      setOk(`${tipo.label} ficou na ficha (${r.nome}).`);
      setFicheiro(null);
      setFoco(null);
      recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmarTurma() {
    if (!turmaId) { setError("Escolha uma turma para continuar."); return; }
    setBusy(true);
    setError("");
    try {
      aplicar(await apiPublicEscolherTurma(token, turmaId));
      setOk("Turma reservada.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível reservar a turma.");
    } finally {
      setBusy(false);
    }
  }

  async function enviarComprovativo(e: FormEvent) {
    e.preventDefault();
    if (!comprovativo) { setError("O comprovativo de pagamento é obrigatório."); return; }
    setBusy(true);
    setError("");
    try {
      await apiPublicDocumentoUpload(token, comprovativo, "comprovativo");
      setComprovativo(null);
      recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar o comprovativo.");
    } finally {
      setBusy(false);
    }
  }

  function irPara(passo: Passo) {
    const alvo = passos.indexOf(passo);
    if (alvo <= indiceServidor) {
      setPassoLocal(passo);
      setError("");
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1b2330]">
      <header className="bg-white border-b border-[#e7e1d6]">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <img
            src="/imagens/ena-logo-nobg.png"
            alt="ENA, Escola de Negócios e Administração"
            className="h-9 w-auto"
            onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8172]">Inscrição</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-0 sm:py-12">
        {estado === "loading" && <p className="text-sm text-[#5c564c]">A abrir o seu percurso de inscrição…</p>}
        {estado === "missing" && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Ligação inválida</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Este convite já não está disponível.</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">Peça uma nova ligação à secretaria, em formacao@ena.pt.</p>
          </article>
        )}
        {estado === "error" && <p className="text-sm text-[#5c564c]">Não foi possível abrir a ligação. Tente dentro de momentos.</p>}

        {estado === "ready" && vista?.encerrada && (
          <Concluido vista={vista} />
        )}

        {estado === "ready" && vista && !vista.encerrada && (
          <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e7e1d6]">
            <div className="px-6 pt-7 pb-5 sm:px-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">
                {correcao ? "Documentos a corrigir" : "Percurso de inscrição"}
              </p>
              <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight leading-tight">{vista.nome}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5c564c]">
                {vista.curso}{vista.local ? ` · ${vista.local}` : ""}{vista.horario ? ` · ${vista.horario}` : ""}. Cada passo fica fechado até estar completo. A ligação só encerra no fim.
              </p>
              {!correcao && (
                <ol className={`mt-5 grid gap-2 ${passos.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {passos.map((p, i) => {
                    const feito = i < indiceServidor || (vista.passo === "concluido");
                    const aberto = p === activo;
                    const bloqueado = i > indiceServidor;
                    return (
                      <li key={p}>
                        <button
                          type="button"
                          disabled={bloqueado}
                          onClick={() => irPara(p)}
                          className={`w-full rounded-xl px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide ${aberto ? "bg-[#1b2330] text-white" : feito ? "bg-emerald-50 text-emerald-800" : "bg-[#efeae1] text-[#8a8172]"} disabled:opacity-50`}
                        >
                          {i + 1}. {p === "documentos" ? "Documentos" : p === "turma" ? "Turma" : "Pagamento"}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {(correcao || activo === "documentos") && (
              <Documentos
                tipos={tipos}
                porTipo={porTipo}
                activoId={activoId}
                correcao={correcao}
                feitos={feitosObrigatorios}
                total={obrigatorios.length}
                ficheiro={ficheiro}
                busy={busy}
                error={error}
                ok={ok}
                onFicheiro={setFicheiro}
                onFoco={id => { setFoco(id); setFicheiro(null); setError(""); setOk(""); }}
                onSubmit={submitDoc}
              />
            )}

            {!correcao && activo === "documentos" && vista.docsCompletos && (
              <div className="border-t border-[#efeae1] px-6 py-4 sm:px-8">
                <button type="button" onClick={() => irPara("turma")} className="w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330]">
                  Continuar para a turma
                </button>
              </div>
            )}

            {!correcao && activo === "turma" && (
              <Turmas
                turmas={vista.turmas ?? []}
                escolhida={turmaId}
                onEscolher={id => { setTurmaId(id); setError(""); }}
                busy={busy}
                error={error}
                onConfirmar={() => void confirmarTurma()}
              />
            )}

            {!correcao && activo === "pagamento" && (
              <Pagamento
                vista={vista}
                ficheiro={comprovativo}
                busy={busy}
                error={error}
                onFicheiro={setComprovativo}
                onSubmit={enviarComprovativo}
              />
            )}
          </article>
        )}
      </main>
    </div>
  );
}

function Documentos({
  tipos, porTipo, activoId, correcao, feitos, total, ficheiro, busy, error, ok, onFicheiro, onFoco, onSubmit,
}: {
  tipos: TipoDoc[];
  porTipo: Map<string, Ficheiro>;
  activoId: string | null;
  correcao: boolean;
  feitos: number;
  total: number;
  ficheiro: File | null;
  busy: boolean;
  error: string;
  ok: string;
  onFicheiro: (f: File | null) => void;
  onFoco: (id: string) => void;
  onSubmit: (e: FormEvent, tipo: TipoDoc) => void;
}) {
  return (
    <>
      {total > 0 && (
        <div className="px-6 pb-4 sm:px-8">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold">{feitos} de {total} obrigatórios</span>
            <span className="text-[#8a8172]">Um de cada vez</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efeae1]">
            <div className="h-full rounded-full bg-[#ffa900]" style={{ width: `${Math.round((feitos / total) * 100)}%` }} />
          </div>
        </div>
      )}
      <ol className="divide-y divide-[#efeae1] border-t border-[#efeae1]">
        {tipos.map((t, i) => {
          const anexo = porTipo.get(t.id);
          const recusado = anexo?.estado === "recusado";
          const aberto = t.id === activoId;
          const feito = Boolean(anexo) && !recusado && !aberto;
          return (
            <li key={t.id} className={aberto ? "bg-[#fffaf2]" : "bg-white"}>
              <div className="flex gap-3 px-6 py-4 sm:px-8">
                <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${anexo && !recusado ? "bg-emerald-600 text-white" : recusado ? "bg-red-600 text-white" : aberto ? "bg-[#1b2330] text-white" : "bg-[#efeae1] text-[#8a8172]"}`}>
                  {anexo && !recusado ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{t.label}</p>
                    <span className="text-[11px] uppercase tracking-wide text-[#8a8172]">{recusado ? "A corrigir" : t.required || correcao ? "Obrigatório" : "Opcional"}</span>
                  </div>
                  {anexo && !recusado && <p className="mt-1 truncate text-sm text-emerald-800">{anexo.nome}</p>}
                  {recusado && anexo?.observacao && <p className="mt-1 text-sm text-red-800">{anexo.observacao}</p>}
                  {feito && (
                    <button type="button" className="mt-2 text-xs font-semibold underline decoration-[#ffa900] underline-offset-2" onClick={() => onFoco(t.id)}>Substituir</button>
                  )}
                </div>
              </div>
              {aberto && (
                <form onSubmit={e => onSubmit(e, t)} className="px-6 pb-5 sm:px-8 sm:pl-[4.25rem]">
                  <label className="block rounded-xl border border-dashed border-[#d9c9a3] bg-white px-4 py-4">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a8172]">Ficheiro PDF, JPG ou PNG</span>
                    <input className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1b2330] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" type="file" accept=".pdf,image/jpeg,image/png,application/pdf" onChange={e => onFicheiro(e.target.files?.[0] ?? null)} />
                  </label>
                  {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                  <button type="submit" disabled={busy || !ficheiro} className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
                    {busy ? "A anexar…" : anexo ? `Substituir ${t.label}` : `Anexar ${t.label}`}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ol>
      {ok && <p className="border-t border-[#efeae1] px-6 py-4 text-sm text-emerald-800 sm:px-8">{ok}</p>}
    </>
  );
}

function Cronograma({ turma }: { turma: PercursoTurma }) {
  if (!turma.cronograma.length) return <p className="mt-2 text-xs text-[#8a8172]">Cronograma ainda sem sessões.</p>;
  return (
    <ul className="mt-3 max-h-48 space-y-1 overflow-auto rounded-lg bg-[#faf7f1] px-3 py-2">
      {turma.cronograma.map((s, i) => (
        <li key={`${s.data}-${i}`} className="flex justify-between gap-3 text-xs text-[#3d4450]">
          <span>{fmtData(s.data)}{s.horaInicio ? ` · ${s.horaInicio}${s.horaFim ? `–${s.horaFim}` : ""}` : ""}</span>
          <span className="truncate text-[#8a8172]">{s.modalidade === "matricula" ? rotuloSessao(s.modalidade) : (s.modulos[0] || rotuloSessao(s.modalidade))}</span>
        </li>
      ))}
    </ul>
  );
}

function Turmas({
  turmas, escolhida, onEscolher, busy, error, onConfirmar,
}: {
  turmas: PercursoTurma[];
  escolhida: number | null;
  onEscolher: (id: number) => void;
  busy: boolean;
  error: string;
  onConfirmar: () => void;
}) {
  return (
    <div className="border-t border-[#efeae1] px-6 py-5 sm:px-8">
      <p className="text-sm text-[#5c564c]">Só aparecem turmas activas do curso, local e horário da sua pré-inscrição, com sessões por começar e matrículas ainda abertas.</p>
      {turmas.length === 0 && (
        <p className="mt-4 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm text-[#5c564c]">Não há turma disponível com estes requisitos. A ligação mantém-se aberta.</p>
      )}
      <ul className="mt-4 space-y-3">
        {turmas.map(t => {
          const on = escolhida === t.id;
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onEscolher(t.id)} className={`w-full rounded-xl border px-4 py-3 text-left ${on ? "border-[#1b2330] bg-[#fffaf2]" : "border-[#efeae1] bg-white"}`}>
                <p className="text-sm font-semibold">{t.nome}</p>
                <p className="mt-1 text-xs text-[#5c564c]">{t.local} · {t.horario} · início {fmtData(t.dataInicio)}</p>
                <Cronograma turma={t} />
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="button" disabled={busy || !escolhida} onClick={onConfirmar} className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40">
        {busy ? "A reservar…" : "Confirmar turma"}
      </button>
    </div>
  );
}

function Pagamento({
  vista, ficheiro, busy, error, onFicheiro, onSubmit,
}: {
  vista: PercursoVista;
  ficheiro: File | null;
  busy: boolean;
  error: string;
  onFicheiro: (f: File | null) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const turma = vista.turmaEscolhida;
  const valor = vista.pagamento?.valor ?? vista.preco ?? 0;
  return (
    <form onSubmit={onSubmit} className="border-t border-[#efeae1] px-6 py-5 sm:px-8">
      <div className="rounded-xl bg-[#1b2330] px-5 py-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Transferência</p>
        <p className="mt-3 font-mono text-lg font-semibold tracking-wide">{vista.iban || "IBAN por indicar pela secretaria"}</p>
        <p className="mt-2 font-sans text-sm text-white/80">Valor € {valor.toFixed(2)}{turma ? ` · ${turma.nome}` : ""}</p>
      </div>
      <p className="mt-4 text-sm text-[#5c564c]">Anexe o comprovativo. Sem este ficheiro o percurso não fecha e a ligação continua aberta. A secretaria valida depois os documentos e o pagamento.</p>
      <label className="mt-4 block rounded-xl border border-dashed border-[#d9c9a3] bg-white px-4 py-4">
        <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a8172]">Comprovativo de pagamento</span>
        <input className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1b2330] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" type="file" accept=".pdf,image/jpeg,image/png,application/pdf" onChange={e => onFicheiro(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || !ficheiro} className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40">
        {busy ? "A enviar…" : "Enviar comprovativo e concluir"}
      </button>
    </form>
  );
}

function Concluido({ vista }: { vista: PercursoVista }) {
  const turma = vista.turmaEscolhida;
  const docs = (vista.ficheiros ?? []).filter(f => f.tipo !== "comprovativo" && f.estado !== "recusado");
  return (
    <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Percurso concluído</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{vista.nome}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">
        A ligação de {vista.curso} ficou encerrada. Enviámos um email com o resumo. A secretaria ainda valida os documentos pessoais e o pagamento.
      </p>
      {turma && (
        <dl className="mt-5 space-y-1 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-[#8a8172]">Turma</dt><dd className="font-semibold">{turma.nome}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#8a8172]">Local</dt><dd>{turma.local}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#8a8172]">Horário</dt><dd>{turma.horario}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#8a8172]">Início</dt><dd>{fmtData(turma.dataInicio)}</dd></div>
        </dl>
      )}
      {docs.length > 0 && <p className="mt-4 text-sm text-[#5c564c]">{docs.length} documento{docs.length === 1 ? "" : "s"} na ficha.</p>}
    </article>
  );
}
