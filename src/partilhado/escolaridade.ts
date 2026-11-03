import { LISTA_PAISES } from "./execucaoFisica.js";

// Escolaridade da pré-inscrição Gold (formulário do site): pode ser gatilho dos documentos (ficha do curso › Documentos).
export const ESCOLARIDADES = ["Até ao 11.º ano", "12.º ano", "Licenciatura", "Mestrado", "Doutoramento"] as const;
export type Escolaridade = typeof ESCOLARIDADES[number];

export const eEscolaridade = (v: string): v is Escolaridade => (ESCOLARIDADES as readonly string[]).includes(v);

/** Países para a nacionalidade do formulário Gold (a lista oficial, sem o código da execução física). */
export const PAISES = LISTA_PAISES.map(p => p.replace(/^\d+\s*-\s*/, ""));
