/**
 * Regras de email com prazo (Sistema › Emails › Regras): cada regra tem os seus dias (email_rules.dias).
 *  - matricula.antes_limite: X dias antes da data limite de matrícula (marcador do cronograma), às pré-inscrições
 *    da turma ainda por concluir;
 *  - documentos.antes_prazo: X dias antes da mesma data (ou do início da turma), às que ainda têm documentos em falta;
 *  - pagamento.sem_comprovativo: X dias depois de pedido o pagamento, sem comprovativo nem pagamento confirmado;
 *  - turma.integracao: X dias antes do início da turma, aos formandos.
 * Corre com o cron dos emails; cada pessoa recebe cada regra uma só vez (chave de idempotência por regra).
 */
import { ingestEvent } from "./automations.js";
import { config } from "./config.js";
import { hojeLisboa, somarDias } from "./datas.js";
import type { Db } from "./db/pool.js";
import { docsDoCurso } from "./docsCurso.js";
import { listarDocsLead } from "./docsLink.js";
import { garantirToken } from "./ligacaoPessoal.js";
import { formandosDaTurma } from "./repos/emails.js";
import { isEmail, normalizeEmail } from "./security.js";

/** Dias por omissão (regra sem dias) e o sentido: antes da data de referência ou depois dela. */
export const GATILHOS_COM_PRAZO: Record<string, { dias: number; sentido: "antes" | "depois"; referencia: string }> = {
  "matricula.antes_limite": { dias: 2, sentido: "antes", referencia: "da data limite de matrícula" },
  "documentos.antes_prazo": { dias: 3, sentido: "antes", referencia: "da data limite de matrícula (ou do início da turma)" },
  "pagamento.sem_comprovativo": { dias: 3, sentido: "depois", referencia: "do pedido de pagamento" },
  "turma.integracao": { dias: 3, sentido: "antes", referencia: "do início da turma" },
};

const origem = () => config.appOrigin.replace(/\/$/, "");
const dataPt = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : iso);
const fmtEuros = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Regra = { id: number; trigger_key: string; dias: number | null; curso: string | null };
type Turma = { regime: "gold" | "fin"; id: number; nome: string; curso: string; local: string; horario: string; data_inicio: string; matricula: string | null };

async function regrasComPrazo(db: Db) {
  return (await db.query<Regra>(
    "SELECT id, trigger_key, dias, curso FROM email_rules WHERE ativo = true AND trigger_key = ANY($1::text[]) ORDER BY id",
    [`{${Object.keys(GATILHOS_COM_PRAZO).join(",")}}`])).rows;
}

async function turmasAbertas(db: Db) {
  const marcador = `(SELECT left(e->>'data', 10) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cronograma) = 'array' THEN cronograma ELSE '[]'::jsonb END) e
                      WHERE e->>'modalidade' = 'matricula' OR e->>'id' = 'matricula' LIMIT 1)`;
  return (await db.query<Turma>(
    `SELECT 'gold' AS regime, id, nome, curso, local, horario, left(data_inicio::text, 10) AS data_inicio, ${marcador} AS matricula
       FROM turmas_gold WHERE estado = 'Ativa'
     UNION ALL
     SELECT 'fin', id, nome, curso, local, horario, left(data_inicio::text, 10), ${marcador}
       FROM turmas_fin WHERE activa = true`)).rows;
}

async function leadsPorConcluir(db: Db, t: Turma) {
  return (await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string; escolaridade: string }>(
    `SELECT p.id, COALESCE(p.nome, '') AS nome, COALESCE(p.apelido, '') AS apelido, p.email, COALESCE(p.curso, '') AS curso, COALESCE(p.escolaridade, '') AS escolaridade
       FROM preinscricoes p
      WHERE p.turma_id = $1 AND COALESCE(p.regime, 'gold') = $2 AND p.email <> ''
        AND p.estado NOT IN ('Pago', 'Formando', 'Desistiu')`, [t.id, t.regime])).rows;
}

const ligacao = async (db: Db, leadId: number, passo: string) => `${origem()}/documentos/${await garantirToken(db, leadId)}?passo=${passo}`;

function disparar(db: Db, regra: Regra, tipo: string, chave: string, payload: Record<string, unknown>, vars: Record<string, string>) {
  return ingestEvent(db, tipo, payload, `${tipo}:${regra.id}:${chave}`, { soRegraId: regra.id, vars })
    .catch(err => console.error(`[emails] regra ${regra.id} (${tipo}):`, err));
}

