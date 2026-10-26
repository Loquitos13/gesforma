// Página do curso: escolha do local e cartão de inscrição feito de blocos (imagem, textos com variáveis
// do curso e botão). O local escolhido é da página: os dados, as turmas, o preço e o botão seguem-no.
import { videoDoCurso } from "../../partilhado/siteServicos";
import type { ComponentType } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { ePrepago, ePreinscricao, rotuloBotaoInscricao, TEXTO_DIRETO, textoDiretoAtual } from "../../partilhado/siteConteudo";
import { useInscricaoOpcional } from "../SiteInscricao";
import { Icon, type Course } from "../SiteLanding";
import {
  ajudaVariaveis, Caixa, campoEntreTitulo, locaisDo, precoNoLocal, preencherVariaveis, Titulo, useLocalCurso, variaveisCurso, ZonaEntreTitulo, type Base, CursoVideo, LeitorVideo,
} from "./blocosCurso";
import { campoCor, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { textoAutomaticoCurso } from "./textosLocais";
import { corSegura, estiloTexto, estiloVazio, juntar, tipoVazia, type Tipografia } from "./estilos";

// ─── Escolha do local ────────────────────────────────────────────────────────

/** Aspeto dos cartões de local (vazio = o aspeto de sempre). */
type CartaoLocal = {
  alturaMin: number | null; espaco: number | null; interior: number | null; raio: number | null;
  sombra: "" | "nenhuma" | "suave" | "media" | "forte"; corFundo: string; corAtivo: string; centrar: boolean;
  tNome: Tipografia; tMorada: Tipografia; tPreco: Tipografia; tTexto: Tipografia;
};
/** Botão (CTA) dentro de cada cartão: o cartão inteiro é clicável, o botão é o convite visual. */
type BotaoLocal = {
  mostrar: boolean; texto: string; cor: string; corTexto: string;
  posicao: "esquerda" | "centro" | "direita" | "largura"; raio: number | null; seta: boolean; tipografia: Tipografia;
};

type LocalProps = Base & {
  titulo: string; tTitulo: Tipografia; entreTitulo: Slot; texto: string; textoPreco: string; mostrarPreco: boolean; mostrarMorada: boolean; abrirPedido: boolean;
  colunas: number | null; colunasTab: number | null; colunasTel: number | null;
  cartao: CartaoLocal; botao: BotaoLocal;
  contactosTitulo: string; tContactos: Tipografia;
};

/** Contactos para dúvidas de um local (aparecem no cartão desse local). */
type ContactoLocal = { local: string; telemovel?: string; telefone: string; email: string; whatsapp: string };

const chaveLocal = (s: string) => s.trim().toLowerCase();
const temContacto = (c: ContactoLocal | undefined) => Boolean(c && (c.telemovel?.trim() || c.telefone?.trim() || c.email?.trim() || c.whatsapp?.trim()));
/** Os gravados no backoffice: Locais, ou a ficha do curso quando o local lhe está atribuído. */
const contactoDo = (curso: Course, local: string) => {
  const c = (curso.contactosLocais ?? []).find(x => chaveLocal(x.local) === chaveLocal(local));
  return temContacto(c) ? c! : null;
};

/** wa.me só aceita algarismos com o indicativo; um número português de 9 algarismos ganha o 351. */
function ligacaoWhatsapp(numero: string) {
  const d = numero.replace(/\D/g, "");
  return `https://wa.me/${d.length === 9 ? `351${d}` : d}`;
}

const cartaoLocalPadrao = (): CartaoLocal => ({
  alturaMin: 96, espaco: 16, interior: 20, raio: 0, sombra: "", corFundo: "#ffffff", corAtivo: "var(--c-destaque)", centrar: false,
  tNome: tipoVazia(), tMorada: tipoVazia(), tPreco: tipoVazia(), tTexto: tipoVazia(),
});
const botaoLocalPadrao = (): BotaoLocal => ({
  mostrar: false, texto: "Escolher {{local}}", cor: "var(--c-destaque)", corTexto: "#ffffff", posicao: "largura", raio: 0, seta: true, tipografia: tipoVazia(),
});

const SOMBRA_LOCAL = {
  "": "0 8px 24px rgba(18,52,59,.08)", nenhuma: "none", suave: "0 6px 18px rgba(20,38,61,.08)",
  media: "0 14px 36px rgba(20,38,61,.16)", forte: "0 28px 70px rgba(8,18,32,.32)",
};
const POSICAO_BOTAO = { esquerda: "self-start", centro: "self-center", direita: "self-end", largura: "self-stretch justify-between" };

export const CursoEscolhaLocal: ComponentConfig<LocalProps> = {
  label: "Curso · Escolha do local",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder). «{{titulo_locais}}» muda com o curso: onde, quando e como" },
    tTitulo: campoTipografia("Tipografia do título"),
    entreTitulo: campoEntreTitulo,
    texto: { type: "textarea", label: `Texto em cada cartão (vazio = nenhum). ${ajudaVariaveis}` },
    textoPreco: { type: "text", label: "Texto do preço (vazio = o preço do local). Ex.: «Desde {{preco}}» ou «{{preco}} · IVA incluído»" },
    mostrarMorada: simNao("Morada de cada local (Edição de cursos › Locais)"),
    mostrarPreco: simNao("Preço em cada local"),
    abrirPedido: simNao("Ao clicar num local, abre logo a pré-inscrição"),
    colunas: campoNumero("Colunas (computador)", ""),
    colunasTab: campoNumero("Colunas (tablet)", ""),
    colunasTel: campoNumero("Colunas (telemóvel)", ""),
    cartao: {
      type: "object", label: "Cartões",
      objectFields: {
        alturaMin: campoNumero("Altura mínima"),
        espaco: campoNumero("Espaço entre cartões"),
        interior: campoNumero("Espaço interior"),
        raio: campoNumero("Cantos arredondados"),
        sombra: {
          type: "select", label: "Sombra",
          options: [{ label: "Normal", value: "" }, { label: "Nenhuma", value: "nenhuma" }, { label: "Suave", value: "suave" }, { label: "Média", value: "media" }, { label: "Forte", value: "forte" }],
        },
        corFundo: campoCor("Fundo do cartão"),
        corAtivo: campoCor("Cor do local escolhido (borda e visto)"),
        centrar: simNao("Conteúdo centrado"),
        tNome: campoTipografia("Tipografia do nome do local"),
        tMorada: campoTipografia("Tipografia da morada"),
        tPreco: campoTipografia("Tipografia do preço"),
        tTexto: campoTipografia("Tipografia do texto"),
      },
    },
    botao: {
      type: "object", label: "Botão em cada cartão",
      objectFields: {
        mostrar: simNao("Mostrar o botão"),
        texto: { type: "text", label: `Texto (na pré-inscrição é sempre «Pré-inscrever» e no acesso direto «Pagamento/Inscrição», com seta). ${ajudaVariaveis}` },
        cor: campoCor("Cor do botão"),
        corTexto: campoCor("Cor do texto"),
        posicao: {
          type: "select", label: "Posição",
          options: [{ label: "Largura toda", value: "largura" }, { label: "Esquerda", value: "esquerda" }, { label: "Centro", value: "centro" }, { label: "Direita", value: "direita" }],
        },
        raio: campoNumero("Cantos arredondados"),
        seta: simNao("Seta"),
        tipografia: campoTipografia("Tipografia do botão"),
      },
    },
    contactosTitulo: { type: "text", label: "Título dos contactos em cada local (vazio = sem título). Os contactos vêm do backoffice: Edição de cursos › Locais, ou a ficha do curso" },
    tContactos: campoTipografia("Tipografia dos contactos"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    contactosTitulo: "Dúvidas? Fale connosco", tContactos: tipoVazia(),
    titulo: "{{titulo_locais}}", tTitulo: tipoVazia(), entreTitulo: [], texto: "", textoPreco: "{{preco}}", mostrarMorada: true, mostrarPreco: true,
    abrirPedido: true, colunas: 3, colunasTab: 2, colunasTel: 1, cartao: cartaoLocalPadrao(), botao: botaoLocalPadrao(), aparencia: estiloVazio(),
  },
  render: p => <EscolhaLocal {...p} />,
};

