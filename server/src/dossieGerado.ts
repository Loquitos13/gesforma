import { assiduidadeMinima, lerEntidade } from "./regrasConfig.js";
import { resultadosDaTurma, resultadosDeTurmas } from "./resultados.js";
import type { Db } from "./db/pool.js";
import { certificadosFinComFicheiro, formandosFinComContacto, turmaFinBase, ufcdDoCurso } from "./repos/dossieGerado.js";
import { listarNotas } from "./repos/pedagogiaSessoes.js";
import { fichaCursoFinPorNome } from "./repos/pedagogiaRelatorio.js";
import { pdfDeLinhas } from "./pdfTexto.js";
import { partirLinhas } from "./relatorioFinal.js";

export const ITENS_DOSSIE_GERADO = [
  "listagem-formandos",
  "equipa",
  "programa",
  "fichas",
  "pauta",
  "entrega-certificados",
] as const;

export type ItemDossieGerado = (typeof ITENS_DOSSIE_GERADO)[number];

const NOMES: Record<ItemDossieGerado, string> = {
  "listagem-formandos": "ListagemFormandos.pdf",
  equipa: "ListagemEquipaPedagogica.pdf",
  programa: "ProgramaUfcd.pdf",
  fichas: "FichasInscricao.pdf",
  pauta: "PautaAvaliacao.pdf",
  "entrega-certificados": "ComprovativoEntregaCertificados.pdf",
};

export function nomePdfDossie(item: ItemDossieGerado) {
  return NOMES[item];
}

export function eItemDossieGerado(id: string): id is ItemDossieGerado {
  return (ITENS_DOSSIE_GERADO as readonly string[]).includes(id);
}

type Pessoa = {
  id: number;
  nome: string;
  email: string;
  telf: string;
  estado: string;
  concelho: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  origem: string;
  inscrito: string;
};

type Nota = { formandoId: number; moduloId: string; parametroId: string; nota: number | null };

type Cert = { formandoId: number; ficheiroId: string; ficheiroNome: string; emitidoEm: string; elearning: number | null; nota: number | null };

type Parametro = { id: string; label: string; moodle: boolean };

type Dados = {
  acao: string;
  curso: string;
  ufcd: string;
  local: string;
  formador: string;
  formadores: string[];
  objetivos: string[];
  programa: string[];
  formandos: Pessoa[];
  notas: Nota[];
  parametros: Parametro[];
  unidade: string;
  minimo: number;
  ccp: boolean;
  certs: Cert[];
  presencas: Map<number, number | null>;
  /** Calculados pelo servidor (resultados.ts): mesma regra da emissão de certificados. */
  elegiveis: Map<number, boolean>;
  notasFinais: Map<number, number | null>;
  aprovados: Map<number, boolean | null>;
  /** A regra de `resultados.ts` por extenso, com os mínimos das configurações. */
  regraElegivel: string;
  entidade: string;
};

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return p && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

