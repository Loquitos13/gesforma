// Ligação pessoal da formação financiada: os passos antes dos documentos (Morada, Identificação, Termos).
// Cada «Seguinte» grava o passo no servidor (que valida com as mesmas regras e cifra os dados). Ao retomar, os
// valores sensíveis vêm mascarados: em branco ficam como estavam; escritos de novo, substituem.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiPublicDadosFin, type DadosFinLigacao } from "../partilhado/api";
import {
  IDENTIFICACAO_FIN_VAZIA, SITUACOES_EMPREGO_FIN, TIPOS_DOCUMENTO_FIN, situacaoEmpregoFin, validarIdentificacaoFin,
  validarMoradaFin, type IdentificacaoFinForm, type MoradaFin,
} from "../partilhado/dadosPessoaisFin";
import { SearchSelect } from "../partilhado/FormKit";
import { hojeLisboa } from "../partilhado/horaLisboa";
import { CampoFin, errosDoServidor, type ErrosForm } from "./DadosPessoaisFin";
import { textoListaVazia, useOpcoesPublicas } from "./useOpcoesPublicas";

export type EtapaFin = "morada" | "identificacao" | "termos";
const ETAPAS: [EtapaFin, string][] = [["morada", "Morada"], ["identificacao", "Identificação"], ["termos", "Termos"]];

const inputCls = "w-full rounded-lg border border-[#e7e1d6] bg-white px-3 py-2.5 text-sm text-[#1b2330] outline-none focus:border-[#1b2330] aria-[invalid=true]:border-red-700";
const rotuloCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8172]";

/** Primeiro passo por fazer (ou o dos termos, quando está tudo feito e a pessoa volta atrás). */
export function etapaInicial(d: DadosFinLigacao): EtapaFin {
  if (!d.moradaCompleta) return "morada";
  if (!d.identificacaoCompleta) return "identificacao";
  return "termos";
}

