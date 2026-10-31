export const SITE_OMISSAO = {
  tituloSeparador: "ENA | Escola de Negócios e Administração",
  marcaLinha1: "Escola de",
  marcaLinha2: "Negócios e Administração",
  navFormacao: "Formação",
  navNoticias: "Notícias",
  navEmpresas: "Empresas",
  navFormando: "Área de formando",
  navEntrar: "Iniciar Sessão",
  heroTitulo: "Certifique o seu futuro com formação de referência.",
  heroTexto: "Formação de formadores com CCP e formação financiada com subsídio de alimentação.",
  heroBotao: "Explorar todos os cursos",
  heroImagem: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80",
  heroImagemAlt: "Sessão de formação em sala",
  heroDisposicao: "texto-esquerda",
  heroContentorLargura: "100",
  heroContentorAltura: "100",
  heroForma: "circulo",
  heroFormaCor: "#A60000",
  heroFormaEspessura: "14",
  heroFormaX: "0",
  heroFormaY: "0",
  heroFormaTamanho: "100",
  heroTituloTamanho: "100",
  heroTextoTamanho: "100",
  heroTextoX: "0",
  heroTextoY: "0",
  heroBotaoTamanho: "100",
  heroBotaoX: "0",
  heroBotaoY: "0",
  margemCabecalhoX: "0",
  margemCabecalhoY: "0",
  margemDestaqueX: "0",
  margemDestaqueY: "0",
  margemOfertaX: "0",
  margemOfertaY: "0",
  margemApresentacaoX: "0",
  margemApresentacaoY: "0",
  margemEmpresasX: "0",
  margemEmpresasY: "0",
  margemRodapeX: "0",
  margemRodapeY: "0",
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
  evaNome: "Eva",
  /** Número de WhatsApp da ENA (com indicativo, ex.: 351912345678): «Falar com um operador» abre a conversa com ele. */
  evaWhatsapp: "",
  evaBoasVindas: "Olá! Sou a Eva, assistente virtual da ENA. Em menos de dois minutos ajudo a encontrar a formação certa e a tratar da inscrição.",
  evaObjetivos: "Evoluir na carreira\nCompetências digitais | Digital\nGestão e liderança | Gestão, Competências\nSaúde e segurança | Saúde, Segurança",
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
  rodapeEmail: "",
  rodapeTelefone: "",
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

export function objectivosEva(texto: string) {
  return texto.split("\n").map(linha => {
    const [rotulo, areas] = linha.split("|");
    return {
      rotulo: (rotulo ?? "").trim(),
      areas: (areas ?? "").split(",").map(parte => parte.trim()).filter(Boolean),
    };
  }).filter(item => item.rotulo);
}

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

export type InscricaoPublica = "Acesso direto" | "Pré-pago" | "Pré-inscrição";

export function ePreinscricao(inscricao?: string) {
  return inscricao === "Pré-inscrição";
}

export function ePrepago(inscricao?: string) {
  return inscricao === "Pré-pago";
}

export function rotuloBotaoInscricao(inscricao?: string) {
  if (ePreinscricao(inscricao)) return "Pré-inscrever";
  if (ePrepago(inscricao)) return "Inscrever-me agora";
  return "Pagamento/Inscrição";
}

/** Texto do cartão de inscrição no acesso direto (o antigo dizia que não havia formulário: agora há dados e pagamento). */
export const TEXTO_DIRETO = "Primeiro recolhemos os seus dados. O pagamento fica no passo seguinte e, depois dele, recebe o acesso ao curso.";
export function textoDiretoAtual(texto: string | undefined) {
  return texto && /abre no Moodle\. Não há formulário/.test(texto) ? TEXTO_DIRETO : texto ?? "";
}
