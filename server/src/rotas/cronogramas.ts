/**
 * Cronogramas das turmas Gold para vender (vista «Cronogramas» do comercial): só leitura e só o que o site já
 * mostra — curso, local, horário, datas, vagas, preço e as sessões do cronograma público. Sem formandos, custos,
 * contactos de formadores nem nada que se edite. Quem vê está em permissoes/comercial.ts e na matriz (Gold).
 */
import type { FastifyInstance } from "fastify";
import { sessoesPublicas, type SessaoPublica } from "../cronogramaPublico.js";
import { hojeLisboa } from "../datas.js";
import { listOfertaGold } from "../ofertaGold.js";
import { cronogramasGoldActivos } from "../repos/oferta.js";
import type { Deps } from "./tipos.js";

export type CronogramaVenda = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  dataFim: string;
  fase: "por_comecar" | "a_decorrer";
  vagasLivres: number;
  /** O que o site mostra (vagas anunciadas, nunca acima das livres). */
  vagasMostradas: number;
  preco: number | null;
  publicadoEm: string | null;
  /** Página pública do cronograma (`/cronograma/gold/:id`), quando o site a mostra. */
  ligacaoPublica: string | null;
  sessoes: SessaoPublica[];
};

/** Data de fim: o marcador «Data de fim» do cronograma ou, sem ele, a última sessão. */
function dataFim(raw: unknown, sessoes: SessaoPublica[]) {
  const marcador = (Array.isArray(raw) ? raw : []).find((s: { id?: unknown }) => s?.id === "fim-cronograma") as { data?: unknown } | undefined;
  const fim = String(marcador?.data ?? "").slice(0, 10);
  return fim || sessoes.reduce((m, s) => (s.data > m ? s.data : m), "");
}

export async function registar(app: FastifyInstance, { db, requireAuth }: Deps) {
  app.get("/v1/cronogramas/gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const [oferta, cronogramas] = await Promise.all([listOfertaGold(db), cronogramasGoldActivos(db)]);
    const porId = new Map(cronogramas.map(c => [Number(c.id), c]));
    const hoje = hojeLisboa();
    const turmas: CronogramaVenda[] = [];
    for (const t of oferta) {
      const c = porId.get(t.turmaId);
      const sessoes = sessoesPublicas(c?.cronograma);
      const fim = dataFim(c?.cronograma, sessoes);
      // Turmas que já acabaram não se vendem.
      if (fim && fim < hoje) continue;
      const publicadoEm = c?.cronograma_publicado_em ? new Date(c.cronograma_publicado_em).toISOString() : null;
      turmas.push({
        turmaId: t.turmaId,
        nome: t.nome,
        curso: t.curso,
        local: t.local,
        horario: t.horario,
        dataInicio: t.dataInicio,
        dataFim: fim,
        fase: t.dataInicio && t.dataInicio <= hoje ? "a_decorrer" : "por_comecar",
        vagasLivres: t.vagasLivres,
        vagasMostradas: t.vagasMostradas,
        preco: t.preco,
        publicadoEm,
        // A mesma regra da página pública: publicado, ou turma activa com sessões.
        ligacaoPublica: publicadoEm || sessoes.length ? `/cronograma/gold/${t.turmaId}` : null,
        sessoes,
      });
    }
    turmas.sort((a, b) => (a.dataInicio || "9999").localeCompare(b.dataInicio || "9999") || a.curso.localeCompare(b.curso, "pt") || a.turmaId - b.turmaId);
    return { turmas, hoje };
  });
}
