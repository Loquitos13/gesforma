/**
 * Ajustes de conteúdo às páginas do site já gravadas (rascunho e publicada), uma vez cada um (tabela ajustes_site).
 * Servem para mudanças pedidas pelo cliente que mexem no que está na base (menu, rodapé, secções), sem obrigar a
 * refazer as páginas no editor. Cada ajuste só acrescenta ou troca o que encontra; se a página não existe, não faz nada.
 */
import type { Db } from "./pool.js";
import { PAGINAS_LEGAIS, type PaginaLegal } from "./paginasLegais.js";

type No = { type: string; props: Record<string, unknown> };
type Pagina = { root?: unknown; content?: No[] };

const eNo = (v: unknown): v is No => Boolean(v) && typeof v === "object" && typeof (v as No).type === "string" && Boolean((v as No).props) && typeof (v as No).props === "object";

/**
 * Percorre todos os blocos (também os de dentro das secções). Os blocos com valores por ecrã (`__disp`) guardam o que
 * se vê em `__disp.base` (e as diferenças do tablet/telemóvel ao lado): o ajuste corre também sobre esses valores,
 * com `variante` = true nas diferenças por ecrã (aí só se muda o que já lá está).
 */
function cadaBloco(lista: unknown, fn: (b: No, variante: boolean) => void) {
  if (!Array.isArray(lista)) return;
  for (const b of lista) {
    if (!eNo(b)) continue;
    fn(b, false);
    const disp = b.props.__disp as Record<string, unknown> | undefined;
    if (disp && typeof disp === "object") {
      for (const [ecra, v] of Object.entries(disp)) {
        if (v && typeof v === "object" && !Array.isArray(v)) fn({ type: b.type, props: v as Record<string, unknown> }, ecra !== "base");
      }
    }
    for (const v of Object.values(b.props)) if (Array.isArray(v) && v.some(eNo)) cadaBloco(v, fn);
  }
}
const temBloco = (p: Pagina, tipo: string) => JSON.stringify(p.content ?? []).includes(`"type":"${tipo}"`);

const lados = (t: number | null, r: number | null = t) => ({ t, r, b: t, l: r });
const vazio = () => ({ t: null, r: null, b: null, l: null });
const estilo = (extra: Record<string, unknown> = {}) => ({
  margem: vazio(), preenchimento: vazio(), margemTel: vazio(), preenchimentoTel: vazio(),
  largura: { valor: null, unidade: "px" }, larguraMax: { valor: null, unidade: "px" }, alturaMin: { valor: null, unidade: "px" }, alinhar: "",
  deslocX: null, deslocY: null, camada: null, fundoCor: "", fundoImagem: "", fundoSobreposicao: "", fundoOpacidade: null,
  bordaLargura: null, bordaCor: "", bordaEstilo: "solid", bordaTopo: null, raio: null, sombra: "", opacidade: null,
  ocultarTel: false, ocultarTab: false, ocultarPc: false, sessao: "", ancora: "", ...extra,
});
const id = (tipo: string, sufixo: string) => `${tipo}-ajuste-${sufixo}`;
/** Acrescenta uma secção no fim da página, antes do rodapé quando a página tem o seu. */
function acrescentar(p: Pagina, bloco: No) {
  const lista = [...(p.content ?? [])];
  const rodape = lista.findIndex(b => eNo(b) && b.type === "Rodape");
  lista.splice(rodape >= 0 ? rodape : lista.length, 0, bloco);
  p.content = lista;
}
const seccao = (sufixo: string, ancora: string, conteudo: No[], fundo = "") => ({
  type: "Seccao",
  props: { id: id("Seccao", sufixo), espaco: 0, conteudo, aparencia: estilo({ ancora, fundoCor: fundo, preenchimento: lados(72, 32), preenchimentoTel: lados(48, 20) }) },
});

export const CONTACTOS = [
  "R. do Conselheiro Veloso da Cruz 524, 4400-705 Vila Nova de Gaia",
  "Telefone: 223 781 100 | tel:+351223781100",
  "Telemóvel: 912 744 205 | tel:+351912744205",
  "geral@ena.pt | mailto:geral@ena.pt",
  "Secretaria: 2ª a 6ª, 9h00–13h00 e 14h00–18h00",
].join("\n");

const LOGOS = [
  { imagem: "/imagens/certificacoes/dgert.jpg", alt: "DGERT – Entidade formadora certificada", ligacao: "https://www.dgert.gov.pt/" },
  { imagem: "/imagens/certificacoes/iefp.jpg", alt: "IEFP – Instituto do Emprego e Formação Profissional", ligacao: "https://www.iefp.pt/" },
];

