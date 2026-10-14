// Peças do editor do site (destaque, margens, fotografias). O ecrã está em vistas/sistema/Site.tsx.
import type { CursoPreview } from "./SitePreview";
import { corForma, heroDisposicao, heroForma, HERO_CONTENTOR_MAX, HERO_CONTENTOR_MIN, HERO_FORMA_BORDA_MAX, HERO_FORMA_BORDA_MIN, HERO_FORMA_POS_MAX, HERO_FORMA_POS_MIN, HERO_FORMA_TAMANHO_MAX, HERO_FORMA_TAMANHO_MIN, HERO_POS_MAX, HERO_POS_MIN, HERO_TAMANHO_MAX, HERO_TAMANHO_MIN, MARGEM_MAX, MARGEM_MIN, numeroSite, type HeroDisposicao, type HeroForma, type HeroSlot, type SiteChave } from "../partilhado/siteConteudo";

export const campoCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

export const HERO: Record<HeroSlot, {
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

export type CursoPublico = CursoPreview;

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

export function CarregarFotografia({
  slot, aEnviar, erro, onFile,
}: {
  slot: "fundo" | "apresentacao";
  aEnviar: "fundo" | "apresentacao" | null;
  erro: string;
  onFile: (file: File) => void;
}) {
  const ocupado = aEnviar === slot;
  return (
    <div className="mt-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">{ocupado ? "A gravar o ficheiro…" : "Carregar ficheiro"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={aEnviar != null}
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      <p className="mt-1 text-[11px] text-slate-400">O endereço entra no rascunho. O site público só muda depois de Guardar site.</p>
      {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
    </div>
  );
}

export function ControlosMargem({
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

export function ComposicaoHero({
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
        <p className="mt-1 text-xs text-slate-500">A disposição coloca o texto e os cartões. A forma com a fotografia fica no fundo e não acompanha o texto. A largura e a altura mudam o contentor do destaque: 100% é o tamanho de omissão. O tamanho e a posição mexem no texto e no botão que está por baixo dele. Zero na posição é o lugar de omissão. A pré-visualização acompanha o rascunho.</p>
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
        <Regua etiqueta="Largura do contentor" chave="heroContentorLargura" draft={draft} min={HERO_CONTENTOR_MIN} max={HERO_CONTENTOR_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Altura do contentor" chave="heroContentorAltura" draft={draft} min={HERO_CONTENTOR_MIN} max={HERO_CONTENTOR_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Tamanho do título" chave="heroTituloTamanho" draft={draft} min={HERO_TAMANHO_MIN} max={HERO_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Tamanho do texto" chave="heroTextoTamanho" draft={draft} min={HERO_TAMANHO_MIN} max={HERO_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Posição horizontal do texto" chave="heroTextoX" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
        <Regua etiqueta="Posição vertical do texto" chave="heroTextoY" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
        <Regua etiqueta="Tamanho do botão" chave="heroBotaoTamanho" draft={draft} min={HERO_TAMANHO_MIN} max={HERO_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Posição horizontal do botão" chave="heroBotaoX" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
        <Regua etiqueta="Posição vertical do botão" chave="heroBotaoY" draft={draft} min={HERO_POS_MIN} max={HERO_POS_MAX} omissao={0} sufixo="" onChange={onChange} />
      </div>
      <FormaFundo draft={draft} onChange={onChange} />
    </div>
  );
}

const FORMAS: { id: HeroForma; titulo: string }[] = [
  { id: "circulo", titulo: "Círculo" },
  { id: "elipse", titulo: "Elipse" },
  { id: "quadrado", titulo: "Quadrado" },
  { id: "retangulo", titulo: "Retângulo" },
  { id: "losango", titulo: "Losango" },
];

function FormaFundo({
  draft, onChange,
}: {
  draft: Record<SiteChave, string>;
  onChange: (chave: SiteChave, valor: string) => void;
}) {
  const forma = heroForma(draft.heroForma);
  const cor = corForma(draft.heroFormaCor);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Forma de fundo</p>
        <p className="mt-1 text-xs text-slate-500">A fotografia fica atrás do texto e dos cartões. Mudar a disposição ou a posição do texto não a arrasta. Zero na posição deixa o círculo à direita no ecrã grande. 100% é o tamanho de omissão e 14 px é a espessura de omissão.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forma</span>
          <select className={campoCls} value={forma} aria-label="Forma de fundo" onChange={e => onChange("heroForma", e.target.value)}>
            {FORMAS.map(opcao => <option key={opcao.id} value={opcao.id}>{opcao.titulo}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cor da borda
            <span className="font-bold normal-case tracking-normal text-slate-800">{cor}</span>
          </span>
          <input
            type="color"
            value={cor.toLowerCase()}
            aria-label="Cor da borda"
            onChange={e => onChange("heroFormaCor", e.target.value.toUpperCase())}
            className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          />
        </label>
        <Regua etiqueta="Espessura da borda" chave="heroFormaEspessura" draft={draft} min={HERO_FORMA_BORDA_MIN} max={HERO_FORMA_BORDA_MAX} omissao={14} sufixo="px" onChange={onChange} />
        <Regua etiqueta="Tamanho da forma" chave="heroFormaTamanho" draft={draft} min={HERO_FORMA_TAMANHO_MIN} max={HERO_FORMA_TAMANHO_MAX} omissao={100} sufixo="%" onChange={onChange} />
        <Regua etiqueta="Posição horizontal da forma" chave="heroFormaX" draft={draft} min={HERO_FORMA_POS_MIN} max={HERO_FORMA_POS_MAX} omissao={0} sufixo="" passo={5} onChange={onChange} />
        <Regua etiqueta="Posição vertical da forma" chave="heroFormaY" draft={draft} min={HERO_FORMA_POS_MIN} max={HERO_FORMA_POS_MAX} omissao={0} sufixo="" passo={5} onChange={onChange} />
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
  etiqueta, chave, draft, min, max, omissao, sufixo, passo, onChange,
}: {
  etiqueta: string;
  chave: SiteChave;
  draft: Record<SiteChave, string>;
  min: number;
  max: number;
  omissao: number;
  sufixo: string;
  passo?: number;
  onChange: (chave: SiteChave, valor: string) => void;
}) {
  const valor = numeroSite(draft[chave], min, max, omissao);
  const mostrado = sufixo === "%" ? `${valor}${sufixo}` : sufixo === "px" ? `${valor} px` : valor > 0 ? `+${valor}` : String(valor);
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
        step={passo ?? (sufixo === "%" ? 5 : sufixo === "px" ? 1 : 2)}
        value={valor}
        aria-label={etiqueta}
        onChange={e => onChange(chave, e.target.value)}
        className="accent-amber-500"
      />
      <button type="button" onClick={() => onChange(chave, String(omissao))} className="self-start text-xs font-semibold text-slate-500 hover:text-slate-800">Repor</button>
    </label>
  );
}
