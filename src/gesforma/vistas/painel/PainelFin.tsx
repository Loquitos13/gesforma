// Painel Financiada: inscrições, assiduidade, documentos e Dossiê TP (vistas/painel/PainelEcra.tsx).
import type { VistaProps } from "../../shell/tipos";
import { PainelEcra } from "./PainelEcra";

export default function PainelFin({ navigate }: VistaProps) {
  return <PainelEcra regime="fin" navigate={navigate} />;
}
