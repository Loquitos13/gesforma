import { randomUUID } from "node:crypto";
import { formadorForaDoSlot, slotsDoFormador } from "../../src/partilhado/disponibilidade.js";
import { gerarPalavraPasse } from "../../src/partilhado/passwordPolicy.js";
import type { Db } from "./db/pool.js";
import { disponibilidades, estaAlocado, inserirUtilizadorFormador, utilizadorPorEmail } from "./repos/formadores.js";
import { hashPassword, isEmail, normalizeEmail } from "./security.js";

function uniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

/** Cria a conta de formador (palavra-passe temporária) ou liga-se à que já existe com o mesmo email. */
export async function garantirContaFormador(db: Db, nome: string, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  if (!email || !isEmail(email)) return null;
  const existente = await utilizadorPorEmail(db, email);
  if (existente) return { userId: existente.id, email, criado: false as const };
  const password = gerarPalavraPasse();
  const id = randomUUID();
  try {
    await inserirUtilizadorFormador(db, { id, nome: nome.trim() || email, email, hash: await hashPassword(password) });
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
    const outra = await utilizadorPorEmail(db, email);
    if (!outra) throw err;
    return { userId: outra.id, email, criado: false as const };
  }
  return { userId: id, email, criado: true as const, password };
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
