/** Aviso por email ao formador quando a coordenação aprova ou devolve o plano de sessão. */
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { enviarModelo } from "./emailModelo.js";
import { contactosFormadores } from "./repos/pedagogiaTurma.js";
import { isEmail } from "./security.js";
import { areaDoRegime } from "../../src/partilhado/emailAreas.js";

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
  const aprovado = a.estado === "aprovado";
  let enviados = 0;
  for (const c of contactos) {
    await enviarModelo(db, {
      tipo: aprovado ? "plano_aprovado" : "plano_devolvido", area: areaDoRegime(a.regime), para: c.email, nome: c.nome, link: href,
      vars: {
        curso: a.curso, turma: a.turma, sessao: String(a.n), data_sessao: a.data ? ` (${fmtData(a.data)})` : "",
        revisto_por: a.revistoPor ? ` (${a.revistoPor})` : "", comentario_itens: a.comentario ? [a.comentario] : [],
      },
      reserva: {
        assunto: `Plano de sessão ${aprovado ? "aprovado" : "devolvido"} · {{turma}} · sessão {{sessao}}`,
        linhas: [
          `O plano da sessão {{sessao}}{{data_sessao}} da turma {{turma}} ({{curso}}) foi ${aprovado ? "aprovado" : "devolvido"} pela coordenação pedagógica{{revisto_por}}.`,
          "Comentários:<br>{{comentario_itens}}",
          aprovado ? "Não precisa de fazer mais nada." : "Corrija o plano e volte a submetê-lo para aprovação.",
        ],
        cta: aprovado ? "Ver o plano" : "Corrigir o plano",
      },
    });
    enviados += 1;
  }
  return enviados;
}
