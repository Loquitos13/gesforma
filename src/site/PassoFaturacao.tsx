import { useState, type FormEvent } from "react";
import { ApiError, type DadosFaturacao } from "../partilhado/api";
import { CampoFin } from "./DadosPessoaisFin";

const inputCls = "w-full rounded-lg border border-[#e7e1d6] bg-white px-3 py-2.5 text-sm text-[#1b2330] outline-none focus:border-[#1b2330] aria-[invalid=true]:border-red-700";
const rotuloCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8172]";

const CAMPOS: { chave: keyof DadosFaturacao; rotulo: string; largo?: boolean; tipo?: string; auto?: string; max: number; ajuda?: string }[] = [
  { chave: "nome", rotulo: "Nome ou empresa", largo: true, auto: "name", max: 200 },
  { chave: "nif", rotulo: "NIF", auto: "off", max: 20, ajuda: "O da empresa, se a fatura for em nome dela." },
  { chave: "email", rotulo: "Email para a fatura", tipo: "email", auto: "email", max: 200 },
  { chave: "moradaFiscal", rotulo: "Morada fiscal", largo: true, auto: "street-address", max: 300 },
  { chave: "codigoPostal", rotulo: "Código postal", auto: "postal-code", max: 20, ajuda: "0000-000" },
];

/**
 * Dados de faturação, logo a seguir ao comprovativo (passo de pagamento da ligação pessoal). Vêm com os dados da
 * pré-inscrição e alteram-se (fatura em nome de uma empresa). Seguem para a contabilidade com o comprovativo.
 */
export function PassoFaturacao({ dados, confirmado, destaque, onGravar }: {
  dados: DadosFaturacao;
  confirmado: boolean;
  /** Em destaque enquanto faltam (logo depois de anexar o comprovativo). */
  destaque: boolean;
  onGravar: (dados: DadosFaturacao) => Promise<void>;
}) {
  const [f, setF] = useState<DadosFaturacao>(dados);
  const [editar, setEditar] = useState(!confirmado);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Partial<Record<keyof DadosFaturacao, string>>>({});

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro("");
    setErros({});
    try {
      await onGravar({ ...f, nif: f.nif.replace(/\s/g, "") });
      setEditar(false);
    } catch (err) {
      if (err instanceof ApiError && err.campos?.length) {
        setErros(Object.fromEntries(err.campos.map(c => [c.campo, c.erro])));
        setErro("Confira os campos assinalados.");
      } else {
        setErro(err instanceof ApiError ? err.message : "Não foi possível gravar os dados de faturação.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="faturacao" className={`border-t border-[#efeae1] px-6 py-5 sm:px-8 ${destaque && editar ? "bg-[#fff6e0] ring-2 ring-inset ring-[color:var(--lig-d,#ffa900)]" : ""}`}>
      <p className="text-sm font-semibold">Dados de faturação</p>
      {!editar ? (
        <div className="mt-2 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm ring-1 ring-[#efeae1]">
          <p className="font-semibold text-emerald-800">Confirmados. A fatura sai com estes dados.</p>
          <p className="mt-2 break-words">{dados.nome} · NIF {dados.nif}</p>
          <p className="mt-0.5 break-words text-[#5c564c]">{dados.moradaFiscal}, {dados.codigoPostal}</p>
          <p className="mt-0.5 break-all text-[#5c564c]">{dados.email}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline decoration-[color:var(--lig-d,#ffa900)] underline-offset-2"
            onClick={() => { setF(dados); setEditar(true); }}>
            Alterar os dados de faturação
          </button>
        </div>
      ) : (
        <form onSubmit={e => void submeter(e)} noValidate>
          <p className="mt-1 text-sm text-[#5c564c]">
            {confirmado
              ? "Corrija o que for preciso e confirme."
              : "Para emitirmos a fatura, confirme os dados. Já vêm com os seus dados pessoais; se a fatura for em nome de uma empresa, altere-os."}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {CAMPOS.map(c => (
              <CampoFin key={c.chave} id={`fat-${c.chave}`} rotulo={c.rotulo} erro={erros[c.chave]} ajuda={c.ajuda} rotuloCls={rotuloCls} className={c.largo ? "sm:col-span-2" : ""}>
                {p => (
                  <input {...p} className={inputCls} type={c.tipo ?? "text"} autoComplete={c.auto} maxLength={c.max}
                    inputMode={c.chave === "nif" ? "numeric" : undefined}
                    value={f[c.chave]} onChange={e => setF({ ...f, [c.chave]: e.target.value })} />
                )}
              </CampoFin>
            ))}
          </div>
          {erro && <p className="mt-3 text-sm text-red-700" role="alert">{erro}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-[color:var(--lig-d,#ffa900)] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
              {busy ? "A gravar…" : "Confirmar dados de faturação"}
            </button>
            {confirmado && (
              <button type="button" disabled={busy} onClick={() => { setEditar(false); setErro(""); setErros({}); }}
                className="w-full rounded-lg border border-[#e7e1d6] px-4 py-3 text-sm font-semibold disabled:opacity-40 sm:w-auto">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
