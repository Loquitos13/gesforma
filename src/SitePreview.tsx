import type { ReactNode } from "react";
import { botaoHero, classeAnimacaoBotao, heroAnimacao, heroPedido, heroTamanho, moradaSegura, tituloRegime, type HeroPedido, type HeroSlot, type SiteChave } from "./siteConteudo";

export type CursoPreview = {
  id: string;
  titulo: string;
  area: string;
  precoLabel: string;
  miniatura: string | null;
  financiamento: "Gold" | "Financiada";
  regime: "gold" | "fin";
  inscricao: "Acesso direto" | "Pré-inscrição";
};

export type OfertaPreview = {
  cursos: CursoPreview[];
  destaques: CursoPreview[];
  ccp: CursoPreview | null;
};

const letra = { fontFamily: '"Atkinson Hyperlegible", system-ui, sans-serif' } as const;

function moldura(children: ReactNode) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#E7E4DE] shadow-inner">
      <p className="border-b border-slate-200/80 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Pré-visualização</p>
      <div className="pointer-events-none" style={letra}>
        {children}
      </div>
    </div>
  );
}

function texto(valor: string, vazio = "") {
  const limpo = valor.trim();
  return limpo || vazio;
}

export function SiteSeccaoPreview({
  titulo, draft, oferta, ano,
}: {
  titulo: string;
  draft: Record<SiteChave, string>;
  oferta: OfertaPreview | null;
  ano: number;
}) {
  const ler = (chave: SiteChave) => draft[chave] ?? "";
  if (titulo === "Cabeçalho") return moldura(<PreviewCabecalho ler={ler} />);
  if (titulo === "Destaque") return moldura(<PreviewHero ler={ler} oferta={oferta} />);
  if (titulo === "Oferta formativa") return moldura(<PreviewOferta ler={ler} oferta={oferta} />);
  if (titulo === "Apresentação") return moldura(<PreviewMetodo ler={ler} />);
  if (titulo === "Empresas") return moldura(<PreviewEmpresas ler={ler} />);
  if (titulo === "Rodapé") return moldura(<PreviewRodape ler={ler} ano={ano} />);
  return null;
}

