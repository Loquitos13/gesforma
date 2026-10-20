/** Leituras para os PDFs gerados do dossiê da Financiada (fichas, pautas, entrega de certificados). */
import { many, one, type Consulta } from "./sql.js";

export async function turmaFinBase(c: Consulta, turmaId: number) {
  return one<{ nome: string; curso: string; local: string; formador: string; formadores: unknown }>(
    c,
    "SELECT nome, curso, local, formador, formadores FROM turmas_fin WHERE id = $1",
    [turmaId],
  );
}

/** Formandos da turma com os dados de contacto da pré-inscrição mais recente do mesmo email. */
export async function formandosFinComContacto(c: Consulta, turmaId: number, turmaNome: string) {
  return many<{
    id: number; nome: string; apelido: string; email: string; telf: string; estado: string;
    concelho: string; nif: string; morada: string; codigo_postal: string; origem: string; inscrito: string;
  }>(
    c,
    `SELECT f.id, f.nome, f.apelido, f.email, f.telf, f.estado,
            COALESCE(p.concelho, '') AS concelho,
            COALESCE(p.nif, '') AS nif,
            COALESCE(p.morada_fiscal, '') AS morada,
            COALESCE(p.codigo_postal, '') AS codigo_postal,
            COALESCE(p.origem, '') AS origem,
            COALESCE(p.inscrito::text, '') AS inscrito
       FROM formandos_fin f
       LEFT JOIN LATERAL (
         SELECT concelho, nif, morada_fiscal, codigo_postal, origem, inscrito
           FROM preinscricoes
          WHERE f.email <> '' AND lower(trim(email)) = lower(trim(f.email))
          ORDER BY id DESC
          LIMIT 1
       ) p ON true
      WHERE f.turma_id = $1
         OR (f.turma_id IS NULL AND f.turma = $2)
      ORDER BY f.nome, f.apelido`,
    [turmaId, turmaNome],
  );
}

export async function certificadosFinComFicheiro(c: Consulta, turmaId: number) {
  return many<{ formando_id: number; ficheiro_id: string; ficheiro_nome: string; emitido_em: string | null; elearning: number | null; nota: number | null }>(
    c,
    `SELECT formando_id, COALESCE(ficheiro_id, '') AS ficheiro_id, COALESCE(ficheiro_nome, '') AS ficheiro_nome,
            emitido_em, elearning, nota
       FROM turma_certificados WHERE regime = 'fin' AND turma_id = $1`,
    [turmaId],
  );
}

export async function ufcdDoCurso(c: Consulta, curso: string) {
  return one<{ ufcd_cod: string; ufcd: string }>(
    c,
    `SELECT ufcd_cod, ufcd FROM cursos_fin
      WHERE lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1))
      LIMIT 1`,
    [curso],
  );
}
