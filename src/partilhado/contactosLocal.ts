/** Contactos de um local (Edição de Cursos › Locais e ficha do curso): a chave no payload e o rótulo. */
export const CONTACTOS_LOCAL = [
  ["telemovel", "Telemóvel"], ["telefone", "Telefone"], ["email", "Email"], ["whatsapp", "WhatsApp"],
] as const;

export type CampoContactoLocal = (typeof CONTACTOS_LOCAL)[number][0];

/** «Penafiel: (Telemóvel) 917565561 · (Telefone) 223781105 · (Email) ccppenafiel@ena.pt», ou "" sem contactos. */
export function linhaContactosLocal(nome: string, local: Record<string, unknown>) {
  const partes = CONTACTOS_LOCAL
    .map(([campo, rotulo]) => [rotulo, String(local[campo] ?? "").trim()] as const)
    .filter(([, valor]) => valor)
    .map(([rotulo, valor]) => `(${rotulo}) ${valor}`);
  return partes.length ? `${nome}: ${partes.join(" · ")}` : "";
}
