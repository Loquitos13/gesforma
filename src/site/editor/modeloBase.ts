// Modelo base da página inicial: o ponto de partida do editor (e o que o site mostra até haver uma versão publicada).
import type { Data } from "@puckeditor/core";
import type { PaginaSite } from "../../partilhado/siteBlocos";
import { AreaFormando } from "./blocosArea";
import { Catalogo } from "./blocosCatalogo";
import { CursoBanner, CursoDados, CursoObjetivos, CursoPrograma, CursoSintese, CursoTurmas } from "./blocosCurso";
import { blocosCartaoPadrao, CursoEscolhaLocal, CursoInscricao } from "./blocosCursoCartao";
import { ListaNoticias } from "./blocosNoticias";
import { Botao, Coluna, Imagem, Pilares, Seccao, Texto, Titulo } from "./blocosBase";
import { cartaoPadrao, CursosDestaque, OfertaFormativa } from "./blocosCursos";
import { cabecalhoPadrao, rodapePadrao } from "./blocosMoldura";
import { temaPadrao } from "./config";
import { em, estiloVazio, lados, tipoVazia } from "./estilos";

let n = 0;
const bloco = <P extends object>(type: string, base: P | undefined, props: Partial<P> = {}) =>
  ({ type, props: { ...(base ?? {}), ...props, id: `${type}-base-${++n}` } });

const kicker = (texto: string, cor = "var(--c-destaque)") => bloco("Texto", Texto.defaultProps, {
  texto, tipografia: tipoVazia({ tamanho: 12, peso: "800", espacamento: 2.2, transformacao: "uppercase", cor }),
});

