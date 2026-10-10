export const SITE_OMISSAO = {
  tituloSeparador: "ENA | Escola de Negócios e Administração",
  marcaLinha1: "Escola de",
  marcaLinha2: "Negócios e Administração",
  navFormacao: "Formação",
  navEmpresas: "Empresas",
  navFormando: "Área de formando",
  navEntrar: "Iniciar Sessão",
  heroTitulo: "Certifique o seu futuro com formação de referência.",
  heroTexto: "Formação de formadores com CCP e formação financiada com subsídio de alimentação.",
  heroBotao: "Explorar todos os cursos",
  heroImagem: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80",
  heroImagemAlt: "Sessão de formação em sala",
  hero1Tipo: "",
  hero1Curso: "",
  hero1Regime: "",
  hero1Titulo: "",
  hero1Descricao: "",
  hero1Imagem: "",
  hero1Botao: "",
  hero1Destino: "",
  hero1Tamanho: "",
  hero1Animacao: "",
  hero1Badge: "",
  hero1BadgeCor: "",
  hero2Tipo: "",
  hero2Curso: "",
  hero2Regime: "",
  hero2Titulo: "",
  hero2Descricao: "",
  hero2Imagem: "",
  hero2Botao: "",
  hero2Destino: "",
  hero2Tamanho: "",
  hero2Animacao: "",
  hero2Badge: "",
  hero2BadgeCor: "",
  ofertaKicker: "Oferta formativa",
  ofertaTitulo: "Encontre a formação certa para o seu momento.",
  ofertaPesquisa: "Pesquisar curso ou área...",
  metodoImagem: "https://images.unsplash.com/photo-1570616969692-54d6ba3d0397?auto=format&fit=crop&w=1200&q=80",
  metodoImagemAlt: "Sessão de formação colaborativa",
  metodoNota: "4,8/5",
  metodoNotaLegenda: "Satisfação média",
  metodoKicker: "Mais do que aprender",
  metodoTitulo: "Conhecimento que se transforma em ação.",
  metodoTexto: "Na ENA, cada percurso é desenhado para criar impacto real — no trabalho, nas equipas e na comunidade.",
  pilar1Numero: "01",
  pilar1Titulo: "Formadores no terreno",
  pilar1Texto: "Especialistas com experiência real e gosto por ensinar.",
  pilar2Numero: "02",
  pilar2Titulo: "Aprendizagem prática",
  pilar2Texto: "Casos, ferramentas e desafios que fazem parte do dia a dia.",
  pilar3Numero: "03",
  pilar3Titulo: "Acompanhamento próximo",
  pilar3Texto: "Uma equipa disponível antes, durante e depois da formação.",
  pilar4Numero: "04",
  pilar4Titulo: "Formatos flexíveis",
  pilar4Texto: "Presencial, online ou à medida da sua organização.",
  empresasKicker: "Formação à medida",
  empresasTitulo: "A sua organização tem desafios únicos.",
  empresasTexto: "Desenhamos programas que respondem às necessidades da sua equipa e aos objetivos do seu negócio.",
  empresasBotao: "Conhecer soluções",
  rodapeMarca: "ENA",
  rodapeTexto: "Capacitamos pessoas e organizações através de experiências de aprendizagem relevantes, práticas e transformadoras.",
  rodapeTituloContactos: "Contactos",
  rodapeEmail: "formacao@ena.pt",
  rodapeTelefone: "+351 210 000 000",
  rodapeHorario: "2ª a 6ª, 09h—18h",
  rodapeTituloLigacoes: "Ligações úteis",
  rodapeLigacaoFormacao: "Formação",
  rodapePrivacidade: "Política de privacidade",
  rodapePrivacidadeUrl: "https://ena.pt/politica-de-privacidade",
  rodapeReclamacoes: "Livro de reclamações",
  rodapeReclamacoesUrl: "https://www.livroreclamacoes.pt/Inicio/",
  rodapeEntidade: "ENA",
  rodapeDireitos: "Todos os direitos reservados.",
  rodapeLema: "Aprender. Evoluir. Transformar.",
} as const;

