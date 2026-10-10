import type { Db } from "./db/pool.js";
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

function pctPresencas(formandoId: number, sessoes: { presencas: unknown }[]) {
  let folhas = 0;
  let presentes = 0;
  for (const s of sessoes) {
    const marca = asArr(s.presencas).map(asObj).find(p => Number(p.id) === formandoId);
    if (!marca) continue;
    folhas += 1;
    if (marca.presente !== false) presentes += 1;
  }
  if (!folhas) return null;
  return Math.round((presentes / folhas) * 100);
}

export function comAproveitamento(input: {
  presencas: number | null;
  elearning: number | null;
  nota: number | null;
  ccp: boolean;
  minimo: number;
}) {
  if (input.presencas == null || input.presencas < 75) return false;
  if (input.ccp) return input.nota != null && input.nota >= input.minimo;
  return input.elearning != null && input.elearning >= 50;
}

async function carregar(db: Db, turmaId: number): Promise<Dados | null> {
  const turma = await db.query<{
    nome: string; curso: string; local: string; formador: string; formadores: unknown;
  }>(
    "SELECT nome, curso, local, formador, formadores FROM turmas_fin WHERE id = $1",
    [turmaId],
  );
  const row = turma.rows[0];
  if (!row) return null;
  const [formandos, notas, certs, sessoes, ficha, curso] = await Promise.all([
    db.query<{
      id: number; nome: string; apelido: string; email: string; telf: string; estado: string;
      concelho: string; nif: string; morada: string; codigo_postal: string; origem: string; inscrito: string;
    }>(
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
           OR (f.turma_id IS NULL AND f.curso = $3 AND NOT EXISTS (SELECT 1 FROM turmas_fin t WHERE t.nome = f.turma))
        ORDER BY f.nome, f.apelido`,
      [turmaId, row.nome, row.curso],
    ),
    db.query<{ formando_id: number; modulo_id: string; parametro_id: string; nota: number | null }>(
      "SELECT formando_id, modulo_id, parametro_id, nota FROM turma_avaliacoes WHERE regime = 'fin' AND turma_id = $1",
      [turmaId],
    ),
    db.query<{ formando_id: number; ficheiro_id: string; ficheiro_nome: string; emitido_em: string | null; elearning: number | null; nota: number | null }>(
      `SELECT formando_id, COALESCE(ficheiro_id, '') AS ficheiro_id, COALESCE(ficheiro_nome, '') AS ficheiro_nome,
              emitido_em, elearning, nota
         FROM turma_certificados WHERE regime = 'fin' AND turma_id = $1`,
      [turmaId],
    ),
    db.query<{ presencas: unknown }>(
      "SELECT presencas FROM turma_sessoes WHERE regime = 'fin' AND turma_id = $1 ORDER BY sessao_n",
      [turmaId],
    ),
    db.query<{ payload: unknown }>(
      `SELECT f.payload FROM curso_fichas f
         JOIN cursos_fin c ON c.id = f.curso_id AND f.regime = 'fin'
        WHERE lower(trim(c.nome_comercial)) = lower(trim($1))
           OR lower(trim(c.ufcd)) = lower(trim($1))
        LIMIT 1`,
      [row.curso],
    ),
    db.query<{ ufcd_cod: string; ufcd: string }>(
      `SELECT ufcd_cod, ufcd FROM cursos_fin
        WHERE lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1))
        LIMIT 1`,
      [row.curso],
    ),
  ]);
  const payload = asObj(ficha.rows[0]?.payload);
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
  const unidade = String(avaliacao.unidade ?? (ccp ? "pontos" : "valores")).trim() || "valores";
  const presencas = new Map<number, number | null>();
  for (const f of formandos.rows) presencas.set(f.id, pctPresencas(f.id, sessoes.rows));
  const ufcdCod = String(curso.rows[0]?.ufcd_cod ?? "").trim();
  const ufcdNome = String(curso.rows[0]?.ufcd ?? "").trim();
  return {
    acao: row.nome,
    curso: row.curso,
    ufcd: [ufcdCod, ufcdNome].filter(Boolean).join(" · ") || row.curso,
    local: row.local,
    formador: String(row.formador ?? "").trim(),
    formadores: asArr(row.formadores).map(s => String(s).trim()).filter(Boolean),
    objetivos: linhasDe(payload.objetivos),
    programa: topicos.length ? topicos : linhasDe(payload.programa),
    formandos: formandos.rows.map(f => ({
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
    notas: notas.rows.map(n => ({
      formandoId: n.formando_id,
      moduloId: n.modulo_id,
      parametroId: n.parametro_id,
      nota: n.nota == null || !Number.isFinite(Number(n.nota)) ? null : Number(n.nota),
    })),
    parametros,
    unidade,
    minimo: Number.isFinite(minimoRaw) ? minimoRaw : (ccp ? 3 : 10),
    ccp,
    certs: certs.rows.map(c => ({
      formandoId: c.formando_id,
      ficheiroId: c.ficheiro_id,
      ficheiroNome: c.ficheiro_nome,
      emitidoEm: c.emitido_em ? String(c.emitido_em).slice(0, 10) : "",
      elearning: c.elearning == null ? null : Number(c.elearning),
      nota: c.nota == null || !Number.isFinite(Number(c.nota)) ? null : Number(c.nota),
    })),
    presencas,
  };
}

function cabecalho(d: Dados, titulo: string) {
  return [
    titulo,
    ...partirLinhas(`Ação: ${d.acao || "—"}`),
    ...partirLinhas(`Curso: ${d.curso || "—"}`),
    ...partirLinhas(`UFCD: ${d.ufcd || "—"}`),
    ...partirLinhas(d.local ? `Local: ${d.local}` : "Local: por indicar"),
    "Entidade formadora: ENA · Escola de Negócios e Administração",
    "",
  ];
}

function notaDoFormando(d: Dados, formandoId: number) {
  const daGrelha = d.notas.filter(n => n.formandoId === formandoId && n.nota != null).map(n => n.nota as number);
  const media = mediaDe(daGrelha);
  if (media != null) return media;
  return d.certs.find(c => c.formandoId === formandoId)?.nota ?? null;
}

function linhasElegiveis(d: Dados) {
  return d.formandos.map(f => {
    const cert = d.certs.find(c => c.formandoId === f.id);
    const nota = notaDoFormando(d, f.id);
    const elegivel = comAproveitamento({
      presencas: d.presencas.get(f.id) ?? null,
      elearning: cert?.elearning ?? null,
      nota,
      ccp: d.ccp,
      minimo: d.minimo,
    });
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
    const resultado = media == null ? "incompleta" : media >= d.minimo ? "aproveitamento" : "sem aproveitamento";
    linhas.push(...partirLinhas(`  Média das notas lançadas: ${media == null ? "—" : media} · ${resultado}`));
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
    d.ccp
      ? `Elegível: 75% de presenças e média da grelha ≥ ${d.minimo}.`
      : "Elegível: 75% de presenças e resultado de e-learning ≥ 50. Esse resultado lança-se à mão até existir leitura do Moodle.",
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
