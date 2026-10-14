// Documento de propostas, contratos e modelos: HTML limitado, com cabeçalho, campos automáticos,
// cláusulas numeradas e cláusulas opcionais. O mesmo HTML é desenhado no editor, na impressão e no PDF do servidor
// (server/src/assinaturas/pdfHtml.ts), por isso só se aceitam as etiquetas e atributos que os três sabem desenhar.

export type PosicaoLogo = "esquerda" | "centro" | "direita";

/** Definições guardadas no próprio documento (primeiro elemento, escondido). */
export type Definicoes = {
  logoPos: PosicaoLogo;
  logoAltura: number;
  mostrarNome: boolean;
  subtitulo: string;
  regime: "gold" | "fin" | "ambos";
  assinatura: "digital" | "papel";
  /** Dados do formulário lateral (A/C, formandos, desconto, sede…), para reabrir o documento como estava. */
  dados: Record<string, string>;
};

export const DEFINICOES_PADRAO: Definicoes = {
  logoPos: "esquerda", logoAltura: 40, mostrarNome: true, subtitulo: "", regime: "gold", assinatura: "digital", dados: {},
};

export type Campo = { chave: string; rotulo: string; grupo: string; servidor?: boolean };

/**
 * Campos automáticos. Os marcados `servidor` são preenchidos pelo servidor ao enviar para assinatura
 * (ficam guardados como {{chave}}); os outros guardam o valor actual, que vem do formulário ao lado da página.
 */
export const CAMPOS: Campo[] = [
  { chave: "cliente", rotulo: "Nome do cliente", grupo: "Cliente", servidor: true },
  { chave: "nif", rotulo: "NIF do cliente", grupo: "Cliente", servidor: true },
  { chave: "email", rotulo: "Email do cliente", grupo: "Cliente", servidor: true },
  { chave: "contacto", rotulo: "A/C (contacto)", grupo: "Cliente" },
  { chave: "sede", rotulo: "Sede", grupo: "Cliente" },
  { chave: "representante", rotulo: "Representante", grupo: "Cliente" },
  { chave: "curso", rotulo: "Curso", grupo: "Formação", servidor: true },
  { chave: "turma", rotulo: "Turma", grupo: "Formação", servidor: true },
  { chave: "horas", rotulo: "Horas", grupo: "Formação" },
  { chave: "formandos", rotulo: "Formandos", grupo: "Formação" },
  { chave: "local", rotulo: "Local", grupo: "Formação" },
  { chave: "inicio", rotulo: "Data de início", grupo: "Formação" },
  { chave: "datas", rotulo: "Datas da formação", grupo: "Formação" },
  { chave: "valor", rotulo: "Total", grupo: "Valores" },
  { chave: "desconto", rotulo: "Desconto", grupo: "Valores" },
  { chave: "plano", rotulo: "Plano de pagamento", grupo: "Valores" },
  { chave: "validade", rotulo: "Validade", grupo: "Valores" },
  { chave: "data", rotulo: "Data do documento", grupo: "Documento", servidor: true },
  { chave: "numero", rotulo: "Número", grupo: "Documento" },
  { chave: "comercial", rotulo: "Comercial", grupo: "Documento" },
  { chave: "entidade", rotulo: "Nome da entidade", grupo: "Documento" },
];

export const CAMPO_POR_CHAVE = new Map(CAMPOS.map(c => [c.chave, c]));

export type Valores = Record<string, string>;

const ETIQUETAS = new Set(["P", "H2", "H3", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "UL", "OL", "LI", "BR", "TABLE", "TBODY", "THEAD", "TR", "TD", "TH", "SPAN", "DIV", "SECTION"]);
const ALINHAMENTOS = new Set(["left", "center", "right", "justify"]);

