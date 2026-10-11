export type TipoElementoPedagogico =
  | "texto"
  | "video"
  | "manual"
  | "scorm"
  | "h5p"
  | "flashcards"
  | "quiz"
  | "webinar"
  | "atividade";

export type TipoQuiz =
  | "escolha_unica"
  | "escolha_multipla"
  | "resposta_aberta"
  | "verdadeiro_falso"
  | "correspondencia"
  | "ordenacao";

export type MidiaRef = {
  origem: "url" | "drive" | "ficheiro";
  url?: string;
  nome?: string;
  driveFileId?: string;
  driveUrl?: string;
};

export type OpcaoQuiz = { id: string; texto: string; correta: boolean };

export type ParCorrespondencia = { id: string; esquerda: string; direita: string };

export type CartaFlash = { id: string; frente: string; verso: string };

export type CartaOrdenacao = { id: string; texto: string; ordem: number };

export type ElementoPedagogico = {
  id: string;
  tipo: TipoElementoPedagogico;
  titulo: string;
  duracaoMin?: number;
  midia?: MidiaRef;
  corpo?: string;
  quizTipo?: TipoQuiz;
  pergunta?: string;
  opcoes?: OpcaoQuiz[];
  pares?: ParCorrespondencia[];
  cartasFlash?: CartaFlash[];
  cartasOrdenacao?: CartaOrdenacao[];
  flashOrdemAleatoria?: boolean;
  flashRepetirDificeis?: boolean;
};

export type ConteudoMoodle = {
  moduloId: string;
  introducao: string;
  objetivoModulo: string;
  criterioConclusao: string;
  percursoSequencial: boolean;
  notaMinimaQuiz: number | null;
  elementos: ElementoPedagogico[];
};

function idNovo(prefixo = "e") {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function limparTexto(val: unknown, max: number) {
  return String(val ?? "").slice(0, max);
}

function limparMidia(raw: unknown): MidiaRef | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const origem = m.origem === "drive" || m.origem === "ficheiro" ? m.origem : "url";
  const url = limparTexto(m.url, 2000);
  const nome = limparTexto(m.nome, 200);
  const driveFileId = limparTexto(m.driveFileId, 80);
  const driveUrl = limparTexto(m.driveUrl, 2000);
  if (!url && !driveFileId && !nome) return undefined;
  return { origem, url, nome, driveFileId, driveUrl };
}

function limparOpcoes(raw: unknown): OpcaoQuiz[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; texto?: unknown; correta?: unknown };
    const texto = limparTexto(row.texto, 500);
    if (!texto) return [];
    return [{ id: limparTexto(row.id, 40) || idNovo("o"), texto, correta: Boolean(row.correta) }];
  }).slice(0, 12);
}

function limparPares(raw: unknown): ParCorrespondencia[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; esquerda?: unknown; direita?: unknown };
    const esquerda = limparTexto(row.esquerda, 300);
    const direita = limparTexto(row.direita, 300);
    if (!esquerda && !direita) return [];
    return [{ id: limparTexto(row.id, 40) || idNovo("p"), esquerda, direita }];
  }).slice(0, 20);
}

function limparFlash(raw: unknown): CartaFlash[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; frente?: unknown; verso?: unknown };
    const frente = limparTexto(row.frente, 800);
    const verso = limparTexto(row.verso, 800);
    if (!frente && !verso) return [];
    return [{ id: limparTexto(row.id, 40) || idNovo("f"), frente, verso }];
  }).slice(0, 40);
}

function limparOrdenacao(raw: unknown): CartaOrdenacao[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; texto?: unknown; ordem?: unknown };
    const texto = limparTexto(row.texto, 400);
    if (!texto) return [];
    const ordem = Number(row.ordem);
    return [{ id: limparTexto(row.id, 40) || idNovo("c"), texto, ordem: Number.isFinite(ordem) ? ordem : i + 1 }];
  }).slice(0, 20);
}

const TIPOS_ELEMENTO = new Set<TipoElementoPedagogico>([
  "texto", "video", "manual", "scorm", "h5p", "flashcards", "quiz", "webinar", "atividade",
]);

const TIPOS_QUIZ = new Set<TipoQuiz>([
  "escolha_unica", "escolha_multipla", "resposta_aberta", "verdadeiro_falso", "correspondencia", "ordenacao",
]);

function limparElemento(raw: unknown): ElementoPedagogico | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const tipoRaw = String(row.tipo ?? "");
  const tipo: TipoElementoPedagogico = TIPOS_ELEMENTO.has(tipoRaw as TipoElementoPedagogico)
    ? tipoRaw as TipoElementoPedagogico
    : "texto";
  const titulo = limparTexto(row.titulo, 200);
  const duracao = Number(row.duracaoMin);
  const quizRaw = String(row.quizTipo ?? "");
  const quizTipo: TipoQuiz | undefined = TIPOS_QUIZ.has(quizRaw as TipoQuiz) ? quizRaw as TipoQuiz : undefined;
  return {
    id: limparTexto(row.id, 40) || idNovo(),
    tipo,
    titulo,
    duracaoMin: Number.isFinite(duracao) && duracao > 0 ? Math.min(999, Math.round(duracao)) : undefined,
    midia: limparMidia(row.midia),
    corpo: limparTexto(row.corpo, 8000),
    quizTipo: tipo === "quiz" ? (quizTipo ?? "escolha_unica") : undefined,
    pergunta: limparTexto(row.pergunta, 2000),
    opcoes: limparOpcoes(row.opcoes),
    pares: limparPares(row.pares),
    cartasFlash: limparFlash(row.cartasFlash),
    cartasOrdenacao: limparOrdenacao(row.cartasOrdenacao),
    flashOrdemAleatoria: Boolean(row.flashOrdemAleatoria),
    flashRepetirDificeis: Boolean(row.flashRepetirDificeis),
  };
}

