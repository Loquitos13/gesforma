/** Envio dos inquéritos do regime aos formandos e formadores de uma turma. */
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import type { Db } from "../db/pool.js";
import { sendMail } from "../mailer.js";
import { rotuloPublicoInquerito } from "../relatorioFinal.js";
import { gravarToken, inqueritosDoRegime, registarEnvio } from "../repos/inqueritos.js";
import { contactosFormadores, contactosFormandos, equipaDaTurma } from "../repos/pedagogiaTurma.js";
import { escapeHtml } from "../xss.js";
import { anexarPerguntasDaTurma } from "./ficheiros.js";
import { publicoInquerito, type PublicoInquerito } from "./inqueritos.js";
import { asArr, asObj, type Regime } from "./util.js";

/** Token público do inquérito (cria se ainda não tiver). */
export async function tokenDoInquerito(db: Db, item: { id: number; public_token: string | null }) {
  if (item.public_token) return item.public_token;
  const token = randomBytes(18).toString("base64url");
  await gravarToken(db, item.id, token);
  return token;
}

/** Ligação pública; com turma, a resposta fica associada a essa turma (validada no servidor contra os envios). */
export const urlInquerito = (token: string, turmaId?: number) =>
  `${config.appOrigin}/inquerito/${token}${turmaId ? `?turma=${turmaId}` : ""}`;

export type ResultadoEnvio = { enviados: number; semEmail: number; inqueritos: number } | { erro: string; codigo: number };

/**
 * `fase` "fim": inquéritos de fim de curso (formandos e formadores). "pos": os de impacto pós-formação (~3 meses
 * depois), só aos formandos; enviam-se à parte, quando chega a altura.
 */
export async function enviarInqueritosDaTurma(db: Db, actorId: string | undefined, regime: Regime, turmaId: number, fase: "fim" | "pos" = "fim"): Promise<ResultadoEnvio> {
  const row = await equipaDaTurma(db, regime, turmaId);
  if (!row) return { erro: "turma inexistente", codigo: 404 };
  const inqs = (await inqueritosDoRegime(db, regime)).filter(i => (publicoInquerito(asObj(i.payload)) === "pos") === (fase === "pos"));
  if (!inqs.length) {
    return {
      erro: fase === "pos"
        ? "Não há inquéritos de pós-formação neste regime. Crie um com o público-alvo «pós-formação»."
        : "Não há inquéritos neste regime. Crie um e marque o público-alvo.",
      codigo: 400,
    };
  }
  const pessoas = await contactosFormandos(db, regime, turmaId, row.nome);
  const nomesFormador = [...new Set([...asArr(row.formadores).map(n => String(n).trim()), String(row.formador ?? "").trim()]
    .filter(Boolean).map(n => n.toLowerCase()))];
  const formadores = await contactosFormadores(db, nomesFormador);

  const destinatarios: { nome: string; email: string; publicos: PublicoInquerito[] }[] = [
    ...pessoas.map(p => ({ nome: `${p.nome ?? ""} ${p.apelido ?? ""}`.trim() || "formando", email: String(p.email ?? "").trim(), publicos: [fase === "pos" ? "pos" : "formando"] as PublicoInquerito[] })),
    ...(fase === "pos" ? [] : formadores.map(f => ({ nome: f.nome || "formador", email: String(f.email ?? "").trim(), publicos: ["formador"] as PublicoInquerito[] }))),
  ];
  const quantos = (publico: PublicoInquerito) => destinatarios.filter(d => d.publicos.includes(publico) && d.email.includes("@")).length;

  const porPublico = new Map<PublicoInquerito, { titulo: string; url: string }[]>();
  for (const item of inqs) {
    const token = await tokenDoInquerito(db, item);
    const payload = asObj(item.payload);
    const publico = publicoInquerito(payload);
    const lista = porPublico.get(publico) ?? [];
    lista.push({ titulo: String(payload.titulo ?? "Inquérito"), url: urlInquerito(token, turmaId) });
    porPublico.set(publico, lista);
    await registarEnvio(db, regime, turmaId, item.id, publico, quantos(publico));
  }

  let enviados = 0;
  let semEmail = 0;
  const vistosSemEmail = new Set<string>();
  for (const pessoa of destinatarios) {
    const links = pessoa.publicos.flatMap(publico => porPublico.get(publico) ?? []);
    if (!links.length) continue;
    if (!pessoa.email.includes("@")) {
      if (!vistosSemEmail.has(pessoa.nome)) { semEmail += 1; vistosSemEmail.add(pessoa.nome); }
      continue;
    }
    const linhas = links.map(l => `${l.titulo}: ${l.url}`).join("\n");
    const htmlLinks = links.map(l => `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.titulo)}</a></li>`).join("");
    const alvos = pessoa.publicos.filter(p => (porPublico.get(p) ?? []).length).map(rotuloPublicoInquerito).join(" e ");
    await sendMail(db, {
      to: pessoa.email,
      name: pessoa.nome,
      subject: `Inquérito da turma ${row.nome}`,
      text: `Olá ${pessoa.nome},\n\nPedimos a sua resposta ao inquérito da turma ${row.nome} (${row.curso}). Público-alvo: ${alvos}.\n\n${linhas}\n`,
      html: `<p>Olá ${escapeHtml(pessoa.nome)},</p><p>Pedimos a sua resposta ao inquérito da turma <strong>${escapeHtml(row.nome)}</strong> (${escapeHtml(row.curso)}). Público-alvo: ${escapeHtml(alvos)}.</p><ul>${htmlLinks}</ul>`,
    });
    enviados += 1;
  }
  if (regime === "fin") await anexarPerguntasDaTurma(db, actorId, { id: turmaId, nome: row.nome, curso: row.curso }).catch(() => undefined);
  return { enviados, semEmail, inqueritos: inqs.length };
}
