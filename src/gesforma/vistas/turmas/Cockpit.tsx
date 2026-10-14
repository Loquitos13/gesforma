// Interior de uma turma (Gold ou Financiada). Os ecrãs estão em ./cockpit/.
import type { VistaProps } from "../../shell/tipos";
import { CockpitFin } from "./cockpit/CockpitFin";
import { CockpitGold } from "./cockpit/CockpitGold";

export default function Cockpit({ view, params, navigate }: VistaProps) {
  if (view === "gold-cockpit-turma") {
    return <CockpitGold key={params.turmaId} turmaId={params.turmaId} initialTab={params.tab} navigate={navigate} />;
  }
  return (
    <CockpitFin
      key={params.turmaId}
      turmaId={params.turmaId}
      initialTab={view === "fin-presencas" ? "sessoes" : params.tab}
      navigate={navigate}
    />
  );
}