function pecaLegadaParaElemento(raw: unknown): ElementoPedagogico | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { id?: unknown; tipo?: unknown; titulo?: unknown; detalhe?: unknown };
  const titulo = limparTexto(p.titulo, 200);
  const detalhe = limparTexto(p.detalhe, 4000);
  const id = limparTexto(p.id, 40) || idNovo();
  if (p.tipo === "recurso") {
    return {
      id,
      tipo: "manual",
      titulo,
      midia: detalhe ? { origem: "url", url: detalhe, nome: titulo || "Recurso" } : undefined,
      corpo: "",
    };
  }
  if (p.tipo === "atividade") {
    return { id, tipo: "atividade", titulo, corpo: detalhe };
  }
  return { id, tipo: "texto", titulo, corpo: detalhe };
}

function limparElementos(raw: unknown, legado?: unknown): ElementoPedagogico[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.flatMap(item => {
      const el = limparElemento(item);
      return el ? [el] : [];
    }).slice(0, 40);
  }
  if (Array.isArray(legado)) {
    return legado.flatMap(item => {
      const el = pecaLegadaParaElemento(item);
      return el ? [el] : [];
    }).slice(0, 40);
  }
  return [];
}

export function elementoVazio(tipo: TipoElementoPedagogico, quizTipo?: TipoQuiz): ElementoPedagogico {
  const base: ElementoPedagogico = { id: idNovo(), tipo, titulo: "" };
  if (tipo === "quiz") {
    const qt = quizTipo ?? "escolha_unica";
    return {
      ...base,
      quizTipo: qt,
      pergunta: "",
      opcoes: qt === "verdadeiro_falso"
        ? [
          { id: idNovo("o"), texto: "Verdadeiro", correta: true },
          { id: idNovo("o"), texto: "Falso", correta: false },
        ]
        : qt === "escolha_unica" || qt === "escolha_multipla"
          ? [
            { id: idNovo("o"), texto: "", correta: true },
            { id: idNovo("o"), texto: "", correta: false },
          ]
          : [],
      pares: qt === "correspondencia" ? [{ id: idNovo("p"), esquerda: "", direita: "" }] : [],
      cartasOrdenacao: qt === "ordenacao" ? [{ id: idNovo("c"), texto: "", ordem: 1 }] : [],
    };
  }
  if (tipo === "flashcards") {
    return {
      ...base,
      cartasFlash: [{ id: idNovo("f"), frente: "", verso: "" }],
      flashOrdemAleatoria: true,
      flashRepetirDificeis: true,
    };
  }
  return base;
}

export function parseConteudosMoodle(raw: unknown): ConteudoMoodle[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const moduloId = limparTexto(row.moduloId, 80);
    if (!moduloId) return [];
    const nota = Number(row.notaMinimaQuiz);
    const elementos = limparElementos(row.elementos, row.pecas);
    return [{
      moduloId,
      introducao: limparTexto(row.introducao, 4000),
      objetivoModulo: limparTexto(row.objetivoModulo, 2000),
      criterioConclusao: limparTexto(row.criterioConclusao, 2000),
      percursoSequencial: Boolean(row.percursoSequencial),
      notaMinimaQuiz: Number.isFinite(nota) && nota >= 0 && nota <= 100 ? Math.round(nota) : null,
      elementos,
    }];
  }).slice(0, 80);
}

export function conteudoModuloVazio(moduloId: string): ConteudoMoodle {
  return {
    moduloId,
    introducao: "",
    objetivoModulo: "",
    criterioConclusao: "",
    percursoSequencial: false,
    notaMinimaQuiz: null,
    elementos: [],
  };
}

export function moduloTemConteudo(c: ConteudoMoodle) {
  return Boolean(
    c.introducao.trim()
    || c.objetivoModulo.trim()
    || c.criterioConclusao.trim()
    || c.elementos.length,
  );
}

export const ROTULOS_ELEMENTO: Record<TipoElementoPedagogico, string> = {
  texto: "Texto",
  video: "Vídeo",
  manual: "Manual PDF",
  scorm: "SCORM",
  h5p: "H5P",
  flashcards: "Flashcards",
  quiz: "Quiz",
  webinar: "Webinar",
  atividade: "Atividade",
};

export const ROTULOS_QUIZ: Record<TipoQuiz, string> = {
  escolha_unica: "Escolha única",
  escolha_multipla: "Escolha múltipla",
  resposta_aberta: "Resposta aberta",
  verdadeiro_falso: "Verdadeiro ou falso",
  correspondencia: "Correspondência",
  ordenacao: "Ordenação de cartões",
};

export function midiaDeDrive(file: { id: string; name: string; openUrl: string }): MidiaRef {
  return { origem: "drive", driveFileId: file.id, driveUrl: file.openUrl, nome: file.name, url: file.openUrl };
}

export function eMultimediaDrive(mime: string) {
  const m = mime.toLowerCase();
  return m.startsWith("video/")
    || m.startsWith("image/")
    || m.startsWith("audio/")
    || m.includes("pdf")
    || m.includes("zip")
    || m.includes("h5p");
}