/** Os testemunhos do site antigo (página de formação para empresas). */
export const TESTEMUNHOS_ANTIGOS = [
  { nome: "João Almeida", foto: "/imagens/testemunhos/joao-almeida.jpg", texto: "Ter participado no curso de Formação de Formadores da ENA foi uma excelente decisão para impulsionar a minha carreira! Para além de ter obtido o Certificado de Competências Pedagógicas (CCP), aprendi muito sobre como comunicar e criar dinâmicas pedagógicas com o público, não só pessoalmente como também digitalmente. Isto só foi possível pelo facto de o curso estar muito bem estruturado e do formador, Aguiar Falcão, ter muita experiência e know-how nesta área. Estou muito feliz por ter escolhido a ENA para obter o meu CCP!" },
  { nome: "Márcia Brandão", foto: "/imagens/testemunhos/marcia-brandao.jpg", texto: "A modalidade B-Learning adequou-se na perfeição às minhas necessidades, expectativas e horários. Adorei a experiência: a turma era incrível e o grupo tornou-se coeso pela professora Sofia Sousa. Após a conclusão do curso já fui convidada pela minha empresa a desempenhar funções de formadora numa ação a nível nacional. Agradeço à ENA a formação, os materiais, a dedicação e o acompanhamento." },
  { nome: "Alexandra Santos", foto: "/imagens/testemunhos/alexandra-santos.jpg", texto: "O formador Dr. Aguiar Falcão esteve atento à minha dificuldade e deu-me muito apoio, o que me permitiu rasgar com crenças pessoais e aprender que também sou capaz. O facto de as aulas serem em regime b-learning ajudou bastante a conciliar com o meu horário de trabalho. Os métodos de ensino foram muito bons e os vídeos utilizados também são muito explicativos." },
  { nome: "Flávio Flórido", foto: "/imagens/testemunhos/flavio-florido.jpg", texto: "Posso afirmar que, sem qualquer dúvida, o curso me permitiu melhorar a forma como comunico, em formação e no trabalho. A ENA disponibiliza bastantes ferramentas audiovisuais, uma forma muito mais interessante e motivadora de aprender. Foi uma experiência muito positiva e recomendaria esta formação a qualquer profissional." },
  { nome: "Juliana Verde", foto: "/imagens/testemunhos/juliana-verde.jpg", texto: "Quando escolhi a ENA para fazer o meu CCP, não imaginava que me iria surpreender positivamente a cada aula. A formadora Sofia Sousa manteve-nos muito à vontade e usou a nossa diversidade sempre a favor do grupo, com materiais pedagógicos modernos. Já indiquei a ENA a várias pessoas e continuarei a indicar de olhos fechados! Para mim foi uma experiência 5 estrelas!" },
  { nome: "Manuel Taveira", foto: "/imagens/testemunhos/manuel-taveira.jpg", texto: "Fui aluno do CCP na ENA, com a formadora Sofia, e fui agradavelmente surpreendido com os métodos de ensino e com o resultado da aprendizagem. Desde o início da inscrição até à obtenção do certificado, fui sempre bem acompanhado. O curso torna-se bastante intuitivo devido a todo o suporte fornecido, desde os vídeos e manuais de cada módulo à disponibilidade da formadora." },
].map(t => ({ ...t, curso: "Formação de Formadores – CCP", estrelas: 5 }));

const comTestemunhosAntigos = (itens: unknown) => {
  const lista = Array.isArray(itens) ? itens as { nome?: string }[] : [];
  const ja = new Set(lista.map(i => String(i.nome ?? "").trim().toLowerCase()));
  return [...TESTEMUNHOS_ANTIGOS.filter(t => !ja.has(t.nome.toLowerCase())), ...lista];
};

type Ajuste = { id: string; paginas: string[]; aplicar: (p: Pagina, pagina: string) => void };