function linhasDe(valor: unknown) {
  return String(valor ?? "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function dataPt(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "—";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function mediaDe(notas: number[]) {
  if (!notas.length) return null;
  return Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100;
}

async function carregar(db: Db, turmaId: number): Promise<Dados | null> {
  const row = await turmaFinBase(db, turmaId);
  if (!row) return null;
  const [formandos, notas, certs, ficha, curso] = await Promise.all([
    formandosFinComContacto(db, turmaId, row.nome),
    listarNotas(db, "fin", turmaId),
    certificadosFinComFicheiro(db, turmaId),
    fichaCursoFinPorNome(db, row.curso),
    ufcdDoCurso(db, row.curso),
  ]);
  const payload = asObj(ficha?.payload);
  const avaliacao = asObj(payload.avaliacaoCurso);
  const parametros = asArr(avaliacao.parametros).flatMap(item => {
    const p = asObj(item);
    const id = String(p.id ?? "").trim();
    const label = String(p.label ?? "").trim();
    if (!id || !label) return [];
    return [{ id, label, moodle: p.moodle === true }];
  });
  const topicos = asArr(payload.topicosPrograma).map(item => {
    const t = asObj(item);
    const titulo = String(t.titulo ?? t.nome ?? "").trim();
    const horas = String(t.horas ?? "").trim();
    return titulo ? (horas ? `${titulo} (${horas})` : titulo) : "";
  }).filter(Boolean);
  const minimoRaw = Number(avaliacao.minimoAprovacao);
  const ccp = /ccp/i.test(row.curso);
  const [res, entidade] = await Promise.all([resultadosDaTurma(db, "fin", turmaId), lerEntidade(db)]);
  // Escala e mínimo: os do cálculo dos resultados (a mesma leitura da ficha que a grelha e os certificados).
  const unidade = res?.avaliacao.unidade ?? (String(avaliacao.unidade ?? (ccp ? "pontos" : "valores")).trim() || "valores");
  const minimo = res?.avaliacao.minimoAprovacao ?? (Number.isFinite(minimoRaw) ? minimoRaw : (ccp ? 3 : 10));
  const presencas = new Map<number, number | null>();
  const elegiveis = new Map<number, boolean>();
  const notasFinais = new Map<number, number | null>();
  const aprovados = new Map<number, boolean | null>();
  for (const r of res?.formandos ?? []) {
    presencas.set(r.id, r.assiduidade.pct);
    elegiveis.set(r.id, r.elegivel);
    notasFinais.set(r.id, r.nota);
    aprovados.set(r.id, r.aprovado);
  }
  const regraElegivel = res
    ? `Elegível: ${assiduidadeMinima(res.regras, "fin")}% de assiduidade em horas e aprovação na avaliação (nota final de pelo menos `
      + `${minimo} ${unidade}; sem grelha de notas, resultado de e-learning de pelo menos ${res.regras.elearningMin})`
      + `${res.regras.dtpBloqueiaCertificado ? ", com o dossiê técnico-pedagógico completo" : ""}.`
    : "Elegível: sem resultados calculados para esta turma.";
  const ufcdCod = String(curso?.ufcd_cod ?? "").trim();
  const ufcdNome = String(curso?.ufcd ?? "").trim();
  return {
    acao: row.nome,
    curso: row.curso,
    ufcd: [ufcdCod, ufcdNome].filter(Boolean).join(" · ") || row.curso,
    local: row.local,
    formador: String(row.formador ?? "").trim(),
    formadores: asArr(row.formadores).map(s => String(s).trim()).filter(Boolean),
    objetivos: linhasDe(payload.objetivos),
    programa: topicos.length ? topicos : linhasDe(payload.programa),
    formandos: formandos.map(f => ({
      id: f.id,
      nome: `${f.nome} ${f.apelido}`.trim(),
      email: f.email,
      telf: f.telf,
      estado: f.estado,
      concelho: f.concelho,
      nif: f.nif,
      morada: f.morada,
      codigoPostal: f.codigo_postal,
      origem: f.origem,
      inscrito: String(f.inscrito ?? "").slice(0, 10),
    })),
    notas: notas.map(n => ({
      formandoId: n.formando_id,
      moduloId: n.modulo_id,
      parametroId: n.parametro_id,
      nota: n.nota == null || !Number.isFinite(Number(n.nota)) ? null : Number(n.nota),
    })),
    parametros,
    unidade,
    minimo,
    ccp,
    certs: certs.map(c => ({
      formandoId: c.formando_id,
      ficheiroId: c.ficheiro_id,
      ficheiroNome: c.ficheiro_nome,
      emitidoEm: c.emitido_em ? String(c.emitido_em).slice(0, 10) : "",
      elearning: c.elearning == null ? null : Number(c.elearning),
      nota: c.nota == null || !Number.isFinite(Number(c.nota)) ? null : Number(c.nota),
    })),
    presencas,
    elegiveis,
    notasFinais,
    aprovados,
    regraElegivel,
    entidade: entidade.nome,
  };
}

function cabecalho(d: Dados, titulo: string) {
  return [
    titulo,
    ...partirLinhas(`Ação: ${d.acao || "—"}`),
    ...partirLinhas(`Curso: ${d.curso || "—"}`),
    ...partirLinhas(`UFCD: ${d.ufcd || "—"}`),
    ...partirLinhas(d.local ? `Local: ${d.local}` : "Local: por indicar"),
    ...partirLinhas(`Entidade formadora: ${d.entidade}`),
    "",
  ];
}

function notaDoFormando(d: Dados, formandoId: number) {
  const final = d.notasFinais.get(formandoId);
  if (final != null) return final;
  const daGrelha = d.notas.filter(n => n.formandoId === formandoId && n.nota != null).map(n => n.nota as number);
  const media = mediaDe(daGrelha);
  if (media != null) return media;
  return d.certs.find(c => c.formandoId === formandoId)?.nota ?? null;
}

function linhasElegiveis(d: Dados) {
  return d.formandos.map(f => {
    const cert = d.certs.find(c => c.formandoId === f.id);
    const nota = notaDoFormando(d, f.id);
    // Sem resultado calculado não há elegibilidade: a regra é só a de `resultados.ts`.
    const elegivel = d.elegiveis.get(f.id) ?? false;
    return { ...f, cert, nota, elegivel, presencas: d.presencas.get(f.id) ?? null };
  });
}

function pdfListagem(d: Dados) {
  const linhas = [
    ...cabecalho(d, "Listagem de formandos"),
    d.formandos.length ? `${d.formandos.length} formandos nesta turma.` : "Ainda sem formandos nesta turma.",
    "",
  ];
  d.formandos.forEach((f, i) => {
    linhas.push(...partirLinhas(`${String(i + 1).padStart(2, "0")}  ${f.nome}`));
    linhas.push(...partirLinhas(`    ${f.email || "sem email"} · ${f.telf || "sem telefone"} · ${f.estado || "—"}`));
  });
  if (!d.formandos.length) linhas.push("A listagem fica vazia até haver formandos na turma.");
  linhas.push("", "GESFORMA · gerado a partir dos formandos desta turma.");
  return pdfDeLinhas(linhas);
}

function pdfEquipa(d: Dados) {
  const nomes = new Set<string>();
  if (d.formador) nomes.add(d.formador);
  for (const nome of d.formadores) nomes.add(nome);
  const linhas = [
    ...cabecalho(d, "Listagem da equipa pedagógica"),
    "Formador da turma e restantes nomes registados na equipa.",
    "",
  ];
  if (!nomes.size) linhas.push("Ainda sem formador nem equipa atribuídos a esta turma.");
  [...nomes].forEach((nome, i) => {
    const papel = nome === d.formador ? "Formador" : "Equipa pedagógica";
    linhas.push(...partirLinhas(`${String(i + 1).padStart(2, "0")}  ${nome} · ${papel}`));
  });
  linhas.push("", "GESFORMA · gerado a partir da equipa desta turma.");
  return pdfDeLinhas(linhas);
}

function pdfPrograma(d: Dados) {
  const linhas = [
    ...cabecalho(d, "Programa da UFCD"),
    "Objetivos",
    ...(d.objetivos.length ? d.objetivos.flatMap(o => partirLinhas(o).map(l => `  ${l}`)) : ["  Sem objetivos na ficha do curso."]),
    "",
    "Conteúdo programático",
    ...(d.programa.length ? d.programa.flatMap(p => partirLinhas(p).map(l => `  ${l}`)) : ["  Sem programa na ficha do curso."]),
    "",
    "GESFORMA · gerado a partir da ficha da UFCD.",
  ];
  return pdfDeLinhas(linhas);
}

function pdfFichas(d: Dados) {
  const linhas = [
    ...cabecalho(d, "Fichas de inscrição"),
    "Uma ficha por formando, com os dados gravados na inscrição.",
    "",
  ];
  if (!d.formandos.length) linhas.push("Ainda sem formandos nesta turma.");
  for (const f of d.formandos) {
    linhas.push(...partirLinhas(f.nome), ...partirLinhas(`  Email: ${f.email || "—"}`));
    linhas.push(...partirLinhas(`  Telefone: ${f.telf || "—"}`));
    linhas.push(...partirLinhas(`  NIF: ${f.nif || "—"}`));
    linhas.push(...partirLinhas(`  Morada: ${[f.morada, f.codigoPostal, f.concelho].filter(Boolean).join(", ") || "—"}`));
    linhas.push(...partirLinhas(`  Origem: ${f.origem || "—"}`));
    linhas.push(...partirLinhas(`  Inscrição: ${f.inscrito ? dataPt(f.inscrito) : "—"} · ${f.estado || "—"}`));
    linhas.push("");
  }
  linhas.push("GESFORMA · gerado a partir da ficha de inscrição.");
  return pdfDeLinhas(linhas);
}

function rotuloParametro(d: Dados, id: string) {
  return d.parametros.find(p => p.id === id)?.label || id;
}

function pdfPauta(d: Dados) {
  const linhas = [
    ...cabecalho(d, "Pauta de avaliação final"),
    "Notas lançadas na grelha desta turma.",
    "A nota marcada como Moodle continua a ser escrita à mão. A leitura automática no Moodle ainda não existe.",
    `Mínimo de aprovação na grelha: ${d.minimo} ${d.unidade}.`,
    "",
  ];
  if (!d.formandos.length) linhas.push("Ainda sem formandos nesta turma.");
  for (const f of d.formandos) {
    const cells = d.notas.filter(n => n.formandoId === f.id);
    const media = mediaDe(cells.filter(n => n.nota != null).map(n => n.nota as number));
    linhas.push(...partirLinhas(f.nome));
    if (!cells.length) linhas.push("  Sem notas na grelha.");
    for (const cell of cells) {
      const moodle = d.parametros.find(p => p.id === cell.parametroId)?.moodle ? " · Moodle, lançada à mão" : "";
      const modulo = cell.moduloId && cell.moduloId !== "_final" ? `${cell.moduloId} · ` : "";
      linhas.push(...partirLinhas(`  ${modulo}${rotuloParametro(d, cell.parametroId)}: ${cell.nota == null ? "—" : cell.nota}${moodle}`));
    }
    // Resultado e nota final: os do servidor (mesma fórmula da grelha e dos certificados).
    const final = d.notasFinais.get(f.id) ?? null;
    const aprov = d.aprovados.get(f.id) ?? null;
    const resultado = aprov == null ? "incompleta" : aprov ? "aproveitamento" : "sem aproveitamento";
    linhas.push(...partirLinhas(`  Média das notas lançadas: ${media == null ? "—" : media} · Nota final: ${final == null ? "—" : final} · ${resultado}`));
    linhas.push("");
  }
  linhas.push(
    "Formador: ________________________________",
    "",
    "GESFORMA · pauta gerada da grelha. A grelha assinada em papel, se a ação a exigir à parte, continua a ser um upload.",
  );
  return pdfDeLinhas(linhas);
}

function pdfEntrega(d: Dados) {
  const linhas = [
    ...cabecalho(d, "Comprovativo da entrega dos certificados"),
    "O certificado legal obtém-se fora do GesForma. Esta lista regista o PDF carregado para cada formando elegível com aproveitamento.",
    ...partirLinhas(d.regraElegivel),
    ...(d.ccp ? [] : ["O resultado de e-learning lança-se à mão até existir leitura do Moodle."]),
    "",
  ];
  const lista = linhasElegiveis(d);
  const elegiveis = lista.filter(f => f.elegivel);
  if (!lista.length) linhas.push("Ainda sem formandos nesta turma.");
  if (lista.length && !elegiveis.length) linhas.push("Nenhum formando está elegível com aproveitamento.");
  for (const f of elegiveis) {
    const tem = Boolean(f.cert?.ficheiroId);
    linhas.push(...partirLinhas(
      `${f.nome} · ${tem ? "PDF no dossiê" : "em falta"} · ${f.cert?.ficheiroNome || "sem ficheiro"} · ${f.cert?.emitidoEm ? dataPt(f.cert.emitidoEm) : "sem data"}`,
    ));
  }
  const comPdf = elegiveis.filter(f => f.cert?.ficheiroId).length;
  linhas.push(
    "",
    `Elegíveis com certificado externo: ${comPdf}/${elegiveis.length}.`,
    "Quem não tem aproveitamento não leva certificado nesta lista.",
    "",
    "GESFORMA · lista gerada a partir dos PDFs carregados.",
  );
  return pdfDeLinhas(linhas);
}

const BUILDERS: Record<ItemDossieGerado, (d: Dados) => Buffer> = {
  "listagem-formandos": pdfListagem,
  equipa: pdfEquipa,
  programa: pdfPrograma,
  fichas: pdfFichas,
  pauta: pdfPauta,
  "entrega-certificados": pdfEntrega,
};

export async function pdfDossieGerado(db: Db, turmaId: number, item: ItemDossieGerado) {
  const dados = await carregar(db, turmaId);
  if (!dados) return null;
  return { nome: NOMES[item], bytes: BUILDERS[item](dados) };
}

/**
 * O mesmo que `contagemCertificadosFin`, para muitas turmas de uma vez (vista geral do Dossiê TP, painel).
 * `formandoIds` são os formandos de cada turma pelas regras de `formandosFinComContacto`.
 * Só é elegível quem tem resultado na turma.
 */
export async function contagemCertificadosFinLote(db: Db, turmas: { id: number; formandoIds: number[] }[]) {
  const out = new Map<number, { done: number; total: number }>();
  const resultados = await resultadosDeTurmas(db, "fin", turmas.map(t => t.id));
  for (const t of turmas) {
    const r = resultados.get(t.id);
    const porId = new Map((r?.formandos ?? []).map(f => [f.id, f]));
    const elegiveis = t.formandoIds.map(id => porId.get(id)).filter(f => f?.elegivel);
    out.set(t.id, { done: elegiveis.filter(f => f!.certificado.ficheiro).length, total: elegiveis.length });
  }
  return out;
}

/** Cópia do tópico 11: só conta o PDF externo de quem é elegível com aproveitamento. */
export async function contagemCertificadosFin(db: Db, turmaId: number): Promise<{ done: number; total: number }> {
  const dados = await carregar(db, turmaId);
  if (!dados) return { done: 0, total: 0 };
  const elegiveis = linhasElegiveis(dados).filter(f => f.elegivel);
  return {
    done: elegiveis.filter(f => f.cert?.ficheiroId).length,
    total: elegiveis.length,
  };
}