function escapar(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Texto antigo (sem HTML): parágrafos separados por linha em branco. */
export function textoParaHtml(texto: string) {
  return texto.replace(/\r/g, "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${escapar(p).replace(/\n/g, "<br>").replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (_m, k: string) => chipHtml(k.toLowerCase()))}</p>`)
    .join("");
}

export function chipHtml(chave: string, texto?: string) {
  const c = CAMPO_POR_CHAVE.get(chave);
  const conteudo = texto ?? (c?.servidor ? `{{${chave}}}` : `[${c?.rotulo ?? chave}]`);
  return `<span data-campo="${escapar(chave)}" contenteditable="false">${escapar(conteudo)}</span>`;
}

/** Limpa o HTML para o subconjunto que o editor, a impressão e o PDF desenham. */
export function sanitizar(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const limpar = (no: Node): Node[] => {
    if (no.nodeType === Node.TEXT_NODE) return [document.createTextNode(no.textContent ?? "")];
    if (no.nodeType !== Node.ELEMENT_NODE) return [];
    const el = no as HTMLElement;
    const filhos = () => Array.from(el.childNodes).flatMap(limpar);
    if (!ETIQUETAS.has(el.tagName)) return filhos();
    const novo = document.createElement(el.tagName === "B" ? "strong" : el.tagName === "I" ? "em" : el.tagName === "STRIKE" ? "s" : el.tagName.toLowerCase());
    const alinhar = el.style?.textAlign;
    if (alinhar && ALINHAMENTOS.has(alinhar) && /^(P|H2|H3|DIV|TD|TH|LI)$/.test(el.tagName)) novo.style.textAlign = alinhar;
    for (const a of ["data-campo", "data-quebra", "data-opcional", "data-ligada", "data-bloco", "data-gf", "data-assinaturas"]) {
      const v = el.getAttribute(a);
      if (v != null) novo.setAttribute(a, v.slice(0, 4000));
    }
    if (el.tagName === "H3" && el.classList.contains("gf-clausula")) novo.className = "gf-clausula";
    if (el.tagName === "DIV" && el.getAttribute("data-gf") === "doc") {
      for (const a of Array.from(el.attributes)) if (a.name.startsWith("data-")) novo.setAttribute(a.name, a.value.slice(0, 8000));
      novo.hidden = true;
      return [novo];
    }
    if (novo.hasAttribute("data-campo") || novo.hasAttribute("data-quebra") || novo.hasAttribute("data-bloco") || novo.hasAttribute("data-assinaturas")) {
      novo.setAttribute("contenteditable", "false");
    }
    for (const f of filhos()) novo.appendChild(f);
    return [novo];
  };
  const out = document.createElement("div");
  for (const f of Array.from(doc.body.childNodes).flatMap(limpar)) out.appendChild(f);
  return out.innerHTML;
}

/** Separa as definições (elemento escondido no início) do corpo do documento. */
export function lerDocumento(corpo: string): { def: Definicoes; html: string } {
  const bruto = corpo.trim();
  if (!bruto) return { def: { ...DEFINICOES_PADRAO, dados: {} }, html: "" };
  if (!bruto.startsWith("<")) return { def: { ...DEFINICOES_PADRAO, dados: {} }, html: textoParaHtml(bruto) };
  const limpo = sanitizar(bruto);
  const tmp = document.createElement("div");
  tmp.innerHTML = limpo;
  const meta = tmp.querySelector<HTMLElement>("div[data-gf='doc']");
  const def: Definicoes = { ...DEFINICOES_PADRAO, dados: {} };
  if (meta) {
    const pos = meta.getAttribute("data-logo-pos");
    if (pos === "esquerda" || pos === "centro" || pos === "direita") def.logoPos = pos;
    const alt = Number(meta.getAttribute("data-logo-altura"));
    if (alt >= 20 && alt <= 90) def.logoAltura = alt;
    def.mostrarNome = meta.getAttribute("data-nome") !== "0";
    def.subtitulo = meta.getAttribute("data-subtitulo") ?? "";
    const reg = meta.getAttribute("data-regime");
    if (reg === "gold" || reg === "fin" || reg === "ambos") def.regime = reg;
    def.assinatura = meta.getAttribute("data-assinatura") === "papel" ? "papel" : "digital";
    try {
      const d = JSON.parse(meta.getAttribute("data-dados") || "{}");
      if (d && typeof d === "object") for (const [k, v] of Object.entries(d)) def.dados[k] = String(v);
    } catch { /* dados ilegíveis: ignoram-se */ }
    meta.remove();
  }
  return { def, html: tmp.innerHTML };
}

/** Junta as definições e o corpo num só HTML para guardar. */
export function escreverDocumento(def: Definicoes, html: string) {
  const meta = document.createElement("div");
  meta.setAttribute("data-gf", "doc");
  meta.setAttribute("data-logo-pos", def.logoPos);
  meta.setAttribute("data-logo-altura", String(def.logoAltura));
  meta.setAttribute("data-nome", def.mostrarNome ? "1" : "0");
  meta.setAttribute("data-subtitulo", def.subtitulo);
  meta.setAttribute("data-regime", def.regime);
  meta.setAttribute("data-assinatura", def.assinatura);
  meta.setAttribute("data-dados", JSON.stringify(def.dados));
  meta.hidden = true;
  return meta.outerHTML + sanitizar(html);
}

/**
 * Prepara o corpo para guardar: os campos do servidor voltam a {{chave}}; os outros guardam o valor actual.
 * As cláusulas desligadas mantêm-se (com data-ligada="0") para se poderem voltar a ligar.
 */
export function corpoParaGuardar(htmlEditor: string, valores: Valores) {
  const tmp = document.createElement("div");
  tmp.innerHTML = htmlEditor;
  tmp.querySelectorAll<HTMLElement>("[data-campo]").forEach(el => {
    const k = el.getAttribute("data-campo") ?? "";
    const c = CAMPO_POR_CHAVE.get(k);
    el.textContent = c?.servidor ? `{{${k}}}` : (valores[k]?.trim() || `[${c?.rotulo ?? k}]`);
    el.removeAttribute("style");
  });
  return tmp.innerHTML;
}

/** Mostra no editor o valor de cada campo (ou o nome do campo, quando ainda não há valor). */
export function preencherCampos(raiz: HTMLElement, valores: Valores, modo: "valores" | "campos" = "valores") {
  raiz.querySelectorAll<HTMLElement>("[data-campo]").forEach(el => {
    const k = el.getAttribute("data-campo") ?? "";
    const c = CAMPO_POR_CHAVE.get(k);
    const v = valores[k]?.trim();
    const texto = modo === "campos" ? (c?.rotulo ?? k) : v || `[${c?.rotulo ?? k}]`;
    if (el.textContent !== texto) el.textContent = texto;
    el.classList.toggle("gf-campo-vazio", modo === "valores" && !v);
  });
}

/** Valor final de um campo na impressão (os campos do servidor que já se conhecem também se preenchem). */
export function htmlParaImpressao(htmlEditor: string, valores: Valores) {
  const tmp = document.createElement("div");
  tmp.innerHTML = htmlEditor;
  tmp.querySelectorAll<HTMLElement>("[data-campo]").forEach(el => {
    const k = el.getAttribute("data-campo") ?? "";
    const c = CAMPO_POR_CHAVE.get(k);
    const v = valores[k]?.trim();
    // Sem valor novo, fica o que o documento guardou (excepto os marcadores {{campo}} do servidor).
    if (v) el.textContent = v;
    else if (/^\s*(\{\{.*\}\})?\s*$/.test(el.textContent ?? "")) el.textContent = `[${c?.rotulo ?? k}]`;
  });
  tmp.querySelectorAll("[data-opcional][data-ligada='0']").forEach(el => el.remove());
  return tmp.innerHTML;
}

/** Cláusulas opcionais presentes no texto. */
export function opcionaisDe(html: string): { id: string; titulo: string; ligada: boolean }[] {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return Array.from(tmp.querySelectorAll<HTMLElement>("section[data-opcional]")).map(s => ({
    id: s.getAttribute("data-opcional") ?? "",
    titulo: s.querySelector("h3")?.textContent?.trim() || "Cláusula opcional",
    ligada: s.getAttribute("data-ligada") !== "0",
  }));
}

export function alternarOpcional(html: string, id: string, ligada: boolean) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll<HTMLElement>(`section[data-opcional="${CSS.escape(id)}"]`).forEach(s => s.setAttribute("data-ligada", ligada ? "1" : "0"));
  return tmp.innerHTML;
}

/** Número legível: P-0143, C-0057. */
export function numeroDoc(tipo: "proposta" | "contrato", id: number | null | undefined) {
  return id ? `${tipo === "proposta" ? "P" : "C"}-${String(id).padStart(4, "0")}` : "novo";
}

export function dataLonga(iso?: string | null) {
  const d = iso ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

/** "€ 1 600,00" (o formato das propostas e contratos). */
/** Números à portuguesa com espaço nos milhares também nos números de 4 algarismos ("1 600"). */
function agrupar(v: number, casas: number) {
  const [int, dec] = Math.abs(v).toFixed(casas).split(".");
  const comEspacos = int!.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${v < 0 ? "−" : ""}${comEspacos}${dec ? `,${dec}` : ""}`;
}

export function euros(v: number) {
  return `€ ${agrupar(v, 2)}`;
}

/** Quantias curtas para listas: "€ 2 400" ou "€ 980,50". */
export function eurosCurto(v: number) {
  const inteiro = Math.abs(v - Math.round(v)) < 0.005;
  return `€ ${agrupar(v, inteiro ? 0 : 2)}`;
}