export const AJUSTES: Ajuste[] = [
  {
    // Menu: «Cursos Financiados» logo a seguir a «Cursos Gold»; o blog passa a «Notícias e artigos».
    id: "2026-11-menu",
    paginas: ["moldura", "inicio"],
    aplicar: p => cadaBloco(p.content, b => {
      if (b.type !== "Cabecalho" || !Array.isArray(b.props.ligacoes)) return;
      const l = [...b.props.ligacoes] as { rotulo?: string; ligacao?: string }[];
      for (const x of l) if (String(x.ligacao ?? "").replace(/\/$/, "") === "/noticias") x.rotulo = "Notícias e artigos";
      const fin = l.findIndex(x => /financiad/i.test(String(x.rotulo ?? "")));
      if (fin >= 0) {
        const [item] = l.splice(fin, 1);
        const gold = l.findIndex(x => /gold/i.test(String(x.rotulo ?? "")));
        l.splice(gold >= 0 ? gold + 1 : fin, 0, item!);
      }
      b.props.ligacoes = l;
    }),
  },
  {
    // Rodapé: morada, telefones, email e horário; logótipos de certificação; «Notícias e artigos».
    id: "2026-11-rodape",
    paginas: ["moldura", "inicio"],
    aplicar: p => cadaBloco(p.content, (b, variante) => {
      if (b.type !== "Rodape") return;
      if (variante && !Array.isArray(b.props.colunas)) return;
      const colunas = (Array.isArray(b.props.colunas) ? [...b.props.colunas] : []) as { titulo?: string; linhas?: string }[];
      const c = colunas.findIndex(x => /contact/i.test(String(x.titulo ?? "")));
      if (c >= 0) colunas[c] = { ...colunas[c], linhas: CONTACTOS };
      else colunas.unshift({ titulo: "Contactos", linhas: CONTACTOS });
      for (const x of colunas) x.linhas = String(x.linhas ?? "").replace(/^Notícias(\s*\|\s*\/noticias)/m, "Notícias e artigos$1");
      b.props.colunas = colunas;
      if (variante) return;
      if (!Array.isArray(b.props.logos) || !b.props.logos.length) b.props.logos = LOGOS;
      b.props.tituloLogos ??= "Entidade formadora certificada";
    }),
  },
  {
    // Página inicial: sai a secção «Siga a ENA» (as redes já estão no menu e no rodapé).
    id: "2026-11-sem-siga-a-ena",
    paginas: ["inicio"],
    aplicar: p => { p.content = (p.content ?? []).filter(b => !JSON.stringify(b).includes('"type":"RedesSociais"')); },
  },
  {
    // Testemunhos do site antigo na página inicial; a mesma secção (sem o botão do Google) em Empresas e no catálogo.
    id: "2026-11-testemunhos",
    paginas: ["inicio", "empresas", "catalogo"],
    aplicar: (p, pagina) => {
      if (pagina === "inicio" || temBloco(p, "Testemunhos")) {
        cadaBloco(p.content, (b, variante) => {
          if (b.type === "Testemunhos" && (!variante || Array.isArray(b.props.itens))) b.props.itens = comTestemunhosAntigos(b.props.itens);
        });
        return;
      }
      acrescentar(p, seccao(`testemunhos-${pagina}`, "testemunhos", [{
        type: "Testemunhos",
        props: {
          id: id("Testemunhos", pagina), titulo: "O que dizem os nossos formandos", itens: TESTEMUNHOS_ANTIGOS,
          disposicao: "carrossel", mostrarBotao: false, google: "nao", formandos: true, aparencia: estilo(),
        },
      }], "#ffffff"));
    },
  },
  {
    // Página inicial: «Onde estamos» com o mapa e os contactos (não há página de contactos).
    id: "2026-11-onde-estamos",
    paginas: ["inicio"],
    aplicar: p => {
      if (temBloco(p, "Mapa")) return;
      acrescentar(p, seccao("onde-estamos", "onde-estamos", [{
        type: "Mapa",
        props: {
          id: id("Mapa", "inicio"), titulo: "Onde estamos", texto: "",
          morada: "Escola de Negócios e Administração, R. do Conselheiro Veloso da Cruz 524, 4400-705 Vila Nova de Gaia",
          contactos: CONTACTOS, altura: 380, aparencia: estilo(),
        },
      }]));
    },
  },
  {
    // Rodapé: «Termos e condições» logo a seguir à «Política de privacidade» (páginas novas do site).
    id: "2026-11-rodape-termos",
    paginas: ["moldura", "inicio"],
    aplicar: p => cadaBloco(p.content, b => {
      if (b.type !== "Rodape" || !Array.isArray(b.props.colunas)) return;
      b.props.colunas = (b.props.colunas as { linhas?: string }[]).map(c => {
        const linhas = String(c.linhas ?? "");
        if (!/^Política de privacidade\s*\|/mi.test(linhas) || /termos-e-condicoes/i.test(linhas)) return c;
        return { ...c, linhas: linhas.replace(/^(Política de privacidade\s*\|[^\n]*)$/mi, "$1\nTermos e condições | /termos-e-condicoes") };
      });
    }),
  },
  {
    // «Notícias» passa a «Notícias e artigos» (título da página e regresso à lista).
    id: "2026-11-noticias-artigos",
    paginas: ["noticias", "noticia"],
    aplicar: p => cadaBloco(p.content, b => {
      if (b.type === "Titulo" && String(b.props.texto ?? "").trim() === "Notícias") b.props.texto = "Notícias e artigos";
      if (b.type === "NoticiaCabecalho" && String(b.props.voltar ?? "").trim() === "Todas as notícias") b.props.voltar = "Todas as notícias e artigos";
    }),
  },
];

