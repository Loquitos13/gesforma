// Modelo base da página inicial: o ponto de partida do editor (e o que o site mostra até haver uma versão publicada).
import type { Data } from "@puckeditor/core";
import type { PaginaSite } from "../../partilhado/siteBlocos";
import { AreaFormando } from "./blocosArea";
import { Catalogo } from "./blocosCatalogo";
import { CursoBanner, CursoDados, CursoFuncionamento, CursoObjetivos, CursoPrograma, CursoSintese, CursoTurmas } from "./blocosCurso";
import { blocosCartaoPadrao, CursoEscolhaLocal, CursoInscricao } from "./blocosCursoCartao";
import { ListaNoticias } from "./blocosNoticias";
import { Botao, Coluna, Imagem, Pilares, Seccao, Texto, Titulo } from "./blocosBase";
import { cartaoPadrao, CursosDestaque, OfertaFormativa } from "./blocosCursos";
import { Servicos } from "./blocosServicos";
import { ServicoBanner, ServicoDetalhe, ServicoGaleria, ServicoLogos, ServicoVideo } from "./blocosServico";
import { Testemunhos } from "./blocosTestemunhos";
import { CursoRelevantes } from "./blocosCursoRelevantes";
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
      hero, oferta, metodo, seccaoTestemunhos(), empresas,
      bloco("Rodape", rodapePadrao),
    ],
  } as Data;
}

/** Secção da página inicial com os testemunhos (arrasta-se para onde se quiser no editor). */
const seccaoTestemunhos = () => bloco("Seccao", Seccao.defaultProps, {
  espaco: 0,
  aparencia: estiloVazio({ ancora: "testemunhos", preenchimento: lados(80, 32), preenchimentoTel: lados(56, 20) }),
  conteudo: [bloco("Testemunhos", Testemunhos.defaultProps, { aparencia: estiloVazio() })],
});

