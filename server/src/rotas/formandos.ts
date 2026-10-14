import type { FastifyInstance } from "fastify";
import { registarAccoes } from "./formandos/accoes.js";
import { registarEscrita } from "./formandos/escrita.js";
import { registarInscricoesFin } from "./formandos/inscricoesFin.js";
import { registarLeitura } from "./formandos/leitura.js";
import type { Deps } from "./tipos.js";

/** Formandos Gold e Financiada: listas, ficha, escrita, documentos, pagamento e inscrições da Financiada. */
export async function registar(app: FastifyInstance, deps: Deps) {
  registarLeitura(app, deps);
  registarEscrita(app, deps);
  registarAccoes(app, deps);
  registarInscricoesFin(app, deps);
}