export type SiteChave = keyof typeof SITE_OMISSAO;

type CampoSite = { chave: SiteChave; etiqueta: string; tipo: "linha" | "texto" | "url" };

export const SITE_GRUPOS: { titulo: string; nota?: string; campos: CampoSite[] }[] = [
  {
    titulo: "Cabeçalho",
    campos: [
      { chave: "tituloSeparador", etiqueta: "Título do separador", tipo: "linha" },
      { chave: "marcaLinha1", etiqueta: "Marca, primeira linha", tipo: "linha" },
      { chave: "marcaLinha2", etiqueta: "Marca, segunda linha", tipo: "linha" },
      { chave: "navFormacao", etiqueta: "Ligação Formação", tipo: "linha" },
      { chave: "navEmpresas", etiqueta: "Ligação Empresas", tipo: "linha" },
      { chave: "navFormando", etiqueta: "Ligação da área de formando", tipo: "linha" },
      { chave: "navEntrar", etiqueta: "Botão Iniciar sessão", tipo: "linha" },
    ],
  },
  {
    titulo: "Destaque",
    nota: "O texto e a fotografia de fundo. Cada cartão escolhe o badge, o tamanho e a animação do botão. A pré-visualização mostra o rascunho.",
    campos: [
      { chave: "heroTitulo", etiqueta: "Título", tipo: "texto" },
      { chave: "heroTexto", etiqueta: "Texto", tipo: "texto" },
      { chave: "heroBotao", etiqueta: "Botão", tipo: "linha" },
      { chave: "heroImagem", etiqueta: "Fotografia (endereço https ou /imagens/…)", tipo: "url" },
      { chave: "heroImagemAlt", etiqueta: "Descrição da fotografia", tipo: "linha" },
    ],
  },
  {
    titulo: "Oferta formativa",
    nota: "A grelha de cursos vem das fichas e das turmas libertadas.",
    campos: [
      { chave: "ofertaKicker", etiqueta: "Antetítulo", tipo: "linha" },
      { chave: "ofertaTitulo", etiqueta: "Título", tipo: "texto" },
      { chave: "ofertaPesquisa", etiqueta: "Texto da pesquisa", tipo: "linha" },
    ],
  },
  {
    titulo: "Apresentação",
    campos: [
      { chave: "metodoImagem", etiqueta: "Fotografia (endereço https ou /imagens/…)", tipo: "url" },
      { chave: "metodoImagemAlt", etiqueta: "Descrição da fotografia", tipo: "linha" },
      { chave: "metodoNota", etiqueta: "Nota em destaque (ex.: 4,8/5). Vazio esconde o selo.", tipo: "linha" },
      { chave: "metodoNotaLegenda", etiqueta: "Legenda da nota", tipo: "linha" },
      { chave: "metodoKicker", etiqueta: "Antetítulo", tipo: "linha" },
      { chave: "metodoTitulo", etiqueta: "Título", tipo: "texto" },
      { chave: "metodoTexto", etiqueta: "Texto", tipo: "texto" },
      { chave: "pilar1Numero", etiqueta: "Pilar 1, número", tipo: "linha" },
      { chave: "pilar1Titulo", etiqueta: "Pilar 1, título", tipo: "linha" },
      { chave: "pilar1Texto", etiqueta: "Pilar 1, texto", tipo: "texto" },
      { chave: "pilar2Numero", etiqueta: "Pilar 2, número", tipo: "linha" },
      { chave: "pilar2Titulo", etiqueta: "Pilar 2, título", tipo: "linha" },
      { chave: "pilar2Texto", etiqueta: "Pilar 2, texto", tipo: "texto" },
      { chave: "pilar3Numero", etiqueta: "Pilar 3, número", tipo: "linha" },
      { chave: "pilar3Titulo", etiqueta: "Pilar 3, título", tipo: "linha" },
      { chave: "pilar3Texto", etiqueta: "Pilar 3, texto", tipo: "texto" },
      { chave: "pilar4Numero", etiqueta: "Pilar 4, número", tipo: "linha" },
      { chave: "pilar4Titulo", etiqueta: "Pilar 4, título", tipo: "linha" },
      { chave: "pilar4Texto", etiqueta: "Pilar 4, texto", tipo: "texto" },
    ],
  },
  {
    titulo: "Empresas",
    campos: [
      { chave: "empresasKicker", etiqueta: "Antetítulo", tipo: "linha" },
      { chave: "empresasTitulo", etiqueta: "Título", tipo: "texto" },
      { chave: "empresasTexto", etiqueta: "Texto", tipo: "texto" },
      { chave: "empresasBotao", etiqueta: "Botão", tipo: "linha" },
    ],
  },
  {
    titulo: "Rodapé",
    nota: "O ano do © é o ano corrente. Não se grava.",
    campos: [
      { chave: "rodapeMarca", etiqueta: "Sigla", tipo: "linha" },
      { chave: "rodapeTexto", etiqueta: "Texto de apresentação", tipo: "texto" },
      { chave: "rodapeTituloContactos", etiqueta: "Título dos contactos", tipo: "linha" },
      { chave: "rodapeEmail", etiqueta: "Email", tipo: "linha" },
      { chave: "rodapeTelefone", etiqueta: "Telefone", tipo: "linha" },
      { chave: "rodapeHorario", etiqueta: "Horário", tipo: "linha" },
      { chave: "rodapeTituloLigacoes", etiqueta: "Título das ligações", tipo: "linha" },
      { chave: "rodapeLigacaoFormacao", etiqueta: "Texto da ligação Formação", tipo: "linha" },
      { chave: "rodapePrivacidade", etiqueta: "Texto da política de privacidade", tipo: "linha" },
      { chave: "rodapePrivacidadeUrl", etiqueta: "Endereço da política de privacidade", tipo: "url" },
      { chave: "rodapeReclamacoes", etiqueta: "Texto do livro de reclamações", tipo: "linha" },
      { chave: "rodapeReclamacoesUrl", etiqueta: "Endereço do livro de reclamações", tipo: "url" },
      { chave: "rodapeEntidade", etiqueta: "Nome no copyright", tipo: "linha" },
      { chave: "rodapeDireitos", etiqueta: "Frase dos direitos", tipo: "linha" },
      { chave: "rodapeLema", etiqueta: "Lema", tipo: "linha" },
    ],
  },
];

