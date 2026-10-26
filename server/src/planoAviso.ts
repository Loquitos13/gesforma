/** Aviso por email ao formador quando a coordenação aprova ou devolve o plano de sessão. */
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { contactosFormadores } from "./repos/pedagogiaTurma.js";
import { isEmail } from "./security.js";

function fmtData(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export async function avisarPlanoRevisto(db: Db, a: {
  regime: "gold" | "fin"; turmaId: number; turma: string; curso: string;
  n: number; data: string; formadores: string[];
  estado: "aprovado" | "devolvido"; comentario: string; revistoPor: string;
}) {
  const nomes = [...new Set(a.formadores.map(f => f.trim().toLowerCase()).filter(Boolean))];
  const contactos = (await contactosFormadores(db, nomes)).filter(c => isEmail(c.email));
  const href = `${config.appOrigin}/gesforma/${a.regime === "fin" ? "financiada" : "gold"}/turmas/${a.turmaId}${a.regime === "fin" ? "/sessoes" : ""}`;
  const sessao = `sessão ${a.n}${a.data ? ` (${fmtData(a.data)})` : ""}`;
  const aprovado = a.estado === "aprovado";
  let enviados = 0;
  for (const c of contactos) {
    const linhas = [
      aprovado
        ? `O plano da ${sessao} da turma ${a.turma} (${a.curso}) foi aprovado pela coordenação pedagógica${a.revistoPor ? ` (${a.revistoPor})` : ""}.`
        : `O plano da ${sessao} da turma ${a.turma} (${a.curso}) foi devolvido pela coordenação pedagógica${a.revistoPor ? ` (${a.revistoPor})` : ""}.`,
      ...(a.comentario ? [`Comentários: ${a.comentario}`] : []),
      aprovado ? "Não precisa de fazer mais nada." : "Corrija o plano e volte a submetê-lo para aprovação.",
    ];
    const mail = renderAutomaticEmail({
      nome: c.nome, xml: "", linhas, cta: aprovado ? "Ver o plano" : "Corrigir o plano", href,
      vars: { nome: c.nome, curso: a.curso }, origin: config.appOrigin,
    });
    await sendMail(db, {
      to: c.email, name: c.nome,
      subject: `Plano de sessão ${aprovado ? "aprovado" : "devolvido"} · ${a.turma} · sessão ${a.n}`,
      text: mail.text, html: mail.html,
    });
    enviados += 1;
  }
  return enviados;
}