export async function enviarRegrasComPrazo(db: Db, fim = 0) {
  const regras = await regrasComPrazo(db);
  if (!regras.length) return;
  const hoje = hojeLisboa();
  const turmas = regras.some(r => r.trigger_key !== "pagamento.sem_comprovativo") ? await turmasAbertas(db) : [];
  for (const regra of regras) {
    if (fim && Date.now() >= fim) return;
    const cfg = GATILHOS_COM_PRAZO[regra.trigger_key]!;
    const dias = regra.dias ?? cfg.dias;
    const alvo = somarDias(hoje, cfg.sentido === "antes" ? dias : -dias);
    const doCurso = (curso: string) => !regra.curso || regra.curso.trim().toLowerCase() === curso.trim().toLowerCase();

    if (regra.trigger_key === "matricula.antes_limite" || regra.trigger_key === "documentos.antes_prazo") {
      const docs = regra.trigger_key === "documentos.antes_prazo";
      for (const t of turmas) {
        const limite = t.matricula || (docs ? t.data_inicio : "");
        if (limite !== alvo || !doCurso(t.curso)) continue;
        for (const l of await leadsPorConcluir(db, t)) {
          const email = normalizeEmail(l.email);
          if (!isEmail(email)) continue;
          let emFalta: string[] = [];
          if (docs) {
            const pedidos = (await docsDoCurso(db, l.curso || t.curso, t.regime, l.escolaridade)).filter(d => d.required);
            const ficheiros = new Map((await listarDocsLead(db, l.id)).map(f => [f.tipo, f]));
            emFalta = pedidos.filter(d => !ficheiros.get(d.id) || ficheiros.get(d.id)!.estado === "recusado").map(d => d.label);
            if (!emFalta.length) continue;
          }
          const link = await ligacao(db, l.id, "documentos");
          await disparar(db, regra, regra.trigger_key, `${l.id}:${limite}`,
            { email, nome: `${l.nome} ${l.apelido}`.trim(), curso: l.curso || t.curso, turma: t.nome, preinscricaoId: l.id, regime: t.regime, local: t.local, documentos_url: link },
            { link, data_limite: dataPt(limite), data_inicio: dataPt(t.data_inicio), local: t.local, horario: t.horario, documentos_em_falta_itens: emFalta.join("\n") });
        }
      }
    }

    if (regra.trigger_key === "pagamento.sem_comprovativo") {
      // Pedidos entre `alvo - 2` e `alvo`: um dia sem cron não faz perder o lembrete (a chave evita repetir).
      const r = await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string; valor: string | null; preco: number | null; local: string; regime: string }>(
        `SELECT p.id, COALESCE(p.nome, '') AS nome, COALESCE(p.apelido, '') AS apelido, p.email, COALESCE(p.curso, '') AS curso,
                g.valor::text AS valor, p.preco, COALESCE(p.local, '') AS local, COALESCE(p.regime, 'gold') AS regime
           FROM preinscricoes p LEFT JOIN pagamentos g ON g.id = p.pagamento_id
          WHERE p.pagamento_pedido_em IS NOT NULL AND p.email <> ''
            AND (p.pagamento_pedido_em AT TIME ZONE 'Europe/Lisbon')::date BETWEEN $1::date - 2 AND $1::date
            AND p.estado NOT IN ('Pago', 'Formando', 'Desistiu')
            AND lower(COALESCE(g.estado, '')) <> 'pago'
            AND NOT EXISTS (SELECT 1 FROM preinscricao_docs d
                             WHERE d.preinscricao_id = p.id AND d.tipo = 'comprovativo' AND COALESCE(d.estado, '') <> 'recusado')`,
        [alvo]);
      for (const l of r.rows) {
        if (!doCurso(l.curso)) continue;
        const email = normalizeEmail(l.email);
        if (!isEmail(email)) continue;
        const link = await ligacao(db, l.id, "pagamento");
        const valor = Number(l.valor ?? l.preco) || 0;
        await disparar(db, regra, regra.trigger_key, String(l.id),
          { email, nome: `${l.nome} ${l.apelido}`.trim(), curso: l.curso, preinscricaoId: l.id, regime: l.regime, local: l.local, comprovativo_url: link, valor: fmtEuros(valor) },
          { link, valor: fmtEuros(valor) });
      }
    }

    if (regra.trigger_key === "turma.integracao") {
      for (const t of turmas) {
        if (t.data_inicio !== alvo || !doCurso(t.curso)) continue;
        for (const a of await formandosDaTurma(db, t.regime, t.id, t.nome)) {
          const email = normalizeEmail(a.email);
          if (!isEmail(email)) continue;
          await disparar(db, regra, regra.trigger_key, `${t.regime}${t.id}:${email}:${t.data_inicio}`,
            { email, nome: `${a.nome} ${a.apelido}`.trim(), curso: a.curso || t.curso, turma: t.nome, regime: t.regime, local: t.local },
            { link: `${origem()}/area-formando`, data_inicio: dataPt(t.data_inicio), local: t.local || "a confirmar", horario: t.horario || "a confirmar" });
        }
      }
    }
  }
}
