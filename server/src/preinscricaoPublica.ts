import { ingestEvent } from "./automations.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { mapPreinscricao, nextOpsId } from "./ops.js";
import { isEmail, normalizeEmail, sanitizeHeader } from "./security.js";

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export type PreinscricaoPublicaInput = {
  nome: string;
  apelido?: string;
  email: string;
  telf?: string;
  concelho?: string;
  origem?: string;
  curso?: string;
  local?: string;
  inicioCurso?: string;
  campanha?: string;
  preco?: number;
  meioContacto?: string;
};

export async function criarPreinscricaoPublica(
  db: Db,
  input: PreinscricaoPublicaInput,
  meta: { ip?: string } = {},
) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { error: "email inválido" as const };
  const curso = sanitizeHeader(input.curso || "Formação de Formadores - CCP");
  const origem = sanitizeHeader(input.origem || "Website") || "Website";
  const meio = sanitizeHeader(input.meioContacto || origem);
  const telf = sanitizeHeader(input.telf || "");

  const dup = await db.query(
    "SELECT * FROM preinscricoes WHERE lower(email) = $1 ORDER BY id DESC LIMIT 1",
    [email],
  );
  if (dup.rows[0]) {
    const row = dup.rows[0] as Record<string, unknown>;
    return {
      duplicado: true as const,
      preinscricao: mapPreinscricao(row),
      aviso: `Já temos o pedido ${row.id} (${row.estado}). A secretaria trata do seguimento.`,
    };
  }

  const precoRow = await db.query<{ preco: number }>("SELECT preco FROM cursos_gold WHERE nome = $1", [curso]);
  const id = await nextOpsId(db);
  await db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem, entrada, meio_contacto)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Não contactado',$12,$13,'preinscricao',$14)`,
    [
      id, nowStamp(), sanitizeHeader(input.nome), sanitizeHeader(input.apelido || ""), email,
      telf, input.inicioCurso || "-", sanitizeHeader(input.concelho || ""),
      sanitizeHeader(input.local || ""), curso, Number(precoRow.rows[0]?.preco ?? input.preco ?? 0),
      sanitizeHeader(input.campanha || ""), origem, meio,
    ],
  );
  const nome = `${input.nome} ${input.apelido || ""}`.trim();
  await ingestEvent(db, "preinscricao.created", { email, nome, curso, preinscricaoId: id }, `preinscricao:${id}:${email}`).catch(() => undefined);
  await logLeadEvent(db, id, undefined, "criacao", "Pré-inscrição recebida", `${origem} · ${curso}`);
  const row = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [id]);
  return {
    duplicado: false as const,
    preinscricao: row.rows[0] ? mapPreinscricao(row.rows[0] as Record<string, unknown>) : { id },
    aviso: "A secretaria contacta-o em breve.",
    ip: meta.ip,
  };
}
