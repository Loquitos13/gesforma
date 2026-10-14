// Continuação de SiteLanding.tsx (partido para ficar abaixo das 500 linhas).
import { useMemo, useState } from "react";

import { useInscricao } from "./SiteInscricao";
import { classeSelo, estiloMargem, heroAnimacao, heroBadge, heroDisposicao, heroPedido, heroTamanho, HERO_CONTENTOR_MAX, HERO_CONTENTOR_MIN, HERO_FORMA_BORDA_MAX, HERO_FORMA_BORDA_MIN, HERO_FORMA_POS_MAX, HERO_FORMA_POS_MIN, HERO_FORMA_TAMANHO_MAX, HERO_FORMA_TAMANHO_MIN, HERO_POS_MAX, HERO_POS_MIN, HERO_TAMANHO_MAX, HERO_TAMANHO_MIN, moradaSegura, numeroSite, corForma, heroForma, type SiteChave } from "../partilhado/siteConteudo";
import { useSiteTexto, useNotaInqueritos, useOferta, Icon, estiloEscala, estiloContentor, margemLida, vistaCurso, vistaDePedido, CartaoFlutuante, FormaHero, OndaHero } from "./SiteLanding";

function SplitHero() {
  const { ccp, cursos } = useOferta();
  const { abrir } = useInscricao();
  const t = useSiteTexto();
  const heroImagem = moradaSegura(t("heroImagem"));
  const disposicao = heroDisposicao(t("heroDisposicao"));
  const contentorLargura = numeroSite(t("heroContentorLargura"), HERO_CONTENTOR_MIN, HERO_CONTENTOR_MAX, 100);
  const contentorAltura = numeroSite(t("heroContentorAltura"), HERO_CONTENTOR_MIN, HERO_CONTENTOR_MAX, 100);
  const forma = heroForma(t("heroForma"));
  const formaCor = corForma(t("heroFormaCor"));
  const formaBorda = numeroSite(t("heroFormaEspessura"), HERO_FORMA_BORDA_MIN, HERO_FORMA_BORDA_MAX, 14);
  const formaX = numeroSite(t("heroFormaX"), HERO_FORMA_POS_MIN, HERO_FORMA_POS_MAX, 0);
  const formaY = numeroSite(t("heroFormaY"), HERO_FORMA_POS_MIN, HERO_FORMA_POS_MAX, 0);
  const formaTamanho = numeroSite(t("heroFormaTamanho"), HERO_FORMA_TAMANHO_MIN, HERO_FORMA_TAMANHO_MAX, 100);
  const tituloEsc = numeroSite(t("heroTituloTamanho"), HERO_TAMANHO_MIN, HERO_TAMANHO_MAX, 100);
  const textoEsc = numeroSite(t("heroTextoTamanho"), HERO_TAMANHO_MIN, HERO_TAMANHO_MAX, 100);
  const textoX = numeroSite(t("heroTextoX"), HERO_POS_MIN, HERO_POS_MAX, 0);
  const textoY = numeroSite(t("heroTextoY"), HERO_POS_MIN, HERO_POS_MAX, 0);
  const botaoEsc = numeroSite(t("heroBotaoTamanho"), HERO_TAMANHO_MIN, HERO_TAMANHO_MAX, 100);
  const botaoX = numeroSite(t("heroBotaoX"), HERO_POS_MIN, HERO_POS_MAX, 0);
  const botaoY = numeroSite(t("heroBotaoY"), HERO_POS_MIN, HERO_POS_MAX, 0);
  const margem = margemLida(t, "margemDestaqueX", "margemDestaqueY");
  const financiada = cursos.find(curso => curso.regime === "fin" && (curso.capa || curso.miniatura)) ?? cursos.find(curso => curso.regime === "fin");
  const cartoes = ([1, 2] as const).flatMap(posicao => {
    const pedido = heroPedido(t, posicao);
    const vista = vistaDePedido(posicao, pedido, cursos);
    const curso = posicao === 1 ? ccp : financiada;
    const base = vista && vista !== "automatico" ? vista : vista === null ? null : curso ? vistaCurso(posicao, curso) : null;
    if (!base) return [];
    const badge = heroBadge(t, posicao, base.ouro, base.selo);
    return [{
      ...base,
      ...badge,
      seloClasse: classeSelo(badge.seloCor),
      tamanho: heroTamanho(t, posicao),
      animacao: heroAnimacao(t, posicao),
    }];
  });
  const centro = disposicao === "texto-centro";
  const palavras = (
    <div className={centro ? "text-center" : ""} style={{ transform: `translate(${textoX}%, ${textoY}%)` }}>
      <h1 className={`ena-hero-titulo max-w-[16ch] font-serif font-bold tracking-[-0.03em] text-white ${centro ? "mx-auto" : ""}`} style={estiloEscala(tituloEsc / 100)}>
        {t("heroTitulo")}
      </h1>
      <p className={`ena-hero-texto mt-5 max-w-md text-[#E6EDF5] ${centro ? "mx-auto" : ""}`} style={estiloEscala(textoEsc / 100)}>
        {t("heroTexto")}
      </p>
      <a
        href="/formacao"
        className="ena-hero-botao relative z-30 mt-7 inline-flex w-fit items-center rounded-full bg-[#FFA900] font-bold text-[#14263D] transition-colors hover:bg-[#A60000] hover:text-white"
        style={estiloEscala(botaoEsc / 100, { transform: `translate(${botaoX}%, ${botaoY}%)` })}
      >
        {t("heroBotao")}
      </a>
    </div>
  );
  const texto = centro ? (
    <div className="relative z-30 flex flex-col items-center px-4 pb-6 pt-10 text-center sm:px-6 lg:px-6 lg:py-14">
      {palavras}
    </div>
  ) : (
    <div className="relative z-30 flex flex-col justify-center px-6 pb-4 pt-10 sm:px-8 lg:px-10 lg:py-12">
      {palavras}
    </div>
  );
  const ancora: "par-direita" | "par-esquerda" | "coluna" = centro ? "coluna" : disposicao === "texto-direita" ? "par-esquerda" : "par-direita";
  const grelha = centro
    ? "pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.95fr)_minmax(0,1fr)] lg:items-center lg:pb-28"
    : disposicao === "texto-direita"
      ? "lg:grid-cols-[minmax(0,1.22fr)_minmax(0,.78fr)]"
      : "lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]";
  const cartao = (posicao: 1 | 2) => {
    const vista = cartoes.find(item => item.posicao === posicao);
    return vista ? <CartaoFlutuante vista={vista} abrir={abrir} ancora={ancora} /> : null;
  };
  const palco = centro ? (
    <>
      <div className="relative z-20 order-2 flex flex-col justify-center px-4 py-4 lg:order-1 lg:px-8 lg:py-10">{cartao(1)}</div>
      <div className="order-1 lg:order-2">{texto}</div>
      <div className="relative z-20 order-3 flex flex-col justify-center px-4 pb-4 pt-4 lg:px-8 lg:py-10">{cartao(2)}</div>
    </>
  ) : (
    <>
      {disposicao === "texto-direita" ? null : texto}
      <div className={`relative z-20 flex flex-col gap-6 px-4 pb-28 pt-2 lg:block lg:h-auto lg:min-h-full lg:px-0 lg:pb-0 lg:pt-0 ${disposicao === "texto-direita" ? "order-2 lg:order-1" : ""}`}>
        <div className="relative z-20 flex flex-col gap-5 lg:absolute lg:inset-0 lg:block">
          {cartoes.map(vista => <CartaoFlutuante key={vista.posicao} vista={vista} abrir={abrir} ancora={ancora} />)}
        </div>
      </div>
      {disposicao === "texto-direita" ? <div className="order-1 lg:order-2">{texto}</div> : null}
    </>
  );
  return (
    <section
      className="ena-margem bg-[#F6F3EE]"
      style={estiloMargem(margem.x, margem.y, { x: "1rem", y: "1.5rem", xSm: "1.5rem", xLg: "2rem", yLg: "2rem" })}
      aria-label="Destaques"
      data-hero-disposicao={disposicao}
    >
      <div className={`ena-hero-contentor relative mx-auto grid overflow-hidden rounded-[32px] bg-[#14263D] shadow-[0_28px_80px_rgba(20,38,61,.22)] ${grelha}`} style={estiloContentor(contentorLargura, contentorAltura)} data-hero-largura={contentorLargura} data-hero-altura={contentorAltura}>
        <FormaHero src={heroImagem} alt={t("heroImagemAlt")} forma={forma} cor={formaCor} espessura={formaBorda} x={formaX} y={formaY} tamanho={formaTamanho} />
        {palco}
        <OndaHero />
      </div>
    </section>
  );
}

