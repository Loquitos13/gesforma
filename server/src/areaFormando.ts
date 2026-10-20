import { DOCS_FORMANDO_GOLD } from "../../src/partilhado/dossierDocs.js";
import { eur as eurPt } from "../../src/partilhado/ui/formatos.js";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { textoDoCorpo } from "../../src/partilhado/blogBlocos.js";
import { gerarPalavraPasse, mensagemPalavraPasse, palavraPasseValida } from "../../src/partilhado/passwordPolicy.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { dentroDoLimite } from "./limitePedidos.js";
import { sendMail } from "./mailer.js";
import { readFormandoPii, writeFormandoPiiPatch } from "./pii.js";
import {
  atualizarDadosDoUtilizador, certificadosDe, contaPorEmail, criarContaFormando, cronogramaDaTurma, definirPalavraPasseFormando,
  docsGoldValidados, formandoParaAcesso, gravarPrefs, guardarPedidoReposicao, inscricoesFinDoUtilizador, inscricoesGoldDoUtilizador,
  gravarTelefoneDaFicha, ligarFichasPeloEmail, pagamentosDoUtilizador, pedidoReposicaoValido, prefsDoUtilizador, reporContaFormando, respostasDeInqueritos,
} from "./repos/areaFormando.js";
import { hashPassword, isEmail, normalizeEmail, sha256 } from "./security.js";
import { vistaDocumentosFormandoFin } from "./formandoFinDocs.js";
import { listarCatalogoPublico } from "./catalogoPublico.js";
import { diaLisboa, hojeLisboa, lerInstante, stampLisboa } from "./datas.js";

/** Área do formando: conta, inscrições, agenda, certificados, pagamentos e documentos. */

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
  return hojeLisboa();
}