/** Aplica os ajustes ainda não feitos às páginas gravadas (rascunho e publicada). */
export async function aplicarAjustesSite(db: Db, ajustes: Ajuste[] = AJUSTES) {
  const feitos = new Set((await db.query<{ id: string }>("SELECT id FROM ajustes_site")).rows.map(r => r.id));
  for (const a of ajustes) {
    if (feitos.has(a.id)) continue;
    for (const pagina of a.paginas) {
      const r = (await db.query<{ rascunho: Pagina | null; publicado: Pagina | null }>(
        "SELECT rascunho, publicado FROM site_paginas WHERE pagina = $1", [pagina])).rows[0];
      if (!r) continue;
      const mudar = (d: Pagina | null) => {
        if (!d || !Array.isArray(d.content)) return d;
        const copia = JSON.parse(JSON.stringify(d)) as Pagina;
        a.aplicar(copia, pagina);
        return copia;
      };
      await db.query("UPDATE site_paginas SET rascunho = $2::jsonb, publicado = $3::jsonb WHERE pagina = $1",
        [pagina, JSON.stringify(mudar(r.rascunho)), JSON.stringify(mudar(r.publicado))]);
    }
    await db.query("INSERT INTO ajustes_site (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [a.id]);
  }
}

const tipografia = (extra: Record<string, unknown>) => ({
  fonte: "", tamanho: null, tamanhoTel: null, peso: "", alturaLinha: null, espacamento: null,
  cor: "", alinhamento: "", transformacao: "", italico: false, ...extra,
});

/** Página de texto (título, secções, parágrafos e listas) numa coluna estreita, como se fosse feita no editor. */
export function paginaDeTexto(p: PaginaLegal): Pagina {
  let n = 0;
  const bid = (tipo: string) => `${tipo}-${p.endereco}-${++n}`;
  const blocos: No[] = [{ type: "Titulo", props: { id: bid("Titulo"), texto: p.titulo, nivel: "h1" } }];
  for (const parte of p.partes) {
    if (parte[0] === "titulo" || parte[0] === "subtitulo") {
      const seccao = parte[0] === "titulo";
      blocos.push({ type: "Titulo", props: {
        id: bid("Titulo"), texto: parte[1], nivel: seccao ? "h2" : "h3",
        tipografia: tipografia({ fonte: "tema-titulos", tamanho: seccao ? 24 : 19, tamanhoTel: seccao ? 20 : 17, peso: "700", alturaLinha: 1.25, cor: "var(--c-primaria)" }),
        aparencia: estilo({ margem: { t: seccao ? 20 : 6, r: null, b: null, l: null } }),
      } });
    } else if (parte[0] === "texto") {
      blocos.push({ type: "Texto", props: { id: bid("Texto"), texto: parte[1] } });
    } else if (parte[0] === "lista") {
      blocos.push({ type: "Texto", props: { id: bid("Texto"), texto: parte[1].map(i => `• ${i}`).join("\n") } });
    } else {
      blocos.push({ type: "Titulo", props: {
        id: bid("Titulo"), texto: parte[1], nivel: "p", ligacao: parte[2],
        tipografia: tipografia({ tamanho: 17, alturaLinha: 1.65, peso: "600", cor: "var(--c-destaque)" }),
      } });
    }
  }
  return {
    root: { props: {} },
    content: [{ type: "Seccao", props: {
      id: bid("Seccao"), espaco: 12, aparencia: estilo({ preenchimento: lados(64, 32), preenchimentoTel: lados(40, 20) }),
      conteudo: [{ type: "Coluna", props: {
        id: bid("Coluna"), espaco: 12, conteudo: blocos,
        aparencia: estilo({ largura: { valor: 100, unidade: "%" }, larguraMax: { valor: 860, unidade: "px" }, alinhar: "centro" }),
      } }],
    } }],
  };
}

/**
 * Páginas novas do site (páginas livres), criadas uma vez e já publicadas. Se o endereço já tiver página, fica a
 * que lá está; depois de criadas, editam-se em Sistema › Site como as outras.
 */
export async function criarPaginasSite(db: Db, paginas: PaginaLegal[] = PAGINAS_LEGAIS) {
  const feitos = new Set((await db.query<{ id: string }>("SELECT id FROM ajustes_site")).rows.map(r => r.id));
  for (const p of paginas) {
    if (feitos.has(p.id)) continue;
    await db.query(
      `INSERT INTO site_paginas (pagina, titulo, rascunho, publicado, publicado_em, atualizado_em)
       VALUES ($1, $2, $3::jsonb, $3::jsonb, now(), now()) ON CONFLICT (pagina) DO NOTHING`,
      [`livre-${p.endereco}`, p.titulo, JSON.stringify(paginaDeTexto(p))]);
    await db.query("INSERT INTO ajustes_site (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [p.id]);
  }
}
