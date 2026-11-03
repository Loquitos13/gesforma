// Etiqueta da área de um email (só aparece a quem vê mais do que uma área: a administração).
import { ROTULO_AREA_EMAIL, eAreaEmail, type AreaEmail } from "../../../../partilhado/emailAreas";
import { Estado } from "../../../../partilhado/ui";

const TOM = { gold: "aviso", fin: "info", contabilidade: "sucesso" } as const satisfies Record<AreaEmail, string>;

export function EtiquetaArea({ area, className }: { area?: string; className?: string }) {
  if (!eAreaEmail(area)) return null;
  return <Estado tom={TOM[area]} className={className}>{ROTULO_AREA_EMAIL[area]}</Estado>;
}
