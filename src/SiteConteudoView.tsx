import { useEffect, useState } from "react";
import { apiSiteHeroImagem } from "./api";
import { useCatalogs } from "./CatalogsContext";
import { SearchSelect } from "./FormKit";
import { SiteSeccaoPreview, type CursoPreview, type OfertaPreview } from "./SitePreview";
import { classeSelo, heroBadgeCor, heroDisposicao, HERO_POS_MAX, HERO_POS_MIN, HERO_TAMANHO_MAX, HERO_TAMANHO_MIN, MARGEM_MAX, MARGEM_MIN, moradaSegura, numeroSite, SITE_GRUPOS, SITE_OMISSAO, type HeroDisposicao, type HeroSlot, type SiteChave } from "./siteConteudo";
import { toastOk } from "./toastBus";

const campoCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

const HERO: Record<HeroSlot, {
  tipo: SiteChave;
  curso: SiteChave;
  regime: SiteChave;
  titulo: SiteChave;
  descricao: SiteChave;
  imagem: SiteChave;
  botao: SiteChave;
  destino: SiteChave;
  tamanho: SiteChave;
  animacao: SiteChave;
  badge: SiteChave;
  badgeCor: SiteChave;
}> = {
  1: { tipo: "hero1Tipo", curso: "hero1Curso", regime: "hero1Regime", titulo: "hero1Titulo", descricao: "hero1Descricao", imagem: "hero1Imagem", botao: "hero1Botao", destino: "hero1Destino", tamanho: "hero1Tamanho", animacao: "hero1Animacao", badge: "hero1Badge", badgeCor: "hero1BadgeCor" },
  2: { tipo: "hero2Tipo", curso: "hero2Curso", regime: "hero2Regime", titulo: "hero2Titulo", descricao: "hero2Descricao", imagem: "hero2Imagem", botao: "hero2Botao", destino: "hero2Destino", tamanho: "hero2Tamanho", animacao: "hero2Animacao", badge: "hero2Badge", badgeCor: "hero2BadgeCor" },
};

type CursoPublico = CursoPreview;