/** Carimbo UTC sem fuso ("aaaa-mm-dd hh:mm") → o mesmo formato na hora de Lisboa; outro texto fica como está. */
function carimboVisivel(raw: string) {
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(raw.trim()) ? stampLisboa(lerInstante(raw)) || raw : raw;
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

const eur = (valor: number) => eurPt(valor, true);

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

/**
 * Cria a conta da área do formando (utilizador = email, palavra-passe temporária) ou, com `repor`,
 * gera uma palavra-passe nova. Uma conta de formando que já existe (outro curso) só se liga.
 */
export async function gerarAcessoFormando(db: Db, regime: "gold" | "fin", id: number, repor: boolean): Promise<
  | { email: string; password?: string; criado: boolean; reposto: boolean }
  | { erro: string; estado: 400 | 404 | 409 }
> {
  const pessoa = await formandoParaAcesso(db, regime, id);
  if (!pessoa) return { erro: "formando não encontrado", estado: 404 as const };
  const email = normalizeEmail(pessoa.email);
  if (!email || !isEmail(email)) return { erro: "O formando precisa de um email válido para ter acesso.", estado: 400 as const };
  const nome = `${pessoa.nome} ${pessoa.apelido}`.trim() || email;
  const conta = await contaPorEmail(db, email);
  if (conta && conta.role !== "formando") {
    return { erro: "Este email já é uma conta da secretaria ou de um formador.", estado: 409 as const };
  }
  if (conta && !repor) {
    await ligarFichasPeloEmail(db, conta.id, email);
    return { email, criado: false, reposto: false };
  }
  const password = gerarPalavraPasse();
  const hash = await hashPassword(password);
  let userId = conta?.id ?? "";
  if (!conta) {
    userId = randomUUID();
    try {
      await criarContaFormando(db, { id: userId, nome, email, hash });
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
      const outra = await contaPorEmail(db, email);
      if (!outra || outra.role !== "formando") {
        return { erro: "Este email já é uma conta da secretaria ou de um formador.", estado: 409 as const };
      }
      // Outro pedido criou a conta ao mesmo tempo: a palavra-passe gerada aqui não ficou gravada e não se envia.
      await ligarFichasPeloEmail(db, outra.id, email);
      return { email, criado: false, reposto: false };
    }
  } else {
    await reporContaFormando(db, { id: conta.id, nome, hash });
    userId = conta.id;
  }
  await ligarFichasPeloEmail(db, userId, email);
  return { email, password, criado: !conta, reposto: Boolean(conta) };
}

async function mediaInqueritos(db: Db) {
  const rows = await respostasDeInqueritos(db);
  const nums: number[] = [];
  for (const row of rows) {
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

/** A média lê todas as respostas: o site pede-a em cada visita, por isso calcula-se no máximo a cada 10 minutos por instância. */
const SATISFACAO_TTL_MS = 10 * 60_000;
let satisfacaoCache: { em: number; valor: Promise<Awaited<ReturnType<typeof mediaInqueritos>>> } | null = null;

export async function satisfacaoPublica(db: Db) {
  const agora = Date.now();
  if (!satisfacaoCache || agora - satisfacaoCache.em > SATISFACAO_TTL_MS) {
    const valor = mediaInqueritos(db);
    satisfacaoCache = { em: agora, valor };
    valor.catch(() => { satisfacaoCache = null; });
  }
  return satisfacaoCache.valor;
}

type Inscricao = {
  regime: "gold" | "fin";
  id: number;
  nome: string;
  apelido: string;
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

function inscricaoDe(regime: "gold" | "fin", r: Record<string, unknown>): Inscricao {
  return {
    regime,
    id: Number(r.id),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    telf: readFormandoPii(r).telf || String(r.telf ?? ""),
    curso: String(r.curso ?? ""),
    turma: String(r.turma ?? ""),
    turmaId: Number(r.turma_id ?? 0),
    estado: String(r.estado ?? ""),
    pago: regime === "fin" ? true : Boolean(r.pago),
    valor: regime === "fin" ? 0 : Number(r.valor ?? 0),
    metodo: regime === "fin" ? "Financiada" : String(r.metodo ?? ""),
    inscrito: regime === "fin" ? "" : String(r.inscrito ?? ""),
  };
}

async function inscricoesDo(db: Db, userId: string): Promise<Inscricao[]> {
  const [gold, fin] = [await inscricoesGoldDoUtilizador(db, userId), await inscricoesFinDoUtilizador(db, userId)];
  return [...gold.map(r => inscricaoDe("gold", r)), ...fin.map(r => inscricaoDe("fin", r))];
}

/**
 * Cursos a sugerir ao formando (depois de deixar a opinião): da mesma área temática dos cursos que fez,
 * no mesmo regime (Gold e Financiada não se misturam), sem os que já tem. Sem nada nessa área: os mais procurados.
 */
export async function sugestoesDeCursos(db: Db, userId: string) {
  const inscricoes = await inscricoesDo(db, userId);
  const { cursos } = await listarCatalogoPublico(db);
  const k = (s: string) => s.trim().toLowerCase();
  const regimes = new Set(inscricoes.map(i => i.regime));
  const feitos = new Set(inscricoes.map(i => k(i.curso)).filter(Boolean));
  const doRegime = cursos.filter(c => regimes.has(c.regime));
  const meus = doRegime.filter(c => feitos.has(k(c.titulo)) || feitos.has(k(c.nomeOferta)));
  const areas = new Set(meus.map(c => k(c.area)).filter(Boolean));
  const outros = doRegime.filter(c => !meus.includes(c));
  const daArea = outros.filter(c => areas.has(k(c.area)));
  // A lista do catálogo já vem dos mais procurados para os menos.
  return (daArea.length ? daArea : outros).slice(0, 4).map(c => ({
    id: c.id, titulo: c.titulo, area: c.area, modalidade: c.modalidade, inicio: c.inicio, preco: c.precoLabel, imagem: c.miniatura,
  }));
}

export async function montarArea(db: Db, user: Actor) {
  const conta = await prefsDoUtilizador(db, user.id);
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
    const turma = ins.turmaId ? await cronogramaDaTurma(db, ins.regime, ins.turmaId) : null;
    const sessoes = sessoesDe(turma?.cronograma);
    const feitas = sessoes.filter(s => s.data <= hoje).length;
    const progresso = sessoes.length ? Math.round((feitas / sessoes.length) * 100) : 0;
    const passadas = sessoes.filter(s => s.data <= hoje);
    const ultimo = passadas.length ? dataPt(passadas[passadas.length - 1]!.data) : "";
    const cursoId = `${ins.regime}-${ins.id}`;
    cursos.push({
      id: cursoId,
      regime: ins.regime,
      titulo: ins.curso || turma?.nome || "Formação",
      turma: ins.turma || turma?.nome || "",
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
      for (const cert of await certificadosDe(db, ins.regime, ins.turmaId, ins.id)) {
        if (!cert.emitido) continue;
        const quando = cert.emitido_em ? dataPt(diaLisboa(cert.emitido_em)) : "";
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
    if (ins.regime === "gold" && ins.valor > 0 && !ins.pago) {
      notificacoes.push({
        id: `pag-${ins.id}`,
        titulo: "Pagamento pendente",
        texto: `${ins.curso || "A formação"} tem ${eur(ins.valor)} por confirmar.`,
        quando: carimboVisivel(ins.inscrito) || "Em aberto",
      });
    }
  }

  // Movimentos de pagamento da própria pessoa (fichas Gold ou email da conta); sem movimento, mostra a ficha.
  const idsGold = inscricoes.filter(i => i.regime === "gold").map(i => i.id);
  const movimentos = await pagamentosDoUtilizador(db, idsGold, normalizeEmail(conta?.email || user.email));
  for (const p of movimentos) {
    pagamentos.push({ id: String(p.id), curso: p.curso, data: carimboVisivel(String(p.data ?? "")), valor: eur(Number(p.valor) || 0), estado: p.estado, metodo: p.metodo });
  }
  if (!movimentos.length) {
    for (const ins of inscricoes.filter(i => i.regime === "gold" && i.valor > 0)) {
      pagamentos.push({
        id: `fg-${ins.id}`, curso: ins.curso || "Formação", data: carimboVisivel(ins.inscrito), valor: eur(ins.valor),
        estado: ins.pago ? "Pago" : "Pendente", metodo: ins.metodo,
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
  const documentosFin = [];
  for (const ins of inscricoes.filter(i => i.regime === "fin")) {
    const vista = await vistaDocumentosFormandoFin(db, ins.id);
    if (!vista) continue;
    documentosFin.push({ formandoId: ins.id, curso: vista.curso, url: vista.url, completo: vista.completo, documentos: vista.documentos });
    const recusados = vista.documentos.filter(d => d.estado === "recusado");
    if (recusados.length) {
      notificacoes.push({
        id: `doc-rec-${ins.id}`,
        titulo: "Documentos a corrigir",
        texto: `${recusados.length} documento(s) recusado(s) na formação financiada. Envie de novo na área Documentos.`,
        quando: "Agora",
      });
    } else if (!vista.completo) {
      notificacoes.push({
        id: `doc-falta-${ins.id}`,
        titulo: "Documentos em falta",
        texto: `Complete o dossiê de elegibilidade de ${vista.curso}.`,
        quando: "Pendente",
      });
    }
  }
  // Gold: os documentos chegam da ligação pessoal só depois de validada a pré-inscrição e de a pessoa
  // estar inscrita numa turma do curso (docsParaFormando.ts). Aqui só se mostram, já validados.
  const documentosGold = [];
  const labels = new Map(DOCS_FORMANDO_GOLD.map(d => [d.id, d.label]));
  for (const ins of inscricoes.filter(i => i.regime === "gold" && i.turmaId)) {
    const docs = await docsGoldValidados(db, ins.id);
    if (!docs.length) continue;
    documentosGold.push({
      formandoId: ins.id,
      curso: ins.curso,
      documentos: docs.map(d => ({
        id: d.doc_id,
        label: labels.get(d.doc_id) ?? d.doc_id,
        estado: "validado" as const,
        fileName: d.file_name,
        driveUrl: d.drive_url,
        validadoEm: d.validated_at ? diaLisboa(d.validated_at as Date | string) || String(d.validated_at).slice(0, 10) : "",
      })),
    });
  }
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
    documentosFin,
    documentosGold,
  };
}

export const perfilSchema = z.object({
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

/** O formando altera os seus dados e preferências na área. */
export async function atualizarPerfil(db: Db, user: Actor, d: z.infer<typeof perfilSchema>) {
  const atual = await prefsDoUtilizador(db, user.id);
  const prefs = prefsDe(atual?.area_prefs);
  const seguinte = { novidades: d.novidades ?? prefs.novidades, canais: d.canais ?? prefs.canais, lidas: d.lidas ?? prefs.lidas };
  const nomeConta = [d.nome, d.apelido].filter(parte => parte != null).join(" ").trim();
  await gravarPrefs(db, user.id, seguinte, nomeConta);
  if (d.nome != null || d.apelido != null) {
    await atualizarDadosDoUtilizador(db, user.id, { nome: d.nome, apelido: d.apelido });
  }
  if (d.telf != null) {
    // A leitura prefere o pacote cifrado: o telefone novo tem de entrar lá (e não só na coluna em claro).
    const fichas = [
      ...(await inscricoesGoldDoUtilizador(db, user.id)).map(r => ({ regime: "gold" as const, r })),
      ...(await inscricoesFinDoUtilizador(db, user.id)).map(r => ({ regime: "fin" as const, r })),
    ];
    for (const { regime, r } of fichas) {
      await gravarTelefoneDaFicha(db, regime, user.id, Number(r.id), writeFormandoPiiPatch({ telf: d.telf }, readFormandoPii(r)));
    }
  }
  return montarArea(db, user);
}

/** Pedidos de recuperação por email (por hora) e por IP (por hora), contados na base de dados. */
export const RECUPERACAO_POR_EMAIL = 3;
export const RECUPERACAO_POR_IP = 20;

/**
 * Pede a ligação de recuperação. Responde sempre igual, para não revelar que emails existem.
 * O limite conta-se antes de procurar a conta: existir ou não a conta não muda nada para quem pede.
 */
export async function pedirRecuperacao(db: Db, emailBruto: string, ip = "") {
  const email = normalizeEmail(emailBruto);
  if (!isEmail(email)) return;
  if (ip && !(await dentroDoLimite(db, "recuperar-ip", ip, RECUPERACAO_POR_IP, 3600))) return;
  if (!(await dentroDoLimite(db, "recuperar-email", email, RECUPERACAO_POR_EMAIL, 3600))) return;
  const conta = await contaPorEmail(db, email);
  if (!conta?.active || conta.role !== "formando") return;
  const token = randomBytes(24).toString("base64url");
  const exp = new Date(Date.now() + 2 * 3600_000).toISOString();
  await guardarPedidoReposicao(db, conta.id, sha256(token), exp);
  const origem = config.appOrigin.replace(/\/$/, "");
  const ligacao = `${origem}/area-formando?recuperar=${encodeURIComponent(token)}`;
  await sendMail(db, {
    to: email,
    name: conta.name || email,
    subject: "Redefinir a palavra-passe da área do formando",
    text: `Para definir uma palavra-passe nova, abra esta ligação nas próximas duas horas:\n${ligacao}\n\nSe não pediu esta mensagem, pode ignorá-la.`,
  }).catch(() => undefined);
}

/** Define a palavra-passe nova a partir da ligação de recuperação. */
export async function reporPalavraPasse(db: Db, token: string, password: string): Promise<{ ok: true } | { erro: string }> {
  if (!palavraPasseValida(password)) return { erro: mensagemPalavraPasse(password) };
  const pedido = await pedidoReposicaoValido(db, sha256(token));
  if (!pedido) return { erro: "A ligação expirou. Peça outra à área do formando." };
  await definirPalavraPasseFormando(db, pedido.user_id, await hashPassword(password));
  return { ok: true };
}

export function excerto(corpo: string) {
  const limpo = textoDoCorpo(corpo);
  if (limpo.length <= 180) return limpo;
  return `${limpo.slice(0, 177).trim()}…`;
}
