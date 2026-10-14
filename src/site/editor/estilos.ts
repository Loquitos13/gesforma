// Modelo de estilo dos blocos do editor visual: espaçamento sem limites, tamanho, posição, fundo, borda,
// tipografia e visibilidade por dispositivo. Tudo vira variáveis CSS (as regras estão em index.css, `.ena-b`).
import type { CSSProperties } from "react";
import { moradaSegura } from "../../partilhado/siteConteudo";

export type Lados = { t: number | null; r: number | null; b: number | null; l: number | null };
export type Medida = { valor: number | null; unidade: "px" | "%" | "vw" | "vh" | "rem" };

export type Estilo = {
  margem: Lados;
  preenchimento: Lados;
  margemTel: Lados;
  preenchimentoTel: Lados;
  largura: Medida;
  larguraMax: Medida;
  alturaMin: Medida;
  alinhar: "" | "inicio" | "centro" | "fim";
  deslocX: number | null;
  deslocY: number | null;
  camada: number | null;
  fundoCor: string;
  fundoImagem: string;
  fundoSobreposicao: string;
  fundoOpacidade: number | null;
  bordaLargura: number | null;
  bordaCor: string;
  bordaEstilo: "solid" | "dashed" | "dotted";
  bordaTopo: number | null;
  raio: number | null;
  sombra: "" | "suave" | "media" | "forte";
  opacidade: number | null;
  ocultarTel: boolean;
  ocultarTab: boolean;
  ocultarPc: boolean;
  /** Área do formando: mostrar o bloco só a quem entrou, ou só a quem ainda não entrou. */
  sessao: "" | "sem" | "com";
  ancora: string;
};

export type Tipografia = {
  fonte: string;
  tamanho: number | null;
  tamanhoTel: number | null;
  peso: "" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  alturaLinha: number | null;
  espacamento: number | null;
  cor: string;
  alinhamento: "" | "left" | "center" | "right" | "justify";
  transformacao: "" | "none" | "uppercase" | "lowercase" | "capitalize";
  italico: boolean;
};

const ladosVazios = (): Lados => ({ t: null, r: null, b: null, l: null });
const medida = (valor: number | null = null, unidade: Medida["unidade"] = "px"): Medida => ({ valor, unidade });

export function estiloVazio(extra: Partial<Estilo> = {}): Estilo {
  return {
    margem: ladosVazios(), preenchimento: ladosVazios(), margemTel: ladosVazios(), preenchimentoTel: ladosVazios(),
    largura: medida(), larguraMax: medida(), alturaMin: medida(), alinhar: "",
    deslocX: null, deslocY: null, camada: null,
    fundoCor: "", fundoImagem: "", fundoSobreposicao: "", fundoOpacidade: null,
    bordaLargura: null, bordaCor: "", bordaEstilo: "solid", bordaTopo: null, raio: null, sombra: "", opacidade: null,
    ocultarTel: false, ocultarTab: false, ocultarPc: false, sessao: "", ancora: "",
    ...extra,
  };
}

export function tipoVazia(extra: Partial<Tipografia> = {}): Tipografia {
  return {
    fonte: "", tamanho: null, tamanhoTel: null, peso: "", alturaLinha: null, espacamento: null,
    cor: "", alinhamento: "", transformacao: "", italico: false, ...extra,
  };
}

export const lados = (t: number | null, r: number | null = t, b: number | null = t, l: number | null = r): Lados => ({ t, r, b, l });
export const em = (valor: number, unidade: Medida["unidade"] = "px"): Medida => ({ valor, unidade });

// ─── Fontes ──────────────────────────────────────────────────────────────────

/** Fontes do Google com os pesos que existem em cada uma (a API recusa pesos que a fonte não tem). */
export const FONTES: Record<string, string> = {
  "Atkinson Hyperlegible": "ital,wght@0,400;0,700;1,400;1,700",
  "Inter": "wght@300;400;500;600;700;800;900",
  "Public Sans": "wght@300;400;500;600;700;800;900",
  "Poppins": "wght@300;400;500;600;700;800;900",
  "Montserrat": "wght@300;400;500;600;700;800;900",
  "Lato": "wght@300;400;700;900",
  "Open Sans": "wght@300;400;500;600;700;800",
  "Roboto": "wght@300;400;500;700;900",
  "Raleway": "wght@300;400;500;600;700;800;900",
  "Nunito": "wght@300;400;500;600;700;800;900",
  "Work Sans": "wght@300;400;500;600;700;800;900",
  "DM Sans": "wght@300;400;500;600;700;800;900",
  "Oswald": "wght@300;400;500;600;700",
  "Bebas Neue": "wght@400",
  "Playfair Display": "wght@400;500;600;700;800;900",
  "Merriweather": "wght@300;400;700;900",
  "Lora": "wght@400;500;600;700",
  "DM Serif Display": "wght@400",
  "Libre Baskerville": "wght@400;700",
  "Source Serif 4": "wght@300;400;500;600;700;800;900",
};