export function textoSite(gravado: Record<string, string> | undefined, chave: SiteChave) {
  const valor = gravado?.[chave];
  if (valor === undefined) return SITE_OMISSAO[chave];
  return valor;
}

export function moradaSegura(valor: string) {
  const s = valor.trim();
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const url = new URL(s);
    if (url.protocol === "https:" || url.protocol === "http:") return s;
  } catch {
    return "";
  }
  return "";
}

export type HeroSlot = 1 | 2;

export type HeroPedido =
  | { modo: "automatico" }
  | { modo: "curso"; cursoId: string; descricao: string; botao: string; destino: string }
  | { modo: "regime"; regime: "gold" | "fin"; titulo: string; descricao: string; imagem: string; botao: string; destino: string };

export function heroPedido(ler: (chave: SiteChave) => string, slot: HeroSlot): HeroPedido {
  const prefixo = slot === 1 ? "hero1" : "hero2";
  const campo = (nome: string) => ler(`${prefixo}${nome}` as SiteChave).trim();
  const botao = campo("Botao");
  const destino = moradaSegura(campo("Destino"));
  const tipo = campo("Tipo");
  if (tipo === "curso") {
    const cursoId = campo("Curso");
    if (!cursoId) return { modo: "automatico" };
    return { modo: "curso", cursoId, descricao: campo("Descricao"), botao, destino };
  }
  if (tipo === "regime") {
    const regime = campo("Regime");
    if (regime !== "gold" && regime !== "fin") return { modo: "automatico" };
    return {
      modo: "regime",
      regime,
      titulo: campo("Titulo"),
      descricao: campo("Descricao"),
      imagem: moradaSegura(campo("Imagem")),
      botao,
      destino,
    };
  }
  return { modo: "automatico" };
}