export function PercursoDadosFin({ token, dados, etapaAbrir, onGuardado, onDocumentos, onFechada }: {
  token: string;
  dados: DadosFinLigacao;
  etapaAbrir: EtapaFin;
  /** Depois de gravar um passo: volta a ler a ligação (sem sair destes passos). */
  onGuardado: () => Promise<void>;
  /** Termos aceites: segue para os documentos. */
  onDocumentos: () => void;
  /** A ligação fechou entretanto (410). */
  onFechada: () => void;
}) {
  const [etapa, setEtapa] = useState<EtapaFin>(etapaAbrir);
  const [morada, setMorada] = useState<MoradaFin>(dados.morada);
  const [ident, setIdent] = useState<IdentificacaoFinForm>(() => ({
    ...IDENTIFICACAO_FIN_VAZIA,
    tipoDocumento: dados.identificacao.tipoDocumento || IDENTIFICACAO_FIN_VAZIA.tipoDocumento,
    validadeDocumento: dados.identificacao.validadeDocumento,
    situacaoEmprego: dados.identificacao.situacaoEmprego,
  }));
  const [termos, setTermos] = useState(Boolean(dados.termos));
  const [usoDados, setUsoDados] = useState(Boolean(dados.termos));
  const [verTermos, setVerTermos] = useState(false);
  const [erros, setErros] = useState<ErrosForm>({});
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const concelhos = useOpcoesPublicas("concelhos");
  const guardados = dados.identificacao.guardados;
  const hoje = hojeLisboa();

  useEffect(() => { setEtapa(etapaAbrir); }, [etapaAbrir]);

  function ir(n: EtapaFin) {
    setErros({});
    setErro("");
    setEtapa(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function gravar(passo: EtapaFin, corpo: Record<string, unknown>, locais: ErrosForm, depois: () => void) {
    const limpos = Object.fromEntries(Object.entries(locais).filter(([, v]) => v));
    setErros(limpos);
    if (Object.keys(limpos).length) { setErro("Corrija os campos assinalados."); return; }
    setBusy(true);
    setErro("");
    try {
      await apiPublicDadosFin(token, passo, corpo);
      await onGuardado();
      depois();
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) { onFechada(); return; }
      if (err instanceof ApiError && err.campos?.length) setErros(errosDoServidor(err.campos));
      setErro(err instanceof ApiError ? err.message : "Não foi possível gravar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function seguinte(e: FormEvent) {
    e.preventDefault();
    if (etapa === "morada") {
      void gravar("morada", morada, validarMoradaFin(morada, concelhos.nomes), () => ir("identificacao"));
    } else if (etapa === "identificacao") {
      const sit = situacaoEmpregoFin(ident.situacaoEmprego);
      // Independente: o NIF de trabalhador independente é o seu (o servidor faz o mesmo se ficar em branco).
      const corpo = sit?.pedeNifEntidade === "independente" && !ident.nifEntidadeEmpregadora.trim() && ident.nif.trim()
        ? { ...ident, nifEntidadeEmpregadora: ident.nif }
        : ident;
      const locais = validarIdentificacaoFin(corpo, hoje, guardados);
      if (sit?.pedeNifEntidade === "independente" && locais.nifEntidadeEmpregadora && !corpo.nifEntidadeEmpregadora.trim() && guardados.includes("nif")) {
        delete locais.nifEntidadeEmpregadora;
      }
      void gravar("identificacao", corpo, locais, () => ir("termos"));
    } else {
      void gravar("termos", { termos, dados: usoDados }, {
        termos: termos ? undefined : "Para continuar, aceite os termos e condições.",
        dados: usoDados ? undefined : "Para continuar, autorize o uso dos dados pessoais.",
      }, onDocumentos);
    }
  }

  const sit = situacaoEmpregoFin(ident.situacaoEmprego);
  const mascara = (k: keyof DadosFinLigacao["identificacao"]["mascarados"]) =>
    guardados.includes(k) ? `Guardado: ${dados.identificacao.mascarados[k]} (em branco, mantém-se)` : undefined;
  const setM = (k: keyof MoradaFin) => (e: { target: { value: string } }) => setMorada(m => ({ ...m, [k]: e.target.value }));
  const setI = (k: keyof IdentificacaoFinForm) => (e: { target: { value: string } }) => setIdent(m => ({ ...m, [k]: e.target.value }));
  const indice = ETAPAS.findIndex(([id]) => id === etapa);

  return (
    <section className="border-t border-[#efeae1]">
      <ol className="grid grid-cols-4 gap-2 px-6 pt-5 sm:px-8">
        {[...ETAPAS, ["documentos", "Documentos"] as const].map(([id, rotulo], i) => (
          <li key={id} className={`rounded-xl px-2 py-2 text-xs ${id === etapa ? "bg-[#1b2330] text-white" : i < indice ? "bg-emerald-50 text-emerald-900" : "bg-[#efeae1] text-[#8a8172]"}`}>
            <span className="block font-bold">{i + 1}</span>{rotulo}
          </li>
        ))}
      </ol>
      <form onSubmit={seguinte} noValidate className="px-6 py-5 sm:px-8">
        {etapa === "morada" && (
          <>
            <h2 className="text-lg font-semibold">Morada</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Campo id="fin-morada" rotulo="Morada / Rua" erro={erros.morada} className="sm:col-span-2">
                {p => <input {...p} className={inputCls} value={morada.morada} onChange={setM("morada")} autoComplete="street-address" maxLength={200} />}
              </Campo>
              <Campo id="fin-localidade" rotulo="Localidade" erro={erros.localidade}>
                {p => <input {...p} className={inputCls} value={morada.localidade} onChange={setM("localidade")} autoComplete="address-level2" maxLength={80} />}
              </Campo>
              <Campo id="fin-codigoPostal" rotulo="Código postal" erro={erros.codigoPostal}>
                {p => <input {...p} className={inputCls} value={morada.codigoPostal} inputMode="numeric" autoComplete="postal-code" placeholder="0000-000"
                  onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 7); setMorada(m => ({ ...m, codigoPostal: d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d })); }} />}
              </Campo>
              <div className="min-w-0 sm:col-span-2">
                <span className={rotuloCls}>Concelho</span>
                <SearchSelect value={morada.concelho} onChange={v => setMorada(m => ({ ...m, concelho: v }))} options={concelhos.nomes.map(value => ({ value }))}
                  allowEmpty placeholder="Pesquisar concelho" emptyLabel="Seleccione o concelho"
                  empty={textoListaVazia(concelhos.estado, "A secretaria ainda não definiu concelhos.")} />
                {erros.concelho && <p className="mt-1 text-xs text-red-700">{erros.concelho}</p>}
              </div>
            </div>
          </>
        )}

        {etapa === "identificacao" && (
          <>
            <h2 className="text-lg font-semibold">Identificação</h2>
            <p className="mt-1 text-sm text-[#5c564c]">Necessários para a colocação na turma e para o reembolso. Ficam cifrados e só a secretaria da formação financiada os vê.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Campo id="fin-tipoDocumento" rotulo="Documento de identificação" erro={erros.tipoDocumento}>
                {p => (
                  <select {...p} className={inputCls} value={ident.tipoDocumento} onChange={setI("tipoDocumento")}>
                    {TIPOS_DOCUMENTO_FIN.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </Campo>
              <Campo id="fin-numeroDocumento" rotulo="N.º do documento" erro={erros.numeroDocumento} ajuda={mascara("numeroDocumento")}>
                {p => <input {...p} className={inputCls} value={ident.numeroDocumento} onChange={setI("numeroDocumento")} autoComplete="off" maxLength={20}
                  placeholder={ident.tipoDocumento === "Cartão de Cidadão" ? "12345678 0 ZZ0" : undefined} />}
              </Campo>
              <Campo id="fin-validadeDocumento" rotulo="Validade do documento" erro={erros.validadeDocumento}>
                {p => <input {...p} type="date" className={inputCls} value={ident.validadeDocumento} onChange={setI("validadeDocumento")} min={hoje} />}
              </Campo>
              <Campo id="fin-nif" rotulo="NIF" erro={erros.nif} ajuda={mascara("nif")}>
                {p => <input {...p} className={inputCls} value={ident.nif} onChange={setI("nif")} inputMode="numeric" autoComplete="off" maxLength={12} />}
              </Campo>
              <Campo id="fin-niss" rotulo="NISS" erro={erros.niss} ajuda={mascara("niss") ?? "11 dígitos (Segurança Social)."}>
                {p => <input {...p} className={inputCls} value={ident.niss} onChange={setI("niss")} inputMode="numeric" autoComplete="off" maxLength={14} />}
              </Campo>
              <Campo id="fin-iban" rotulo="IBAN / NIB" erro={erros.iban} ajuda={mascara("iban") ?? "Conta para receber os apoios da formação."}>
                {p => <input {...p} className={inputCls} value={ident.iban} onChange={setI("iban")} autoComplete="off" maxLength={40} placeholder="PT50 …" />}
              </Campo>
            </div>
            <div className="mt-6 grid gap-4 border-t border-[#efeae1] pt-5 sm:grid-cols-2">
              <Campo id="fin-situacaoEmprego" rotulo="Situação de emprego" erro={erros.situacaoEmprego} className="sm:col-span-2">
                {p => (
                  <select {...p} className={inputCls} value={ident.situacaoEmprego}
                    onChange={e => {
                      const nova = situacaoEmpregoFin(e.target.value);
                      setIdent(m => ({
                        ...m, situacaoEmprego: e.target.value,
                        // Independente: o NIF da actividade é, por omissão, o próprio (pode mudar-se).
                        nifEntidadeEmpregadora: nova?.pedeNifEntidade === "independente" && !m.nifEntidadeEmpregadora ? m.nif : m.nifEntidadeEmpregadora,
                      }));
                    }}>
                    <option value="">Seleccione</option>
                    {SITUACOES_EMPREGO_FIN.map(s => <option key={s.rotulo} value={s.rotulo}>{s.rotulo}</option>)}
                  </select>
                )}
              </Campo>
              {sit?.pedeNifEntidade && (
                <Campo id="fin-nifEntidadeEmpregadora" erro={erros.nifEntidadeEmpregadora} className="sm:col-span-2"
                  rotulo={sit.pedeNifEntidade === "independente" ? "NIF de trabalhador independente" : "NIF da entidade empregadora"}
                  ajuda={mascara("nifEntidadeEmpregadora") ?? (sit.pedeNifEntidade === "independente" ? "Normalmente, o seu NIF." : undefined)}>
                  {p => <input {...p} className={inputCls} value={ident.nifEntidadeEmpregadora} onChange={setI("nifEntidadeEmpregadora")} inputMode="numeric" autoComplete="off" maxLength={12} />}
                </Campo>
              )}
            </div>
          </>
        )}

        {etapa === "termos" && (
          <>
            <h2 className="text-lg font-semibold">Termos e condições</h2>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm leading-6">
              <input type="checkbox" className="mt-1 accent-[#ffa900]" checked={termos} onChange={e => setTermos(e.target.checked)} aria-invalid={Boolean(erros.termos)} />
              <span>Li e aceito os <button type="button" onClick={() => setVerTermos(true)} className="font-semibold underline decoration-[#ffa900] underline-offset-2">termos e condições</button>.</span>
            </label>
            {erros.termos && <p className="mt-1 text-xs text-red-700">{erros.termos}</p>}
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm leading-6">
              <input type="checkbox" className="mt-1 accent-[#ffa900]" checked={usoDados} onChange={e => setUsoDados(e.target.checked)} aria-invalid={Boolean(erros.dados)} />
              <span>{dados.consentimentoTexto}</span>
            </label>
            {erros.dados && <p className="mt-1 text-xs text-red-700">{erros.dados}</p>}
            <p className="mt-4 text-xs text-[#8a8172]">Sem as duas aceitações não é possível enviar os documentos.</p>
          </>
        )}

        {erro && <p className="mt-5 text-sm text-red-700" role="alert">{erro}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {indice > 0 ? (
            <button type="button" disabled={busy} onClick={() => ir(ETAPAS[indice - 1]![0])} className="rounded-lg border border-[#e7e1d6] px-5 py-3 text-sm font-semibold disabled:opacity-40">
              ‹ Voltar
            </button>
          ) : <span />}
          <button type="submit" disabled={busy} className="rounded-lg bg-[#1b2330] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "A gravar…" : etapa === "termos" ? "Seguinte: documentos ›" : "Seguinte ›"}
          </button>
        </div>
      </form>

      {verTermos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="termos-titulo">
          <button type="button" className="absolute inset-0 bg-[#1b2330]/50" aria-label="Fechar" onClick={() => setVerTermos(false)} />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white px-6 py-6 shadow-xl sm:rounded-2xl">
            <h3 id="termos-titulo" className="text-lg font-semibold">Termos e condições</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#3d3830]">
              {dados.termosTexto.map(t => <li key={t}>{t}</li>)}
            </ul>
            <p className="mt-4 text-xs text-[#8a8172]">Versão {dados.termosVersao}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setVerTermos(false)} className="rounded-lg border border-[#e7e1d6] px-5 py-3 text-sm font-semibold">Fechar</button>
              <button type="button" onClick={() => { setTermos(true); setVerTermos(false); }} className="rounded-lg bg-[#ffa900] px-5 py-3 text-sm font-semibold text-[#1b2330]">Li e aceito</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Campo(props: { id: string; rotulo: string; erro?: string; ajuda?: string; className?: string; children: Parameters<typeof CampoFin>[0]["children"] }): ReactNode {
  return <CampoFin {...props} rotuloCls={rotuloCls} />;
}
