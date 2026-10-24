/** Exportação do dossiê da turma num ZIP organizado pelas pastas (Gold) ou tópicos (Financiada). */
import type { Db } from "../db/pool.js";
import { NA_PASTA_DA_TURMA } from "../googleDrive.js";
import { getDriveFile, listDriveFiles, readDriveContent } from "../driveFicheiros.js";
import { nomesNoCronograma } from "../driveArvore.js";
import { DTP_CATEGORIAS, dtpCategoriaDe, dtpCategoriaPasta, dtpPastaNome, dtpZipNome, dtpZipRelPath, pastaSegura } from "../dtpPasta.js";
import { fichasInscricaoDaTurma } from "../documentosFin.js";
import { pastaFinDoItem, TOPICOS_FIN } from "../dtpTopicosFin.js";
import { pdfPerguntasInqueritos, pdfRelatorioFinal, pdfRelatorioInqueritos } from "../relatorioFinal.js";
import { certificadosEmitidos, ficheirosDoFormador, ficheirosDosFormandos, formadoresPorNome } from "../repos/dtp.js";
import { equipaDaTurma, formandosDaTurma, type TurmaRow } from "../repos/pedagogiaTurma.js";
import { turmaFechadaEm } from "../repos/resultados.js";
import { zipStore } from "../zipStore.js";
import { dtpForTurma } from "./dtp.js";
import { gravarPdfsDossie, montarPdfsDossie } from "./ficheiros.js";
import { ITEM_PERGUNTAS, NOME_PERGUNTAS, perguntasEnviadas } from "./inqueritos.js";
import { dadosRelatorioFinal } from "./relatorio.js";
import { asArr, nomeArquivoDtp, uniqueZipPath, type Regime } from "./util.js";

/** Descargas da Drive em paralelo (a API da Google limita pedidos por utilizador; 8 fica longe desse limite). */
const DESCARGAS_EM_PARALELO = 8;
/** Uma descarga presa não segura a exportação (na Vercel a função tem 30 s). */
const LIMITE_DESCARGA_MS = 8_000;
/** Com menos tempo do que isto até ao prazo já não se começa uma descarga. */
const MINIMO_DESCARGA_MS = 1_000;
const FORA_DO_TEMPO = "não coube no tempo desta exportação";

export type OpcoesExport = {
  /** Até quando (Date.now()) há descargas; as que não acabam a tempo são listadas no índice. */
  prazo?: number;
};

type Pedido = { fileId: string; rel: string; itemId?: string };

const msgErro = (err: unknown) => (err instanceof Error && err.message ? err.message : "erro desconhecido");

