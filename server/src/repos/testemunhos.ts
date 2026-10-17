import { many, one, type Consulta } from "./sql.js";

export type EstadoTestemunho = "pendente" | "aprovado" | "recusado";
export type DadosTestemunho = { nome: string; curso: string; texto: string; estrelas: number; autorizaPublicar: boolean };

const COLUNAS = `id, nome, curso, texto, estrelas, autoriza_publicar AS "autorizaPublicar", estado,
  criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`;

export function doUtilizador(c: Consulta, userId: string) {
  return one(c, `SELECT ${COLUNAS} FROM testemunhos WHERE user_id = $1`, [userId]);
}

/** Um por conta: gravar de novo substitui o anterior e volta a pôr em revisão. */
export function gravarDoUtilizador(c: Consulta, userId: string, d: DadosTestemunho) {
  return one(c,
    `INSERT INTO testemunhos (user_id, nome, curso, texto, estrelas, autoriza_publicar)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET nome = EXCLUDED.nome, curso = EXCLUDED.curso, texto = EXCLUDED.texto,
       estrelas = EXCLUDED.estrelas, autoriza_publicar = EXCLUDED.autoriza_publicar,
       estado = 'pendente', atualizado_em = now(), revisto_em = NULL, revisto_por = NULL
     RETURNING ${COLUNAS}`,
    [userId, d.nome, d.curso, d.texto, d.estrelas, d.autorizaPublicar]);
}

export function apagarDoUtilizador(c: Consulta, userId: string) {
  return many(c, "DELETE FROM testemunhos WHERE user_id = $1", [userId]);
}

/** Para a revisão no backoffice (com o email da conta, para a equipa saber quem é). */
export function listar(c: Consulta, estado?: EstadoTestemunho) {
  return many(c,
    `SELECT t.id, t.nome, t.curso, t.texto, t.estrelas, t.autoriza_publicar AS "autorizaPublicar", t.estado,
       t.atualizado_em AS "atualizadoEm", u.email
     FROM testemunhos t JOIN users u ON u.id = t.user_id
     WHERE ($1::text IS NULL OR t.estado = $1)
     ORDER BY (t.estado = 'pendente') DESC, t.atualizado_em DESC
     LIMIT 500`, [estado ?? null]);
}

export function rever(c: Consulta, id: number, estado: EstadoTestemunho, porId: string) {
  return one(c,
    `UPDATE testemunhos SET estado = $2, revisto_em = now(), revisto_por = $3 WHERE id = $1 RETURNING id, estado`,
    [id, estado, porId]);
}

export function apagar(c: Consulta, id: number) {
  return one(c, "DELETE FROM testemunhos WHERE id = $1 RETURNING id", [id]);
}

/** Para o site: só os aprovados que o formando autorizou publicar. */
export function publicos(c: Consulta) {
  return many(c,
    `SELECT nome, curso, texto, estrelas FROM testemunhos
     WHERE estado = 'aprovado' AND autoriza_publicar
     ORDER BY atualizado_em DESC LIMIT 60`);
}