export function modeloInicio(): Data {
  n = 0;
  const hero = bloco("Seccao", Seccao.defaultProps, {
    disposicao: "grelha", colunas: 2, colunasTab: 1, colunasTel: 1, espaco: 48, alinharItens: "centro",
    aparencia: estiloVazio({ fundoCor: "var(--c-primaria)", preenchimento: lados(96, 32), preenchimentoTel: lados(56, 20), bordaTopo: 0 }),
    conteudo: [
      bloco("Coluna", Coluna.defaultProps, {
        espaco: 20,
        conteudo: [
          kicker("Formação certificada", "var(--c-acento)"),
          bloco("Titulo", Titulo.defaultProps, {
            texto: "Certifique o seu futuro com formação de referência.", nivel: "h1",
            tipografia: tipoVazia({ fonte: "tema-titulos", tamanho: 56, tamanhoTel: 36, alturaLinha: 1.05, cor: "#ffffff", peso: "700" }),
          }),
          bloco("Texto", Texto.defaultProps, {
            texto: "Formação de formadores com CCP e formação financiada com subsídio de alimentação.",
            tipografia: tipoVazia({ tamanho: 19, alturaLinha: 1.6, cor: "#D7E0EA" }),
          }),
          bloco("Botao", Botao.defaultProps, { rotulo: "Explorar todos os cursos", ligacao: "#formacao", cor: "var(--c-acento)", corTexto: "var(--c-primaria)", corHover: "#ffffff" }),
        ],
      }),
      bloco("CursosDestaque", CursosDestaque.defaultProps, {
        modo: "automatico", limite: 2,
        cartao: cartaoPadrao({ formato: "horizontal", colunas: 1, colunasTab: 1, mostrar: ["imagem", "regime", "titulo", "preco", "botao"], raio: 16, barraTopo: 0, sombra: "forte", interior: 20, textoBotao: "Inscrever" }),
      }),
    ],
  });

  const oferta = bloco("Seccao", Seccao.defaultProps, {
    espaco: 16,
    aparencia: estiloVazio({ ancora: "formacao", preenchimento: lados(96, 32), preenchimentoTel: lados(64, 20) }),
    conteudo: [
      kicker("Oferta formativa"),
      bloco("Titulo", Titulo.defaultProps, { texto: "Encontre a formação certa para o seu momento." }),
      bloco("OfertaFormativa", OfertaFormativa.defaultProps, { aparencia: estiloVazio({ margem: lados(24, 0, 0, 0) }) }),
    ],
  });

  const metodo = bloco("Seccao", Seccao.defaultProps, {
    disposicao: "grelha", colunas: 2, colunasTab: 1, colunasTel: 1, espaco: 56, alinharItens: "centro",
    aparencia: estiloVazio({ ancora: "metodo", fundoCor: "#ffffff", bordaTopo: 8, bordaCor: "var(--c-destaque)", preenchimento: lados(96, 32), preenchimentoTel: lados(64, 20) }),
    conteudo: [
      bloco("Imagem", Imagem.defaultProps, {
        src: "https://images.unsplash.com/photo-1570616969692-54d6ba3d0397?auto=format&fit=crop&w=1200&q=80",
        alt: "Sessão de formação colaborativa", proporcao: "4/3",
      }),
      bloco("Coluna", Coluna.defaultProps, {
        espaco: 18,
        conteudo: [
          kicker("Mais do que aprender"),
          bloco("Titulo", Titulo.defaultProps, { texto: "Conhecimento que se transforma em ação." }),
          bloco("Texto", Texto.defaultProps, { texto: "Na ENA, cada percurso é desenhado para criar impacto real — no trabalho, nas equipas e na comunidade." }),
          bloco("Pilares", Pilares.defaultProps, {
            aparencia: estiloVazio({ margem: lados(20, 0, 0, 0) }),
            itens: [
              { numero: "01", titulo: "Formadores no terreno", texto: "Especialistas com experiência real e gosto por ensinar.", imagem: "" },
              { numero: "02", titulo: "Aprendizagem prática", texto: "Casos, ferramentas e desafios que fazem parte do dia a dia.", imagem: "" },
              { numero: "03", titulo: "Acompanhamento próximo", texto: "Uma equipa disponível antes, durante e depois da formação.", imagem: "" },
              { numero: "04", titulo: "Formatos flexíveis", texto: "Presencial, online ou à medida da sua organização.", imagem: "" },
            ],
          }),
        ],
      }),
    ],
  });

  const empresas = bloco("Seccao", Seccao.defaultProps, {
    disposicao: "grelha", colunas: 2, colunasTab: 1, colunasTel: 1, alinharItens: "centro",
    aparencia: estiloVazio({ ancora: "empresas", fundoCor: "var(--c-acento)", preenchimento: lados(64, 32), preenchimentoTel: lados(48, 20) }),
    conteudo: [
      bloco("Coluna", Coluna.defaultProps, {
        espaco: 14,
        conteudo: [
          kicker("Formação à medida"),
          bloco("Titulo", Titulo.defaultProps, { texto: "A sua organização tem desafios únicos.", tipografia: tipoVazia({ fonte: "tema-titulos", tamanho: 38, tamanhoTel: 28, cor: "var(--c-primaria)" }) }),
          bloco("Texto", Texto.defaultProps, { texto: "Desenhamos programas que respondem às necessidades da sua equipa e aos objetivos do seu negócio.", tipografia: tipoVazia({ tamanho: 17, alturaLinha: 1.6, cor: "var(--c-primaria)" }) }),
        ],
      }),
      bloco("Botao", Botao.defaultProps, { rotulo: "Conhecer soluções", ligacao: "#contactos", aparencia: estiloVazio({ preenchimento: lados(20, 28), alinhar: "fim", largura: em(100, "%"), larguraMax: em(360) }) }),
    ],
  });

  return {
    root: { props: { ...temaPadrao } },
    content: [
      bloco("Cabecalho", cabecalhoPadrao, { ligacoes: [{ rotulo: "Formação", ligacao: "/formacao" }, { rotulo: "Notícias", ligacao: "/noticias" }, { rotulo: "Empresas", ligacao: "/empresas" }] }),
      hero, oferta, metodo, empresas,
      bloco("Rodape", rodapePadrao),
    ],
  } as Data;
}

// ─── Outras páginas (o cabeçalho, o rodapé e o tema vêm da página inicial) ───

function modeloNoticias(): Data {
  return {
    root: { props: {} },
    content: [bloco("Seccao", Seccao.defaultProps, {
      espaco: 12,
      aparencia: estiloVazio({ preenchimento: lados(56, 32), preenchimentoTel: lados(40, 20) }),
      conteudo: [
        kicker("ENA"),
        bloco("Titulo", Titulo.defaultProps, { texto: "Notícias", nivel: "h1" }),
        bloco("Texto", Texto.defaultProps, { texto: "Novidades, eventos e artigos da ENA." }),
        bloco("ListaNoticias", ListaNoticias.defaultProps, { aparencia: estiloVazio({ margem: lados(24, 0, 0, 0) }) }),
      ],
    })],
  } as Data;
}

