/** Apoios da Financiada: regras configuráveis, IBAN do formando, cálculo, processamento e pagamento. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  calcularMes, ibanDe, mascararIban, mesesDaTurma, periodoValido, presencasNoMes, regraDaLinha, regrasEfetivas,
  ROTULO_APOIO, sessoesDaTurma, TRANSICOES, validarIban, type CalculoMes,
} from "../../apoios.js";
import { encryptField } from "../../fieldCrypto.js";
import {
  alterarApoio, apoioPorId, apoiosDaTurma, apoiosDoFormando, dadosBancarios, financiadoresEmUso, folhasFin,
  anularCalculado, formandoFin, formandosDaTurma, gravarCalculado, gravarDadosBancarios, listarRegras, regrasParaTurma,
  substituirRegras, TIPOS_APOIO, turmaFin, turmasFinAtivas, type ApoioRow,
} from "../../repos/apoios.js";
import { idNum, idParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";

const tipo = z.enum(TIPOS_APOIO);
const estado = z.enum(["calculado", "aprovado", "pago", "anulado"]);
const periodo = z.string().trim().refine(periodoValido, "Mês inválido (AAAA-MM).");
const dataIso = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).");
const dinheiro = z.coerce.number().min(0).max(100_000);

const regraBody = z.object({
  tipo,
  ativo: z.boolean().default(true),
  modo: z.enum(["hora", "dia", "mes"]),
  valor: dinheiro,
  minHorasDia: z.coerce.number().min(0).max(24).default(0),
  tetoMensal: dinheiro.nullable().default(null),
  assiduidadeMinima: z.coerce.number().min(0).max(100).nullable().default(null),
  requerIban: z.boolean().default(true),
  notas: z.string().trim().max(500).default(""),
});

const regrasBody = z.object({
  financiador: z.string().trim().max(120).default(""),
  turmaId: idNum.nullable().default(null),
  regras: z.array(regraBody).max(TIPOS_APOIO.length)
    .refine(l => new Set(l.map(r => r.tipo)).size === l.length, "Cada tipo de apoio só pode aparecer uma vez."),
});

const n = (v: unknown) => Number(v ?? 0);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? "")).slice(0, 10);

function apoioJson(a: ApoioRow) {
  const calculado = n(a.valor_calculado);
  const ajuste = n(a.ajuste);
  return {
    id: Number(a.id),
    formandoId: Number(a.formando_id),
    formando: a.formando_nome ?? undefined,
    turmaId: Number(a.turma_id),
    periodo: a.periodo,
    tipo: a.tipo,
    rotulo: ROTULO_APOIO[a.tipo],
    dias: Number(a.dias),
    horas: n(a.horas),
    valorCalculado: calculado,
    ajuste,
    motivoAjuste: a.motivo_ajuste,
    valor: Math.round((calculado + ajuste) * 100) / 100,
    estado: a.estado,
    detalhe: a.detalhe,
    pagoEm: a.pago_em ? iso(a.pago_em) : null,
    referencia: a.referencia,
    notas: a.notas,
    atualizadoEm: iso(a.updated_at),
  };
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function registarApoios(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  /** Cálculo de um mês para os formandos indicados de uma turma. */
  async function calcularTurma(turmaId: number, mes: string, so?: number) {
    const turma = await turmaFin(db, turmaId);
    if (!turma) return null;
    const [linhasRegras, folhas, formandos] = await Promise.all([
      regrasParaTurma(db, turmaId, turma.financiador),
      folhasFin(db, turmaId),
      formandosDaTurma(db, turmaId),
    ]);
    const regras = regrasEfetivas(linhasRegras, turmaId, turma.financiador);
    const sessoes = sessoesDaTurma(turma.cronograma, folhas);
    const alvo = so ? formandos.filter(f => Number(f.id) === so) : formandos;
    const bancos = new Map((await dadosBancarios(db, alvo.map(f => Number(f.id)))).map(b => [Number(b.formando_id), b]));
    const calculos = alvo.map(f => {
      const nome = `${f.nome} ${f.apelido}`.trim();
      const dias = presencasNoMes(sessoes, { id: Number(f.id), nome }, mes);
      const temIban = Boolean(ibanDe(bancos.get(Number(f.id))?.iban_enc));
      return { formandoId: Number(f.id), nome, calculo: calcularMes(regras, dias, mes, temIban) };
    });
    return { turma, regras, sessoes, calculos };
  }

  // ── Regras ──────────────────────────────────────────────────────────────────
  app.get("/v1/apoios/regras", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const [linhas, financiadores, turmas] = await Promise.all([
      listarRegras(db),
      financiadoresEmUso(db),
      turmasFinAtivas(db),
    ]);
    return {
      tipos: TIPOS_APOIO.map(t => ({ id: t, rotulo: ROTULO_APOIO[t] })),
      financiadores,
      turmas: turmas.map(t => ({ id: Number(t.id), nome: t.nome, financiador: t.financiador })),
      regras: linhas.map(l => ({ id: Number(l.id), financiador: l.financiador, turmaId: l.turma_id == null ? null : Number(l.turma_id), ...regraDaLinha(l) })),
    };
  });

  app.put("/v1/apoios/regras", async (req, reply) => {
    const v = validar(reply, { body: regrasBody }, req);
    if (!v || !requireAuth(req, reply)) return;
    const { financiador, turmaId, regras } = v.body;
    if (turmaId && !(await turmaFin(db, turmaId))) return reply.code(404).send({ error: "Turma não encontrada." });
    await db.tx(q => substituirRegras(q, { financiador, turmaId }, regras, req.actor!.id));
    await audit(db, req.actor!.id, "apoios.regras", "apoio_regras", turmaId ? `turma:${turmaId}` : financiador || "geral", req.ip, {
      financiador, turmaId, tipos: regras.map(r => r.tipo),
    });
    return { ok: true };
  });

  // ── Formando ────────────────────────────────────────────────────────────────
  app.get("/v1/formandos/fin/:id/apoios", async (req, reply) => {
    const v = validar(reply, { params: idParam, query: z.object({ mes: periodo.optional() }) }, req);
    if (!v || !requireAuth(req, reply)) return;
    const f = await formandoFin(db, v.params.id);
    if (!f) return reply.code(404).send({ error: "Formando não encontrado." });
    const [banco] = await dadosBancarios(db, [Number(f.id)]);
    const iban = ibanDe(banco?.iban_enc);
    const registos = (await apoiosDoFormando(db, Number(f.id))).map(apoioJson);
    let simulacao: CalculoMes | null = null;
    let meses: string[] = [];
    let mes: string | null = null;
    let turma: { id: number; nome: string; financiador: string } | null = null;
    let regras: ReturnType<typeof regrasEfetivas> = [];
    const t = f.turma_id ? await turmaFin(db, Number(f.turma_id)) : null;
    if (t) {
      turma = { id: Number(t.id), nome: t.nome, financiador: t.financiador };
      meses = mesesDaTurma(sessoesDaTurma(t.cronograma, []));
      // Mês pedido; senão o atual se a turma tiver sessões nele; senão o último mês já decorrido.
      const mesAtual = hojeIso().slice(0, 7);
      mes = v.query.mes ?? (meses.includes(mesAtual) ? mesAtual : meses.find(m => m <= mesAtual) ?? meses[meses.length - 1] ?? mesAtual);
      const calc = await calcularTurma(Number(t.id), mes, Number(f.id));
      regras = calc?.regras ?? [];
      // Um formando que já saiu da lista ativa (ex.: desistiu) não tem simulação.
      simulacao = calc?.calculos[0]?.calculo ?? null;
    }
    return {
      formandoId: Number(f.id),
      iban: { tem: Boolean(iban), mascarado: mascararIban(iban), titular: banco?.titular ?? "" },
      turma,
      regras,
      meses,
      mes,
      simulacao,
      registos,
      totais: {
        pago: registos.filter(r => r.estado === "pago").reduce((s, r) => s + r.valor, 0),
        porPagar: registos.filter(r => r.estado === "calculado" || r.estado === "aprovado").reduce((s, r) => s + r.valor, 0),
      },
    };
  });

  app.put("/v1/formandos/fin/:id/apoios/iban", async (req, reply) => {
    const body = z.object({ iban: z.string().trim().max(60).default(""), titular: z.string().trim().max(160).default("") });
    const v = validar(reply, { params: idParam, body }, req);
    if (!v || !requireAuth(req, reply)) return;
    if (!(await formandoFin(db, v.params.id))) return reply.code(404).send({ error: "Formando não encontrado." });
    let enc = "";
    if (v.body.iban) {
      const ok = validarIban(v.body.iban);
      if (!ok.ok) return reply.code(400).send({ error: ok.erro, campos: { iban: ok.erro } });
      enc = encryptField(ok.iban);
    }
    await gravarDadosBancarios(db, v.params.id, enc, v.body.titular, req.actor!.id);
    await audit(db, req.actor!.id, enc ? "apoios.iban" : "apoios.iban.removido", "formando_fin", String(v.params.id), req.ip);
    return { ok: true, iban: { tem: Boolean(enc), mascarado: enc ? mascararIban(ibanDe(enc)) : "", titular: v.body.titular } };
  });

  // ── Turma ───────────────────────────────────────────────────────────────────
  app.get("/v1/apoios/turmas/:id", async (req, reply) => {
    const v = validar(reply, { params: idParam, query: z.object({ mes: periodo.optional() }) }, req);
    if (!v || !requireAuth(req, reply)) return;
    const turma = await turmaFin(db, v.params.id);
    if (!turma) return reply.code(404).send({ error: "Turma não encontrada." });
    const sessoes = sessoesDaTurma(turma.cronograma, []);
    const registos = (await apoiosDaTurma(db, v.params.id, v.query.mes ?? null)).map(apoioJson);
    const totais: Record<string, { n: number; valor: number }> = {};
    for (const r of registos) {
      const t = totais[r.estado] ??= { n: 0, valor: 0 };
      t.n++;
      t.valor = Math.round((t.valor + r.valor) * 100) / 100;
    }
    return {
      turma: { id: Number(turma.id), nome: turma.nome, curso: turma.curso, financiador: turma.financiador },
      meses: mesesDaTurma(sessoes),
      registos,
      totais,
    };
  });

  /** Lote para as transferências: os apoios do mês com IBAN completo e titular (acesso auditado). */
  app.get("/v1/apoios/turmas/:id/lote", async (req, reply) => {
    const v = validar(reply, { params: idParam, query: z.object({ mes: periodo }) }, req);
    if (!v || !requireAuth(req, reply)) return;
    const turma = await turmaFin(db, v.params.id);
    if (!turma) return reply.code(404).send({ error: "Turma não encontrada." });
    const registos = (await apoiosDaTurma(db, v.params.id, v.query.mes)).map(apoioJson);
    const bancos = await dadosBancarios(db, [...new Set(registos.map(r => r.formandoId))]);
    await audit(db, req.actor!.id, "apoios.lote", "turma_fin", String(v.params.id), req.ip, { mes: v.query.mes, n: registos.length });
    return {
      turma: { id: Number(turma.id), nome: turma.nome },
      mes: v.query.mes,
      registos,
      bancos: Object.fromEntries(bancos.map(b => [Number(b.formando_id), { iban: ibanDe(b.iban_enc), titular: b.titular }])),
    };
  });

  app.post("/v1/apoios/turmas/:id/processar", async (req, reply) => {
    const body = z.object({ mes: periodo, confirmar: z.boolean().default(false) });
    const v = validar(reply, { params: idParam, body }, req);
    if (!v || !requireAuth(req, reply)) return;
    const calc = await calcularTurma(v.params.id, v.body.mes);
    if (!calc) return reply.code(404).send({ error: "Turma não encontrada." });
    if (!calc.regras.some(r => r.ativo)) {
      return reply.code(409).send({ error: "Esta turma não tem regras de apoios ativas. Defina-as em Configurações › Apoios." });
    }
    const existentes = new Map((await apoiosDaTurma(db, v.params.id, v.body.mes)).map(a => [`${a.formando_id}:${a.tipo}`, a.estado]));
    const linhas = calc.calculos.map(c => ({
      formandoId: c.formandoId,
      nome: c.nome,
      ...c.calculo,
      linhas: c.calculo.linhas.map(l => ({ ...l, estadoAtual: existentes.get(`${c.formandoId}:${l.tipo}`) ?? null })),
    }));
    if (!v.body.confirmar) return { mes: v.body.mes, confirmado: false, formandos: linhas };

    const contagem = { criado: 0, atualizado: 0, mantido: 0, semDireito: 0, semIban: 0 };
    await db.tx(async q => {
      for (const c of calc.calculos) {
        for (const l of c.calculo.linhas) {
          if (l.bloqueadoIban || l.valor <= 0) {
            if (l.bloqueadoIban) contagem.semIban++; else contagem.semDireito++;
            const chave = { formandoId: c.formandoId, periodo: v.body.mes, tipo: l.tipo, motivo: l.bloqueadoIban ? "Sem IBAN" : "Sem direito" };
            if (await anularCalculado(q, chave, req.actor!.id)) contagem.atualizado++;
            continue;
          }
          const acao = await gravarCalculado(q, {
            formandoId: c.formandoId, turmaId: v.params.id, periodo: v.body.mes, tipo: l.tipo, dias: l.dias, horas: l.horas,
            valor: l.valor, detalhe: { modo: l.modo, valorBruto: l.valorBruto, aplicadoTeto: l.aplicadoTeto, ambito: l.ambito, assiduidade: c.calculo.assiduidade },
          }, req.actor!.id);
          contagem[acao]++;
        }
      }
    });
    await audit(db, req.actor!.id, "apoios.processar", "turma_fin", String(v.params.id), req.ip, { mes: v.body.mes, ...contagem });
    return { mes: v.body.mes, confirmado: true, contagem, formandos: linhas };
  });

  app.post("/v1/apoios/turmas/:id/estado", async (req, reply) => {
    const body = z.object({
      mes: periodo,
      de: estado,
      para: estado,
      pagoEm: dataIso.optional(),
      referencia: z.string().trim().max(120).optional(),
      ids: z.array(idNum).max(500).optional(),
    });
    const v = validar(reply, { params: idParam, body }, req);
    if (!v || !requireAuth(req, reply)) return;
    const { mes, de, para } = v.body;
    if (!TRANSICOES[de]?.includes(para)) return reply.code(409).send({ error: `Não é possível passar de "${de}" para "${para}".` });
    if (para === "pago" && !v.body.pagoEm) return reply.code(400).send({ error: "Indique a data de pagamento.", campos: { pagoEm: "Obrigatória" } });
    const alvo = (await apoiosDaTurma(db, v.params.id, mes))
      .filter(a => a.estado === de && (!v.body.ids || v.body.ids.includes(Number(a.id))));
    await db.tx(async q => {
      for (const a of alvo) {
        await alterarApoio(q, Number(a.id), {
          estado: para,
          ...(para === "pago" ? { pagoEm: v.body.pagoEm, referencia: v.body.referencia ?? a.referencia } : {}),
          ...(de === "pago" ? { pagoEm: null } : {}),
        }, req.actor!.id);
      }
    });
    await audit(db, req.actor!.id, "apoios.estado", "turma_fin", String(v.params.id), req.ip, { mes, de, para, n: alvo.length });
    return { ok: true, alterados: alvo.length };
  });

  app.patch("/v1/apoios/:id", async (req, reply) => {
    const body = z.object({
      estado: estado.optional(),
      pagoEm: dataIso.nullable().optional(),
      referencia: z.string().trim().max(120).optional(),
      notas: z.string().trim().max(1000).optional(),
      ajuste: z.coerce.number().min(-100_000).max(100_000).optional(),
      motivoAjuste: z.string().trim().max(500).optional(),
    });
    const v = validar(reply, { params: idParam, body }, req);
    if (!v || !requireAuth(req, reply)) return;
    const atual = await apoioPorId(db, v.params.id);
    if (!atual) return reply.code(404).send({ error: "Apoio não encontrado." });
    const b = v.body;
    if (b.estado && b.estado !== atual.estado && !TRANSICOES[atual.estado]?.includes(b.estado)) {
      return reply.code(409).send({ error: `Não é possível passar de "${atual.estado}" para "${b.estado}".` });
    }
    const estadoFinal = b.estado ?? atual.estado;
    if (b.ajuste !== undefined && b.ajuste !== n(atual.ajuste)) {
      if (!(atual.estado === "calculado" || atual.estado === "aprovado")) {
        return reply.code(409).send({ error: "Só se ajusta um apoio calculado ou aprovado." });
      }
      if (!b.motivoAjuste) return reply.code(400).send({ error: "Indique o motivo do ajuste.", campos: { motivoAjuste: "Obrigatório" } });
      if (n(atual.valor_calculado) + b.ajuste < 0) return reply.code(400).send({ error: "O valor final não pode ser negativo." });
    }
    if (estadoFinal === "pago" && atual.estado !== "pago" && !b.pagoEm) {
      return reply.code(400).send({ error: "Indique a data de pagamento.", campos: { pagoEm: "Obrigatória" } });
    }
    const pagoEm = b.estado && atual.estado === "pago" && b.estado !== "pago" ? null : b.pagoEm;
    const novo = await alterarApoio(db, v.params.id, { ...b, pagoEm }, req.actor!.id);
    await audit(db, req.actor!.id, "apoios.alterar", "apoio", String(v.params.id), req.ip, {
      de: atual.estado, para: estadoFinal, ajuste: b.ajuste, motivo: b.motivoAjuste,
    });
    return { ok: true, apoio: novo ? apoioJson(novo) : null };
  });
}
