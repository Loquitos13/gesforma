import type { FastifyInstance } from "fastify";
import type { Deps } from "../tipos.js";
import { registarAvaliacao } from "./avaliacao.js";
import { registarCronograma } from "./cronograma.js";
import { registarDossieTurma } from "./dossie.js";
import { registarFecho } from "./fecho.js";
import { registarRelatorios } from "./relatorios.js";
import { registarSessoes } from "./sessoes.js";

/** Pedagogia do interior da turma: sessões, documentos, dossiê, avaliação, certificados, cronograma, fecho e relatórios. */
export async function registar(app: FastifyInstance, deps: Deps) {
  registarSessoes(app, deps);
  registarDossieTurma(app, deps);
  registarAvaliacao(app, deps);
  registarCronograma(app, deps);
  registarFecho(app, deps);
  registarRelatorios(app, deps);
}
