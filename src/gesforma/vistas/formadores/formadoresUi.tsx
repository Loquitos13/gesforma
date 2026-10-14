import { apiMeuFormador } from "../../../partilhado/api/formadores";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Cartao, Vazio, data } from "../../../partilhado/ui";

/** Estado do CCP (falta, por registar, expirado, a expirar ou válido). */
export function estadoCcp(f: { ccp: string; ccpValidade: string; ccpExpirado: boolean; ccpAExpirar: boolean }) {
  if (!f.ccp) return { texto: "Sem CCP registado", tom: "perigo" as const };
  if (!f.ccpValidade) return { texto: "Validade por registar", tom: "neutro" as const };
  if (f.ccpExpirado) return { texto: `Expirou a ${data(f.ccpValidade)}`, tom: "perigo" as const };
  if (f.ccpAExpirar) return { texto: `Expira a ${data(f.ccpValidade)}`, tom: "aviso" as const };
  return { texto: `Válido até ${data(f.ccpValidade)}`, tom: "sucesso" as const };
}

export function Iniciais({ nome }: { nome: string }) {
  const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  return <span aria-hidden="true" className="w-9 h-9 shrink-0 rounded-full bg-ligacao-suave text-ligacao text-sm font-semibold inline-flex items-center justify-center">{ini || "?"}</span>;
}

/** Ficha de formador da conta autenticada (área do formador). */
export function useMeuFormador() {
  return useRecurso("formador:eu", s => apiMeuFormador(s));
}

export function SemFicha() {
  return (
    <Cartao>
      <Vazio compacto titulo="Conta ainda sem ficha de formador" descricao="A secretaria ainda não associou esta conta a uma ficha de formador. Fale com a secretaria da ENA." />
    </Cartao>
  );
}