/** Página inicial gravada antes dos testemunhos: ganha a secção antes do rodapé (uma vez; depois move-se à vontade). */
export function converterPaginaInicio(d: Data): Data {
  if (JSON.stringify(d.content ?? []).includes('"Testemunhos"')) return d;
  const lista = [...(d.content ?? [])] as No[];
  const rodape = lista.findIndex(b => b.type === "Rodape");
  // Ids próprios: os «…-base-N» do modelo podem já existir na página gravada.
  const seccao = seccaoTestemunhos() as No;
  const sufixo = Date.now().toString(36);
  seccao.props.id = `Seccao-testemunhos-${sufixo}`;
  (seccao.props.conteudo as No[])[0]!.props.id = `Testemunhos-${sufixo}`;
  lista.splice(rodape >= 0 ? rodape : lista.length, 0, seccao);
  return { ...d, content: lista as Data["content"] };
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
  const tipo = (tamanho: number, peso: "400" | "700") => tipoVazia({ tamanho, peso, alturaLinha: 1.4, cor: "var(--c-primaria)" });
  // Dois destaques ao lado da imagem do topo (cada um é uma caixa com título e texto, editáveis).
  const destaque = (titulo: string, texto: string, fundo: string) => bloco("Coluna", Coluna.defaultProps, {
    espaco: 2, aparencia: estiloVazio({ fundoCor: fundo, preenchimento: lados(16, 16) }),
    conteudo: [
      bloco("Texto", Texto.defaultProps, { texto: titulo, tipografia: tipo(18, "700") }),
      bloco("Texto", Texto.defaultProps, { texto, tipografia: tipo(14, "400") }),
    ],
  });
  return {
    root: { props: {} },
    content: [
      bloco("Seccao", Seccao.defaultProps, {
        disposicao: "grelha", colunas: 2, colunasTab: 1, colunasTel: 1, espaco: 48, alinharItens: "centro",
        aparencia: estiloVazio({ fundoCor: "var(--c-primaria)", preenchimento: lados(56, 32), preenchimentoTel: lados(40, 20) }),
        conteudo: [
          bloco("Coluna", Coluna.defaultProps, {
            espaco: 16,
            conteudo: [
              kicker("Formação à medida", "var(--c-acento)"),
              bloco("Titulo", Titulo.defaultProps, {
                texto: "A sua organização tem desafios únicos.", nivel: "h1",
                tipografia: tipoVazia({ fonte: "tema-titulos", tamanho: 44, tamanhoTel: 32, peso: "700", alturaLinha: 1.1, cor: "#ffffff" }),
              }),
              bloco("Texto", Texto.defaultProps, {
                texto: "Desenhamos programas que respondem às necessidades da sua equipa e aos objetivos do seu negócio.",
                tipografia: tipoVazia({ tamanho: 19, alturaLinha: 1.6, cor: "#D7E0EA" }), aparencia: estiloVazio({ larguraMax: em(560) }),
              }),
              bloco("Coluna", Coluna.defaultProps, {
                disposicao: "linha", espaco: 12, aparencia: estiloVazio({ margem: lados(8, 0, 0, 0) }),
                conteudo: [
                  bloco("Botao", Botao.defaultProps, { rotulo: "Pedir proposta", ligacao: "#proposta", cor: "var(--c-acento)", corTexto: "var(--c-primaria)", corHover: "#ffffff" }),
                  bloco("Botao", Botao.defaultProps, { rotulo: "Ver serviços", ligacao: "#servicos", variante: "contorno", cor: "#ffffff", corTexto: "#ffffff", corHover: "var(--c-acento)", seta: false }),
                ],
              }),
            ],
          }),
          bloco("Coluna", Coluna.defaultProps, {
            espaco: 12,
            conteudo: [
              bloco("Imagem", Imagem.defaultProps, {
                src: "https://images.unsplash.com/photo-1570616969692-54d6ba3d0397?auto=format&fit=crop&w=1200&q=80",
                alt: "Equipa numa sessão de formação", proporcao: "16/9",
              }),
              bloco("Coluna", Coluna.defaultProps, {
                disposicao: "linha", espaco: 12, alinharItens: "esticar",
                conteudo: [
                  destaque("Entidade certificada", "pela DGERT", "var(--c-acento)"),
                  destaque("Presencial, online ou misto", "no horário da sua equipa", "#ffffff"),
                ],
              }),
            ],
          }),
        ],
      }),
      bloco("Seccao", Seccao.defaultProps, {
        espaco: 16,
        aparencia: estiloVazio({ ancora: "servicos", fundoCor: "#F4F1EA", preenchimento: lados(48, 32), preenchimentoTel: lados(40, 20) }),
        conteudo: [
          kicker("Serviços"),
          bloco("Titulo", Titulo.defaultProps, { texto: "O que fazemos pela sua organização." }),
          bloco("Servicos", Servicos.defaultProps, { aparencia: estiloVazio({ margem: lados(12, 0, 0, 0) }) }),
        ],
      }),
      bloco("Seccao", Seccao.defaultProps, {
        espaco: 16,
        aparencia: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(48, 32), preenchimentoTel: lados(40, 20) }),
        conteudo: [
          kicker("Como trabalhamos"),
          bloco("Titulo", Titulo.defaultProps, { texto: "Do diagnóstico ao certificado." }),
          bloco("Pilares", Pilares.defaultProps, {
            colunas: 4, aparencia: estiloVazio({ margem: lados(12, 0, 0, 0) }),
            itens: [
              { numero: "01", titulo: "Diagnóstico", texto: "Percebemos as necessidades da equipa e os objetivos do negócio.", imagem: "" },
              { numero: "02", titulo: "Programa à medida", texto: "Conteúdos, horários e formato pensados para a sua organização.", imagem: "" },
              { numero: "03", titulo: "Formação certificada", texto: "Formadores com experiência no terreno e certificação.", imagem: "" },
              { numero: "04", titulo: "Acompanhamento", texto: "Avaliação de resultados e apoio depois da formação.", imagem: "" },
            ],
          }),
        ],
      }),
      bloco("Seccao", Seccao.defaultProps, {
        espaco: 14,
        aparencia: estiloVazio({ ancora: "proposta", fundoCor: "var(--c-primaria)", preenchimento: lados(56, 32), preenchimentoTel: lados(40, 20) }),
        conteudo: [
          kicker("Pedir proposta", "var(--c-acento)"),
          bloco("Titulo", Titulo.defaultProps, { texto: "Fale connosco sobre a sua equipa.", tipografia: tipoVazia({ fonte: "tema-titulos", tamanho: 36, tamanhoTel: 28, peso: "700", cor: "#ffffff" }) }),
          bloco("Texto", Texto.defaultProps, { texto: "Conte-nos o que precisa. Respondemos com uma proposta à medida.", tipografia: tipoVazia({ tamanho: 17, alturaLinha: 1.6, cor: "#D7E0EA" }) }),
          bloco("Botao", Botao.defaultProps, { rotulo: "Contactos", ligacao: "#contactos", cor: "var(--c-acento)", corTexto: "var(--c-primaria)", corHover: "#ffffff" }),
        ],
      }),
    ],
  } as Data;
}

