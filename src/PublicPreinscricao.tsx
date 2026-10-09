import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiPublicOferta, apiPublicOpcoes, apiPublicPreinscricao } from "./api";
import { CursoOfertaCampos } from "./CursoOfertaCampos";
import { SearchSelect } from "./FormKit";
import { LISTAS_OPCOES } from "./listaOpcoes";
import { precoDaInscricao, type RegraPreco } from "./liveOpts";
import { OFERTA_VAZIA, type CursoOfertaSel, type OfertaTurma } from "./oferta";

export const CONCELHOS = [
  "Águeda", "Albergaria-a-Velha", "Alcobaça", "Almada", "Amadora", "Amarante", "Aveiro",
  "Barcelos", "Beja", "Braga", "Bragança", "Caldas da Rainha", "Cascais", "Castelo Branco",
  "Chaves", "Coimbra", "Covilhã", "Évora", "Fafe", "Faro", "Figueira da Foz", "Funchal",
  "Gondomar", "Guarda", "Guimarães", "Ílhavo", "Lamego", "Leiria", "Lisboa", "Loures",
  "Maia", "Marco de Canaveses", "Matosinhos", "Odivelas", "Oeiras", "Oliveira de Azeméis",
  "Ovar", "Paços de Ferreira", "Palmela", "Paredes", "Penafiel", "Ponta Delgada", "Portalegre",
  "Portimão", "Porto", "Póvoa de Varzim", "Santa Maria da Feira", "Santarém", "Santo Tirso",
  "Seixal", "Setúbal", "Sintra", "Tomar", "Torres Vedras", "Trofa", "Valongo", "Viana do Castelo",
  "Vila do Conde", "Vila Franca de Xira", "Vila Nova de Famalicão", "Vila Nova de Gaia",
  "Vila Real", "Viseu",
];

const ORIGENS = [...LISTAS_OPCOES.origens.fallback];

const fieldCls = "w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1b2330] rounded-none";
const labelCls = "block text-[13px] text-slate-700 mb-1";

export function PublicPreinscricao() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const cursoParam = params.get("curso")?.trim() || "";
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [telf, setTelf] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [concelho, setConcelho] = useState("");
  const [origem, setOrigem] = useState("");
  const [origens, setOrigens] = useState<string[]>(ORIGENS);
  const [oferta, setOferta] = useState<CursoOfertaSel>({ ...OFERTA_VAZIA, curso: cursoParam });
  const [cursos, setCursos] = useState<{ nome: string; preco: number }[]>([]);
  const [turmas, setTurmas] = useState<OfertaTurma[]>([]);
  const [edicoes, setEdicoes] = useState<RegraPreco[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    void apiPublicOferta()
      .then(r => {
        setCursos(r.cursos);
        setTurmas(r.turmas);
        setEdicoes(r.edicoes ?? []);
      })
      .catch(() => setError("Não foi possível carregar as turmas liberadas."));
    void apiPublicOpcoes("origens")
      .then(r => { if (r.opcoes?.length) setOrigens(r.opcoes); })
      .catch(() => undefined);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!nome.trim() || !apelido.trim() || !telf.trim() || !email.trim() || !concelho || !origem) {
      setError("Preencha os seus dados para a secretaria o poder contactar.");
      return;
    }
    if (!oferta.turmaId) {
      setError("Escolha curso, local, horário e data de uma turma libertada.");
      return;
    }
    setBusy(true);
    try {
      await apiPublicPreinscricao({
        nome: nome.trim(),
        apelido: apelido.trim(),
        telf: telf.trim(),
        email: email.trim(),
        concelho,
        origem,
        curso: oferta.curso,
        local: oferta.local,
        horario: oferta.horario,
        inicioCurso: oferta.dataInicio,
        turmaId: oferta.turmaId,
        campanha: params.get("campanha") ?? "",
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente de novo dentro de um minuto.");
    } finally {
      setBusy(false);
    }
  }

  const resumo = [oferta.curso, oferta.local, oferta.horario, oferta.dataInicio].filter(Boolean).join(" · ");
  const preco = precoDaInscricao(cursos, edicoes, {
    curso: oferta.curso,
    local: oferta.local,
    horario: oferta.horario,
    inicio: oferta.dataInicio,
  });

  return (
    <div className="min-h-screen bg-white px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <img
          src="/imagens/ena-logo-nobg.png"
          alt="ENA"
          className="h-10 w-auto mb-10"
          onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
        />
        {done ? (
          <div className="max-w-xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Pré-inscrição recebida</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Será contactado brevemente.</h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Pedido para {resumo || "a formação escolhida"}. A secretaria da ENA liga ou escreve para {email} / {telf}.
              Não existe área de formando online - o próximo passo é este contacto.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-10" noValidate>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">
              Os seus dados
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-8">
              <label>
                <span className={labelCls}>Nome</span>
                <input className={fieldCls} value={nome} onChange={e => setNome(e.target.value)} autoComplete="given-name" />
              </label>
              <label>
                <span className={labelCls}>Apelido</span>
                <input className={fieldCls} value={apelido} onChange={e => setApelido(e.target.value)} autoComplete="family-name" />
              </label>
              <label>
                <span className={labelCls}>Telemóvel</span>
                <input className={fieldCls} value={telf} onChange={e => setTelf(e.target.value)} autoComplete="tel" inputMode="tel" />
              </label>
              <label>
                <span className={labelCls}>Email</span>
                <input className={fieldCls} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </label>
              <label>
                <span className={labelCls}>Concelho</span>
                <SearchSelect value={concelho} onChange={setConcelho} options={CONCELHOS.map(value => ({ value }))} allowEmpty placeholder="Seleccione um concelho" />
              </label>
              <label>
                <span className={labelCls}>Como tomou conhecimento?</span>
                <SearchSelect
                  value={origem}
                  onChange={setOrigem}
                  options={origens.map(o => ({ value: o }))}
                  placeholder="Pesquisar origem…"
                  allowEmpty
                />
              </label>
            </div>

            <CursoOfertaCampos
              turmas={turmas}
              cursos={cursos}
              value={oferta}
              onChange={setOferta}
              cursoLocked={Boolean(cursoParam)}
              preco={preco}
            />
            <p className="text-xs text-slate-500 -mt-6">
              A turma é o conjunto local + horário + data de início. Horário e data só aparecem depois do local, e só se a secretaria tiver libertado essa turma Gold.
            </p>
            {turmas.find(t => t.turmaId === oferta.turmaId)?.cronogramaPublicado && (
              <p className="text-sm -mt-4">
                <a className="font-semibold text-[#1b2330] underline" href={`/cronograma/gold/${oferta.turmaId}`}>
                  Ver o cronograma desta turma
                </a>
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={busy}
                className="min-w-[220px] px-10 py-3 rounded-full bg-[#1b2330] text-white text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-black"
              >
                {busy ? "A enviar…" : "INSCREVER-ME"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