export async function exportarDossie(db: Db, actorId: string | undefined, regime: Regime, turma: TurmaRow, opts: OpcoesExport = {}) {
  const dtp = await dtpForTurma(db, regime, turma);
  const root = pastaSegura(dtpPastaNome(regime, turma.nome));
  const used = new Set<string>();
  const files: { name: string; data: Buffer }[] = [];
  const add = (rel: string, data: Buffer) => files.push({ name: uniqueZipPath(used, rel), data });
  /** O que devia ir no ZIP e não foi, com o motivo: tudo vai para o índice geral. */
  const omitidos: { rel: string; motivo: string }[] = [];
  const avisos: string[] = [];
  const relPath = (o: Omit<Parameters<typeof dtpZipRelPath>[0], "root" | "regime">) => dtpZipRelPath({ ...o, root, regime });

  const formandos = await formandosDaTurma(db, regime, turma);
  const nomeFormando = (id: number | string) => formandos.find(f => String(f.id) === String(id))?.nome ?? String(id);
  const fechada = Boolean((await turmaFechadaEm(db, regime, turma.id))?.fechada_em);

  // PDFs gerados na hora. Os anexos guardados destes itens (cópias anteriores) não entram outra vez.
  const gerados = await montarPdfsDossie(db, regime, turma);
  const geradosZip: { rel: string; data: Buffer; itens: string[] }[] = [];
  const pastaPed = DTP_CATEGORIAS.find(c => c.id === "pedagogia")?.pasta ?? "04-Pedagogia";
  const pastaCron = regime === "fin" ? pastaFinDoItem("cronograma") : pastaPed;
  const pastaSess = regime === "fin" ? pastaFinDoItem("presencas") : pastaPed;
  geradosZip.push({ rel: `${root}/${pastaCron}/Cronograma.pdf`, data: gerados.cronograma, itens: ["cronograma"] });
  geradosZip.push({ rel: `${root}/${pastaSess}/Folhas de presenca e sumarios.pdf`, data: gerados.folhas, itens: ["presencas", "sumarios"] });
  geradosZip.push({ rel: `${root}/${pastaSess}/Planos de sessao.pdf`, data: gerados.planos, itens: ["planos"] });
  if (regime === "fin") {
    // Fichas de inscrição no modelo da candidatura (uma página por formando), geradas na hora.
    const fichas = await fichasInscricaoDaTurma(db, turma.id);
    if (fichas) geradosZip.push({ rel: `${root}/${pastaFinDoItem("fichas")}/${fichas.nome}`, data: fichas.bytes, itens: ["fichas"] });
    const dados = await dadosRelatorioFinal(db, turma.id);
    if (dados) {
      // Turma fechada: vai o relatório final entregue no fecho (anexo do item), não um gerado agora.
      const doFecho = fechada && dtp.items.find(i => i.id === "relatorio")?.anexo?.driveFileId;
      if (!doFecho) {
        geradosZip.push({ rel: `${root}/${pastaFinDoItem("relatorio")}/RelatorioFinalAccao.pdf`, data: await pdfRelatorioFinal(db, turma.id, dados), itens: ["relatorio"] });
      }
      geradosZip.push({
        rel: `${root}/${pastaFinDoItem("relatorios-estatisticos")}/RelatorioEstatistico.pdf`,
        data: await pdfRelatorioInqueritos(db, turma.id, {
          ...dados, inqueritos: dados.inqueritos.filter(i => i.publico === "formador" || i.publico === "formando"),
        }, { titulo: "Relatórios estatísticos", intro: "Médias e contagens das respostas dos inquéritos de formandos e de formador enviados a esta turma." }),
        itens: ["relatorios-estatisticos"],
      });
      geradosZip.push({
        rel: `${root}/${pastaFinDoItem("relatorio-pos")}/RelatorioPosFormacao.pdf`,
        data: await pdfRelatorioInqueritos(db, turma.id, {
          ...dados, inqueritos: dados.inqueritos.filter(i => i.publico === "pos"),
        }, { titulo: "Relatório pós-formação", intro: "Só entram respostas dos inquéritos com público-alvo Pós-formação, e só desta turma." }),
        itens: ["relatorio-pos"],
      });
      for (const publico of ["formador", "formando", "pos"] as const) {
        const nomePdf = NOME_PERGUNTAS[publico];
        const itemId = ITEM_PERGUNTAS[publico];
        if (!nomePdf || !itemId) continue;
        const perguntas = await perguntasEnviadas(db, turma.id, publico);
        geradosZip.push({
          rel: `${root}/${pastaFinDoItem(itemId)}/${nomePdf}`,
          data: await pdfPerguntasInqueritos(db, turma.id, { acao: dados.acao, curso: dados.curso, publico, inqueritos: perguntas }),
          itens: [itemId],
        });
      }
    }
  }
  const regenerados = new Set(geradosZip.flatMap(g => g.itens));

  // Primeiro junta-se o que descarregar (cada ficheiro uma vez, no primeiro sítio), depois descarrega-se em paralelo.
  const seen = new Set<string>();
  const pedidos: Pedido[] = [];
  const pushDrive = (fileId: string, rel: string, itemId?: string) => {
    if (!fileId || seen.has(fileId)) return;
    seen.add(fileId);
    pedidos.push({ fileId, rel, itemId });
  };

  for (const item of dtp.items) {
    if (!item.anexo?.driveFileId) continue;
    if (regenerados.has(item.id)) {
      // A cópia gravada do PDF que se acabou de gerar: não entra outra vez (nem pela listagem da Drive).
      seen.add(item.anexo.driveFileId);
      continue;
    }
    const ficheiro = nomeArquivoDtp(item.label, item.anexo.fileName || "anexo.pdf");
    const rel = regime === "fin"
      ? [root, pastaFinDoItem(item.id), pastaSegura(ficheiro)].join("/")
      : dtpZipRelPath({ root, ambito: item.ambito, itemId: item.id, itemLabel: item.label, fileName: ficheiro });
    pushDrive(item.anexo.driveFileId, rel, item.id);
  }

  // Certificados carregados na turma (turma_certificados), pelo id do ficheiro: não dependem do nome da turma.
  const certificados = await certificadosEmitidos(db, regime, turma.id).catch(err => {
    avisos.push(`Certificados: não foi possível lê-los (${msgErro(err)}); não estão neste ZIP. Exporte de novo.`);
    return [];
  });
  const comCertificado = new Set<string>();
  for (const c of certificados) {
    if (!c.ficheiro_id) continue;
    comCertificado.add(String(c.formando_id));
    const f = await getDriveFile(db, c.ficheiro_id);
    const rel = relPath({ ambito: "formando", kind: "certificado", itemId: "certificados", pessoa: nomeFormando(c.formando_id), fileName: f?.name || "Certificado.pdf" });
    if (f) pushDrive(f.id, rel);
    else omitidos.push({ rel, motivo: "o registo do ficheiro já não existe" });
  }

  // Outros ficheiros da turma na Drive (materiais, contratos assinados, PIP, simulações). Os do dossiê
  // («dtp») só entram como anexo actual de um item: os substituídos ficam de fora.
  const drive = [
    ...await listDriveFiles(db, { kind: "", regime, turma: turma.nome, todos: true }),
    ...await listDriveFiles(db, { kind: "", regime, turma: String(turma.id), todos: true }),
  ];
  for (const f of drive) {
    // Recibos e reembolso ficam na pasta da turma, não no dossiê.
    if (seen.has(f.id) || f.kind === "dtp" || NA_PASTA_DA_TURMA.has(f.kind)) continue;
    if (f.kind === "certificado" && comCertificado.has(String(f.formando ?? ""))) continue;
    // Os documentos dos formandos vêm de formando_docs (só o actual); daqui só os contratos assinados.
    if (f.kind === "formando-doc" && f.contratoId == null) continue;
    const item = dtp.items.find(i => i.label === f.label || i.id === f.label);
    const pessoal = f.kind === "formando-doc" || f.kind === "pip" || f.kind === "certificado";
    pushDrive(f.id, relPath({
      ambito: item?.ambito ?? (pessoal ? "formando" : f.kind === "formador-doc" ? "formador" : "turma"),
      itemId: item?.id,
      itemLabel: item?.label || f.label || undefined,
      pessoa: f.formando ? (f.kind === "certificado" ? nomeFormando(f.formando) : f.formando) : undefined,
      kind: f.kind,
      fileName: nomeArquivoDtp(item?.label || f.label || undefined, f.name),
    }));
  }

  try {
    const docs = await ficheirosDosFormandos(db, regime, formandos.map(f => f.id));
    for (const row of docs) {
      pushDrive(row.drive_file_id, relPath({
        ambito: "formando", itemId: row.doc_id, itemLabel: row.doc_id, pessoa: nomeFormando(row.formando_id), kind: "formando-doc",
        fileName: nomeArquivoDtp(row.doc_id, row.file_name || "documento.pdf"),
      }));
    }
  } catch (err) {
    avisos.push(`Documentos dos formandos: não foi possível lê-los (${msgErro(err)}); não estão neste ZIP. Exporte de novo.`);
  }

  // Todos os formadores associados à turma (responsável, equipa e cronograma) — e só esses.
  const equipa = await equipaDaTurma(db, regime, turma.id);
  const nomesFormadores = nomesNoCronograma(turma.cronograma, [turma.formador ?? "", ...asArr(equipa?.formadores).map(String)]);
  for (const formador of await formadoresPorNome(db, nomesFormadores)) {
    try {
      for (const row of await ficheirosDoFormador(db, formador.id)) {
        pushDrive(row.drive_file_id, relPath({
          ambito: "formador", itemId: row.doc_id, itemLabel: row.doc_id, pessoa: formador.nome, kind: "formador-doc",
          fileName: nomeArquivoDtp(row.doc_id, row.file_name || "documento.pdf"),
        }));
      }
    } catch (err) {
      avisos.push(`Documentos do formador ${formador.nome}: não foi possível lê-los (${msgErro(err)}); não estão neste ZIP.`);
    }
  }

  const descarregados: (Buffer | null)[] = new Array(pedidos.length).fill(null);
  const falhaDoItem = new Map<string, string>();
  let foraDoPrazo = 0;
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < pedidos.length) {
      const i = proximo++;
      const p = pedidos[i]!;
      const resta = opts.prazo != null ? opts.prazo - Date.now() : Infinity;
      let motivo = "";
      if (resta < MINIMO_DESCARGA_MS) {
        motivo = FORA_DO_TEMPO;
      } else {
        // A descarga acaba no prazo, no máximo: o resto do tempo é para gravar os PDFs e o ZIP.
        const limite = Math.min(LIMITE_DESCARGA_MS, resta);
        try {
          const content = await readDriveContent(db, p.fileId, { timeoutMs: limite });
          if (!content) motivo = "o registo do ficheiro já não existe";
          else if (!content.bytes) motivo = "sem ligação à Drive ou a Drive recusou a descarga";
          else descarregados[i] = content.bytes;
        } catch (err) {
          motivo = limite < LIMITE_DESCARGA_MS ? FORA_DO_TEMPO : `a descarga falhou (${msgErro(err)})`;
        }
      }
      if (motivo) {
        if (motivo === FORA_DO_TEMPO) foraDoPrazo += 1;
        omitidos.push({ rel: p.rel, motivo });
        if (p.itemId) falhaDoItem.set(p.itemId, motivo);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DESCARGAS_EM_PARALELO, pedidos.length) }, trabalhador));
  pedidos.forEach((p, i) => { const bytes = descarregados[i]; if (bytes) add(p.rel, bytes); });
  for (const g of geradosZip) add(g.rel, g.data);
  await gravarPdfsDossie(db, actorId, regime, turma, gerados).catch(() => undefined);

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
      ...cat.itens.map(i => {
        const falha = falhaDoItem.get(i.id);
        const marca = i.estado === "ok" ? "[x]" : i.estado === "parcial" ? "[~]" : "[ ]";
        return `${marca} ${i.label}${i.anexo?.fileName ? ` · ${i.anexo.fileName}` : ""}${falha ? ` · NÃO ESTÁ NESTE ZIP (${falha})` : ""}`;
      }),
      ...extra,
    ];
    add(`${root}/${cat.pasta}/_indice.txt`, Buffer.from(linhas.join("\n"), "utf8"));
  }

  const pdfs = files.filter(f => !f.name.endsWith("/_indice.txt") && !f.name.endsWith("/00-Indice geral.txt"));
  const indice = [
    "Dossiê técnico-pedagógico",
    root,
    `Turma: ${turma.nome}`,
    `Curso: ${turma.curso}`,
    `Regime: ${regime === "fin" ? "Financiada" : "Gold"}`,
    `Completude: ${dtp.pct}% · ${dtp.ok} no dossiê · ${dtp.parcial} parciais · ${dtp.falta} em falta`,
    `Ficheiros: ${pdfs.length}${omitidos.length || avisos.length ? " · há ficheiros que NÃO estão neste ZIP (ver o fim deste índice)" : ""}`,
    "",
    regime === "fin" ? "Organização da pasta (pelos tópicos do dossiê):" : "Organização da pasta (por categoria):",
    `  ${root}/`,
    ...(regime === "fin" ? TOPICOS_FIN : DTP_CATEGORIAS).map(c => `    ${c.pasta}/`),
    "",
    "Documentos do dossiê:",
    ...dtp.items.map(i => {
      const pasta = regime === "fin" ? pastaFinDoItem(i.id) : dtpCategoriaPasta(i);
      const falha = falhaDoItem.has(i.id) ? " · ficheiro NÃO incluído neste ZIP" : "";
      return `  [${i.estado === "ok" ? "ok" : i.estado === "parcial" ? "parcial" : "falta"}] ${pasta} / ${i.label}${falha}`;
    }),
    "",
    "Ficheiros neste ZIP:",
    ...files.map(f => `  ${f.name}`),
    pdfs.length ? "" : "Ainda não há PDFs no Drive desta turma. As pastas e o índice ficam no ZIP para o arquivo.",
    ...(omitidos.length
      ? [
        "",
        `Ficheiros que NÃO estão neste ZIP (${omitidos.length}):`,
        ...omitidos.map(o => `  ${o.rel} · ${o.motivo}`).sort(),
        "Para os obter: exporte de novo (as descargas repetem-se; o que ficou fora do tempo costuma entrar à segunda)",
        "ou abra-os na Drive da turma, nas mesmas pastas.",
      ]
      : []),
    ...(avisos.length ? ["", "Avisos:", ...avisos.map(a => `  ${a}`)] : []),
  ].join("\n");
  add(`${root}/00-Indice geral.txt`, Buffer.from(indice, "utf8"));

  return {
    zip: zipStore(files), nome: dtpZipNome(regime, turma.nome), ficheiros: pdfs.length, pasta: root,
    foraDoPrazo, omitidos: omitidos.length + avisos.length,
  };
}