function modeloEmpresas(): Data {
  return {
    root: { props: {} },
    content: [
      bloco("Seccao", Seccao.defaultProps, {
        espaco: 20,
        aparencia: estiloVazio({ fundoCor: "var(--c-primaria)", preenchimento: lados(96, 32), preenchimentoTel: lados(56, 20) }),
        conteudo: [
          kicker("Formação à medida", "var(--c-acento)"),
          bloco("Titulo", Titulo.defaultProps, {
            texto: "A sua organização tem desafios únicos.", nivel: "h1",
            tipografia: tipoVazia({ fonte: "tema-titulos", tamanho: 56, tamanhoTel: 36, peso: "700", alturaLinha: 1.05, cor: "#ffffff" }),
            aparencia: estiloVazio({ larguraMax: em(820) }),
          }),
          bloco("Texto", Texto.defaultProps, {
            texto: "Desenhamos programas que respondem às necessidades da sua equipa e aos objetivos do seu negócio.",
            tipografia: tipoVazia({ tamanho: 19, alturaLinha: 1.6, cor: "#D7E0EA" }), aparencia: estiloVazio({ larguraMax: em(680) }),
          }),
          bloco("Botao", Botao.defaultProps, { rotulo: "Falar connosco", ligacao: "#contactos", cor: "var(--c-acento)", corTexto: "var(--c-primaria)", corHover: "#ffffff" }),
        ],
      }),
      bloco("Seccao", Seccao.defaultProps, {
        espaco: 16,
        aparencia: estiloVazio({ preenchimento: lados(80, 32), preenchimentoTel: lados(56, 20) }),
        conteudo: [
          kicker("Como trabalhamos"),
          bloco("Titulo", Titulo.defaultProps, { texto: "Do diagnóstico ao certificado." }),
          bloco("Pilares", Pilares.defaultProps, {
            colunas: 4, aparencia: estiloVazio({ margem: lados(24, 0, 0, 0) }),
            itens: [
              { numero: "01", titulo: "Diagnóstico", texto: "Percebemos as necessidades da equipa e os objetivos do negócio.", imagem: "" },
              { numero: "02", titulo: "Programa à medida", texto: "Conteúdos, horários e formato pensados para a sua organização.", imagem: "" },
              { numero: "03", titulo: "Formação certificada", texto: "Formadores com experiência no terreno e certificação.", imagem: "" },
              { numero: "04", titulo: "Acompanhamento", texto: "Avaliação de resultados e apoio depois da formação.", imagem: "" },
            ],
          }),
        ],
      }),
    ],
  } as Data;
}

type Legado = Record<string, unknown> & { zonaTopo?: unknown[]; zonaConteudo?: unknown[]; zonaCartao?: unknown[] };

/** Texto antigo por omissão (o pedido de dados vinha antes da turma): passa ao texto novo. */
const TEXTO_PRE_ANTIGO = "A pré-inscrição pede os seus dados e, quando existir, a turma. O pedido fica registado e sai o email automático.";

/** Cartão de inscrição feito de blocos; `antigo` traz os textos e os blocos do cartão gravado antes. */
function cartaoEmBlocos(antigo: Record<string, unknown> = {}, extra: unknown[] = [], id?: string) {
  const textos: Record<string, string> = {};
  for (const k of ["textoPrepago", "textoPreinscricao", "textoDireto"]) {
    const v = antigo[k];
    if (typeof v === "string" && v.trim() && v !== TEXTO_PRE_ANTIGO) textos[k] = v;
  }
  const filhos = blocosCartaoPadrao(textos)
    .filter(b => b.type !== "CursoImagem" || antigo.mostrarImagem !== false)
    .map(b => bloco(b.type, b.props as object));
  const novo = bloco("CursoInscricao", CursoInscricao.defaultProps, { conteudo: [...filhos, ...extra] as never });
  if (id) (novo.props as { id: string }).id = id;
  return novo;
}

const escolhaLocal = () => bloco("CursoEscolhaLocal", CursoEscolhaLocal.defaultProps, { aparencia: estiloVazio({ margem: lados(32, 0, 0, 0) }) });

/**
 * Página do curso em blocos soltos: banner, depois uma grelha com o conteúdo (2 colunas) e o cartão (1 coluna).
 * Com `antigo` (o bloco único «Página do curso»), mantém os textos, as opções e os blocos que lá estavam.
 */