export function Home() {
  const { destaques, estado, recarregar } = useOferta();
  const t = useSiteTexto();
  const notaInqueritos = useNotaInqueritos();
  const notaApresentacao = notaInqueritos || t("metodoNota");
  const metodoImagem = moradaSegura(t("metodoImagem"));
  const pilares = [1, 2, 3, 4].map(n => ({
    number: t(`pilar${n}Numero` as SiteChave),
    title: t(`pilar${n}Titulo` as SiteChave),
    text: t(`pilar${n}Texto` as SiteChave),
  })).filter(item => item.number || item.title || item.text);
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const filtros = useMemo(() => {
    const modos = new Set(destaques.map(curso => curso.format));
    return ["Todos", ...["Presencial", "B-learning", "E-learning"].filter(modo => modos.has(modo))];
  }, [destaques]);
  const filtered = useMemo(
    () => destaques.filter((course) =>
      (filter === "Todos" || course.format === filter) &&
      `${course.title} ${course.area}`.toLowerCase().includes(query.toLowerCase())),
    [destaques, filter, query],
  );

  const margemOferta = margemLida(t, "margemOfertaX", "margemOfertaY");
  const margemMetodo = margemLida(t, "margemApresentacaoX", "margemApresentacaoY");
  const margemEmpresas = margemLida(t, "margemEmpresasX", "margemEmpresasY");
  return (
    <main>
      <SplitHero />

      <section id="formacao" className="ena-margem scroll-mt-24 bg-[#F6F3EE] text-[#14263D]" style={estiloMargem(margemOferta.x, margemOferta.y, { x: "1.25rem", y: "5rem", xLg: "2rem", yLg: "7rem" })}>
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#A60000]">{t("ofertaKicker")}</p>
              <h2 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#14263D] sm:text-5xl">{t("ofertaTitulo")}</h2>
            </div>
            <label className="flex w-full items-center gap-3 rounded-full border border-[#14263D]/20 bg-white px-4 py-3 text-[#14263D] lg:max-w-sm">
              <Icon name="search" />
              <span className="sr-only">Pesquisar formação</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("ofertaPesquisa")} className="w-full bg-transparent text-sm text-[#14263D] outline-none placeholder:text-[#4A6078]" />
            </label>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-[#14263D]/10 pb-5">
            {filtros.map((item) => (
              <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`px-5 py-2.5 text-sm font-bold transition-colors ${filter === item ? "bg-[#FFA900] text-[#14263D]" : "bg-white text-[#14263D] ring-1 ring-[#14263D]/15 hover:ring-[#A60000]"}`}>
                {item}
              </button>
            ))}
            <span className="ml-auto hidden self-center text-sm font-semibold text-[#3E5168] sm:block">{filtered.length} formações disponíveis</span>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {estado === "pronto" && filtered.map((course) => (
              <article key={course.id} className="ena-cartao group flex min-h-[390px] max-w-full flex-col overflow-hidden border-x border-b border-[#14263D]/10 border-t-4 border-t-[#FFA900] bg-white text-[#14263D] shadow-[0_10px_30px_rgba(20,38,61,.06)] hover:shadow-[0_22px_46px_rgba(20,38,61,.16)]">
                <a href={`/formacao/${course.id}`} className="relative block h-44 max-h-44 w-full max-w-full overflow-hidden bg-[#E7EBF0]">
                  {(course.capa || course.miniatura) && <img src={course.capa || course.miniatura || ""} alt="" className="ena-cartao-foto h-full max-h-44 w-full max-w-full object-cover" />}
                  <span className={`absolute left-4 top-4 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] ${course.format === "E-learning" ? "bg-[#FFA900] text-[#14263D]" : "bg-[#14263D] text-white"}`}>{course.format}</span>
                </a>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#A60000]">{course.area}</p>
                  <h3 className="mt-3 font-serif text-2xl leading-tight text-[#14263D]"><a href={`/formacao/${course.id}`} className="hover:text-[#A60000]">{course.title}</a></h3>
                  <p className="mt-4 text-sm leading-6 text-[#3E5168]">{course.description}</p>
                  <div className="mt-auto flex items-end justify-between border-t border-[#14263D]/10 pt-5">
                    <div className="space-y-2 text-xs font-semibold text-[#3E5168]">
                      {course.price && <span className="block text-sm font-bold text-[#14263D]">{course.price}</span>}
                      <span className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4" />{course.duration}</span>
                      <span className="flex items-center gap-2"><Icon name={course.format === "E-learning" ? "screen" : "pin"} className="h-4 w-4" />{course.start}</span>
                    </div>
                    <a href={`/formacao/${course.id}`} aria-label={`Ver ${course.title}`} className="grid h-11 w-11 place-items-center bg-[#14263D] text-white transition-colors group-hover:bg-[#A60000]"><Icon name="arrow" /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {estado === "a-carregar" && <p className="py-20 text-center text-[#3E5168]">A carregar a oferta formativa.</p>}
          {estado === "erro" && (
            <div className="py-16 text-center">
              <p className="text-[#14263D]">Não foi possível carregar os cursos.</p>
              <button type="button" onClick={recarregar} className="mt-4 bg-[#FFA900] px-5 py-3 text-sm font-bold text-[#14263D]">Tentar de novo</button>
            </div>
          )}
          {estado === "pronto" && filtered.length === 0 && <p className="py-20 text-center text-[#3E5168]">Não encontrámos formações para esta pesquisa.</p>}
        </div>
      </section>

      <section id="metodo" className="ena-margem border-t-8 border-[#A60000] bg-white text-[#14263D]" style={estiloMargem(margemMetodo.x, margemMetodo.y, { x: "1.25rem", y: "5rem", xLg: "2rem", yLg: "7rem" })}>
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div className="relative mb-12 lg:mb-0">
            <div className="aspect-[4/5] overflow-hidden bg-[#E7EBF0]">
              {metodoImagem && <img src={metodoImagem} alt={t("metodoImagemAlt")} className="h-full w-full object-cover" />}
            </div>
            {notaApresentacao && (
              <div className="absolute -bottom-7 -right-3 w-44 bg-[#FFA900] p-5 text-[#14263D] sm:right-8">
                <strong className="block font-serif text-4xl">{notaApresentacao}</strong>
                {t("metodoNotaLegenda") && <span className="mt-1 block text-xs font-bold uppercase tracking-wider">{t("metodoNotaLegenda")}</span>}
              </div>
            )}
          </div>
          <div>
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#A60000]">{t("metodoKicker")}</p>
            <h2 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#14263D] sm:text-5xl">{t("metodoTitulo")}</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#3E5168]">{t("metodoTexto")}</p>
            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {pilares.map(({ number, title, text }) => (
                <div key={number} className="border-t-2 border-[#FFA900] pt-5">
                  <span className="text-xs font-extrabold text-[#A60000]">{number}</span>
                  <h3 className="mt-2 font-bold text-[#14263D]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#3E5168]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="empresas" className="ena-margem scroll-mt-24 bg-[#FFA900] text-[#14263D]" style={estiloMargem(margemEmpresas.x, margemEmpresas.y, { x: "1.25rem", y: "4rem", xLg: "2rem" })}>
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="inline-flex bg-[#A60000] px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-white">{t("empresasKicker")}</p>
            <h2 className="mt-4 font-serif text-4xl text-[#14263D]">{t("empresasTitulo")}</h2>
            <p className="mt-4 text-base leading-7 text-[#14263D]">{t("empresasTexto")}</p>
          </div>
          <a href="#contactos" className="group flex min-w-fit items-center justify-between gap-10 bg-[#A60000] px-7 py-5 font-bold text-white hover:bg-[#14263D]">{t("empresasBotao")} <Icon name="arrow" className="transition-transform group-hover:translate-x-1" /></a>
        </div>
      </section>
    </main>
  );
}

export function Footer() {
  const t = useSiteTexto();
  const privacidade = moradaSegura(t("rodapePrivacidadeUrl"));
  const reclamacoes = moradaSegura(t("rodapeReclamacoesUrl"));
  const contactos = [t("rodapeEmail"), t("rodapeTelefone"), t("rodapeHorario")].filter(Boolean);
  const ano = new Date().getFullYear();
  const margem = margemLida(t, "margemRodapeX", "margemRodapeY");
  return (
    <footer id="contactos" className="ena-margem scroll-mt-24 border-t-4 border-[#FFA900] bg-[#0E1C2E] text-white" style={estiloMargem(margem.x, margem.y, { x: "1.25rem", y: "3.5rem", xLg: "2rem" })}>
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-10 border-b border-white/15 pb-12 md:grid-cols-4">
          <div className="md:col-span-2">
            {t("rodapeMarca") && <span className="grid h-12 w-12 place-items-center bg-[#A60000] text-sm font-extrabold">{t("rodapeMarca")}</span>}
            {t("rodapeTexto") && <p className="mt-5 max-w-sm text-sm leading-6 text-[#D7E0EA]">{t("rodapeTexto")}</p>}
          </div>
          <div>
            <strong className="text-sm text-white">{t("rodapeTituloContactos")}</strong>
            {contactos.length > 0 && <p className="mt-4 text-sm leading-7 text-[#D7E0EA]">{contactos.map((linha, i) => <span key={linha}>{i > 0 && <br />}{linha}</span>)}</p>}
          </div>
          <div>
            <strong className="text-sm text-white">{t("rodapeTituloLigacoes")}</strong>
            <div className="mt-4 flex flex-col gap-3 text-sm text-[#D7E0EA] underline decoration-white/30 underline-offset-4">
              {t("rodapeLigacaoFormacao") && <a href="/formacao" className="hover:text-white">{t("rodapeLigacaoFormacao")}</a>}
              {t("navNoticias") && <a href="/noticias" className="hover:text-white">{t("navNoticias")}</a>}
              {privacidade && t("rodapePrivacidade") && <a href={privacidade} target="_blank" rel="noreferrer" className="hover:text-white">{t("rodapePrivacidade")}</a>}
              {reclamacoes && t("rodapeReclamacoes") && <a href={reclamacoes} target="_blank" rel="noreferrer" className="hover:text-white">{t("rodapeReclamacoes")}</a>}
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs text-[#C5D0DC] sm:flex-row">
          <span>© {ano} {t("rodapeEntidade")}. {t("rodapeDireitos")}</span>
          <span>{t("rodapeLema")}</span>
        </div>
      </div>
    </footer>
  );
}
