import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { textoDoCorpo } from "../../src/partilhado/blogBlocos.js";
import { gerarPalavraPasse, mensagemPalavraPasse, palavraPasseValida } from "../../src/partilhado/passwordPolicy.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { sendMail } from "./mailer.js";
import { hashPassword, isEmail, normalizeEmail, sha256 } from "./security.js";

type Actor = { id: string; role: string; email: string; name: string };

type Sessao = { data: string; horaInicio: string; horaFim: string; modulos: string[] };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function uniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

function sessoesDe(raw: unknown): Sessao[] {
  if (!Array.isArray(raw)) return [];
  const lista: Sessao[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const data = String(o.data ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    lista.push({
      data,
      horaInicio: String(o.horaInicio ?? ""),
      horaFim: String(o.horaFim ?? ""),
      modulos: Array.isArray(o.modulos) ? o.modulos.map(String).filter(Boolean) : [],
    });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function dataPt(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${Number(dia)} ${MESES[Number(mes) - 1] ?? mes} ${ano}`;
}

function horas(inicio: string, fim: string) {
  const a = inicio.replace(":", "h");
  const b = fim.replace(":", "h");
  if (a && b) return `${a}—${b}`;
  return a || b;
}

function eur(valor: number) {
  return `${valor.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

function prefsDe(raw: unknown) {
  const o = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const canais = o.canais && typeof o.canais === "object" ? o.canais as Record<string, unknown> : {};
  const lidas = Array.isArray(o.lidas) ? o.lidas.map(String) : [];
  return {
    novidades: o.novidades !== false,
    canais: {
      email: canais.email !== false,
      sms: Boolean(canais.sms),
      whatsapp: canais.whatsapp !== false,
      plataforma: canais.plataforma !== false,
    },
    lidas,
  };
}

export async function gerarAcessoFormando(db: Db, regime: "gold" | "fin", id: number, repor: boolean): Promise<
  | { email: string; password?: string; criado: boolean; reposto: boolean }
  | { erro: string; estado: 400 | 404 | 409 }
> {
  const tabela = regime === "fin" ? "formandos_fin" : "formandos_gold";
  const row = await db.query<{ nome: string; apelido: string; email: string; user_id: string | null }>(
    `SELECT nome, apelido, email, user_id::text AS user_id FROM ${tabela} WHERE id = $1`,
    [id],
  );
  const pessoa = row.rows[0];
  if (!pessoa) return { erro: "formando não encontrado", estado: 404 as const };
  const email = normalizeEmail(pessoa.email);
  if (!email || !isEmail(email)) return { erro: "O formando precisa de um email válido para ter acesso.", estado: 400 as const };
  const nome = `${pessoa.nome} ${pessoa.apelido}`.trim() || email;
  const existente = await db.query<{ id: string; role: string }>("SELECT id, role FROM users WHERE lower(email) = $1", [email]);
  const conta = existente.rows[0];
  if (conta && conta.role !== "formando") {
    return { erro: "Este email já é uma conta da secretaria ou de um formador.", estado: 409 as const };
  }
  if (conta && !repor && pessoa.user_id) {
    await ligarPeloEmail(db, conta.id, email);
    return { email, criado: false, reposto: false };
  }
  const password = gerarPalavraPasse();
  const hash = await hashPassword(password);
  let userId = conta?.id ?? "";
  if (!conta) {
    userId = randomUUID();
    try {
      await db.query(
        "INSERT INTO users (id, name, email, password_hash, role, active, must_change_password) VALUES ($1,$2,$3,$4,'formando',true,true)",
        [userId, nome, email, hash],
      );
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
      const outra = await db.query<{ id: string; role: string }>("SELECT id, role FROM users WHERE lower(email) = $1", [email]);
      if (!outra.rows[0] || outra.rows[0].role !== "formando") {
        return { erro: "Este email já é uma conta da secretaria ou de um formador.", estado: 409 as const };
      }
      userId = outra.rows[0].id;
    }
  } else {
    await db.query(
      "UPDATE users SET password_hash = $2, must_change_password = true, active = true, name = CASE WHEN name = '' THEN $3 ELSE name END WHERE id = $1",
      [conta.id, hash, nome],
    );
    await db.query("DELETE FROM sessions WHERE user_id = $1", [conta.id]);
    userId = conta.id;
  }
  await ligarPeloEmail(db, userId, email);
  return { email, password, criado: !conta, reposto: Boolean(conta) };
}

async function ligarPeloEmail(db: Db, userId: string, email: string) {
  await db.query("UPDATE formandos_gold SET user_id = $1 WHERE lower(trim(email)) = $2 AND (user_id IS NULL OR user_id = $1)", [userId, email]);
  await db.query("UPDATE formandos_fin SET user_id = $1 WHERE lower(trim(email)) = $2 AND (user_id IS NULL OR user_id = $1)", [userId, email]);
}

async function mediaInqueritos(db: Db) {
  const rows = await db.query<{ payload: unknown; respostas: unknown }>(
    `SELECT c.payload, r.respostas
       FROM inquerito_respostas r
       JOIN catalog_items c ON c.id = r.inquerito_id AND c.kind = 'inqueritos'`,
  );
  const nums: number[] = [];
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
    const perguntas = Array.isArray(payload.perguntas) ? payload.perguntas : [];
    const respostas = row.respostas && typeof row.respostas === "object" ? row.respostas as Record<string, unknown> : {};
    for (const pergunta of perguntas) {
      if (!pergunta || typeof pergunta !== "object") continue;
      const p = pergunta as Record<string, unknown>;
      if (String(p.tipo ?? "") !== "escala") continue;
      const valor = Number(respostas[String(p.id)]);
      if (Number.isFinite(valor) && valor >= 1 && valor <= 5) nums.push(valor);
    }
  }
  if (!nums.length) return null;
  const media = Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
  return { nota: `${media.toFixed(1).replace(".", ",")}/5`, n: nums.length };
}

export async function satisfacaoPublica(db: Db) {
  return mediaInqueritos(db);
}

type Inscricao = {
  regime: "gold" | "fin";
  id: number;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  curso: string;
  turma: string;
  turmaId: number;
  estado: string;
  pago: boolean;
  valor: number;
  metodo: string;
  inscrito: string;
};

async function inscricoesDo(db: Db, userId: string): Promise<Inscricao[]> {
  const gold = await db.query<Record<string, unknown>>(
    "SELECT id, nome, apelido, email, telf, curso, turma, turma_id, estado, pago, valor, metodo, inscrito FROM formandos_gold WHERE user_id = $1 ORDER BY id",
    [userId],
  );
  const fin = await db.query<Record<string, unknown>>(
    "SELECT id, nome, apelido, email, telf, curso, turma, turma_id, estado FROM formandos_fin WHERE user_id = $1 ORDER BY id",
    [userId],
  );
  const lista: Inscricao[] = [];
  for (const r of gold.rows) {
    lista.push({
      regime: "gold",
      id: Number(r.id),
      nome: String(r.nome ?? ""),
      apelido: String(r.apelido ?? ""),
      email: String(r.email ?? ""),
      telf: String(r.telf ?? ""),
      curso: String(r.curso ?? ""),
      turma: String(r.turma ?? ""),
      turmaId: Number(r.turma_id ?? 0),
      estado: String(r.estado ?? ""),
      pago: Boolean(r.pago),
      valor: Number(r.valor ?? 0),
      metodo: String(r.metodo ?? ""),
      inscrito: String(r.inscrito ?? ""),
    });
  }
  for (const r of fin.rows) {
    lista.push({
      regime: "fin",
      id: Number(r.id),
      nome: String(r.nome ?? ""),
      apelido: String(r.apelido ?? ""),
      email: String(r.email ?? ""),
      telf: String(r.telf ?? ""),
      curso: String(r.curso ?? ""),
      turma: String(r.turma ?? ""),
      turmaId: Number(r.turma_id ?? 0),
      estado: String(r.estado ?? ""),
      pago: true,
      valor: 0,
      metodo: "Financiada",
      inscrito: "",
    });
  }
  return lista;
}

export async function montarArea(db: Db, user: Actor) {
  const prefsRow = await db.query<{ area_prefs: unknown; name: string; email: string }>(
    "SELECT area_prefs, name, email FROM users WHERE id = $1",
    [user.id],
  );
  const conta = prefsRow.rows[0];
  const prefs = prefsDe(conta?.area_prefs);
  const inscricoes = await inscricoesDo(db, user.id);
  const primeira = inscricoes[0];
  const hoje = hojeIso();
  const cursos = [];
  const agenda = [];
  const certificados = [];
  const pagamentos = [];
  const notificacoes = [];

  for (const ins of inscricoes) {
    const tabela = ins.regime === "fin" ? "turmas_fin" : "turmas_gold";
    const turma = ins.turmaId
      ? await db.query<{ nome: string; cronograma: unknown }>(`SELECT nome, cronograma FROM ${tabela} WHERE id = $1`, [ins.turmaId])
      : { rows: [] as { nome: string; cronograma: unknown }[] };
    const sessoes = sessoesDe(turma.rows[0]?.cronograma);
    const feitas = sessoes.filter(s => s.data <= hoje).length;
    const progresso = sessoes.length ? Math.round((feitas / sessoes.length) * 100) : 0;
    const passadas = sessoes.filter(s => s.data <= hoje);
    const ultimo = passadas.length ? dataPt(passadas[passadas.length - 1].data) : "";
    const cursoId = `${ins.regime}-${ins.id}`;
    cursos.push({
      id: cursoId,
      regime: ins.regime,
      titulo: ins.curso || turma.rows[0]?.nome || "Formação",
      turma: ins.turma || turma.rows[0]?.nome || "",
      estado: ins.estado,
      progresso,
      sessoes: sessoes.length,
      feitas,
      ultimo,
      modulos: [...new Set(sessoes.flatMap(s => s.modulos))].slice(0, 12),
    });
    for (const s of sessoes) {
      const [ano, mes, dia] = s.data.split("-");
      agenda.push({
        id: `ses-${cursoId}-${s.data}-${s.horaInicio}`,
        cursoId,
        data: s.data,
        dia: String(Number(dia)),
        mes: MESES[Number(mes) - 1] ?? mes,
        ano,
        titulo: s.modulos[0] || "Sessão",
        curso: ins.curso || "Formação",
        horas: horas(s.horaInicio, s.horaFim),
        futura: s.data >= hoje,
      });
    }
    if (ins.turmaId) {
      const certs = await db.query<{ emitido: boolean; nota: unknown; ficheiro_url: string; ficheiro_nome: string; emitido_em: string | Date | null }>(
        `SELECT emitido, nota, COALESCE(ficheiro_url, '') AS ficheiro_url, COALESCE(ficheiro_nome, '') AS ficheiro_nome, emitido_em
           FROM turma_certificados WHERE regime = $1 AND turma_id = $2 AND formando_id = $3`,
        [ins.regime, ins.turmaId, ins.id],
      );
      for (const cert of certs.rows) {
        if (!cert.emitido) continue;
        const quando = cert.emitido_em ? dataPt(new Date(cert.emitido_em).toISOString().slice(0, 10)) : "";
        certificados.push({
          id: `cert-${ins.regime}-${ins.id}`,
          curso: ins.curso || "Formação",
          data: quando,
          nota: cert.nota == null ? "" : String(cert.nota),
          url: cert.ficheiro_url,
          nome: cert.ficheiro_nome,
        });
        notificacoes.push({
          id: `cert-${ins.regime}-${ins.id}`,
          titulo: "Certificado disponível",
          texto: `O certificado de ${ins.curso || "formação"} está na área.`,
          quando: quando || "Disponível",
        });
      }
    }
    if (ins.regime === "gold" && ins.valor > 0) {
      pagamentos.push({
        id: `fg-${ins.id}`,
        curso: ins.curso || "Formação",
        data: ins.inscrito,
        valor: eur(ins.valor),
        estado: ins.pago ? "Pago" : "Pendente",
        metodo: ins.metodo,
      });
      if (!ins.pago) {
        notificacoes.push({
          id: `pag-${ins.id}`,
          titulo: "Pagamento pendente",
          texto: `${ins.curso || "A formação"} tem ${eur(ins.valor)} por confirmar.`,
          quando: ins.inscrito || "Em aberto",
        });
      }
    }
  }

  const nomes = [...new Set(inscricoes.map(i => `${i.nome} ${i.apelido}`.trim().toLowerCase()).filter(Boolean))];
  if (nomes.length) {
    const extra = await db.query<{ id: string; nome: string; valor: unknown; metodo: string; curso: string; data: string; estado: string }>(
      "SELECT id, nome, valor, metodo, curso, data, estado FROM pagamentos WHERE lower(nome) IN (SELECT lower(x) FROM jsonb_array_elements_text($1::jsonb) x)",
      [JSON.stringify(nomes)],
    );
    for (const p of extra.rows) {
      pagamentos.push({
        id: String(p.id),
        curso: p.curso,
        data: p.data,
        valor: eur(Number(p.valor) || 0),
        estado: p.estado,
        metodo: p.metodo,
      });
    }
  }

  const proximas = agenda.filter(s => s.futura).slice(0, 3);
  for (const s of proximas) {
    notificacoes.push({
      id: s.id,
      titulo: s.data === hoje ? "Sessão hoje" : "Próxima sessão",
      texto: `${s.titulo} · ${s.curso} · ${s.horas}`,
      quando: `${s.dia} ${s.mes}`,
    });
  }

  const lidas = new Set(prefs.lidas);
  const progresso = cursos.length ? Math.round(cursos.reduce((s, c) => s + c.progresso, 0) / cursos.length) : 0;
  const pessoaNome = primeira ? `${primeira.nome} ${primeira.apelido}`.trim() : (conta?.name || user.name);
  return {
    pessoa: {
      nome: primeira?.nome || pessoaNome,
      apelido: primeira?.apelido || "",
      email: conta?.email || user.email,
      telf: primeira?.telf || inscricoes.find(i => i.telf)?.telf || "",
      novidades: prefs.novidades,
      canais: prefs.canais,
    },
    cursos,
    agenda: agenda.sort((a, b) => a.data.localeCompare(b.data) || a.horas.localeCompare(b.horas)),
    certificados,
    pagamentos,
    notificacoes: notificacoes.map(n => ({ ...n, porLer: !lidas.has(n.id) })),
    resumo: { cursos: cursos.length, progresso, certificados: certificados.length },
    financiada: inscricoes.some(i => i.regime === "fin"),
  };
}

const perfilSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  apelido: z.string().trim().max(80).optional(),
  telf: z.string().trim().max(40).optional(),
  novidades: z.boolean().optional(),
  canais: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    whatsapp: z.boolean(),
    plataforma: z.boolean(),
  }).optional(),
  lidas: z.array(z.string().max(80)).max(80).optional(),
});

