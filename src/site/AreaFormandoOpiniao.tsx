// Área do formando: a pílula «Deixe a sua opinião» e a janela onde o formando escreve o seu testemunho.
// Pode falar da ENA em geral ou de um curso; só aparece no site depois de aprovado e se autorizar a publicação.
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  apiApagarMeuTestemunho, apiGravarMeuTestemunho, apiMeuTestemunho, apiSugestoesCursos, type CursoSugerido, type TestemunhoFormando,
} from "../partilhado/api/site";

export function PilulaOpiniao({ nome, apelido, cursos }: { nome: string; apelido: string; cursos: string[] }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberta(true)}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--c-acento,#FFA900)] px-4 py-2 text-sm font-bold text-[var(--c-primaria,#1C3350)] hover:brightness-95">
        <span aria-hidden="true">★</span> Deixe a sua opinião
      </button>
      {aberta && <JanelaOpiniao nomeSugerido={`${nome} ${apelido ? `${apelido.trim()[0]}.` : ""}`.trim()} cursos={cursos} onFechar={() => setAberta(false)} />}
    </>
  );
}

function JanelaOpiniao({ nomeSugerido, cursos, onFechar }: { nomeSugerido: string; cursos: string[]; onFechar: () => void }) {
  const [atual, setAtual] = useState<TestemunhoFormando | null | undefined>(undefined);
  const [f, setF] = useState({ nome: nomeSugerido, curso: "", texto: "", estrelas: 5, autorizaPublicar: true });
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiMeuTestemunho()
      .then(r => {
        setAtual(r.testemunho);
        if (r.testemunho) setF({ nome: r.testemunho.nome, curso: r.testemunho.curso, texto: r.testemunho.texto, estrelas: r.testemunho.estrelas, autorizaPublicar: r.testemunho.autorizaPublicar });
      })
      .catch(() => setAtual(null));
    caixa.current?.focus();
  }, []);
  // À parte do carregamento: um redesenho do painel não pode voltar a ler (e apagar o que se está a escrever).
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (f.texto.trim().length < 10) { setErro("Escreva pelo menos uma frase."); return; }
    setAGravar(true);
    try {
      setAtual((await apiGravarMeuTestemunho({ ...f, nome: f.nome.trim(), texto: f.texto.trim() })).testemunho);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setAGravar(false);
    }
  }

  async function apagar() {
    setAGravar(true);
    try { await apiApagarMeuTestemunho(); setAtual(null); setF({ ...f, texto: "" }); } finally { setAGravar(false); }
  }

  const campo = "w-full border border-[var(--c-primaria,#1C3350)]/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--c-destaque,#A60000)]";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-opiniao"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-white p-6 text-[var(--c-primaria,#1C3350)] shadow-2xl outline-none">
        <div className="flex items-start justify-between gap-4">
          <h2 id="titulo-opiniao" className="font-serif text-2xl font-bold">A sua opinião</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-2xl leading-none opacity-60 hover:opacity-100">×</button>
        </div>
        {!enviado && <p className="mt-2 text-sm opacity-70">Conte-nos como foi a sua experiência na ENA. Pode falar de um curso em particular, se quiser.</p>}
        {enviado ? <Obrigado onFechar={onFechar} /> : atual === undefined ? <p className="mt-6 text-sm opacity-60">A carregar…</p> : (
          <form onSubmit={enviar} className="mt-5 flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1 text-sm font-bold">Classificação</legend>
              <div role="radiogroup" aria-label="Estrelas" className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" role="radio" aria-checked={f.estrelas === n} aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                    onClick={() => setF({ ...f, estrelas: n })}
                    className={`text-3xl leading-none ${n <= f.estrelas ? "text-[var(--c-acento,#FFA900)]" : "text-black/15"}`}>★</button>
                ))}
              </div>
            </fieldset>
            <label className="text-sm font-bold">Sobre
              <select className={`${campo} mt-1 font-normal`} value={f.curso} onChange={e => setF({ ...f, curso: e.target.value })}>
                <option value="">A ENA em geral</option>
                {cursos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">A sua opinião
              <textarea className={`${campo} mt-1 min-h-32 font-normal`} maxLength={1200} value={f.texto} onChange={e => setF({ ...f, texto: e.target.value })}
                placeholder="O que mais gostou? O que mudou para si depois da formação?" />
            </label>
            <label className="text-sm font-bold">Nome a mostrar
              <input className={`${campo} mt-1 font-normal`} maxLength={60} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={f.autorizaPublicar} onChange={e => setF({ ...f, autorizaPublicar: e.target.checked })} />
              <span>Autorizo a ENA a publicar esta opinião no site, com o nome acima. Posso apagá-la quando quiser.</span>
            </label>
            {erro && <p role="alert" className="text-sm font-semibold text-[var(--c-destaque,#A60000)]">{erro}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {atual ? <button type="button" onClick={() => void apagar()} disabled={aGravar} className="text-sm font-semibold underline opacity-70">Apagar a minha opinião</button> : <span />}
              <button type="submit" disabled={aGravar || f.nome.trim().length < 2}
                className="bg-[var(--c-destaque,#A60000)] px-5 py-3 text-sm font-bold text-white hover:brightness-90 disabled:opacity-50">
                {aGravar ? "A enviar…" : atual ? "Enviar alterações" : "Enviar opinião"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Depois de enviar: o agradecimento e os próximos cursos (da área temática do que o formando fez). */
function Obrigado({ onFechar }: { onFechar: () => void }) {
  const [cursos, setCursos] = useState<CursoSugerido[] | null>(null);
  useEffect(() => { apiSugestoesCursos().then(r => setCursos(r.cursos)).catch(() => setCursos([])); }, []);
  return (
    <div className="mt-5">
      <p className="bg-[#F4F1EC] px-4 py-3 font-semibold">Testemunho recebido. Muito obrigado por enviar a sua opinião.</p>
      {cursos && cursos.length > 0 && (
        <>
          <p className="mt-6 text-sm font-bold">Fique a par dos próximos cursos:</p>
          <ul className="mt-3 flex flex-col gap-3">
            {cursos.map(c => (
              <li key={c.id}>
                <a href={`/formacao/${encodeURIComponent(c.id)}`} className="flex gap-3 border border-[var(--c-primaria,#1C3350)]/10 p-3 hover:border-[var(--c-destaque,#A60000)]">
                  {c.imagem && <img src={c.imagem} alt="" className="h-16 w-24 shrink-0 object-cover" />}
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--c-destaque,#A60000)]">{c.area}</span>
                    <strong className="block font-serif">{c.titulo}</strong>
                    <span className="block text-xs opacity-65">{[c.modalidade, c.inicio, c.preco].filter(Boolean).join(" · ")}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onFechar} className="bg-[var(--c-primaria,#1C3350)] px-5 py-3 text-sm font-bold text-white hover:brightness-110">Fechar</button>
      </div>
    </div>
  );
}
