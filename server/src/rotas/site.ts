import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { satisfacaoPublica } from "../areaFormando.js";
import { ID_AVALIACOES_GOOGLE } from "../avaliacoesGoogle.js";
import { guardarImagemHero } from "../cursoImagens.js";
import { normalizarLembrete } from "../lembretePre.js";
import { ehSegredo, settingsSemSegredos } from "../opsVisibilidade.js";
import { DEFINICOES_SO_ADMIN, MAX_TELEFONES_ZONA, lerEntidadePublica, validarDefinicoes } from "../regrasConfig.js";
import * as settings from "../repos/settings.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const idDefinicao = z.object({ id: z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/, "definição inválida") });
/** Cada valor até 400 caracteres; os telefones por zona são várias linhas (limites em regrasConfig.ts). */
const settingsSchema = z.object({ values: z.record(z.string().max(MAX_TELEFONES_ZONA)) })
  .refine(b => Object.entries(b.values).every(([k, v]) => k === "telefonesZona" || v.length <= 400));
const siteSchema = z.object({ values: z.record(z.string().max(800)) });
const slotParam = z.object({ slot: z.enum(["1", "2", "fundo", "apresentacao"]) });

function valoresDoSite(values: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(values)) {
    if (/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(chave)) out[chave] = valor.trim().slice(0, 800);
  }
  return out;
}

// Conteúdo do site e definições (`app_settings`).
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/settings", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { [ID_AVALIACOES_GOOGLE]: _google, ...todas } = await settings.todasDefinicoes(db);
    return { settings: req.actor?.role === "admin" ? todas : settingsSemSegredos(todas) };
  });

  app.put("/v1/settings/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const p = validar(reply, { params: idDefinicao }, req);
    if (!p) return;
    const id = p.params.id;
    // A chave e a cópia das avaliações Google só se mudam pela secção própria (a chave fica cifrada).
    if (id === ID_AVALIACOES_GOOGLE) return reply.code(403).send({ error: "Use Configurações › Avaliações Google." });
    if (DEFINICOES_SO_ADMIN.has(id) && req.actor?.role !== "admin") {
      return reply.code(403).send({ error: id === "site" ? "só o administrador edita o site" : "Só o administrador altera esta definição." });
    }
    const parsed = (id === "site" ? siteSchema : settingsSchema).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const lembrete = id === "lembrete_pre" ? normalizarLembrete(parsed.data.values) : null;
    if (id === "lembrete_pre" && !lembrete) return reply.code(400).send({ error: "Frequência inválida. Use minutos, horas ou dias, a partir de 1." });
    const validadas = validarDefinicoes(id, parsed.data.values);
    if (!validadas.ok) return reply.code(400).send({ error: validadas.erro });
    let values: Record<string, unknown> = id === "site" ? valoresDoSite(parsed.data.values) : lembrete ?? validadas.values;
    if (req.actor?.role !== "admin") {
      // Quem não é admin não vê nem altera segredos (chave do webhook, tokens): mantêm-se os gravados.
      const guardados = await settings.lerDefinicao(db, id);
      const semSegredos = Object.fromEntries(Object.entries(values).filter(([k]) => !ehSegredo(k)));
      const segredos = Object.fromEntries(Object.entries(guardados).filter(([k]) => ehSegredo(k)));
      values = { ...semSegredos, ...segredos };
    }
    await settings.gravarDefinicao(db, id, values);
    await audit(db, req.actor?.id, "definicoes.gravar", "app_settings", id, req.ip, { chaves: Object.keys(values).filter(k => !ehSegredo(k)) });
    return { ok: true, id, values: req.actor?.role === "admin" ? values : Object.fromEntries(Object.entries(values).filter(([k]) => !ehSegredo(k))) };
  });

  app.post("/v1/site/hero/:slot/imagem", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor?.role !== "admin") return reply.code(403).send({ error: "só o administrador edita o site" });
    const v = validar(reply, { params: slotParam }, req);
    if (!v) return;
    let ficheiro: { nome: string; mime: string; bytes: Buffer } | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") ficheiro = { nome: part.filename || "hero.jpg", mime: part.mimetype || "", bytes: await part.toBuffer() };
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!ficheiro?.bytes.length) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const gravada = await guardarImagemHero(db, v.params.slot, ficheiro);
      await audit(db, req.actor?.id, "site.imagem", "site", v.params.slot, req.ip);
      return gravada;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  app.get("/v1/public/site", async (_req, reply) => {
    reply.header("cache-control", "no-store");
    const raw = await settings.lerDefinicao(db, "site");
    const valores: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(raw)) if (typeof valor === "string") valores[chave] = valor;
    // As redes sociais da ENA (Sistema › Site › SEO): um endereço por linha, só https.
    const seo = await settings.lerDefinicao(db, "seo");
    const redes = String(seo.redesSociais ?? "").split(/\r?\n/).map(s => s.trim()).filter(s => /^https:\/\//i.test(s)).slice(0, 12);
    return { valores, redes, satisfacao: await satisfacaoPublica(db) };
  });

  /** Contactos públicos da entidade (cabeçalhos de folhas e rodapés do site). */
  app.get("/v1/public/entidade", async () => ({ entidade: await lerEntidadePublica(db) }));
}
