import { randomUUID } from "node:crypto";
import { formadorForaDoSlot, slotsDoFormador } from "../../src/partilhado/disponibilidade.js";
import { gerarPalavraPasse } from "../../src/partilhado/passwordPolicy.js";
import type { Db } from "./db/pool.js";
import {
  contaLigadaAOutraFicha, disponibilidades, estaAlocado, inserirUtilizadorFormador, utilizadorPorEmail,
} from "./repos/formadores.js";
import type { Consulta } from "./repos/sql.js";
import { hashPassword, isEmail, normalizeEmail } from "./security.js";

/**
 * O email da ficha pertence a uma conta que não pode ser a deste formador (equipa, formando ou outra ficha).
 * `fichaId` é a outra ficha de formador com essa conta, quando é esse o caso.
 */
export class ContaFormadorEmUso extends Error {
  constructor(message: string, readonly fichaId: number | null = null) {
    super(message);
  }
}

/**
 * Cria a conta de formador (palavra-passe temporária) ou liga-se à conta de formador que já existe com o
 * mesmo email, se não estiver ligada a outra ficha. Uma conta da equipa ou de formando nunca se liga:
 * a ficha passaria a abrir-se (e a ser desactivada) com essa conta.
 */
export async function garantirContaFormador(c: Consulta, nome: string, emailRaw: string, fichaId: number) {
  const email = normalizeEmail(emailRaw);
  if (!email || !isEmail(email)) return null;
  let existente = await utilizadorPorEmail(c, email);
  if (!existente) {
    const password = gerarPalavraPasse();
    const id = randomUUID();
    if (await inserirUtilizadorFormador(c, { id, nome: nome.trim() || email, email, hash: await hashPassword(password) })) {
      return { userId: id, email, criado: true as const, password };
    }
    existente = await utilizadorPorEmail(c, email);
    if (!existente) return null;
  }
  if (existente.role !== "formador") {
    throw new ContaFormadorEmUso(`O email ${email} é de uma conta que não é de formador: use outro email na ficha.`);
  }
  const outra = await contaLigadaAOutraFicha(c, existente.id, fichaId);
  if (outra != null) {
    throw new ContaFormadorEmUso(`O email ${email} já é a conta de acesso de outro formador.`, outra);
  }
  return { userId: existente.id, email, criado: false as const };
}

export async function formadorEstaAlocado(db: Db, nome: string) {
  return estaAlocado(db, nome);
}

/** Mensagem de erro se algum dos formadores não tem este horário na disponibilidade. */
export async function erroDisponibilidade(db: Db, nomes: string[], horario: string) {
  const limpos = [...new Set(nomes.map(n => n.trim()).filter(Boolean))];
  if (!limpos.length) return null;
  const rows = await disponibilidades(db, limpos);
  const fora = rows.filter(r => {
    const lista = Array.isArray(r.disponibilidade) ? r.disponibilidade : null;
    const slots = !lista || lista.some(item => item && typeof item === "object")
      ? slotsDoFormador(null)
      : lista.map(item => String(item));
    return formadorForaDoSlot(slots, horario);
  }).map(r => String(r.nome));
  if (!fora.length) return null;
  return `${fora.join(", ")} não tem o horário ${horario} na disponibilidade.`;
}
