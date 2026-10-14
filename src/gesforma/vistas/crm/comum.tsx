// Peças partilhadas pelos ecrãs do diretório comercial (clientes, parceiros, contratos) e da equipa.
import { useAuth } from "../../../partilhado/AuthGate";
import { Estado, type Migalha, type Tom } from "../../../partilhado/ui";
import type { Vista } from "../../rotasGesforma";
import type { Navegar } from "../../shell/tipos";

export type Regime = "gold" | "fin";

export function regimeDaVista(view: Vista): Regime {
  return view.startsWith("fin-") ? "fin" : "gold";
}

/** Migalhas "Gold / CRM / Clientes" (ou Financiada). */
export function trilhoCrm(view: Vista, navigate: Navegar, pagina: string, secao = "CRM"): Migalha[] {
  const fin = regimeDaVista(view) === "fin";
  return [
    { rotulo: fin ? "Financiada" : "Gold", onClick: () => navigate(fin ? "fin-painel" : "gold-painel") },
    { rotulo: secao },
    { rotulo: pagina },
  ];
}

const TOM_ESTADO: Record<string, Tom> = {
  Enviada: "info",
  "Negociação": "aviso",
  Aceite: "sucesso",
  Recusada: "perigo",
  Expirada: "neutro",
  "Sem propostas": "neutro",
  Rascunho: "neutro",
  "Por assinar": "aviso",
  Assinado: "sucesso",
  Cancelado: "perigo",
  "Não contactado": "aviso",
  "1º Contacto": "info",
  "2º Contacto": "info",
  Pago: "sucesso",
  Formando: "sucesso",
  Desistiu: "perigo",
};

export function tomEstado(estado: string): Tom {
  return TOM_ESTADO[estado] ?? "neutro";
}

export function EstadoDoc({ estado }: { estado: string }) {
  return <Estado tom={tomEstado(estado)} ponto>{estado === "Negociação" ? "Em negociação" : estado}</Estado>;
}

/** Administração e secretaria: apagam registos e editam modelos (o servidor confirma). */
export function useGestao() {
  const { user } = useAuth();
  return user.role === "admin" || user.role === "secretaria";
}

export function useEu() {
  return useAuth().user;
}

/** Converte "1 250,50" ou "1250.5" em número; vazio dá 0. */
export function numeroDe(texto: string) {
  const n = Number(texto.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Iniciais para o avatar. */
export function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1]![0] : "")).toUpperCase() || "?";
}
