import { pdfDeLinhas } from "./pdfTexto.js";

export type SessaoRelatorio = {
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  modalidade?: string;
};

export type FormandoRelatorio = {
  nome: string;
  estado: string;
  presencasHoras: number;
  faltasHoras: number;
  nota: number | null;
  certificado: boolean;
};

export type PerguntaRelatorio = {
  texto: string;
  tipo: string;
  media: number | null;
  n: number;
  pctSim: number | null;
  contagens: Record<string, number>;
  textos: string[];
};

export type InqueritoRelatorio = {
  titulo: string;
  publico: string;
  respostas: number;
  perguntas: PerguntaRelatorio[];
};

export type PerguntaDocumento = {
  texto: string;
  tipo: string;
  opcoes: string[];
};

export type InqueritoDocumento = {
  titulo: string;
  publico: string;
  perguntas: PerguntaDocumento[];
};

export type RelatorioFinalDados = {
  curso: string;
  acao: string;
  area: string;
  local: string;
  duracaoHoras: number;
  inicio: string;
  fim: string;
  formador: string;
  horario: string;
  objetivos: string[];
  programa: string[];
  inscritos: number;
  desistentes: FormandoRelatorio[];
  formandos: FormandoRelatorio[];
  certificados: number;
  inqueritos: InqueritoRelatorio[];
  ocorrencias: string[];
};

