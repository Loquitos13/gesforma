/**
 * Site público: catálogo, oferta, imagens e o formulário de pré-inscrição.
 * O formulário nunca devolve dados da ficha: só a referência opaca e o aviso.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listarCatalogoPublico } from "../catalogoPublico.js";
import { lerImagemPorToken, tokenImagem } from "../cursoImagens.js";
import { listCursosGoldActivos, listCursosOferta, listOfertaFin, listOfertaGold } from "../ofertaGold.js";
import { criarPreinscricaoPublica } from "../preinscricaoPublica.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const formularioPublico = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  telf: z.string().trim().max(30).optional().default(""),
  concelho: z.string().trim().max(80).optional().default(""),
  origem: z.string().trim().max(80).optional().default(""),
  curso: z.string().trim().max(200).optional().default(""),
  local: z.string().trim().max(120).optional().default(""),
  inicioCurso: z.string().trim().max(40).optional().default("-"),
  horario: z.string().trim().max(80).optional().default(""),
  turmaId: z.preprocess(v => (v === 0 || v === null || v === "" ? undefined : v), z.number().int().positive().optional()),
  campanha: z.string().trim().max(80).optional().default(""),
  campanhaId: z.preprocess(v => (v === 0 || v === null || v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  pagamentoMetodo: z.string().trim().max(40).optional(),
  acessoImediato: z.boolean().optional(),
  regime: z.enum(["gold", "fin"]).optional(),
  consentimento: z.boolean().optional(),
});

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, audit } = deps;

  app.get("/v1/public/cursos", async () => ({ cursos: await listCursosGoldActivos(db) }));

  app.get("/v1/public/catalogo", async (_req, reply) => {
    reply.header("cache-control", "no-store");
    return listarCatalogoPublico(db);
  });

  app.get("/v1/public/imagens/:token", async (req, reply) => {
    const token = tokenImagem(String((req.params as { token?: string }).token ?? ""));
    if (!token) return reply.code(404).send({ error: "imagem inexistente" });
    const imagem = await lerImagemPorToken(db, token);
    if (!imagem) return reply.code(404).send({ error: "imagem inexistente" });
    return reply.header("cache-control", "public, max-age=300").type(imagem.mime).send(imagem.bytes);
  });

  app.get("/v1/public/oferta", async () => {
    const [cursos, gold, fin] = await Promise.all([listCursosOferta(db), listOfertaGold(db), listOfertaFin(db)]);
    return { cursos, turmas: [...gold, ...fin] };
  });

  app.post("/v1/public/preinscricoes", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const v = validar(reply, { body: formularioPublico }, req);
    if (!v) return;
    const d = v.body;
    const created = await criarPreinscricaoPublica(db, {
      nome: d.nome,
      apelido: d.apelido,
      email: d.email,
      telf: d.telf,
      concelho: d.concelho,
      origem: d.origem,
      curso: d.curso,
      local: d.local,
      inicioCurso: d.inicioCurso,
      horario: d.horario,
      turmaId: d.turmaId,
      campanha: d.campanha,
      campanhaId: d.campanhaId,
      meioContacto: "Website",
      pagamentoMetodo: d.pagamentoMetodo,
      acessoImediato: d.acessoImediato,
      regime: d.regime,
      consentimento: d.consentimento,
    }, { ip: req.ip });
    if ("error" in created) {
      const code = created.error === "a turma escolhida já não está libertada" ? 409 : 400;
      return reply.code(code).send({ error: created.error });
    }
    await audit(db, undefined, "preinscricao.public_create", "preinscricao", String(created.preinscricao.id), req.ip, { curso: d.curso, duplicado: created.duplicado });
    return { preinscricao: created.preinscricao, aviso: created.aviso, duplicado: created.duplicado };
  });
}