function modeloServico(): Data {
  n = 0;
  // Uma só secção: os blocos sem conteúdo no serviço (ex.: sem vídeo) não ocupam espaço.
  return {
    root: { props: { previsualizar: "" } },
    content: [
      bloco("ServicoBanner", ServicoBanner.defaultProps),
      bloco("Seccao", Seccao.defaultProps, {
        espaco: 48, aparencia: estiloVazio({ preenchimento: lados(48, 32), preenchimentoTel: lados(36, 20) }),
        conteudo: [
          bloco("ServicoDetalhe", ServicoDetalhe.defaultProps),
          bloco("ServicoGaleria", ServicoGaleria.defaultProps),
          bloco("ServicoVideo", ServicoVideo.defaultProps),
          bloco("ServicoLogos", ServicoLogos.defaultProps),
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
    bloco("CursoFuncionamento", CursoFuncionamento.defaultProps, { aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) }),
    bloco("Testemunhos", Testemunhos.defaultProps),
    ...(sim("mostrarTurmas") ? [bloco("CursoTurmas", CursoTurmas.defaultProps, { titulo: txt("tituloTurmas", "Próximas turmas"), aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) })] : []),
    blocoRelevantes(),
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
  if (!temLocal.v || texto.includes('"textoPrepago"')) {
    dados = { ...dados, content: atualizarBlocosCurso((dados.content ?? []) as No[], temLocal) } as Data;
  }
  // Blocos que a página passou a ter (pedidos pela ENA): entram a seguir ao Programa, se ainda não lá estiverem.
  const novos = [
    !texto.includes('"CursoFuncionamento"') && bloco("CursoFuncionamento", CursoFuncionamento.defaultProps, { aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) }),
    !texto.includes('"Testemunhos"') && bloco("Testemunhos", Testemunhos.defaultProps),
  ].filter(Boolean) as No[];
  // Sem Programa na página, entram a seguir ao primeiro bloco de conteúdo que houver.
  if (novos.length) dados = inserirNaPrimeira(dados, ["CursoPrograma", "CursoObjetivos", "CursoEscolhaLocal", "CursoDados", "CursoSintese"], novos);
  // «Outros cursos relevantes» fecha a coluna do conteúdo: a seguir às turmas (ou ao último bloco conhecido que houver).
  if (!texto.includes('"CursoRelevantes"')) {
    const relevantes = blocoRelevantes() as No;
    relevantes.props.id = `CursoRelevantes-${Date.now().toString(36)}`;
    dados = inserirNaPrimeira(dados, ["CursoTurmas", "Testemunhos", "CursoFuncionamento", "CursoPrograma", "CursoObjetivos", "CursoEscolhaLocal", "CursoDados", "CursoSintese"], [relevantes]);
  }
  return dados;
}

/** Insere a seguir ao primeiro tipo de bloco (da lista, por ordem) que a página tiver; sem nenhum, fica como está. */
function inserirNaPrimeira(dados: Data, ancoras: string[], novos: No[]): Data {
  for (const ancora of ancoras) {
    const antes = (dados.content ?? []) as No[];
    const depois = inserirDepois(antes, ancora, novos);
    if (depois !== antes) return { ...dados, content: depois as Data["content"] };
  }
  return dados;
}

const blocoRelevantes = () => bloco("CursoRelevantes", CursoRelevantes.defaultProps, { aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }) });

/** Põe `novos` logo a seguir ao primeiro bloco do tipo `tipo` (procura também dentro das secções e colunas). */
function inserirDepois(lista: No[], tipo: string, novos: No[]): No[] {
  let feito = false;
  const andar = (l: No[]): No[] => l.flatMap(b => {
    if (feito) return [b];
    if (b.type === tipo) { feito = true; return [b, ...novos]; }
    const props = { ...b.props };
    for (const [k, v] of Object.entries(props)) if (!feito && Array.isArray(v) && v.every(ehNo)) props[k] = andar(v);
    return [{ ...b, props }];
  });
  const out = andar(lista);
  return feito ? out : lista;
}

/** Modelo base de cada página: o ponto de partida do editor e o que o site mostra sem versão publicada. */
export function modeloPagina(pagina: PaginaSite): Data {
  n = 0;
  if (pagina === "inicio") return modeloInicio();
  if (pagina === "noticias") return modeloNoticias();
  if (pagina === "empresas") return modeloEmpresas();
  if (pagina === "curso") return modeloCurso();
  if (pagina === "servico") return modeloServico();
  const unico = pagina === "catalogo" ? bloco("Catalogo", Catalogo.defaultProps)
    : bloco("AreaFormando", AreaFormando.defaultProps);
  return { root: { props: {} }, content: [unico] } as Data;
}
