// Escolaridade da pré-inscrição Gold (formulário do site): decide os documentos pedidos no CCP.
export const ESCOLARIDADES = ["Até ao 11.º ano", "12.º ano", "Licenciatura", "Mestrado", "Doutoramento"] as const;
export type Escolaridade = typeof ESCOLARIDADES[number];

export const eEscolaridade = (v: string): v is Escolaridade => (ESCOLARIDADES as readonly string[]).includes(v);
export const ensinoSuperior = (v: string) => ["Licenciatura", "Mestrado", "Doutoramento"].includes(v);

/** O curso é o CCP (Formação de Formadores / Formação Pedagógica Inicial de Formadores). */
export const eCursoCcp = (curso: string) => /\bccp\b|forma[cç][aã]o (pedag[oó]gica inicial )?de formadores/i.test(curso);
