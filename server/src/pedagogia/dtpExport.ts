/** Exportação do dossiê da turma num ZIP organizado pelas pastas (Gold) ou tópicos (Financiada). */
import type { Db } from "../db/pool.js";
import { listDriveFiles, readDriveContent } from "../driveFicheiros.js";
import { nomesNoCronograma } from "../driveArvore.js";
import { DTP_CATEGORIAS, dtpCategoriaDe, dtpCategoriaPasta, dtpPastaNome, dtpZipNome, dtpZipRelPath, pastaSegura } from "../dtpPasta.js";
import { pastaFinDoItem, TOPICOS_FIN } from "../dtpTopicosFin.js";
import { pdfPerguntasInqueritos, pdfRelatorioFinal, pdfRelatorioInqueritos } from "../relatorioFinal.js";
import { ficheirosDoFormador, ficheirosDosFormandos, formadoresPorNome } from "../repos/dtp.js";
import { equipaDaTurma, formandosDaTurma, type TurmaRow } from "../repos/pedagogiaTurma.js";
import { zipStore } from "../zipStore.js";
import { dtpForTurma } from "./dtp.js";
import { gravarPdfsDossie, montarPdfsDossie } from "./ficheiros.js";
import { ITEM_PERGUNTAS, NOME_PERGUNTAS, perguntasEnviadas } from "./inqueritos.js";
import { dadosRelatorioFinal } from "./relatorio.js";
import { asArr, nomeArquivoDtp, uniqueZipPath, type Regime } from "./util.js";

/** Descargas da Drive em paralelo, poucas de cada vez (a API da Google limita pedidos por utilizador). */
const DESCARGAS_EM_PARALELO = 4;
/** Uma descarga presa não segura a exportação (na Vercel a função tem 30 s). */
const LIMITE_DESCARGA_MS = 8_000;

export type OpcoesExport = {
  /** Até quando (Date.now()) se começam descargas; as que ficam de fora são listadas no índice. */
  prazo?: number;
};

