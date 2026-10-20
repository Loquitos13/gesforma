import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { slugServico, videoServico } from "../../../src/partilhado/siteServicos.js";
import { sendMail } from "../mailer.js";
import { lerEntidadePublica } from "../regrasConfig.js";
import * as repo from "../repos/servicos.js";
import { many, one, type Consulta } from "../repos/sql.js";
import { idNum, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";
import { hojeLisboa } from "../datas.js";

// Serviços para empresas: a administração escreve-os em Gestão › Empresas / Business (matriz: só admin, em permissoes/site.ts);
// o site mostra os ativos nos cartões da página Empresas e cada um na sua página (/empresas/<slug>).

const texto = (max: number) => z.string().trim().max(max).default("");
// Imagens do próprio site (carregadas pelo backoffice) ou https.
const imagem = z.string().trim().max(500).refine(v => v === "" || /^\/(api\/v1\/public\/imagens|imagens)\//.test(v) || /^https:\/\//i.test(v), "imagem inválida").default("");

const dadosSchema = z.object({
  titulo: z.string().trim().min(2, "Escreva o título.").max(120),
  etiqueta: texto(40),
  texto: texto(1200),
  pontos: texto(1200),
  detalhe: texto(12000),
  rotulo: texto(40),
  ligacao: texto(300),
  imagem,
  imagens: z.array(z.object({ imagem, legenda: texto(200) })).max(30).default([]),
  video: texto(500).refine(v => v === "" || videoServico(v) != null, "Vídeo inválido: use um endereço do YouTube, do Vimeo ou de um ficheiro .mp4 (https)."),
  logos: z.array(z.object({ imagem, alt: texto(120), ligacao: texto(300) })).max(60).default([]),
  capa: imagem,
  tituloDetalhe: texto(160),
  cartoes: z.array(z.object({ titulo: texto(120), texto: texto(1200) })).max(12).default([]),
  ctaTitulo: texto(160),
  ctaTexto: texto(1200),
});
const servicoSchema = z.object({
  slug: texto(80),
  ordem: z.number().int().min(0).max(100000).optional(),
  ativo: z.boolean().default(true),
  dados: dadosSchema,
});

const ESTADOS_PEDIDO = ["novo", "contactado", "proposta", "arquivado"] as const;

const ehDuplicado = (e: unknown) => (e as { code?: string })?.code === "23505";

const pedidoSchema = z.object({
  nome: z.string().trim().min(2, "Escreva o seu nome.").max(120),
  empresa: texto(160),
  email: z.string().trim().toLowerCase().email("Email inválido.").max(200),
  telefone: z.string().trim().max(30).refine(v => v === "" || /^[+\d][\d\s().-]{5,}$/.test(v), "Telefone inválido.").default(""),
  servico: texto(160),
  mensagem: texto(3000),
  site: texto(200),
});

/**
 * O pedido junta-se ao cliente com o mesmo email (ou cria-o, como Empresa). A mensagem fica só no pedido
 * (pedidos_proposta): as notas do cliente têm limite e cresciam a cada pedido até o cliente deixar de se poder gravar.
 * O cliente novo leva uma linha curta a dizer de onde veio. Corre na transacção do pedido, com o email bloqueado:
 * dois pedidos ao mesmo tempo não criam dois clientes.
 */
async function registarPedido(q: Consulta, p: { nome: string; email: string; telefone: string; nota: string }) {
  await one(q, "SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext('pedido-proposta|' || $1))", [p.email]);
  const atual = await one<{ id: number }>(q, "SELECT id FROM crm_clientes WHERE lower(email) = $1 ORDER BY id LIMIT 1", [p.email]);
  if (atual) {
    await one(q, "UPDATE crm_clientes SET telf = CASE WHEN telf = '' THEN $2 ELSE telf END WHERE id = $1 RETURNING id", [atual.id, p.telefone]);
    return atual.id;
  }
  const novo = await one<{ id: number }>(q,
    "INSERT INTO crm_clientes (nome, tipo, email, telf, notas) VALUES ($1, 'Empresa', $2, $3, $4) RETURNING id", [p.nome, p.email, p.telefone, p.nota]);
  return novo?.id;
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  const preparar = async (b: z.infer<typeof servicoSchema>) => ({
    slug: slugServico({ slug: b.slug, titulo: b.dados.titulo }),
    ordem: b.ordem ?? await repo.proximaOrdem(db),
    ativo: b.ativo,
    dados: b.dados,
  });

  app.get("/v1/servicos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { servicos: await repo.listar(db) };
  });

  app.post("/v1/servicos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: servicoSchema }, req);
    if (!v) return;
    const s = await preparar(v.body);
    if (!s.slug) return reply.code(400).send({ error: "O endereço da página ficou vazio: use letras ou números no título." });
    try {
      const r = await repo.criar(db, s);
      await audit(db, req.actor!.id, "servico.criar", "servico", String(r?.id ?? ""), req.ip);
      return { servico: r };
    } catch (e) {
      if (ehDuplicado(e)) return reply.code(409).send({ error: `Já existe um serviço com o endereço «${s.slug}».` });
      throw e;
    }
  });

  app.put("/v1/servicos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }), body: servicoSchema }, req);
    if (!v) return;
    const s = await preparar(v.body);
    if (!s.slug) return reply.code(400).send({ error: "O endereço da página ficou vazio: use letras ou números no título." });
    try {
      const r = await repo.atualizar(db, v.params.id, s);
      if (!r) return reply.code(404).send({ error: "serviço inexistente" });
      await audit(db, req.actor!.id, "servico.gravar", "servico", String(v.params.id), req.ip);
      return { servico: r };
    } catch (e) {
      if (ehDuplicado(e)) return reply.code(409).send({ error: `Já existe um serviço com o endereço «${s.slug}».` });
      throw e;
    }
  });

  app.delete("/v1/servicos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }) }, req);
    if (!v) return;
    if (!(await repo.apagar(db, v.params.id))) return reply.code(404).send({ error: "serviço inexistente" });
    await audit(db, req.actor!.id, "servico.apagar", "servico", String(v.params.id), req.ip);
    return { ok: true };
  });

  // Formulário «Pedir proposta» da página Empresas: o pedido fica nos pedidos de proposta, ligado ao cliente (CRM › Clientes, tipo Empresa), e a ENA recebe um email.
  app.post("/v1/public/pedidos-proposta", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { body: pedidoSchema }, req);
    if (!v) return;
    const p = v.body;
    if (p.site) return { ok: true }; // campo escondido: só os robôs o preenchem
    // Cabe sempre nas notas do cliente (até 2000): o serviço tem no máximo 160 e o nome 120.
    const nota = `[${hojeLisboa()}] Pedido de proposta no site${p.servico ? ` (${p.servico})` : ""}: ${p.nome}`;
    await db.tx(async q => {
      const clienteId = await registarPedido(q, { nome: p.empresa || p.nome, email: p.email, telefone: p.telefone, nota });
      await one(q, `INSERT INTO pedidos_proposta (nome, empresa, email, telefone, servico, mensagem, cliente_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [p.nome, p.empresa, p.email, p.telefone, p.servico, p.mensagem, clienteId ?? null]);
    });
    const ena = await lerEntidadePublica(db);
    if (ena.email) {
      const texto = [`Novo pedido de proposta no site.`, "", `Nome: ${p.nome}`, `Empresa: ${p.empresa || "—"}`, `Email: ${p.email}`, `Telefone: ${p.telefone || "—"}`,
        `Serviço: ${p.servico || "—"}`, "", p.mensagem || "(sem mensagem)", "", "Ficou registado em CRM › Clientes."].join("\n");
      await sendMail(db, { to: ena.email, name: ena.nomeCurto || ena.nome, subject: `Pedido de proposta: ${p.empresa || p.nome}`, text: texto }).catch(() => undefined);
    }
    return { ok: true };
  });

  // Pedidos de proposta no backoffice (Gestão › Empresas / Business).
  app.get("/v1/pedidos-proposta", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ estado: z.enum(ESTADOS_PEDIDO).optional() }) }, req);
    if (!v) return;
    const pedidos = await many(db, `SELECT id, nome, empresa, email, telefone, servico, mensagem, estado, cliente_id AS "clienteId", criado_em AS "criadoEm"
      FROM pedidos_proposta WHERE ($1::text IS NULL OR estado = $1) ORDER BY (estado = 'novo') DESC, criado_em DESC LIMIT 500`, [v.query.estado ?? null]);
    return { pedidos };
  });

  app.patch("/v1/pedidos-proposta/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }), body: z.object({ estado: z.enum(ESTADOS_PEDIDO) }) }, req);
    if (!v) return;
    const r = await one(db, "UPDATE pedidos_proposta SET estado = $2, atualizado_em = now() WHERE id = $1 RETURNING id, estado", [v.params.id, v.body.estado]);
    if (!r) return reply.code(404).send({ error: "pedido inexistente" });
    await audit(db, req.actor!.id, `pedido-proposta.${v.body.estado}`, "pedido_proposta", String(v.params.id), req.ip);
    return r;
  });

  app.get("/v1/public/servicos", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (_req, reply) => {
    reply.header("cache-control", "no-store");
    return { servicos: (await repo.ativos(db)).map(s => ({ ...s.dados, slug: s.slug })) };
  });
}
