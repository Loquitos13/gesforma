/** Para onde leva o botão de um email automático. O endereço final é resolvido no servidor (server/src/emailCta.ts). */
export type CtaAmbito = "preinscricao" | "contacto" | "documentos" | "pagamento";

export function isCtaAmbito(value: string | undefined): value is CtaAmbito {
  return value === "preinscricao" || value === "contacto" || value === "documentos" || value === "pagamento";
}
