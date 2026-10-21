import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiPublicOferta, apiPublicPrecoOferta, apiPublicPreinscricao } from "../partilhado/api";
import { CursoOfertaCampos } from "../partilhado/CursoOfertaCampos";
import { SearchSelect } from "../partilhado/FormKit";
import { OFERTA_VAZIA, type CursoOfertaSel, type OfertaTurma } from "../partilhado/oferta";
import { textoListaVazia, useOpcoesPublicas } from "./useOpcoesPublicas";
import { ConsentimentoRgpd } from "./ConsentimentoRgpd";
import { INSCRICAO_FIN_VAZIA, erroTelefoneFin, partirNomeCompleto, validarInscricaoFin, type InscricaoFin } from "../partilhado/dadosPessoaisFin";
import { LISTA_PAISES } from "../partilhado/execucaoFisica";
import { hojeLisboa } from "../partilhado/horaLisboa";
import { CampoFin, CamposInscricaoFin, errosDoServidor, type ErrosForm } from "./DadosPessoaisFin";

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
  const [consentimento, setConsentimento] = useState(false);
  const concelhos = useOpcoesPublicas("concelhos");
  const origens = useOpcoesPublicas("origens");
  const [oferta, setOferta] = useState<CursoOfertaSel>({ ...OFERTA_VAZIA, curso: cursoParam });
  const [cursos, setCursos] = useState<{ nome: string; preco: number; regime?: "gold" | "fin"; inscricao?: string }[]>([]);
  const [turmas, setTurmas] = useState<OfertaTurma[]>([]);
  const [preco, setPreco] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dadosFin, setDadosFin] = useState<InscricaoFin>(INSCRICAO_FIN_VAZIA);
  const [errosFin, setErrosFin] = useState<ErrosForm>({});

  useEffect(() => {
    void apiPublicOferta()
      .then(r => {
        setCursos(r.cursos.filter(c => !c.inscricao || c.inscricao === "Pré-inscrição"));
        setTurmas(r.turmas);
      })
      .catch(() => setError("Não foi possível carregar as turmas liberadas."));
  }, []);

  // O preço vem do servidor: é o mesmo que a pré-inscrição grava para este curso, local e horário.
  const regimeSel = cursos.find(c => c.nome === oferta.curso)?.regime;
  // Financiada: nome completo, género, data de nascimento, nacionalidade, habilitações, telemóvel e email.
  const fin = regimeSel === "fin";
  useEffect(() => {
    if (!oferta.curso) { setPreco(undefined); return; }
    let vivo = true;
    void apiPublicPrecoOferta({ curso: oferta.curso, local: oferta.local, horario: oferta.horario, regime: regimeSel })
      .then(r => { if (vivo) setPreco(r.preco ?? undefined); })
      .catch(() => { if (vivo) setPreco(undefined); });
    return () => { vivo = false; };
  }, [oferta.curso, oferta.local, oferta.horario, regimeSel]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (fin) {
      const erros: ErrosForm = { ...validarInscricaoFin(dadosFin, hojeLisboa(), LISTA_PAISES) };
      const t = erroTelefoneFin(telf);
      if (t) erros.telf = t;
      if (!email.trim()) erros.email = "Indique o email.";
      setErrosFin(erros);
      if (Object.keys(erros).length) { setError("Corrija os campos assinalados."); return; }
    } else if (!nome.trim() || !apelido.trim() || !telf.trim() || !email.trim() || !concelho || !origem) {
      setError("Preencha os seus dados para a secretaria o poder contactar.");
      return;
    }
    if (!consentimento) {
      setError("Para enviar, aceite a política de privacidade.");
      return;
    }
    const cursoSel = cursos.find(c => c.nome === oferta.curso);
    const temTurma = turmas.some(t => t.curso === oferta.curso && (!t.regime || t.regime === (cursoSel?.regime ?? "gold")));
    if (temTurma && !oferta.turmaId) {
      setError("Escolha local, horário e data de uma turma libertada.");
      return;
    }
    setBusy(true);
    try {
      const nomes = fin ? partirNomeCompleto(dadosFin.nomeCompleto) : { nome: nome.trim(), apelido: apelido.trim() };
      await apiPublicPreinscricao({
        nome: nomes.nome,
        apelido: nomes.apelido,
        telf: telf.trim(),
        email: email.trim(),
        concelho,
        origem,
        curso: oferta.curso,
        local: oferta.local,
        horario: oferta.horario,
        inicioCurso: oferta.dataInicio || undefined,
        turmaId: oferta.turmaId || undefined,
        regime: cursoSel?.regime ?? "gold",
        campanha: params.get("campanha") ?? "",
        consentimento,
        ...(fin ? { dadosFin } : {}),
      });
      setDone(true);
    } catch (err) {
      if (fin && err instanceof ApiError && err.campos?.length) setErrosFin(errosDoServidor(err.campos));
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente de novo dentro de um minuto.");
    } finally {
      setBusy(false);
    }
  }

  const resumo = [oferta.curso, oferta.local, oferta.horario, oferta.dataInicio].filter(Boolean).join(" · ");

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
            {fin ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-8">
                <CamposInscricaoFin valor={dadosFin} onMudar={setDadosFin} erros={errosFin} inputCls={fieldCls} rotuloCls={labelCls} />
                <CampoFin id="fin-telf" rotulo="Telemóvel" erro={errosFin.telf} rotuloCls={labelCls}>
                  {p => <input {...p} className={fieldCls} value={telf} onChange={e => setTelf(e.target.value)} autoComplete="tel" inputMode="tel" />}
                </CampoFin>
                <CampoFin id="fin-email" rotulo="Email" erro={errosFin.email} rotuloCls={labelCls}>
                  {p => <input {...p} className={fieldCls} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />}
                </CampoFin>
              </div>
            ) : (
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
                <SearchSelect
                  value={concelho}
                  onChange={setConcelho}
                  options={concelhos.nomes.map(value => ({ value }))}
                  allowEmpty
                  placeholder="Seleccione um concelho"
                  empty={textoListaVazia(concelhos.estado, "A secretaria ainda não definiu concelhos em Listas de opções.")}
                />
              </label>
              <label>
                <span className={labelCls}>Como tomou conhecimento?</span>
                <SearchSelect
                  value={origem}
                  onChange={setOrigem}
                  options={origens.nomes.map(value => ({ value }))}
                  placeholder="Pesquisar origem…"
                  allowEmpty
                  empty={textoListaVazia(origens.estado, "A secretaria ainda não definiu origens em Listas de opções.")}
                />
              </label>
            </div>
            )}

            <CursoOfertaCampos
              turmas={turmas.filter(t => {
                const cursoSel = cursos.find(c => c.nome === oferta.curso);
                return !oferta.curso || !t.regime || t.regime === (cursoSel?.regime ?? t.regime);
              })}
              cursos={cursos}
              value={oferta}
              onChange={setOferta}
              cursoLocked={Boolean(cursoParam)}
              preco={preco}
            />
            <p className="text-xs text-slate-500 -mt-6">
              A turma é o conjunto local + horário + data de início. Horário e data só aparecem depois do local, e só se a secretaria tiver libertado essa turma. Sem turma, o pedido fica na mesma registado.
            </p>
            {(() => {
              const escolhida = turmas.find(t => t.turmaId === oferta.turmaId);
              if (!escolhida?.cronogramaPublicado) return null;
              return (
                <p className="text-sm -mt-4">
                  <a className="font-semibold text-[#1b2330] underline" href={`/cronograma/${escolhida.regime || "gold"}/${oferta.turmaId}`}>
                    Ver o cronograma desta turma
                  </a>
                </p>
              );
            })()}

            <ConsentimentoRgpd aceite={consentimento} onMudar={setConsentimento} />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
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