// No render, o espaço de blocos já chega como componente (não como lista).
function EscolhaLocal(p: Omit<LocalProps, "entreTitulo"> & { entreTitulo?: unknown }) {
  const { local, setLocal, editar } = useLocalCurso();
  const { abrir } = useInscricaoOpcional();
  // Páginas gravadas antes destas opções não as têm: ficam com o aspeto de sempre.
  const c = { ...cartaoLocalPadrao(), ...p.cartao };
  const b = { ...botaoLocalPadrao(), ...p.botao };
  const ativoCor = corSegura(c.corAtivo) ?? "var(--c-destaque)";
  const tNome = estiloTexto(c.tNome);
  const tMorada = estiloTexto(c.tMorada);
  const tPreco = estiloTexto(c.tPreco);
  const tTexto = estiloTexto(c.tTexto);
  const tBotao = estiloTexto(b.tipografia);
  const tContactos = estiloTexto(p.tContactos);
  return (
    <Caixa p={p}>
      {curso => {
        const comTurmas = locaisDo(curso);
        // Locais atribuídos ao curso ainda sem turmas também aparecem (com os contactos, se tiverem), sem abrir a pré-inscrição.
        const semTurmas = [...(curso.locais ?? []).map(x => x.nome), ...(curso.contactosLocais ?? []).map(x => x.local)]
          .filter((l, i, todos) => todos.findIndex(x => chaveLocal(x) === chaveLocal(l)) === i)
          .filter(l => !comTurmas.some(t => chaveLocal(t) === chaveLocal(l)));
        const locais = [...comTurmas, ...semTurmas];
        if (!locais.length) return null;
        // Pré-inscrição e acesso direto não precisam de datas: qualquer local registado (Sala Virtual incluída) mostra o
        // botão, mesmo sem turmas, sempre com o mesmo texto e a seta («Pré-inscrever» / «Pagamento/Inscrição»).
        const preinscricao = ePreinscricao(curso.enrollment);
        const acessoDireto = !preinscricao && !ePrepago(curso.enrollment);
        // Pré-pago sem datas (acesso imediato, ex.: e-learning assíncrono): também abre o pedido («Inscrever-me agora»).
        const rotuloFixo = preinscricao || acessoDireto ? rotuloBotaoInscricao(curso.enrollment)
          : ePrepago(curso.enrollment) && !comTurmas.length ? rotuloBotaoInscricao(curso.enrollment) : "";
        return (
          <fieldset>
            {p.titulo && <legend className="mb-4"><Titulo texto={textoAutomaticoCurso(preencherVariaveis(p.titulo, variaveisCurso(curso, local)), curso)} t={p.tTitulo} className="font-serif text-2xl" /></legend>}
            <ZonaEntreTitulo zona={p.entreTitulo} />
            {/* Cartões grandes (nome, morada e preço), em grelha, como no site da ENA. */}
            <div className="ena-grelha mt-4" style={{
              gap: `${c.espaco ?? 16}px`,
              ["--cols" as string]: String(p.colunas || 3), ["--cols-tab" as string]: String(p.colunasTab || 2), ["--cols-tel" as string]: String(p.colunasTel || 1),
            }}>
              {locais.map(l => {
                const ativo = local === l;
                const semDatas = semTurmas.includes(l) && !rotuloFixo;
                const morada = curso.sessoes.find(s => s.local === l && s.morada)?.morada
                  || (curso.locais ?? []).find(x => chaveLocal(x.nome) === chaveLocal(l))?.morada;
                const vars = variaveisCurso(curso, l);
                const texto = preencherVariaveis(p.texto ?? "", vars).trim();
                const ct = contactoDo(curso, l);
                // Na Financiada não há preço («Desde Financiada» não diz nada): o cartão não o mostra.
                const verPreco = p.mostrarPreco && curso.funding === "Gold";
                const pad = `${c.interior ?? 20}px`;
                return (
                  <div key={l} className={juntar("flex flex-col border-2 transition", !ativo && "hover:border-black/15")}
                    style={{
                      minHeight: c.alturaMin ? `${c.alturaMin}px` : undefined,
                      borderRadius: c.raio ? `${c.raio}px` : undefined, boxShadow: SOMBRA_LOCAL[c.sombra] ?? SOMBRA_LOCAL[""],
                      background: corSegura(c.corFundo) ?? "#ffffff", borderColor: ativo ? ativoCor : "transparent",
                    }}>
                  <button type="button" aria-pressed={ativo} aria-disabled={semDatas || undefined} onClick={() => {
                      if (semDatas) return;
                      // No site, o clique escolhe o local e abre o pedido já nele (datas de início e horário).
                      if (p.abrirPedido !== false && !editar) { setLocal(l); abrir(curso, { local: l }); return; }
                      setLocal(ativo && locais.length > 1 ? "" : l);
                    }}
                    className={juntar("flex flex-1 flex-col gap-2", c.centrar ? "items-center text-center" : "items-start text-left")}
                    style={{ padding: pad, paddingBottom: ct ? 0 : pad }}>
                    <span className={juntar("flex w-full items-start gap-3", c.centrar ? "justify-center" : "justify-between")}>
                      <strong className={juntar("text-sm font-extrabold uppercase tracking-[0.04em] text-[var(--c-primaria)]", tNome.className)} style={tNome.style}>{l}</strong>
                      {ativo && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white" style={{ background: ativoCor }}><Icon name="check" className="h-3 w-3" /></span>}
                    </span>
                    {p.mostrarMorada && morada && <span className={juntar("text-xs leading-5 opacity-65", tMorada.className)} style={tMorada.style}>{morada}</span>}
                    {texto && <span className={juntar("whitespace-pre-line text-sm leading-6 opacity-75", tTexto.className)} style={tTexto.style}>{texto}</span>}
                    {semDatas
                      ? <span className="mt-auto text-sm font-bold opacity-60">Próximas datas em breve</span>
                      : verPreco && <span className={juntar("mt-auto text-sm font-bold text-[var(--c-destaque)]", tPreco.className)} style={tPreco.style}>{preencherVariaveis(p.textoPreco || "{{preco}}", vars)}</span>}
                    {/* Não pode haver um botão dentro de outro: o cartão inteiro faz a ação, isto é só o aspeto. */}
                    {(b.mostrar || rotuloFixo) && !semDatas && (
                      <span className={juntar("mt-2 inline-flex items-center gap-3 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.08em]", POSICAO_BOTAO[b.posicao] ?? POSICAO_BOTAO.largura, !verPreco && "mt-auto", tBotao.className)}
                        style={{ ...tBotao.style, background: corSegura(b.cor) ?? "var(--c-destaque)", color: corSegura(b.corTexto) ?? "#ffffff", borderRadius: b.raio ? `${b.raio}px` : undefined }}>
                        {rotuloFixo || preencherVariaveis(b.texto || "Escolher", vars)} {(b.seta || rotuloFixo) && <Icon name="arrow" />}
                      </span>
                    )}
                  </button>
                  {ct && (
                    <div className={juntar("mt-3 flex flex-col gap-1 border-t border-black/10 pt-3 text-xs", c.centrar ? "items-center text-center" : "items-start")}
                      style={{ padding: `12px ${pad} ${pad}`, ...tContactos.style }}>
                      {p.contactosTitulo && <span className="font-bold opacity-70">{p.contactosTitulo}</span>}
                      {([
                        ["Telemóvel", ct.telemovel, ct.telemovel && `tel:${ct.telemovel.replace(/[^\d+]/g, "")}`],
                        ["Telefone", ct.telefone, ct.telefone && `tel:${ct.telefone.replace(/[^\d+]/g, "")}`],
                        ["Email", ct.email, ct.email && `mailto:${ct.email}`],
                        ["WhatsApp", ct.whatsapp, ct.whatsapp && ligacaoWhatsapp(ct.whatsapp)],
                      ] as const).filter(([, v]) => v?.trim()).map(([rotulo, v, href]) => (
                        <span key={rotulo}>
                          <span className="opacity-70">{rotulo}: </span>
                          <a href={href || undefined} {...(rotulo === "WhatsApp" ? { target: "_blank", rel: "noreferrer" } : {})} className="font-semibold hover:underline">{v}</a>
                        </span>
                      ))}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      }}
    </Caixa>
  );
}

// ─── Texto com variáveis do curso ────────────────────────────────────────────

const ESTILOS_TEXTO = {
  etiqueta: { tag: "p", cls: "text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--c-destaque)]" },
  titulo: { tag: "h2", cls: "font-serif text-3xl" },
  destaque: { tag: "p", cls: "font-serif text-3xl" },
  texto: { tag: "p", cls: "text-sm leading-6 opacity-65" },
} as const;

type TextoProps = Base & {
  texto: string; estilo: keyof typeof ESTILOS_TEXTO; tipografia: Tipografia;
  porInscricao: boolean; textoPrepago: string; textoPreinscricao: string; textoDireto: string;
};

export const CursoTexto: ComponentConfig<TextoProps> = {
  label: "Curso · Texto com variáveis",
  fields: {
    texto: { type: "textarea", label: `Texto. ${ajudaVariaveis}` },
    estilo: {
      type: "select", label: "Estilo",
      options: [{ label: "Etiqueta", value: "etiqueta" }, { label: "Título", value: "titulo" }, { label: "Destaque (ex.: preço)", value: "destaque" }, { label: "Texto", value: "texto" }],
    },
    porInscricao: simNao("Texto diferente por tipo de inscrição (substitui o texto acima)"),
    textoPrepago: { type: "textarea", label: "Pré-pago" },
    textoPreinscricao: { type: "textarea", label: "Pré-inscrição" },
    textoDireto: { type: "textarea", label: "Acesso direto" },
    tipografia: campoTipografia(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    texto: "{{curso}}", estilo: "texto", porInscricao: false, textoPrepago: "", textoPreinscricao: "", textoDireto: "",
    tipografia: tipoVazia(), aparencia: estiloVazio(),
  },
  render: p => <TextoCurso {...p} />,
};

function TextoCurso(p: TextoProps) {
  const { local } = useLocalCurso();
  const e = ESTILOS_TEXTO[p.estilo] ?? ESTILOS_TEXTO.texto;
  const t = estiloTexto(p.tipografia);
  const Tag = e.tag;
  return (
    <Caixa p={p}>
      {curso => {
        const base = p.porInscricao
          ? (ePrepago(curso.enrollment) ? p.textoPrepago : ePreinscricao(curso.enrollment) ? p.textoPreinscricao : textoDiretoAtual(p.textoDireto))
          : p.texto;
        const texto = textoAutomaticoCurso(preencherVariaveis(base ?? "", variaveisCurso(curso, local)).trim(), curso);
        return texto ? <Tag className={juntar(e.cls, "whitespace-pre-line", t.className)} style={t.style}>{texto}</Tag> : null;
      }}
    </Caixa>
  );
}

// ─── Imagem do curso ─────────────────────────────────────────────────────────

type ImagemProps = Base & { imagem: "capa" | "miniatura" | "banner"; altura: number | null; ajuste: "cover" | "contain"; video: boolean; esconderComVideo: boolean };

export const CursoImagem: ComponentConfig<ImagemProps> = {
  label: "Curso · Imagem",
  fields: {
    imagem: { type: "select", label: "Imagem", options: [{ label: "Capa", value: "capa" }, { label: "Miniatura", value: "miniatura" }, { label: "Banner", value: "banner" }] },
    altura: campoNumero("Altura"),
    ajuste: { type: "select", label: "Ajuste", options: [{ label: "Preencher (corta)", value: "cover" }, { label: "Inteira", value: "contain" }] },
    video: simNao("Mostrar o vídeo de apresentação no lugar da imagem (quando o curso tiver vídeo)"),
    esconderComVideo: simNao("Esconder a imagem quando o curso tiver vídeo (o bloco «Vídeo de apresentação» do cartão ocupa o lugar dela)"),
    aparencia: campoAparencia(),
  },
  defaultProps: { imagem: "capa", altura: 144, ajuste: "cover", video: false, esconderComVideo: false, aparencia: estiloVazio() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        const v = p.video ? videoDoCurso(curso.video) : null;
        if (v) return (
          <div className="aspect-video w-full overflow-hidden bg-black">
            <LeitorVideo v={v} titulo={`Vídeo de apresentação: ${curso.title}`} />
          </div>
        );
        if (p.esconderComVideo && videoDoCurso(curso.video)) return null;
        const src = curso[p.imagem] || curso.capa || curso.miniatura;
        return (
          <div className="w-full overflow-hidden bg-[#E7EBF0]" style={{ height: p.altura ? `${p.altura}px` : undefined }}>
            {src && <img src={src} alt="" className="h-full w-full" style={{ objectFit: p.ajuste }} />}
          </div>
        );
      }}
    </Caixa>
  ),
};

// ─── Botão de inscrição ──────────────────────────────────────────────────────

type BotaoProps = Base & { texto: string; cor: string; corTexto: string; larguraTotal: boolean; seta: boolean };

export const CursoBotaoInscricao: ComponentConfig<BotaoProps> = {
  label: "Curso · Botão de inscrição",
  fields: {
    texto: { type: "text", label: `Texto (vazio = conforme a inscrição; na pré-inscrição é sempre «Pré-inscrever»). ${ajudaVariaveis}` },
    cor: campoCor("Cor do botão"),
    corTexto: campoCor("Cor do texto"),
    larguraTotal: simNao("Ocupa a largura toda"),
    seta: simNao("Seta"),
    aparencia: campoAparencia(),
  },
  defaultProps: { texto: "", cor: "var(--c-destaque)", corTexto: "#ffffff", larguraTotal: true, seta: true, aparencia: estiloVazio() },
  render: p => <BotaoCurso {...p} />,
};

/** Abre a pré-inscrição já no local escolhido na página (as datas de início e os dados vêm a seguir). */
function BotaoCurso(p: BotaoProps) {
  const { local } = useLocalCurso();
  const { abrir } = useInscricaoOpcional();
  return (
    <Caixa p={p}>
      {curso => {
        // Pré-inscrição (Oferta › tipo comercial): o botão diz sempre «Pré-inscrever», seja qual for o texto do bloco.
        const texto = p.texto.trim() && !ePreinscricao(curso.enrollment)
          ? preencherVariaveis(p.texto, variaveisCurso(curso, local)) : rotuloBotaoInscricao(curso.enrollment);
        return (
          <button type="button" onClick={() => abrir(curso, local ? { local } : undefined)}
            className={juntar("flex items-center justify-between gap-4 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] hover:brightness-90", p.larguraTotal ? "w-full" : "w-fit")}
            style={{ background: corSegura(p.cor) || "var(--c-destaque)", color: corSegura(p.corTexto) || "#ffffff" }}>
            {texto} {p.seta && <Icon name="arrow" />}
          </button>
        );
      }}
    </Caixa>
  );
}

// ─── Cartão de inscrição ─────────────────────────────────────────────────────

type CartaoProps = Base & {
  conteudo: Slot; fixo: boolean; cartao: boolean; espaco: number | null;
  /** Só nas páginas gravadas antes de o cartão ser feito de blocos. */
  mostrarImagem?: boolean; textoPrepago?: string; textoPreinscricao?: string; textoDireto?: string;
};

const TEXTO_INSCRICAO = {
  textoPrepago: "Primeiro recolhemos os seus dados. O pagamento fica no passo seguinte.",
  textoPreinscricao: "Escolha a data de início (com o cronograma de cada turma). A seguir pedimos os seus dados.",
  textoDireto: TEXTO_DIRETO,
};

/** Blocos do cartão por omissão: imagem, tipo de inscrição, preço do local, texto e botão. */
/** Vídeo de apresentação no topo do cartão (com vídeo, no lugar da imagem). */
export const videoDoCartao = () => ({
  ...CursoVideo.defaultProps, titulo: "", largura: 100, larguraMax: null, alinhar: "centro" as const, raio: 0, sombra: false, aparencia: estiloVazio(),
});

export const blocosCartaoPadrao = (textos: Partial<typeof TEXTO_INSCRICAO> = {}) => [
  { type: "CursoVideo", props: videoDoCartao() },
  { type: "CursoImagem", props: { ...CursoImagem.defaultProps, esconderComVideo: true } },
  { type: "CursoTexto", props: { ...CursoTexto.defaultProps, texto: "{{inscricao}}", estilo: "etiqueta" } },
  { type: "CursoTexto", props: { ...CursoTexto.defaultProps, texto: "{{preco}}", estilo: "destaque" } },
  { type: "CursoTexto", props: { ...CursoTexto.defaultProps, texto: "", estilo: "texto", porInscricao: true, ...TEXTO_INSCRICAO, ...textos } },
  { type: "CursoBotaoInscricao", props: { ...CursoBotaoInscricao.defaultProps } },
];

export const CursoInscricao: ComponentConfig<CartaoProps> = {
  label: "Curso · Cartão de inscrição",
  fields: {
    conteudo: { type: "slot", label: "Blocos no cartão" },
    cartao: simNao("Aspeto de cartão (fundo branco, barra e sombra)"),
    fixo: simNao("Acompanha o scroll (computador)"),
    espaco: campoNumero("Espaço entre os blocos"),
    aparencia: campoAparencia(),
  },
  defaultProps: { conteudo: blocosCartaoPadrao() as never, cartao: true, fixo: true, espaco: 16, aparencia: estiloVazio() },
  render: ({ conteudo: Conteudo, ...p }) => (
    <Caixa p={p} as="aside" className={juntar(
      "h-fit",
      p.cartao && "border-t-4 border-[var(--c-destaque)] bg-white p-7 shadow-[0_18px_50px_rgba(18,52,59,.18)]",
      p.fixo && "lg:sticky lg:top-28",
    )}>
      {curso => p.textoPrepago !== undefined
        ? <CartaoAntigo p={p} curso={curso} Conteudo={Conteudo} />
        : <Conteudo className="flex flex-col" style={{ gap: `${p.espaco ?? 16}px` }} minEmptyHeight={60} />}
    </Caixa>
  ),
};

/** Cartão gravado antes dos blocos (só até a página voltar a ser publicada pelo editor, que o converte). */
function CartaoAntigo({ p, curso, Conteudo }: { p: Omit<CartaoProps, "conteudo">; curso: Course; Conteudo: ComponentType<{ className?: string; minEmptyHeight?: number }> }) {
  const { local } = useLocalCurso();
  const { abrir } = useInscricaoOpcional();
  return (
    <>
      {p.mostrarImagem !== false && (
        <div className="mb-5 h-36 w-full overflow-hidden bg-[#E7EBF0]">
          {(curso.capa || curso.miniatura) && <img src={curso.capa || curso.miniatura || ""} alt="" className="h-full w-full object-cover" />}
        </div>
      )}
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--c-destaque)]">{curso.enrollment}</p>
      <h2 className="mt-3 font-serif text-3xl">{precoNoLocal(curso, local)}</h2>
      <p className="mt-4 text-sm leading-6 opacity-65">
        {ePrepago(curso.enrollment) ? p.textoPrepago : ePreinscricao(curso.enrollment) ? p.textoPreinscricao : textoDiretoAtual(p.textoDireto)}
      </p>
      <button type="button" onClick={() => abrir(curso, local ? { local } : undefined)} className="mt-7 flex w-full items-center justify-between bg-[var(--c-destaque)] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] text-white hover:brightness-90">
        {rotuloBotaoInscricao(curso.enrollment)} <Icon name="arrow" />
      </button>
      <Conteudo className="mt-5 flex flex-col gap-3 ena-zona" minEmptyHeight={30} />
    </>
  );
}
