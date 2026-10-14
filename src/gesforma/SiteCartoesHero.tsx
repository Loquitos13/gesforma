// Cartões do destaque do site (curso, texto, imagem e botão de cada cartão).
import { SearchSelect } from "../partilhado/FormKit";
import { classeSelo, heroBadgeCor, moradaSegura, type HeroSlot, type SiteChave } from "../partilhado/siteConteudo";
import { HERO, campoCls, type CursoPublico } from "./SiteConteudoView";

export function CartoesHero({
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