export function modeloCurso(antigo?: Legado): Data {
  n = 0;
  const a = antigo ?? {};
  const sim = (k: string) => a[k] !== false;
  const txt = (k: string, padrao: string) => (typeof a[k] === "string" ? String(a[k]) : padrao);
  const extra = (k: "zonaTopo" | "zonaConteudo" | "zonaCartao") => (Array.isArray(a[k]) ? a[k] as never[] : []);
  const principal = [
    bloco("CursoSintese", CursoSintese.defaultProps, { etiqueta: txt("tituloSintese", "Síntese") }),
    ...(sim("mostrarDados") ? [bloco("CursoDados", CursoDados.defaultProps, { aparencia: estiloVazio({ margem: lados(32, 0, 0, 0) }) })] : []),
    escolhaLocal(),
    ...extra("zonaConteudo"),
    ...(sim("mostrarObjetivos") ? [bloco("CursoObjetivos", CursoObjetivos.defaultProps, { titulo: txt("tituloObjetivos", "Objetivos"), aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) })] : []),
    ...(sim("mostrarPrograma") ? [bloco("CursoPrograma", CursoPrograma.defaultProps, { titulo: txt("tituloPrograma", "Programa"), aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) })] : []),
    ...(sim("mostrarTurmas") ? [bloco("CursoTurmas", CursoTurmas.defaultProps, { titulo: txt("tituloTurmas", "Próximas turmas"), aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) })] : []),
  ];
  const cartao = sim("mostrarCartao");
  const grelha = bloco("Seccao", Seccao.defaultProps, {
    disposicao: cartao ? "grelha" : "pilha", colunas: 3, colunasTab: 1, colunasTel: 1, espaco: 48, alinharItens: "inicio",
    aparencia: estiloVazio({ preenchimento: lados(64, 32), preenchimentoTel: lados(48, 20) }),
    conteudo: [
      bloco("Coluna", Coluna.defaultProps, { ocupar: cartao ? 2 : null, espaco: 0, conteudo: principal }),
      ...(cartao ? [cartaoEmBlocos({ ...a, mostrarImagem: sim("mostrarImagemCartao") }, extra("zonaCartao"))] : []),
    ],
  });
  return {
    root: { props: { previsualizar: txt("previsualizar", "") } },
    content: [
      ...(sim("mostrarBanner") ? [bloco("CursoBanner", CursoBanner.defaultProps, { voltar: txt("voltar", "Voltar à formação") })] : []),
      ...extra("zonaTopo"),
      grelha,
    ],
  } as Data;
}

type No = { type: string; props: Record<string, unknown> };
const ehNo = (v: unknown): v is No => Boolean(v && typeof v === "object" && typeof (v as No).type === "string" && (v as No).props);

/**
 * Cartão gravado antes de ser feito de blocos (com os textos no próprio cartão) passa a blocos, e a
 * página ganha a escolha do local a seguir aos dados, se ainda não a tiver. Percorre todos os espaços de blocos.
 */
function atualizarBlocosCurso(lista: No[], temLocal: { v: boolean }): No[] {
  const out: No[] = [];
  for (const b of lista) {
    let atual = b;
    if (b.type === "CursoInscricao" && typeof b.props.textoPrepago === "string") {
      atual = cartaoEmBlocos(b.props, Array.isArray(b.props.conteudo) ? b.props.conteudo : [], String(b.props.id ?? "")) as No;
    } else {
      const props = { ...b.props };
      for (const [k, v] of Object.entries(props)) {
        if (Array.isArray(v) && v.every(ehNo)) props[k] = atualizarBlocosCurso(v, temLocal);
      }
      atual = { ...b, props };
    }
    out.push(atual);
    if (b.type === "CursoDados" && !temLocal.v) { out.push(escolhaLocal() as No); temLocal.v = true; }
  }
  return out;
}

/** Página do curso gravada em versões anteriores: passa à estrutura actual (o resto da página fica igual). */
export function converterPaginaCurso(d: Data): Data {
  let dados = d;
  const lista = (d.content ?? []) as { type: string; props: Legado }[];
  const i = lista.findIndex(b => b.type === "DetalheCurso");
  if (i >= 0) {
    const novo = modeloCurso(lista[i]!.props);
    dados = { ...d, root: { ...(d.root ?? {}), props: { ...((d.root as { props?: object })?.props ?? {}), ...(novo.root as { props: object }).props } }, content: [...lista.slice(0, i), ...novo.content, ...lista.slice(i + 1)] } as Data;
  }
  const texto = JSON.stringify(dados.content ?? []);
  const temLocal = { v: texto.includes('"CursoEscolhaLocal"') };
  if (temLocal.v && !texto.includes('"textoPrepago"')) return dados;
  return { ...dados, content: atualizarBlocosCurso((dados.content ?? []) as No[], temLocal) } as Data;
}

/** Modelo base de cada página: o ponto de partida do editor e o que o site mostra sem versão publicada. */
export function modeloPagina(pagina: PaginaSite): Data {
  n = 0;
  if (pagina === "inicio") return modeloInicio();
  if (pagina === "noticias") return modeloNoticias();
  if (pagina === "empresas") return modeloEmpresas();
  if (pagina === "curso") return modeloCurso();
  const unico = pagina === "catalogo" ? bloco("Catalogo", Catalogo.defaultProps)
    : bloco("AreaFormando", AreaFormando.defaultProps);
  return { root: { props: {} }, content: [unico] } as Data;
}