function PreviewCabecalho({ ler }: { ler: (chave: SiteChave) => string }) {
  const separador = texto(ler("tituloSeparador"), "Sem título");
  return (
    <div>
      <div className="flex items-center gap-2 bg-[#E7EBF0] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[#A60000]" />
        <span className="truncate text-[10px] font-semibold text-[#3E5168]">{separador}</span>
      </div>
      <div className="border-b-4 border-[#FFA900] bg-white px-3 py-2.5 text-[#14263D]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/imagens/ena_logo.svg" alt="" className="h-5 w-auto shrink-0" />
            {(ler("marcaLinha1") || ler("marcaLinha2")) && (
              <span className="truncate text-[8px] font-bold uppercase leading-tight tracking-[0.08em]">
                {ler("marcaLinha1")} {ler("marcaLinha2")}
              </span>
            )}
          </div>
          {ler("navEntrar") && <span className="shrink-0 bg-[#A60000] px-2 py-1 text-[10px] font-bold text-white">{ler("navEntrar")}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold">
          {ler("navFormacao") && <span>{ler("navFormacao")}</span>}
          {ler("navEmpresas") && <span>{ler("navEmpresas")}</span>}
          {ler("navFormando") && <span className="text-[#A60000] underline decoration-[#FFA900] decoration-2 underline-offset-2">{ler("navFormando")}</span>}
        </div>
      </div>
    </div>
  );
}

function cartaoDe(slot: HeroSlot, ler: (chave: SiteChave) => string, oferta: OfertaPreview | null) {
  const pedido = heroPedido(ler, slot);
  if (pedido.modo === "curso") {
    const curso = oferta?.cursos.find(item => item.id === pedido.cursoId);
    if (!curso) return null;
    return {
      imagem: curso.miniatura,
      selo: curso.precoLabel,
      ouro: slot === 1,
      titulo: curso.titulo,
      linha: curso.area,
      botao: botaoHero(pedido, curso.inscricao),
      ...medidaHero(slot, ler),
    };
  }
  if (pedido.modo === "regime") {
    return {
      imagem: pedido.imagem || null,
      selo: pedido.regime === "gold" ? "Gold" : "Financiada",
      ouro: pedido.regime === "gold",
      titulo: tituloRegime(pedido.regime, pedido.titulo),
      linha: pedido.descricao,
      botao: botaoHero(pedido),
      ...medidaHero(slot, ler),
    };
  }
  const curso = slot === 1
    ? oferta?.ccp ?? null
    : oferta?.cursos.find(item => item.regime === "fin" && item.miniatura) ?? oferta?.cursos.find(item => item.regime === "fin") ?? null;
  if (!curso) return null;
  const automatico: Exclude<HeroPedido, { modo: "automatico" }> = { modo: "curso", cursoId: curso.id, botao: "", destino: "" };
  return {
    imagem: curso.miniatura,
    selo: curso.precoLabel,
    ouro: slot === 1,
    titulo: curso.titulo,
    linha: curso.area,
    botao: botaoHero(automatico, curso.inscricao),
    ...medidaHero(slot, ler),
  };
}

function medidaHero(slot: HeroSlot, ler: (chave: SiteChave) => string) {
  return { tamanho: heroTamanho(ler, slot), animacao: heroAnimacao(ler, slot) };
}

function MiniCartao({ cartao, classe }: { cartao: NonNullable<ReturnType<typeof cartaoDe>>; classe: string }) {
  const largura = cartao.tamanho === "pequeno" ? "w-[46%]" : cartao.tamanho === "grande" ? "w-[74%]" : "w-[58%]";
  const foto = cartao.tamanho === "pequeno" ? "h-6" : cartao.tamanho === "grande" ? "h-12" : "h-8";
  return (
    <article className={`overflow-hidden rounded-lg bg-white shadow ${largura} ${classe}`} data-hero-tamanho={cartao.tamanho} data-hero-animacao={cartao.animacao}>
      <div className={`${foto} bg-[#E7EBF0]`}>
        {cartao.imagem && <img src={cartao.imagem} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="p-2">
        {cartao.selo && <span className={`inline-flex rounded px-1.5 py-0.5 text-[8px] font-extrabold ${cartao.ouro ? "bg-[#FFA900] text-[#14263D]" : "bg-[#A60000] text-white"}`}>{cartao.selo}</span>}
        <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-[#14263D]">{cartao.titulo}</p>
        {cartao.linha && <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-[#3E5168]">{cartao.linha}</p>}
        {cartao.botao && <p className={`mt-1.5 rounded-full px-2 py-1 text-center text-[8px] font-extrabold uppercase tracking-wide text-white ${cartao.ouro ? "bg-[#A60000]" : "bg-[#1C3350]"} ${classeAnimacaoBotao(cartao.animacao)}`}>{cartao.botao}</p>}
      </div>
    </article>
  );
}

function PreviewHero({ ler, oferta }: { ler: (chave: SiteChave) => string; oferta: OfertaPreview | null }) {
  const imagem = moradaSegura(ler("heroImagem"));
  const esquerda = cartaoDe(1, ler, oferta);
  const direita = cartaoDe(2, ler, oferta);
  return (
    <div className="bg-[#F6F3EE] p-3">
      <div className="overflow-hidden rounded-2xl bg-[#14263D] px-3 pb-3 pt-4">
        <p className="max-w-[18ch] text-base font-bold leading-tight text-white">{texto(ler("heroTitulo"), "Sem título")}</p>
        {ler("heroTexto").trim() && <p className="mt-2 max-w-[28ch] text-[11px] leading-4 text-[#E6EDF5]">{ler("heroTexto")}</p>}
        {ler("heroBotao").trim() && <span className="mt-3 inline-flex rounded-full bg-[#FFA900] px-3 py-1.5 text-[10px] font-bold text-[#14263D]">{ler("heroBotao")}</span>}
        <div className="relative mt-3 h-40">
          <div className="absolute right-0 top-6 h-24 w-24 overflow-hidden rounded-full bg-[#FFA900] shadow-[0_0_0_4px_#A60000]">
            {imagem && <img src={imagem} alt="" className="h-full w-full object-cover object-[center_30%]" />}
          </div>
          {esquerda && <MiniCartao cartao={esquerda} classe="absolute left-0 top-0 z-10" />}
          {direita && <MiniCartao cartao={direita} classe="absolute bottom-0 right-0 z-10" />}
        </div>
        <svg aria-hidden="true" className="mt-1 h-4 w-full" viewBox="0 0 1200 140" preserveAspectRatio="none">
          <path d="M0 140V72C90 36 180 108 320 78C460 48 540 18 700 42C860 66 940 112 1080 82C1140 68 1170 88 1200 74V140H0Z" fill="#A60000" />
          <path d="M0 140V104C140 78 240 124 420 106C600 88 700 126 900 108C1040 96 1120 122 1200 104V140H0Z" fill="#FFA900" />
        </svg>
      </div>
    </div>
  );
}

function PreviewOferta({ ler, oferta }: { ler: (chave: SiteChave) => string; oferta: OfertaPreview | null }) {
  const cursos = (oferta?.destaques ?? []).slice(0, 2);
  return (
    <div className="bg-[#F6F3EE] px-3 py-4">
      {ler("ofertaKicker").trim() && <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#A60000]">{ler("ofertaKicker")}</p>}
      <p className="mt-1 text-base font-bold leading-tight text-[#14263D]">{texto(ler("ofertaTitulo"), "Sem título")}</p>
      <div className="mt-3 flex items-center rounded-full border border-[#14263D]/15 bg-white px-3 py-1.5 text-[10px] text-[#4A6078]">
        {texto(ler("ofertaPesquisa"), "Pesquisar…")}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {cursos.map(curso => (
          <article key={curso.id} className="overflow-hidden border-t-4 border-[#FFA900] bg-white">
            <div className="h-10 bg-[#E7EBF0]">
              {curso.miniatura && <img src={curso.miniatura} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-2">
              <p className="text-[8px] font-bold uppercase tracking-wide text-[#A60000]">{curso.area}</p>
              <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-[#14263D]">{curso.titulo}</p>
              {curso.precoLabel && <p className="mt-1 text-[10px] font-bold text-[#14263D]">{curso.precoLabel}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PreviewMetodo({ ler }: { ler: (chave: SiteChave) => string }) {
  const imagem = moradaSegura(ler("metodoImagem"));
  const pilares = [1, 2, 3, 4].map(n => ({
    numero: ler(`pilar${n}Numero` as SiteChave),
    titulo: ler(`pilar${n}Titulo` as SiteChave),
    texto: ler(`pilar${n}Texto` as SiteChave),
  })).filter(item => item.numero || item.titulo || item.texto);
  return (
    <div className="border-t-4 border-[#A60000] bg-white px-3 py-4">
      <div className="grid grid-cols-[88px_1fr] gap-3">
        <div className="relative">
          <div className="h-28 overflow-hidden bg-[#E7EBF0]">
            {imagem && <img src={imagem} alt="" className="h-full w-full object-cover" />}
          </div>
          {ler("metodoNota").trim() && (
            <div className="absolute -bottom-2 -right-2 bg-[#FFA900] px-1.5 py-1 text-[#14263D]">
              <strong className="block text-sm leading-none">{ler("metodoNota")}</strong>
              {ler("metodoNotaLegenda").trim() && <span className="text-[7px] font-bold uppercase">{ler("metodoNotaLegenda")}</span>}
            </div>
          )}
        </div>
        <div>
          {ler("metodoKicker").trim() && <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">{ler("metodoKicker")}</p>}
          <p className="mt-1 text-sm font-bold leading-tight text-[#14263D]">{texto(ler("metodoTitulo"), "Sem título")}</p>
          {ler("metodoTexto").trim() && <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-[#3E5168]">{ler("metodoTexto")}</p>}
        </div>
      </div>
      {pilares.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {pilares.map(pilar => (
            <div key={pilar.numero || pilar.titulo} className="border-t-2 border-[#FFA900] pt-1.5">
              {pilar.numero && <span className="text-[9px] font-extrabold text-[#A60000]">{pilar.numero}</span>}
              {pilar.titulo && <p className="text-[11px] font-bold text-[#14263D]">{pilar.titulo}</p>}
              {pilar.texto && <p className="line-clamp-2 text-[9px] leading-snug text-[#3E5168]">{pilar.texto}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewEmpresas({ ler }: { ler: (chave: SiteChave) => string }) {
  return (
    <div className="bg-[#FFA900] px-3 py-4 text-[#14263D]">
      {ler("empresasKicker").trim() && <p className="inline-flex bg-[#A60000] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white">{ler("empresasKicker")}</p>}
      <p className="mt-2 text-base font-bold leading-tight">{texto(ler("empresasTitulo"), "Sem título")}</p>
      {ler("empresasTexto").trim() && <p className="mt-1 text-[11px] leading-4">{ler("empresasTexto")}</p>}
      {ler("empresasBotao").trim() && <span className="mt-3 inline-flex bg-[#A60000] px-3 py-2 text-[11px] font-bold text-white">{ler("empresasBotao")}</span>}
    </div>
  );
}

function PreviewRodape({ ler, ano }: { ler: (chave: SiteChave) => string; ano: number }) {
  const contactos = [ler("rodapeEmail"), ler("rodapeTelefone"), ler("rodapeHorario")].map(item => item.trim()).filter(Boolean);
  const ligacoes = [ler("rodapeLigacaoFormacao"), ler("rodapePrivacidade"), ler("rodapeReclamacoes")].map(item => item.trim()).filter(Boolean);
  return (
    <div className="border-t-4 border-[#FFA900] bg-[#0E1C2E] px-3 py-4 text-white">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          {ler("rodapeMarca").trim() && <span className="grid h-8 w-8 place-items-center bg-[#A60000] text-[10px] font-extrabold">{ler("rodapeMarca")}</span>}
          {ler("rodapeTexto").trim() && <p className="mt-2 text-[10px] leading-4 text-[#D7E0EA]">{ler("rodapeTexto")}</p>}
        </div>
        <div>
          {ler("rodapeTituloContactos").trim() && <p className="text-[11px] font-bold">{ler("rodapeTituloContactos")}</p>}
          <p className="mt-1 text-[10px] leading-4 text-[#D7E0EA]">{contactos.join(" · ")}</p>
        </div>
        <div>
          {ler("rodapeTituloLigacoes").trim() && <p className="text-[11px] font-bold">{ler("rodapeTituloLigacoes")}</p>}
          <p className="mt-1 text-[10px] leading-4 text-[#D7E0EA] underline">{ligacoes.join(" · ")}</p>
        </div>
      </div>
      <p className="mt-3 border-t border-white/15 pt-2 text-[9px] text-[#C5D0DC]">
        © {ano} {ler("rodapeEntidade")}. {ler("rodapeDireitos")}
        {ler("rodapeLema").trim() && <span className="mt-1 block">{ler("rodapeLema")}</span>}
      </p>
    </div>
  );
}