export function registerAreaFormandoRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply, opts?: { formando?: boolean }) => boolean;
  },
) {
  const { requireAuth } = helpers;

  app.get("/v1/area-formando", async (req, reply) => {
    if (!requireAuth(req, reply, { formando: true })) return;
    if (req.actor!.role !== "formando") return reply.code(403).send({ error: "a área do formando não abre o GesForma" });
    return montarArea(db, req.actor!);
  });

  app.patch("/v1/area-formando", async (req, reply) => {
    if (!requireAuth(req, reply, { formando: true })) return;
    if (req.actor!.role !== "formando") return reply.code(403).send({ error: "a área do formando não abre o GesForma" });
    const parsed = perfilSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const actual = await db.query<{ area_prefs: unknown }>("SELECT area_prefs FROM users WHERE id = $1", [req.actor!.id]);
    const prefs = prefsDe(actual.rows[0]?.area_prefs);
    const seguinte = {
      novidades: d.novidades ?? prefs.novidades,
      canais: d.canais ?? prefs.canais,
      lidas: d.lidas ?? prefs.lidas,
    };
    const nomeConta = [d.nome, d.apelido].filter(parte => parte != null).join(" ").trim();
    await db.query(
      "UPDATE users SET area_prefs = $2::jsonb, name = CASE WHEN $3 = '' THEN name ELSE $3 END WHERE id = $1",
      [req.actor!.id, JSON.stringify(seguinte), nomeConta],
    );
    if (d.nome != null || d.apelido != null || d.telf != null) {
      await db.query(
        `UPDATE formandos_gold SET
           nome = COALESCE($2, nome),
           apelido = COALESCE($3, apelido),
           telf = COALESCE($4, telf)
         WHERE user_id = $1`,
        [req.actor!.id, d.nome ?? null, d.apelido ?? null, d.telf ?? null],
      );
      await db.query(
        `UPDATE formandos_fin SET
           nome = COALESCE($2, nome),
           apelido = COALESCE($3, apelido),
           telf = COALESCE($4, telf)
         WHERE user_id = $1`,
        [req.actor!.id, d.nome ?? null, d.apelido ?? null, d.telf ?? null],
      );
    }
    return montarArea(db, req.actor!);
  });

  app.post("/v1/formandos/:regime/:id/acesso", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const role = req.actor!.role;
    if (role === "formador" || role === "formando") {
      return reply.code(403).send({ error: "Só a secretaria gera o acesso do formando." });
    }
    const regime = String((req.params as { regime?: string }).regime ?? "");
    const id = Number((req.params as { id?: string }).id);
    if ((regime !== "gold" && regime !== "fin") || !Number.isInteger(id)) {
      return reply.code(400).send({ error: "pedido inválido" });
    }
    const repor = Boolean((req.body as { repor?: boolean } | undefined)?.repor);
    const resultado = await gerarAcessoFormando(db, regime, id, repor);
    if ("erro" in resultado) return reply.code(resultado.estado).send({ error: resultado.erro });
    return { acesso: resultado };
  });

  app.post("/v1/auth/recuperar", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = z.object({ email: z.string().max(254) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const email = normalizeEmail(parsed.data.email);
    if (isEmail(email)) {
      const user = await db.query<{ id: string; name: string; role: string; active: boolean }>(
        "SELECT id, name, role, active FROM users WHERE lower(email) = $1",
        [email],
      );
      const row = user.rows[0];
      if (row?.active && row.role === "formando") {
        const token = randomBytes(24).toString("base64url");
        const exp = new Date(Date.now() + 2 * 3600_000).toISOString();
        await db.query("DELETE FROM password_resets WHERE user_id = $1", [row.id]);
        await db.query(
          "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1,$2,$3)",
          [sha256(token), row.id, exp],
        );
        const origem = config.appOrigin.replace(/\/$/, "");
        const ligacao = `${origem}/area-formando?recuperar=${encodeURIComponent(token)}`;
        await sendMail(db, {
          to: email,
          name: row.name || email,
          subject: "Redefinir a palavra-passe da área do formando",
          text: `Para definir uma palavra-passe nova, abra esta ligação nas próximas duas horas:\n${ligacao}\n\nSe não pediu esta mensagem, pode ignorá-la.`,
        }).catch(() => undefined);
      }
    }
    return reply.send({ ok: true });
  });

  app.post("/v1/auth/repor", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    if (!palavraPasseValida(parsed.data.password)) {
      return reply.code(400).send({ error: mensagemPalavraPasse(parsed.data.password) });
    }
    const row = await db.query<{ user_id: string }>(
      "SELECT user_id::text AS user_id FROM password_resets WHERE token_hash = $1 AND expires_at > now()",
      [sha256(parsed.data.token)],
    );
    const found = row.rows[0];
    if (!found) return reply.code(400).send({ error: "A ligação expirou. Peça outra à área do formando." });
    await db.query(
      "UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1 AND role = 'formando'",
      [found.user_id, await hashPassword(parsed.data.password)],
    );
    await db.query("DELETE FROM password_resets WHERE user_id = $1", [found.user_id]);
    await db.query("DELETE FROM sessions WHERE user_id = $1", [found.user_id]);
    return { ok: true };
  });
}

export function excerto(corpo: string) {
  const limpo = textoDoCorpo(corpo);
  if (limpo.length <= 180) return limpo;
  return `${limpo.slice(0, 177).trim()}…`;
}