function horasTexto(horas: number) {
  const total = Math.max(0, Math.round(horas * 100) / 100);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

function dataPt(iso?: string) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function partirLinhas(texto: string, largura = 92) {
  const palavras = texto.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!palavras.length) return [];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const seguinte = atual ? `${atual} ${palavra}` : palavra;
    if (seguinte.length > largura && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = seguinte;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function bloco(linhas: string[], titulo: string, corpo: string[]) {
  linhas.push(titulo, ...corpo, "");
}

function mediaNotas(formandos: FormandoRelatorio[]) {
  const notas = formandos.map(f => f.nota).filter((n): n is number => n != null && Number.isFinite(n));
  if (!notas.length) return null;
  return Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100;
}

function mediaInquerito(inqueritos: InqueritoRelatorio[]) {
  const medias = inqueritos.flatMap(i => i.perguntas.map(p => p.media).filter((n): n is number => n != null));
  if (!medias.length) return null;
  const media = medias.reduce((s, n) => s + n, 0) / medias.length;
  return Math.round((media / 5) * 10000) / 100;
}

export function linhasRelatorioFinal(d: RelatorioFinalDados) {
  const finais = d.formandos.filter(f => !/desist/i.test(f.estado));
  const notaGlobal = mediaNotas(finais);
  const accao = mediaInquerito(d.inqueritos);
  const volume = d.duracaoHoras * Math.max(finais.length, 0);
  const linhas: string[] = [];
  bloco(linhas, "Relatório Final da Ação", [
    ...partirLinhas(`Curso: ${d.curso || "—"}`),
    ...partirLinhas(`Ação: ${d.acao || "—"}`),
    ...partirLinhas(`Área de formação: ${d.area || "—"}`),
    ...partirLinhas(`Local da realização: ${d.local || "—"}`),
    `Duração: ${horasTexto(d.duracaoHoras)}`,
    `Data de início: ${dataPt(d.inicio)}    Data de fim: ${dataPt(d.fim)}`,
    ...partirLinhas(`Formador: ${d.formador || "—"}`),
    "Entidade formadora: ENA · Escola de Negócios e Administração",
    ...partirLinhas(`Regime horário: ${d.horario || "—"}`),
  ]);
  bloco(linhas, "1. Enquadramento e Contextualização", [
    "- Objetivos gerais",
    ...(d.objetivos.length ? d.objetivos.flatMap(o => partirLinhas(o).map(l => `  ${l}`)) : ["  Sem objetivos na ficha do curso."]),
    "- Conteúdo programático",
    ...(d.programa.length ? d.programa.flatMap(p => partirLinhas(p).map(l => `  ${l}`)) : ["  Sem programa na ficha do curso."]),
  ]);
  bloco(linhas, "2. Organização", [
    `Volume de formação: ${horasTexto(volume)}`,
    `Avaliação global dos formandos: ${notaGlobal == null ? "sem notas na grelha" : notaGlobal.toFixed(2)}`,
    `Número de formandos: ${finais.length}`,
    `Avaliação global da ação: ${accao == null ? "sem respostas de inquérito nesta turma" : accao.toFixed(2)}`,
    `N.º de inscritos: ${d.inscritos}`,
    `N.º de desistentes: ${d.desistentes.length}`,
    `N.º final de formandos: ${finais.length}`,
  ]);
  bloco(linhas, "3. Volume de formação", [
    `Duração da ação: ${horasTexto(d.duracaoHoras)}`,
    `Volume total da formação: ${horasTexto(volume)}`,
  ]);
  bloco(linhas, "4. Análise de desistência dos formandos", d.desistentes.length
    ? d.desistentes.flatMap(f => partirLinhas(`${f.nome} · ${f.estado || "Desistiu"}`))
    : ["Sem desistências registadas nesta turma."]);
  bloco(linhas, "5. Assiduidade", [
    "A folha de presença não separa falta justificada de injustificada. As horas em falta ficam como falta.",
    ...((finais.length ? finais : d.formandos).flatMap(f => partirLinhas(
      `${f.nome} · presenças ${horasTexto(f.presencasHoras)} · faltas ${horasTexto(f.faltasHoras)}`,
    ))),
    ...(d.formandos.length ? [] : ["Ainda sem formandos nesta turma."]),
  ]);
  bloco(linhas, "6. Caracterização dos formandos", [
    "Idade, género, escolaridade, situação profissional e empresa não estão na ficha do formando.",
    ...d.formandos.flatMap(f => partirLinhas(`${f.nome} · ${f.estado || "—"}`)),
    ...(d.formandos.length ? [] : ["Ainda sem formandos nesta turma."]),
  ]);
  bloco(linhas, "7. Instalações e equipamentos", [
    ...partirLinhas(d.local ? `Local registado na turma: ${d.local}` : "A turma ainda não tem local."),
  ]);
  bloco(linhas, "8. Certificados", [
    `N.º de certificados externos carregados no dossiê: ${d.certificados}.`,
    "O certificado legal obtém-se fora do GesForma. Esta contagem só inclui o PDF carregado para a turma.",
  ]);
  bloco(linhas, "9. Avaliação das aprendizagens", [
    ...(d.formandos.length
      ? d.formandos.flatMap(f => partirLinhas(`${f.nome} · ${f.nota == null ? "sem nota" : f.nota}`))
      : ["Ainda sem formandos nesta turma."]),
  ]);
  bloco(linhas, "10. Resultados dos inquéritos desta turma", d.inqueritos.length
    ? d.inqueritos.flatMap(inq => [
      ...partirLinhas(`${inq.titulo} · ${rotuloPublicoInquerito(inq.publico)} · ${inq.respostas} ${inq.respostas === 1 ? "resposta" : "respostas"}`),
      ...inq.perguntas.flatMap(p => {
        const valor = p.media != null
          ? `média ${p.media} (${p.n})`
          : p.pctSim != null
            ? `${p.pctSim}% sim (${p.n})`
            : p.n ? `${p.n} respostas` : "sem respostas";
        return partirLinhas(`  ${p.texto} · ${valor}`).concat(
          Object.entries(p.contagens).flatMap(([opcao, n]) => partirLinhas(`    ${opcao}: ${n}`)),
        );
      }),
    ])
    : ["Sem respostas de inquérito associadas a esta turma."]);
  bloco(linhas, "11. Ocorrências", d.ocorrencias.length ? d.ocorrencias.flatMap(o => partirLinhas(o)) : ["Sem ocorrências registadas."]);
  linhas.push(
    "Coordenador/a da ação: _____________________________",
    "Validado pelo gestor/a de formação: __________________",
    "",
    "GESFORMA · relatório gerado a partir dos dados desta turma.",
  );
  return linhas;
}

export function rotuloPublicoInquerito(publico?: string) {
  if (publico === "formador") return "Formador";
  if (publico === "pos") return "Pós-formação";
  if (publico === "empresa") return "Empresa patronal";
  return "Formandos";
}

function rotuloTipoPergunta(tipo: string) {
  if (tipo === "escala") return "Escala 1 a 5";
  if (tipo === "multipla") return "Escolha múltipla";
  if (tipo === "simnao") return "Sim ou não";
  return "Texto livre";
}

export function linhasRelatorioInqueritos(
  d: Pick<RelatorioFinalDados, "acao" | "curso" | "inqueritos">,
  opts?: { titulo?: string; intro?: string },
) {
  const linhas = [
    opts?.titulo ?? "Relatório de inquéritos da turma",
    ...partirLinhas(`Ação: ${d.acao || "—"}`),
    ...partirLinhas(`Curso: ${d.curso || "—"}`),
    opts?.intro ?? "Só entram respostas em que a turma indicada é esta. O inquérito geral do regime fica de fora.",
    "",
  ];
  if (!d.inqueritos.length) {
    linhas.push("Ainda não há respostas desta turma.");
    return linhas;
  }
  for (const inq of d.inqueritos) {
    linhas.push(
      ...partirLinhas(inq.titulo),
      `Público-alvo: ${rotuloPublicoInquerito(inq.publico)}`,
      `${inq.respostas} ${inq.respostas === 1 ? "resposta" : "respostas"} desta turma`,
      "",
    );
    for (const p of inq.perguntas) {
      const valor = p.media != null
        ? `média ${p.media} em ${p.n}`
        : p.pctSim != null
          ? `${p.pctSim}% responderam sim (${p.n})`
          : `${p.n} respostas`;
      linhas.push(...partirLinhas(`${p.texto}: ${valor}`));
      for (const [opcao, n] of Object.entries(p.contagens)) linhas.push(...partirLinhas(`  ${opcao}: ${n}`));
      for (const texto of p.textos) linhas.push(...partirLinhas(`  “${texto}”`));
      linhas.push("");
    }
  }
  return linhas;
}

export function pdfRelatorioFinal(dados: RelatorioFinalDados) {
  return pdfDeLinhas(linhasRelatorioFinal(dados));
}

export function pdfRelatorioInqueritos(
  dados: Pick<RelatorioFinalDados, "acao" | "curso" | "inqueritos">,
  opts?: { titulo?: string; intro?: string },
) {
  return pdfDeLinhas(linhasRelatorioInqueritos(dados, opts));
}

export function linhasPerguntasInqueritos(d: {
  acao: string;
  curso: string;
  publico: string;
  inqueritos: InqueritoDocumento[];
}) {
  const linhas = [
    "Inquérito · perguntas",
    ...partirLinhas(`Ação: ${d.acao || "—"}`),
    ...partirLinhas(`Curso: ${d.curso || "—"}`),
    `Público-alvo: ${rotuloPublicoInquerito(d.publico)}`,
    "Documento das perguntas enviadas a esta turma.",
    "",
  ];
  if (!d.inqueritos.length) {
    linhas.push("Ainda não foi enviado a esta turma nenhum inquérito com este público-alvo.");
    return linhas;
  }
  for (const inq of d.inqueritos) {
    linhas.push(...partirLinhas(inq.titulo), `Público-alvo: ${rotuloPublicoInquerito(inq.publico)}`, "");
    if (!inq.perguntas.length) linhas.push("Este inquérito ainda não tem perguntas.", "");
    inq.perguntas.forEach((p, i) => {
      linhas.push(...partirLinhas(`${i + 1}. ${p.texto} (${rotuloTipoPergunta(p.tipo)})`));
      for (const opcao of p.opcoes) linhas.push(...partirLinhas(`   - ${opcao}`));
    });
    linhas.push("");
  }
  linhas.push("GESFORMA · perguntas do inquérito enviado a esta turma.");
  return linhas;
}

export function pdfPerguntasInqueritos(dados: {
  acao: string;
  curso: string;
  publico: string;
  inqueritos: InqueritoDocumento[];
}) {
  return pdfDeLinhas(linhasPerguntasInqueritos(dados));
}

export function minutosSessao(inicio?: string, fim?: string) {
  const a = /^(\d{1,2}):(\d{2})$/.exec(inicio ?? "");
  const b = /^(\d{1,2}):(\d{2})$/.exec(fim ?? "");
  if (!a || !b) return 0;
  const delta = (Number(b[1]) * 60 + Number(b[2])) - (Number(a[1]) * 60 + Number(a[2]));
  return delta > 0 ? delta : 0;
}