const SERIFADAS = new Set(["Playfair Display", "Merriweather", "Lora", "DM Serif Display", "Libre Baskerville", "Source Serif 4"]);
const carregadas = new Set<string>();

/** Junta o <link> da fonte ao <head> uma só vez (o editor copia-o para a pré-visualização). */
export function carregarFonte(nome: string) {
  if (!nome || !FONTES[nome] || carregadas.has(nome) || typeof document === "undefined") return;
  carregadas.add(nome);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nome).replace(/%20/g, "+")}:${FONTES[nome]}&display=swap`;
  document.head.appendChild(link);
}

export function pilhaFonte(nome: string) {
  if (!nome) return undefined;
  if (nome === "tema-titulos") return "var(--f-titulos)";
  if (nome === "tema-texto") return "var(--f-texto)";
  if (!FONTES[nome]) return undefined;
  carregarFonte(nome);
  return `"${nome}", ${SERIFADAS.has(nome) ? "Georgia, serif" : "system-ui, sans-serif"}`;
}

// ─── Cores ───────────────────────────────────────────────────────────────────

export const CORES_TEMA = [
  { valor: "var(--c-primaria)", rotulo: "Primária", amostra: "#14263D" },
  { valor: "var(--c-destaque)", rotulo: "Destaque", amostra: "#A60000" },
  { valor: "var(--c-acento)", rotulo: "Acento", amostra: "#FFA900" },
  { valor: "var(--c-fundo)", rotulo: "Fundo", amostra: "#F6F3EE" },
  { valor: "var(--c-texto)", rotulo: "Texto", amostra: "#1C3350" },
  { valor: "var(--c-suave)", rotulo: "Texto suave", amostra: "#3E5168" },
  { valor: "#ffffff", rotulo: "Branco", amostra: "#ffffff" },
] as const;

/** Só cores que não fogem do valor de uma propriedade CSS: hex, rgb(a), variáveis do tema ou transparente. */
export function corSegura(v: string | undefined | null) {
  const s = (v ?? "").trim();
  if (!s) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^var\(--c-[a-z]+\)$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(s)) return s;
  if (s === "transparent") return s;
  return undefined;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const px = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? undefined : `${n}px`);
const medidaCss = (m: Medida | undefined) => (m?.valor == null || Number.isNaN(m.valor) ? undefined : `${m.valor}${m.unidade}`);
const SOMBRAS = {
  suave: "0 6px 18px rgba(20,38,61,.08)",
  media: "0 14px 36px rgba(20,38,61,.16)",
  forte: "0 28px 70px rgba(8,18,32,.32)",
} as const;

/**
 * Variáveis de espaçamento de um bloco. Escrevem-se sempre os quatro lados (as variáveis CSS herdam:
 * sem isto, cada bloco apanharia o espaçamento da secção onde está). No telemóvel, o que não for
 * definido repete o valor do computador, mas os lados esquerdo e direito ficam limitados a 6% do ecrã
 * (uma margem lateral de 100px no computador não pode comer metade de um telemóvel).
 */
function varsEspaco(s: Partial<Estilo>, out: Record<string, string>) {
  const tel = (proprio: number | null | undefined, herdado: number | null, lado: "t" | "r" | "b" | "l") => {
    if (proprio != null) return px(proprio)!;
    if (herdado == null) return "0px";
    return lado === "l" || lado === "r" ? `clamp(-6vw, ${herdado}px, 6vw)` : `${herdado}px`;
  };
  for (const k of ["t", "r", "b", "l"] as const) {
    const m = s.margem?.[k] ?? null;
    const p = s.preenchimento?.[k] ?? null;
    out[`--m${k}`] = px(m) ?? "0px";
    out[`--p${k}`] = px(p) ?? "0px";
    out[`--mm${k}`] = tel(s.margemTel?.[k], m, k);
    out[`--pm${k}`] = tel(s.preenchimentoTel?.[k], p, k);
  }
  if (s.alinhar === "centro") { out["--ml"] = "auto"; out["--mr"] = "auto"; out["--mml"] = "auto"; out["--mmr"] = "auto"; }
  if (s.alinhar === "fim") { out["--ml"] = "auto"; out["--mml"] = "auto"; }
  if (s.alinhar === "inicio") { out["--mr"] = "auto"; out["--mmr"] = "auto"; }
}

/** Estilo do bloco → `className` + `style` (variáveis lidas pelas regras `.ena-b` em index.css). */
export function estiloBloco(e: Partial<Estilo> | undefined, base?: CSSProperties): { className: string; style: CSSProperties } {
  const s: Partial<Estilo> = e ?? {};
  const vars: Record<string, string> = {};
  varsEspaco(s, vars);
  const style: CSSProperties = { ...(base ?? {}), ...(vars as CSSProperties) };
  const largura = medidaCss(s.largura);
  if (largura) style.width = largura;
  const larguraMax = medidaCss(s.larguraMax);
  if (larguraMax) style.maxWidth = larguraMax;
  const alturaMin = medidaCss(s.alturaMin);
  if (alturaMin) style.minHeight = alturaMin;
  if (s.deslocX || s.deslocY) style.transform = `translate(${s.deslocX ?? 0}px, ${s.deslocY ?? 0}px)`;
  if (s.camada != null) { style.position = style.position ?? "relative"; style.zIndex = s.camada; }
  const fundo = corSegura(s.fundoCor);
  if (fundo) style.backgroundColor = fundo;
  const img = s.fundoImagem ? moradaSegura(s.fundoImagem) : "";
  const sobre = corSegura(s.fundoSobreposicao);
  if (img) {
    const camadaCor = sobre ? `linear-gradient(${sobre}, ${sobre}), ` : "";
    style.backgroundImage = `${camadaCor}url("${img.replace(/["\\\n]/g, "")}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  if (s.bordaLargura) {
    style.borderWidth = `${s.bordaLargura}px`;
    style.borderStyle = s.bordaEstilo || "solid";
    style.borderColor = corSegura(s.bordaCor) ?? "currentColor";
  }
  if (s.bordaTopo) {
    style.borderTopWidth = `${s.bordaTopo}px`;
    style.borderTopStyle = "solid";
    style.borderTopColor = corSegura(s.bordaCor) ?? "var(--c-acento)";
  }
  if (s.raio != null) style.borderRadius = `${s.raio}px`;
  if (s.sombra) style.boxShadow = SOMBRAS[s.sombra];
  if (s.opacidade != null) style.opacity = Math.max(0, Math.min(100, s.opacidade)) / 100;
  const classes = ["ena-b"];
  if (s.ocultarTel) classes.push("ena-oculto-tel");
  if (s.ocultarTab) classes.push("ena-oculto-tab");
  if (s.ocultarPc) classes.push("ena-oculto-pc");
  if (s.sessao === "sem") classes.push("ena-so-sem-sessao");
  if (s.sessao === "com") classes.push("ena-so-com-sessao");
  return { className: classes.join(" "), style };
}