export function descricaoDoCurso(area: string, descricao: string) {
  const limpa = descricao.trim();
  return limpa || area;
}

export function tituloRegime(regime: "gold" | "fin", titulo: string) {
  const limpo = titulo.trim();
  if (limpo) return limpo;
  return regime === "gold" ? "ENA Gold" : "Formação financiada";
}

export function botaoHero(pedido: Exclude<HeroPedido, { modo: "automatico" }>, inscricao?: "Acesso direto" | "Pré-inscrição") {
  if (pedido.botao) return pedido.botao;
  if (pedido.modo === "curso") return inscricao === "Acesso direto" ? "Inscrever-me agora" : "Pré-inscrever";
  return "Ver cursos";
}

export function destinoDoHero(pedido: Exclude<HeroPedido, { modo: "automatico" }>, cursoId?: string) {
  if (pedido.destino) return pedido.destino;
  if (pedido.modo === "curso" && cursoId) return `/formacao/${cursoId}`;
  if (pedido.modo === "regime") return pedido.regime === "gold" ? "/formacao?linha=gold" : "/formacao?linha=financiada";
  return "/formacao";
}

export function ligacaoExterna(href: string) {
  return /^https?:\/\//i.test(href);
}

export type HeroTamanho = "pequeno" | "medio" | "grande";
export type HeroAnimacao = "pulsar" | "brilho" | "saltar" | "abanar";

export function heroTamanho(ler: (chave: SiteChave) => string, slot: HeroSlot): HeroTamanho {
  const valor = ler(slot === 1 ? "hero1Tamanho" : "hero2Tamanho").trim();
  if (valor === "pequeno" || valor === "grande") return valor;
  return "medio";
}

export function heroAnimacao(ler: (chave: SiteChave) => string, slot: HeroSlot): HeroAnimacao | "" {
  const valor = ler(slot === 1 ? "hero1Animacao" : "hero2Animacao").trim();
  if (valor === "pulsar" || valor === "brilho" || valor === "saltar" || valor === "abanar") return valor;
  return "";
}

export function classeAnimacaoBotao(animacao: HeroAnimacao | "") {
  if (animacao === "pulsar") return "ena-botao-pulsar";
  if (animacao === "brilho") return "ena-botao-brilho";
  if (animacao === "saltar") return "ena-botao-saltar";
  if (animacao === "abanar") return "ena-botao-abanar";
  return "";
}

export type HeroBadgeCor = "ouro" | "vermelho" | "azul";

export function heroBadgeCor(ler: (chave: SiteChave) => string, slot: HeroSlot, ouro: boolean): HeroBadgeCor {
  const valor = ler(slot === 1 ? "hero1BadgeCor" : "hero2BadgeCor").trim();
  if (valor === "ouro" || valor === "vermelho" || valor === "azul") return valor;
  return ouro ? "ouro" : "vermelho";
}

export function heroBadge(ler: (chave: SiteChave) => string, slot: HeroSlot, ouro: boolean, automatico: string) {
  const escrito = ler(slot === 1 ? "hero1Badge" : "hero2Badge").trim();
  return { selo: escrito || automatico, seloCor: heroBadgeCor(ler, slot, ouro) };
}

export function classeSelo(cor: HeroBadgeCor) {
  if (cor === "vermelho") return "bg-[#A60000] text-white";
  if (cor === "azul") return "bg-[#14263D] text-white";
  return "bg-[#FFA900] text-[#14263D]";
}
