import type { Db } from "./db/pool.js";
import type { getOpsSnapshot } from "./ops.js";
import { nomesDoFormador, turmaDoFormador } from "./sessaoAcesso.js";

type Snapshot = Awaited<ReturnType<typeof getOpsSnapshot>>;
type Actor = { id: string; role: string; email: string; name: string };

/** Chaves de definições que nunca saem do servidor, excepto para o administrador. */
const SEGREDO = /(webhook|token|secret|segredo|password|senha|apikey|api_key|chave)/i;

export function ehSegredo(chave: string) {
  return SEGREDO.test(chave);
}

export function settingsSemSegredos(settings: Record<string, Record<string, unknown>>) {
  return Object.fromEntries(Object.entries(settings).map(([id, values]) => [
    id,
    Object.fromEntries(Object.entries(values).filter(([k]) => !SEGREDO.test(k))),
  ]));
}

function formadorPublico<T extends { nif: string; custoHora: number; telf: string }>(f: T): T {
  return { ...f, nif: "", custoHora: 0, telf: "" };
}

/** Catálogos que o formador não precisa: inscrições e listas com dados pessoais. */
const CATALOGOS_SEM_FORMADOR = /^(inscricoes_fin|formandos_avulso|inqueritos):/;

/**
 * Recorta o snapshot `/v1/ops` ao perfil:
 * - formador: só as suas turmas e respectivos formandos (sem contactos, pagamentos nem documentos);
 * - comercial: sem custos/NIF dos formadores e sem a Financiada;
 * - financiada: sem pagamentos Gold nem campanhas;
 * - ninguém além do admin recebe segredos das definições.
 */
export async function snapshotParaPerfil(db: Db, snap: Snapshot, actor: Actor): Promise<Snapshot> {
  const role = actor.role;
  const settings = role === "admin" ? snap.settings : settingsSemSegredos(snap.settings);

  if (role === "formador") {
    const nomes = await nomesDoFormador(db, actor.email, actor.name, actor.id);
    const turmasGold = snap.turmasGold.filter(t => turmaDoFormador(t, nomes)).map(t => ({ ...t, custoHoraSala: 0, valoresHoraFormador: {} }));
    const turmasFin = snap.turmasFin.filter(t => turmaDoFormador(t, nomes)).map(t => ({ ...t, valoresHoraFormador: {} }));
    const idsGold = new Set(turmasGold.map(t => t.id));
    const idsFin = new Set(turmasFin.map(t => t.id));
    const nomesGold = new Set(turmasGold.map(t => t.nome.trim().toLowerCase()));
    const nomesFin = new Set(turmasFin.map(t => t.nome.trim().toLowerCase()));
    const meus = new Set([...nomes].map(n => n.toLowerCase()));
    return {
      ...snap,
      preinscricoes: [],
      pagamentos: [],
      campanhas: [],
      formandosTurmas: snap.formandosTurmas
        .filter(f => (f.turmaId ? idsGold.has(f.turmaId) : nomesGold.has(f.turma.trim().toLowerCase())))
        .map(f => ({ ...f, telf: "", email: "", pago: false, valor: 0, metodo: "-" })),
      formandosFin: snap.formandosFin
        .filter(f => (f.turmaId ? idsFin.has(f.turmaId) : nomesFin.has(f.turma.trim().toLowerCase())))
        .map(f => ({ ...f, telf: "", email: "" })),
      turmasGold,
      turmasFin,
      formadores: snap.formadores.map(f => (meus.has(f.nome.trim().toLowerCase()) ? f : formadorPublico(f))),
      catalogs: Object.fromEntries(Object.entries(snap.catalogs).filter(([k]) => !CATALOGOS_SEM_FORMADOR.test(k))),
      settings: { site: settings.site ?? {} },
    };
  }

  if (role === "comercial") {
    return {
      ...snap,
      formandosFin: [],
      formadores: snap.formadores.map(formadorPublico),
      catalogs: Object.fromEntries(Object.entries(snap.catalogs).filter(([k]) => !k.startsWith("inscricoes_fin:"))),
      settings,
    };
  }

  if (role === "financiada") {
    return { ...snap, pagamentos: [], campanhas: [], settings };
  }

  return { ...snap, settings };
}