/** Tipografia → `className` + `style` (o tamanho no telemóvel usa uma variável própria). */
export function estiloTexto(t: Partial<Tipografia> | undefined, base?: CSSProperties): { className: string; style: CSSProperties } {
  const s: Partial<Tipografia> = t ?? {};
  const style: CSSProperties = { ...(base ?? {}) };
  const fonte = pilhaFonte(s.fonte ?? "");
  if (fonte) style.fontFamily = fonte;
  const vars = style as Record<string, unknown>;
  // As duas variáveis vão sempre juntas (herdam dos blocos de fora).
  const tam = s.tamanho ?? s.tamanhoTel;
  if (tam != null) {
    vars["--fs"] = s.tamanho != null ? `${s.tamanho}px` : "initial"; // initial = sem valor: herda o tamanho do pai
    vars["--fsm"] = `${s.tamanhoTel ?? tam}px`;
  }
  if (s.peso) style.fontWeight = Number(s.peso);
  if (s.alturaLinha != null) style.lineHeight = s.alturaLinha;
  if (s.espacamento != null) style.letterSpacing = `${s.espacamento}px`;
  const cor = corSegura(s.cor);
  if (cor) style.color = cor;
  if (s.alinhamento) style.textAlign = s.alinhamento;
  if (s.transformacao) style.textTransform = s.transformacao;
  if (s.italico) style.fontStyle = "italic";
  return { className: s.tamanho != null || s.tamanhoTel != null ? "ena-t" : "", style };
}

export function juntar(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(" ");
}

/** Ligação de um botão/bloco: só caminhos internos, http(s), mailto, tel ou âncoras. */
export function ligacaoSegura(v: string | undefined) {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (s.startsWith("#") && /^#[\w-]{1,80}$/.test(s)) return s;
  if (/^mailto:[^\s"<>]+$/i.test(s) || /^tel:[+\d\s()-]+$/i.test(s)) return s;
  return moradaSegura(s);
}