export function SiteConteudoView() {
  const { settings, saveSettings } = useCatalogs();
  const [draft, setDraft] = useState<Record<SiteChave, string>>({ ...SITE_OMISSAO });
  const [guardado, setGuardado] = useState(false);
  const [cursos, setCursos] = useState<CursoPublico[]>([]);
  const [oferta, setOferta] = useState<OfertaPreview | null>(null);
  const [cursosEstado, setCursosEstado] = useState<"a-carregar" | "pronto" | "erro">("a-carregar");
  const [aEnviar, setAEnviar] = useState<HeroSlot | null>(null);
  const [erroImagem, setErroImagem] = useState<Record<HeroSlot, string>>({ 1: "", 2: "" });
  const ano = new Date().getFullYear();

  useEffect(() => {
    const gravado = settings.site ?? {};
    setDraft(prev => {
      const next: Record<SiteChave, string> = { ...SITE_OMISSAO };
      (Object.keys(SITE_OMISSAO) as SiteChave[]).forEach(chave => {
        next[chave] = gravado[chave] ?? prev[chave] ?? SITE_OMISSAO[chave];
      });
      return next;
    });
  }, [settings.site]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/public/catalogo", { cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("oferta indisponível");
        return res.json() as Promise<{ cursos?: CursoPublico[]; destaques?: CursoPublico[]; ccp?: CursoPublico | null }>;
      })
      .then(data => {
        if (!vivo) return;
        const lista = data.cursos ?? [];
        setCursos(lista);
        setOferta({ cursos: lista, destaques: data.destaques ?? [], ccp: data.ccp ?? null });
        setCursosEstado("pronto");
      })
      .catch(() => { if (vivo) setCursosEstado("erro"); });
    return () => { vivo = false; };
  }, []);

  function escrever(chave: SiteChave, valor: string) {
    setDraft(atual => ({ ...atual, [chave]: valor }));
    setGuardado(false);
  }

  function guardar() {
    const values = Object.fromEntries((Object.keys(SITE_OMISSAO) as SiteChave[]).map(chave => [chave, draft[chave] ?? ""]));
    saveSettings("site", values);
    setGuardado(true);
    toastOk("Site guardado.");
  }

  async function carregarMiniatura(slot: HeroSlot, file: File) {
    setAEnviar(slot);
    setErroImagem(atual => ({ ...atual, [slot]: "" }));
    try {
      const gravada = await apiSiteHeroImagem(slot, file);
      escrever(HERO[slot].imagem, gravada.url);
    } catch (err) {
      setErroImagem(atual => ({ ...atual, [slot]: err instanceof Error ? err.message : "Não foi possível gravar a imagem." }));
    } finally {
      setAEnviar(null);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Site</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {guardado
              ? "Alterações guardadas. A pré-visualização já as mostrava; o site público fica com elas agora."
              : "Cada secção mostra o rascunho ao lado. O site público só muda depois de Guardar."}
          </p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Ver o site</a>
      </div>
      {SITE_GRUPOS.map(grupo => (
        <section key={grupo.titulo} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{grupo.titulo}</h2>
            {grupo.nota && <p className="mt-1 text-xs text-slate-500">{grupo.nota}{grupo.titulo === "Rodapé" ? ` Este ano aparece © ${ano}.` : ""}</p>}
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
            <div className="space-y-4">
              <ControlosMargem titulo={grupo.titulo} draft={draft} onChange={escrever} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grupo.campos.map(campo => (
                  <label key={campo.chave} className={`flex flex-col gap-1.5 ${campo.tipo === "texto" ? "md:col-span-2" : ""}`}>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{campo.etiqueta}</span>
                    {campo.tipo === "texto" ? (
                      <textarea
                        className={`${campoCls} min-h-20 resize-y`}
                        value={draft[campo.chave]}
                        onChange={e => escrever(campo.chave, e.target.value)}
                      />
                    ) : (
                      <input
                        className={campoCls}
                        value={draft[campo.chave]}
                        onChange={e => escrever(campo.chave, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
              {grupo.titulo === "Destaque" && (
                <ComposicaoHero draft={draft} onChange={escrever} />
              )}
              {grupo.titulo === "Destaque" && (
                <CartoesHero
                  draft={draft}
                  cursos={cursos}
                  cursosEstado={cursosEstado}
                  aEnviar={aEnviar}
                  erroImagem={erroImagem}
                  onChange={escrever}
                  onFile={(slot, file) => void carregarMiniatura(slot, file)}
                />
              )}
            </div>
            <div className="lg:sticky lg:top-4">
              <SiteSeccaoPreview titulo={grupo.titulo} draft={draft} oferta={oferta} ano={ano} />
            </div>
          </div>
        </section>
      ))}
      <div className="sticky bottom-3 flex justify-end">
        <button type="button" onClick={guardar} disabled={aEnviar != null} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm disabled:opacity-60">
          Guardar site
        </button>
      </div>
    </div>
  );
}

const MARGENS: Record<string, { x: SiteChave; y: SiteChave }> = {
  "Cabeçalho": { x: "margemCabecalhoX", y: "margemCabecalhoY" },
  "Destaque": { x: "margemDestaqueX", y: "margemDestaqueY" },
  "Oferta formativa": { x: "margemOfertaX", y: "margemOfertaY" },
  "Apresentação": { x: "margemApresentacaoX", y: "margemApresentacaoY" },
  "Empresas": { x: "margemEmpresasX", y: "margemEmpresasY" },
  "Rodapé": { x: "margemRodapeX", y: "margemRodapeY" },
};

const DISPOSICOES: { id: HeroDisposicao; titulo: string; nota: string }[] = [
  { id: "texto-esquerda", titulo: "Texto à esquerda", nota: "Cartões à direita" },
  { id: "texto-centro", titulo: "Texto ao centro", nota: "Um cartão de cada lado" },
  { id: "texto-direita", titulo: "Texto à direita", nota: "Cartões à esquerda" },
];

function ControlosMargem({
  titulo, draft, onChange,
}: {
  titulo: string;
  draft: Record<SiteChave, string>;
  onChange: (chave: SiteChave, valor: string) => void;
}) {
  const chaves = MARGENS[titulo];
  if (!chaves) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Margens da secção</p>
      <p className="mt-1 text-xs text-slate-500">Zero é a margem de omissão. Cada passo soma ou tira 8 pixels na página, na vertical e na horizontal.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PassoMargem etiqueta="Vertical" chave={chaves.y} draft={draft} onChange={onChange} />
        <PassoMargem etiqueta="Horizontal" chave={chaves.x} draft={draft} onChange={onChange} />
      </div>
    </div>
  );
}

function PassoMargem({
  etiqueta, chave, draft, onChange,
}: {
  etiqueta: string;
  chave: SiteChave;
  draft: Record<SiteChave, string>;
  onChange: (chave: SiteChave, valor: string) => void;
}) {
  const valor = numeroSite(draft[chave], MARGEM_MIN, MARGEM_MAX, 0);
  function mudar(proximo: number) {
    onChange(chave, String(Math.min(MARGEM_MAX, Math.max(MARGEM_MIN, proximo))));
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => mudar(valor - 1)} disabled={valor <= MARGEM_MIN} aria-label={`Reduzir margem ${etiqueta.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">−</button>
        <span className="w-12 text-center text-sm font-bold tabular-nums text-slate-800">{valor > 0 ? `+${valor}` : valor}</span>
        <button type="button" onClick={() => mudar(valor + 1)} disabled={valor >= MARGEM_MAX} aria-label={`Aumentar margem ${etiqueta.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">+</button>
        <button type="button" onClick={() => mudar(0)} className="px-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Repor</button>
      </div>
    </div>
  );
}

function ComposicaoHero({
  draft, onChange,
}: {
  draft: Record<SiteChave, string>;
  onChange: (chave: SiteChave, valor: string) => void;
}) {
  const disposicao = heroDisposicao(draft.heroDisposicao);
  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Composição do destaque</h3>
        <p className="mt-1 text-xs text-slate-500">A disposição coloca o texto e os cartões. O tamanho e a posição mexem no texto e no botão que está por baixo dele. Zero na posição é o lugar de omissão. A pré-visualização acompanha o rascunho.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Disposição do destaque">
        {DISPOSICOES.map(opcao => {
          const activo = disposicao === opcao.id;
          return (
            <button
              key={opcao.id}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange("heroDisposicao", opcao.id)}
              className={`rounded-lg border px-3 py-3 text-left ${activo ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <Esquema disposicao={opcao.id} />
              <span className="mt-2 block text-xs font-bold text-slate-800">{opcao.titulo}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{opcao.nota}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Regua etiqueta="Tamanho do título" chave="heroTituloTamanho" draft={draft} min={HERO_TAMANHO_MIN} max={HERO_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Tamanho do texto" chave="heroTextoTamanho" draft={draft} min={HERO_TAMANHO_MIN} max={HERO_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Posição horizontal do texto" chave="heroTextoX" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
        <Regua etiqueta="Posição vertical do texto" chave="heroTextoY" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
        <Regua etiqueta="Tamanho do botão" chave="heroBotaoTamanho" draft={draft} min={HERO_TAMANHO_MIN} max={HERO_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Posição horizontal do botão" chave="heroBotaoX" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
        <Regua etiqueta="Posição vertical do botão" chave="heroBotaoY" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
      </div>
    </div>
  );
}

function Esquema({ disposicao }: { disposicao: HeroDisposicao }) {
  const texto = <span className="h-6 flex-1 rounded bg-[#14263D]" />;
  const cartao = <span className="h-6 w-5 rounded bg-[#FFA900]" />;
  const miolo = disposicao === "texto-centro"
    ? <>{cartao}{texto}{cartao}</>
    : disposicao === "texto-direita"
      ? <><span className="flex flex-1 gap-1">{cartao}{cartao}</span>{texto}</>
      : <>{texto}<span className="flex flex-1 justify-end gap-1">{cartao}{cartao}</span></>;
  return <span className="flex h-8 items-center gap-1 rounded-md bg-slate-100 px-2">{miolo}</span>;
}

function Regua({
  etiqueta, chave, draft, min, max, omissao, sufixo, onChange,
}: {
  etiqueta: string;
  chave: SiteChave;
  draft: Record<SiteChave, string>;
  min: number;
  max: number;
  omissao: number;
  sufixo: string;
  onChange: (chave: SiteChave, valor: string) => void;
}) {
  const valor = numeroSite(draft[chave], min, max, omissao);
  const mostrado = sufixo === "%" ? `${valor}${sufixo}` : valor > 0 ? `+${valor}` : String(valor);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {etiqueta}
        <span className="font-bold normal-case tracking-normal text-slate-800 tabular-nums">{mostrado}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={sufixo === "%" ? 5 : 2}
        value={valor}
        aria-label={etiqueta}
        onChange={e => onChange(chave, e.target.value)}
        className="accent-amber-500"
      />
      <button type="button" onClick={() => onChange(chave, String(omissao))} className="self-start text-xs font-semibold text-slate-500 hover:text-slate-800">Repor</button>
    </label>
  );
}

function CartoesHero({
  draft, cursos, cursosEstado, aEnviar, erroImagem, onChange, onFile,
}: {
  draft: Record<SiteChave, string>;
  cursos: CursoPublico[];
  cursosEstado: "a-carregar" | "pronto" | "erro";
  aEnviar: HeroSlot | null;
  erroImagem: Record<HeroSlot, string>;
  onChange: (chave: SiteChave, valor: string) => void;
  onFile: (slot: HeroSlot, file: File) => void;
}) {
  return (
    <div className="border-t border-slate-100 pt-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Cartões do destaque</h3>
        <p className="mt-1 text-xs text-slate-500">
          São dois cartões. Na disposição «texto à esquerda» ou «texto à direita» ficam os dois do mesmo lado. No centro, fica um de cada lado. Cada um escolhe o texto e a cor do badge, o tamanho e a animação do botão. A pré-visualização ao lado mostra essas escolhas. Cada um pode ser um curso publicado ou um regime (Gold ou Financiada). No curso, a descrição substitui a área da ficha. Em automático, o primeiro mostra a formação de formadores com CCP e o segundo a primeira formação financiada com miniatura. O botão desses cartões abre a inscrição.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          No destino, use um caminho do site (<span className="font-mono">/formacao/nome-do-curso</span>) ou um endereço completo (<span className="font-mono">https://…</span>). O caminho continua válido se o domínio mudar. Vazio abre a ficha do curso, ou o catálogo da linha Gold ou Financiada.
        </p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {([1, 2] as const).map(slot => (
          <CartaoHeroEditor
            key={slot}
            slot={slot}
            draft={draft}
            cursos={cursos}
            cursosEstado={cursosEstado}
            aEnviar={aEnviar === slot}
            erroImagem={erroImagem[slot]}
            onChange={onChange}
            onFile={file => onFile(slot, file)}
          />
        ))}
      </div>
    </div>
  );
}

function CartaoHeroEditor({
  slot, draft, cursos, cursosEstado, aEnviar, erroImagem, onChange, onFile,
}: {
  slot: HeroSlot;
  draft: Record<SiteChave, string>;
  cursos: CursoPublico[];
  cursosEstado: "a-carregar" | "pronto" | "erro";
  aEnviar: boolean;
  erroImagem: string;
  onChange: (chave: SiteChave, valor: string) => void;
  onFile: (file: File) => void;
}) {
  const chaves = HERO[slot];
  const tipo = draft[chaves.tipo];
  const regime = draft[chaves.regime] === "fin" ? "fin" : draft[chaves.regime] === "gold" ? "gold" : "";
  const cursoId = draft[chaves.curso];
  const cursoConhecido = cursos.some(curso => curso.id === cursoId);
  const destino = draft[chaves.destino].trim();
  const destinoInseguro = Boolean(destino) && !moradaSegura(destino);
  const imagem = moradaSegura(draft[chaves.imagem]);
  const imagemInsegura = Boolean(draft[chaves.imagem].trim()) && !imagem;
  const opcoesCurso = cursos.map(curso => ({ value: curso.id, label: curso.titulo, sub: curso.financiamento }));

  function mudarTipo(valor: string) {
    onChange(chaves.tipo, valor);
    if (valor === "regime" && !regime) onChange(chaves.regime, "gold");
  }

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4 space-y-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Cartão {slot === 1 ? "da esquerda" : "da direita"}</legend>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">O que aparece</span>
        <select className={campoCls} value={tipo === "curso" || tipo === "regime" ? tipo : ""} onChange={e => mudarTipo(e.target.value)}>
          <option value="">Automático</option>
          <option value="curso">Um curso</option>
          <option value="regime">Um regime</option>
        </select>
      </label>
      {tipo === "curso" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Curso publicado</span>
          <SearchSelect
            value={cursoId}
            onChange={valor => onChange(chaves.curso, valor)}
            options={opcoesCurso}
            allowEmpty
            emptyLabel={cursosEstado === "a-carregar" ? "A carregar a oferta…" : "Escolher curso…"}
            placeholder="Pesquisar curso…"
            empty={cursosEstado === "erro" ? "Não foi possível ler a oferta." : "Nenhum curso publicado."}
          />
          {cursosEstado === "pronto" && cursoId && !cursoConhecido && (
            <p className="text-xs text-amber-700">Este curso já não está na oferta publicada. O cartão fica oculto até escolher outro.</p>
          )}
          {!cursoId && <p className="text-xs text-slate-500">Sem curso, o cartão volta ao automático.</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</span>
            <textarea
              className={`${campoCls} min-h-20 resize-y`}
              value={draft[chaves.descricao]}
              placeholder={cursos.find(curso => curso.id === cursoId)?.area || "Área do curso"}
              onChange={e => onChange(chaves.descricao, e.target.value)}
              aria-label={slot === 1 ? "Descrição do cartão da esquerda" : "Descrição do cartão da direita"}
            />
            <span className="text-xs text-slate-500">Vazio mantém a área da ficha. A pré-visualização mostra o texto escrito.</span>
          </label>
        </div>
      )}
      {tipo === "regime" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Regime</span>
            <select className={campoCls} value={regime || "gold"} onChange={e => onChange(chaves.regime, e.target.value)}>
              <option value="gold">Gold</option>
              <option value="fin">Financiada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Título</span>
            <input
              className={campoCls}
              value={draft[chaves.titulo]}
              placeholder={regime === "fin" ? "Formação financiada" : "ENA Gold"}
              onChange={e => onChange(chaves.titulo, e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</span>
            <textarea
              className={`${campoCls} min-h-20 resize-y`}
              value={draft[chaves.descricao]}
              onChange={e => onChange(chaves.descricao, e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Miniatura</span>
            {imagem && <img src={imagem} alt="" className="h-28 w-full rounded-lg object-cover bg-slate-100" />}
            <input
              className={campoCls}
              value={draft[chaves.imagem]}
              placeholder="https://… ou /api/v1/public/imagens/…"
              onChange={e => onChange(chaves.imagem, e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className={`inline-flex cursor-pointer px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${aEnviar ? "opacity-60 pointer-events-none" : ""}`}>
                {aEnviar ? "A carregar…" : "Carregar imagem"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={aEnviar}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onFile(file);
                  }}
                />
              </label>
              {draft[chaves.imagem] && (
                <button type="button" onClick={() => onChange(chaves.imagem, "")} className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-50">
                  Retirar
                </button>
              )}
            </div>
            {erroImagem && <p className="text-xs text-red-600">{erroImagem}</p>}
            {imagemInsegura && <p className="text-xs text-amber-700">Este endereço não é mostrado. Use https://… ou um caminho /…</p>}
            <p className="text-xs text-slate-500">JPG, PNG, WebP ou GIF, até 8 MB. Grave o site depois de carregar.</p>
          </div>
        </>
      )}
      {(tipo === "curso" || tipo === "regime") && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Texto do botão</span>
            <input
              className={campoCls}
              value={draft[chaves.botao]}
              placeholder={tipo === "regime" ? "Ver cursos" : "Pré-inscrever"}
              onChange={e => onChange(chaves.botao, e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino</span>
            <input
              className={campoCls}
              value={draft[chaves.destino]}
              placeholder={tipo === "regime" ? (regime === "fin" ? "/formacao?linha=financiada" : "/formacao?linha=gold") : "/formacao/nome-do-curso"}
              onChange={e => onChange(chaves.destino, e.target.value)}
            />
            {destinoInseguro && <p className="text-xs text-amber-700">Este destino não é usado. Escreva um caminho /… ou um endereço http(s).</p>}
          </label>
        </>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Texto do badge</span>
        <input
          className={campoCls}
          value={draft[chaves.badge]}
          placeholder={tipo === "regime" ? (regime === "fin" ? "Financiada" : "Gold") : "Preço do curso"}
          onChange={e => onChange(chaves.badge, e.target.value)}
          aria-label={slot === 1 ? "Texto do badge da esquerda" : "Texto do badge da direita"}
        />
        <span className="text-xs text-slate-500">Vazio mantém o preço do curso, ou Gold / Financiada.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cor do badge</span>
        <span className="flex items-center gap-2">
          <select className={`${campoCls} min-w-0 flex-1`} value={["ouro", "vermelho", "azul"].includes(draft[chaves.badgeCor]) ? draft[chaves.badgeCor] : ""} onChange={e => onChange(chaves.badgeCor, e.target.value)} aria-label={slot === 1 ? "Cor do badge da esquerda" : "Cor do badge da direita"}>
            <option value="">Automática</option>
            <option value="ouro">Ouro</option>
            <option value="vermelho">Vermelho</option>
            <option value="azul">Azul</option>
          </select>
          <span className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-[11px] font-extrabold ${classeSelo(heroBadgeCor(chave => draft[chave] ?? "", slot, tipo === "regime" ? regime !== "fin" : slot === 1))}`} aria-hidden="true">Aa</span>
        </span>
        <span className="text-xs text-slate-500">Automática é ouro à esquerda e vermelho à direita. Num regime, ouro no Gold e vermelho na Financiada.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tamanho do cartão</span>
        <select className={campoCls} value={draft[chaves.tamanho] === "pequeno" || draft[chaves.tamanho] === "grande" ? draft[chaves.tamanho] : ""} onChange={e => onChange(chaves.tamanho, e.target.value)} aria-label={slot === 1 ? "Tamanho do cartão da esquerda" : "Tamanho do cartão da direita"}>
          <option value="pequeno">Pequeno</option>
          <option value="">Médio</option>
          <option value="grande">Grande</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Animação do botão</span>
        <select className={campoCls} value={["pulsar", "brilho", "saltar", "abanar"].includes(draft[chaves.animacao]) ? draft[chaves.animacao] : ""} onChange={e => onChange(chaves.animacao, e.target.value)} aria-label={slot === 1 ? "Animação do botão da esquerda" : "Animação do botão da direita"}>
          <option value="">Nenhuma</option>
          <option value="pulsar">Pulsar</option>
          <option value="brilho">Brilho</option>
          <option value="saltar">Saltar</option>
          <option value="abanar">Abanar</option>
        </select>
        <span className="text-xs text-slate-500">A animação pára para quem pediu menos movimento no sistema.</span>
      </label>
    </fieldset>
  );
}