export async function exportarDossie(db: Db, actorId: string | undefined, regime: Regime, turma: TurmaRow, opts: OpcoesExport = {}) {
  const dtp = await dtpForTurma(db, regime, turma);
  const root = pastaSegura(dtpPastaNome(regime, turma.nome));
  const used = new Set<string>();
  const files: { name: string; data: Buffer }[] = [];
  const add = (rel: string, data: Buffer) => files.push({ name: uniqueZipPath(used, rel), data });

  const formandos = await formandosDaTurma(db, regime, turma);
  const grupos = regime === "fin"
    ? TOPICOS_FIN.map(t => ({ pasta: t.pasta, itens: dtp.items.filter(i => i.topico === t.n), formandos: t.n === 5, formador: t.n === 3 }))
    : DTP_CATEGORIAS.map(cat => ({ pasta: cat.pasta, itens: dtp.items.filter(i => dtpCategoriaDe(i) === cat.id), formandos: cat.id === "formandos", formador: cat.id === "formador" }));
  for (const cat of grupos) {
    const extra: string[] = [];
    if (cat.formandos) extra.push("", "Formandos da turma:", ...(formandos.length ? formandos.map(f => `  ${f.nome}`) : ["  Ainda sem formandos."]));
    if (cat.formador) extra.push("", `Formador: ${turma.formador?.trim() || "por atribuir nesta turma."}`);
    const linhas = [
      `${cat.pasta} · ${turma.nome}`,
      turma.curso,
      "",
      ...cat.itens.map(i => `${i.estado === "ok" ? "[x]" : i.estado === "parcial" ? "[~]" : "[ ]"} ${i.label}${i.anexo?.fileName ? ` · ${i.anexo.fileName}` : ""}`),
      ...extra,
    ];
    add(`${root}/${cat.pasta}/_indice.txt`, Buffer.from(linhas.join("\n"), "utf8"));
  }

  // Primeiro junta-se o que descarregar (cada ficheiro uma vez, no primeiro sítio), depois descarrega-se em paralelo.
  const seen = new Set<string>();
  const pedidos: { fileId: string; rel: string }[] = [];
  const pushDrive = async (fileId: string, rel: string) => {
    if (!fileId || seen.has(fileId)) return;
    seen.add(fileId);
    pedidos.push({ fileId, rel });
  };

  for (const item of dtp.items) {
    if (!item.anexo?.driveFileId) continue;
    const ficheiro = nomeArquivoDtp(item.label, item.anexo.fileName || "anexo.pdf");
    const rel = regime === "fin"
      ? [root, pastaFinDoItem(item.id), pastaSegura(ficheiro)].join("/")
      : dtpZipRelPath({ root, ambito: item.ambito, itemId: item.id, itemLabel: item.label, fileName: ficheiro });
    await pushDrive(item.anexo.driveFileId, rel);
  }

  const drive = [
    ...await listDriveFiles(db, { kind: "", regime, turma: turma.nome, limit: 200 }),
    ...await listDriveFiles(db, { kind: "", regime, turma: String(turma.id), limit: 200 }),
  ];
  for (const f of drive) {
    if (seen.has(f.id)) continue;
    const item = dtp.items.find(i => i.label === f.label || i.id === f.label);
    await pushDrive(f.id, dtpZipRelPath({
      root,
      ambito: item?.ambito ?? (f.kind === "formando-doc" || f.kind === "pip" ? "formando" : f.kind === "formador-doc" ? "formador" : "turma"),
      itemId: item?.id,
      itemLabel: item?.label || f.label || undefined,
      pessoa: f.formando ?? undefined,
      kind: f.kind,
      fileName: nomeArquivoDtp(item?.label || f.label || undefined, f.name),
    }));
  }

  const docs = await ficheirosDosFormandos(db, regime, formandos.map(f => f.id)).catch(() => []);
  for (const row of docs) {
    const pessoa = formandos.find(f => f.id === row.formando_id)?.nome ?? String(row.formando_id);
    await pushDrive(row.drive_file_id, dtpZipRelPath({
      root, ambito: "formando", itemId: row.doc_id, itemLabel: row.doc_id, pessoa, kind: "formando-doc",
      fileName: nomeArquivoDtp(row.doc_id, row.file_name || "documento.pdf"),
    }));
  }

  // Todos os formadores associados à turma (responsável, equipa e cronograma) — e só esses.
  const equipa = await equipaDaTurma(db, regime, turma.id);
  const nomesFormadores = nomesNoCronograma(turma.cronograma, [turma.formador ?? "", ...asArr(equipa?.formadores).map(String)]);
  for (const formador of await formadoresPorNome(db, nomesFormadores)) {
    for (const row of await ficheirosDoFormador(db, formador.id).catch(() => [])) {
      await pushDrive(row.drive_file_id, dtpZipRelPath({
        root, ambito: "formador", itemId: row.doc_id, itemLabel: row.doc_id, pessoa: formador.nome, kind: "formador-doc",
        fileName: nomeArquivoDtp(row.doc_id, row.file_name || "documento.pdf"),
      }));
    }
  }

  const descarregados: (Buffer | null)[] = new Array(pedidos.length).fill(null);
  const foraDoPrazo: string[] = [];
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < pedidos.length) {
      const i = proximo++;
      if (opts.prazo != null && Date.now() > opts.prazo) {
        foraDoPrazo.push(pedidos[i]!.rel);
        continue;
      }
      const content = await readDriveContent(db, pedidos[i]!.fileId, { timeoutMs: LIMITE_DESCARGA_MS }).catch(() => null);
      descarregados[i] = content?.bytes ?? null;
    }
  };
  await Promise.all(Array.from({ length: Math.min(DESCARGAS_EM_PARALELO, pedidos.length) }, trabalhador));
  pedidos.forEach((p, i) => { const bytes = descarregados[i]; if (bytes) add(p.rel, bytes); });

  const gerados = await montarPdfsDossie(db, regime, turma);
  const pastaPed = DTP_CATEGORIAS.find(c => c.id === "pedagogia")?.pasta ?? "04-Pedagogia";
  const pastaCron = regime === "fin" ? pastaFinDoItem("cronograma") : pastaPed;
  const pastaSess = regime === "fin" ? pastaFinDoItem("presencas") : pastaPed;
  add(`${root}/${pastaCron}/Cronograma.pdf`, gerados.cronograma);
  add(`${root}/${pastaSess}/Folhas de presenca e sumarios.pdf`, gerados.folhas);
  add(`${root}/${pastaSess}/Planos de sessao.pdf`, gerados.planos);
  if (regime === "fin") {
    const dados = await dadosRelatorioFinal(db, turma.id);
    if (dados) {
      add(`${root}/${pastaFinDoItem("relatorio")}/RelatorioFinalAccao.pdf`, pdfRelatorioFinal(dados));
      add(`${root}/${pastaFinDoItem("relatorios-estatisticos")}/RelatorioEstatistico.pdf`, pdfRelatorioInqueritos({
        ...dados, inqueritos: dados.inqueritos.filter(i => i.publico === "formador" || i.publico === "formando"),
      }, { titulo: "Relatórios estatísticos", intro: "Médias e contagens das respostas dos inquéritos de formandos e de formador enviados a esta turma." }));
      add(`${root}/${pastaFinDoItem("relatorio-pos")}/RelatorioPosFormacao.pdf`, pdfRelatorioInqueritos({
        ...dados, inqueritos: dados.inqueritos.filter(i => i.publico === "pos"),
      }, { titulo: "Relatório pós-formação", intro: "Só entram respostas dos inquéritos com público-alvo Pós-formação, e só desta turma." }));
      for (const publico of ["formador", "formando", "pos"] as const) {
        const nomePdf = NOME_PERGUNTAS[publico];
        const itemId = ITEM_PERGUNTAS[publico];
        if (!nomePdf || !itemId) continue;
        const perguntas = await perguntasEnviadas(db, turma.id, publico);
        add(`${root}/${pastaFinDoItem(itemId)}/${nomePdf}`, pdfPerguntasInqueritos({ acao: dados.acao, curso: dados.curso, publico, inqueritos: perguntas }));
      }
    }
  }
  await gravarPdfsDossie(db, actorId, regime, turma, gerados).catch(() => undefined);

  const pdfs = files.filter(f => !f.name.endsWith("/_indice.txt") && !f.name.endsWith("/00-Indice geral.txt"));
  const indice = [
    "Dossiê técnico-pedagógico",
    root,
    `Turma: ${turma.nome}`,
    `Curso: ${turma.curso}`,
    `Regime: ${regime === "fin" ? "Financiada" : "Gold"}`,
    `Completude: ${dtp.pct}% · ${dtp.ok} no dossiê · ${dtp.parcial} parciais · ${dtp.falta} em falta`,
    `Ficheiros: ${pdfs.length}`,
    "",
    regime === "fin" ? "Organização da pasta (pelos tópicos do dossiê):" : "Organização da pasta (por categoria):",
    `  ${root}/`,
    ...(regime === "fin" ? TOPICOS_FIN : DTP_CATEGORIAS).map(c => `    ${c.pasta}/`),
    "",
    "Documentos do dossiê:",
    ...dtp.items.map(i => {
      const pasta = regime === "fin" ? pastaFinDoItem(i.id) : dtpCategoriaPasta(i);
      return `  [${i.estado === "ok" ? "ok" : i.estado === "parcial" ? "parcial" : "falta"}] ${pasta} / ${i.label}`;
    }),
    "",
    "Ficheiros neste ZIP:",
    ...files.map(f => `  ${f.name}`),
    pdfs.length ? "" : "Ainda não há PDFs no Drive desta turma. As pastas e o índice ficam no ZIP para o arquivo.",
    ...(foraDoPrazo.length
      ? ["", `Ficheiros que não couberam no tempo desta exportação (${foraDoPrazo.length}); estão na Drive da turma:`, ...foraDoPrazo.sort().map(f => `  ${f}`)]
      : []),
  ].join("\n");
  add(`${root}/00-Indice geral.txt`, Buffer.from(indice, "utf8"));

  return { zip: zipStore(files), nome: dtpZipNome(regime, turma.nome), ficheiros: pdfs.length, pasta: root, foraDoPrazo: foraDoPrazo.length };
}
