// Painel Gold: receita, pré-inscrições e filas do dia (vistas/painel/PainelEcra.tsx).
import type { VistaProps } from "../../shell/tipos";
import { PainelEcra } from "./PainelEcra";

export default function PainelGold({ navigate }: VistaProps) {
  return <PainelEcra regime="gold" navigate={navigate} />;
}
