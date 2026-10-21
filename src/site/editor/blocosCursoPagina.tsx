// Bloco "Página do curso": o detalhe de um curso (banner, síntese, dados, objetivos, programa, turmas
// e cartão de inscrição). A mesma página serve todos os cursos; no editor escolhe-se o curso a ver.
import { createContext, useContext, useEffect, type ComponentType, type CSSProperties } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { ePrepago, ePreinscricao, rotuloBotaoInscricao } from "../../partilhado/siteConteudo";
import { useInscricaoOpcional } from "../SiteInscricao";
import { Icon, OfertaCtx, type Course } from "../SiteLanding";
import { campoCurso, simNao } from "./campos";
import { campoAparencia } from "./camposGrupos";
import { estiloBloco, estiloVazio, type Estilo } from "./estilos";

/** O endereço do curso a mostrar (/formacao/<id>), dado pela rota pública. */
export const CursoDaRotaCtx = createContext<string | null>(null);

type Zona = ComponentType<{ className?: string; style?: CSSProperties; minEmptyHeight?: number }>;

type Props = {
  previsualizar: string;
  zonaTopo: Slot; zonaConteudo: Slot; zonaCartao: Slot;
  voltar: string; mostrarBanner: boolean;
  tituloSintese: string; mostrarDados: boolean;
  tituloObjetivos: string; mostrarObjetivos: boolean;
  tituloPrograma: string; mostrarPrograma: boolean;
  tituloTurmas: string; mostrarTurmas: boolean;
  mostrarCartao: boolean; mostrarImagemCartao: boolean;
  textoPrepago: string; textoPreinscricao: string; textoDireto: string;
  aparencia: Estilo;
};

function duracaoModulo(raw: string) {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = /^(\d+)(?:h|:)?(\d{0,2})(?:min)?$/.exec(s);
  if (!m) return raw.trim();
  const horas = Number(m[1]);
  const minutos = m[2] ? Number(m[2]) : 0;
  return minutos ? `${horas} h ${String(minutos).padStart(2, "0")} min` : `${horas} h`;
}

/** No site: o curso da rota. No editor: o escolhido para pré-visualizar (ou o primeiro da oferta). */
function useCursoAtual(previsualizar: string, editar: boolean) {
  const ctx = useContext(OfertaCtx);
  const rota = useContext(CursoDaRotaCtx);
  const cursos = ctx?.cursos ?? [];
  const estado = ctx?.estado ?? "a-carregar";
  if (editar) return { estado, curso: cursos.find(c => c.id === previsualizar) ?? cursos[0] ?? null, recarregar: ctx?.recarregar };
  const pedido = (rota ?? "").toLowerCase();
  const curso = /^(?:gold|fin)-\d+$/.test(pedido) ? null : cursos.find(c => c.id === pedido) ?? null;
  return { estado, curso, recarregar: ctx?.recarregar };
}

function Detalhe({ p, curso, editar, Z }: { p: Props; curso: Course; editar: boolean; Z: { topo?: Zona; conteudo?: Zona; cartao?: Zona } }) {
  const { abrir } = useInscricaoOpcional();
  useEffect(() => { if (!editar) document.title = `${curso.title} | ENA`; }, [curso.title, editar]);
  const imagem = curso.banner || curso.miniatura;
  const local = curso.sessoes.find(s => s.local)?.local || (curso.format === "E-learning" ? "Online" : "A anunciar");
  const ZT = Z.topo, ZC = Z.conteudo, ZK = Z.cartao;
  return (
    <main>
      {p.mostrarBanner && (
        <section className="bg-[var(--c-primaria)] text-white">
          <div className="mx-auto px-5 pt-10 lg:px-8" style={{ maxWidth: "var(--largura)" }}>
            {p.voltar && (
              <a href="/formacao" className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white">
                <span className="rotate-180"><Icon name="arrow" /></span> {p.voltar}
              </a>
            )}
          </div>
          <div className="relative mx-auto mt-8 min-h-[280px] max-h-[480px] w-full overflow-hidden bg-black/20" style={{ maxWidth: "var(--largura)" }}>
            {imagem && <img src={imagem} alt="" className="max-h-[480px] w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-primaria)] via-[var(--c-primaria)]/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-8 lg:px-8">
              <div className="flex flex-wrap gap-3">
                {curso.format && <span className="bg-[var(--c-destaque)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider">{curso.format}</span>}
                {curso.sincronia && <span className="border border-white/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.sincronia}</span>}
                {curso.area && <span className="border border-white/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.area}</span>}
                <span className="bg-[var(--c-acento)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--c-primaria)]">{curso.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
              </div>
              <h1 className="mt-4 max-w-4xl font-serif text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl">{curso.title}</h1>
            </div>
          </div>
        </section>
      )}
      {ZT && <ZT className="flex flex-col ena-zona" minEmptyHeight={40} />}
      <section className="px-5 py-12 lg:px-8 lg:py-16">
        <div className={`mx-auto grid gap-12 ${p.mostrarCartao ? "lg:grid-cols-[1fr_360px]" : ""}`} style={{ maxWidth: "var(--largura)" }}>
          <div className="max-w-3xl">
            {p.tituloSintese && <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--c-destaque)]">{p.tituloSintese}</p>}
            <p className="mt-4 text-lg leading-8 opacity-75">{curso.description}</p>
            {p.mostrarDados && (
              <div className="mt-8 grid grid-cols-2 gap-px bg-black/10 sm:grid-cols-4">
                {[[curso.duration, "Duração"], [curso.start, "Início"], [local, "Local"], [curso.price, "Investimento"]].map(([valor, rotulo]) => (
                  <div key={rotulo} className="border-t-4 border-[var(--c-acento)] bg-white p-4">
                    <span className="block text-xs uppercase tracking-wider opacity-45">{rotulo}</span>
                    <strong className="mt-2 block text-sm">{valor}</strong>
                  </div>
                ))}
              </div>
            )}
            {ZC && <ZC className="mt-10 flex flex-col gap-4 ena-zona" minEmptyHeight={40} />}
            {p.mostrarObjetivos && curso.objetivos.length > 0 && (
              <>
                <h2 className="mt-12 font-serif text-3xl">{p.tituloObjetivos}</h2>
                <ul className="mt-5 space-y-3 opacity-75">
                  {curso.objetivos.map(o => <li key={o} className="flex gap-3"><Icon name="check" className="mt-1 h-4 w-4 shrink-0" />{o}</li>)}
                </ul>
              </>
            )}
            {p.mostrarPrograma && curso.programa.length > 0 && (
              <>
                <h2 className="mt-12 border-b border-black/15 pb-4 font-serif text-3xl">{p.tituloPrograma}</h2>
                <div className="divide-y divide-black/15">
                  {curso.programa.map((m, i) => (
                    <div key={`${m.titulo}-${i}`} className="flex items-baseline gap-4 py-5">
                      <span className="w-24 shrink-0 text-sm font-extrabold text-[var(--c-destaque)]">{curso.organizacao === "livre" ? String(i + 1).padStart(2, "0") : `Módulo ${i + 1}`}</span>
                      <strong>{m.titulo}</strong>
                      {m.horas && <span className="ml-auto shrink-0 text-sm opacity-55">{duracaoModulo(m.horas)}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
            {p.mostrarTurmas && curso.sessoes.length > 0 && (
              <>
                <h2 className="mt-12 border-b border-black/15 pb-4 font-serif text-3xl">{p.tituloTurmas}</h2>
                <div className="divide-y divide-black/15">
                  {curso.sessoes.map(s => (
                    <div key={`${s.data}-${s.local}-${s.horario}`} className="flex flex-wrap items-center justify-between gap-3 py-5">
                      <strong>{s.data}</strong>
                      <span className="text-sm opacity-65">{[s.local, s.horario].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {p.mostrarCartao && (
            <aside className="h-fit border-t-4 border-[var(--c-destaque)] bg-white p-7 shadow-[0_18px_50px_rgba(18,52,59,.18)] lg:sticky lg:top-28">
              {p.mostrarImagemCartao && (
                <div className="mb-5 h-36 w-full overflow-hidden bg-[#E7EBF0]">
                  {(curso.capa || curso.miniatura) && <img src={curso.capa || curso.miniatura || ""} alt="" className="h-full w-full object-cover" />}
                </div>
              )}
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--c-destaque)]">{curso.enrollment}</p>
              <h2 className="mt-3 font-serif text-3xl">{curso.price}</h2>
              <p className="mt-4 text-sm leading-6 opacity-65">
                {ePrepago(curso.enrollment) ? p.textoPrepago : ePreinscricao(curso.enrollment) ? p.textoPreinscricao : p.textoDireto}
              </p>
              <button type="button" onClick={() => abrir(curso)} className="mt-7 flex w-full items-center justify-between bg-[var(--c-destaque)] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] text-white hover:brightness-90">
                {rotuloBotaoInscricao(curso.enrollment)} <Icon name="arrow" />
              </button>
              {ZK && <ZK className="mt-5 flex flex-col gap-3 ena-zona" minEmptyHeight={30} />}
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}

function Vista({ refRaiz, editar, ...p }: Props & { refRaiz?: ((el: Element | null) => void) | null; editar: boolean }) {
  const { estado, curso, recarregar } = useCursoAtual(p.previsualizar, editar);
  const c = estiloBloco(p.aparencia);
  const z = p as unknown as { zonaTopo?: Zona; zonaConteudo?: Zona; zonaCartao?: Zona };
  return (
    <div ref={refRaiz ?? undefined} className={c.className} style={c.style}>
      {estado === "a-carregar" && <p className="px-5 py-24 text-center opacity-60">A carregar o curso.</p>}
      {estado === "erro" && (
        <div className="px-5 py-24 text-center">
          <p className="opacity-70">Não foi possível carregar o curso.</p>
          {recarregar && <button type="button" onClick={recarregar} className="mt-4 bg-[var(--c-primaria)] px-5 py-3 text-sm font-bold text-white">Tentar de novo</button>}
        </div>
      )}
      {estado === "pronto" && !curso && (
        <div className="px-5 py-24 text-center">
          <h1 className="font-serif text-3xl">{editar ? "Ainda não há cursos publicados para pré-visualizar." : "Este curso não está na oferta."}</h1>
          <a href="/formacao" className="mt-6 inline-flex font-bold text-[var(--c-destaque)] underline">Voltar ao catálogo</a>
        </div>
      )}
      {estado === "pronto" && curso && <Detalhe p={p} curso={curso} editar={editar} Z={{ topo: z.zonaTopo, conteudo: z.zonaConteudo, cartao: z.zonaCartao }} />}
    </div>
  );
}

export const DetalheCurso: ComponentConfig<Props> = {
  label: "Página do curso",
  fields: {
    previsualizar: campoCurso("No editor, ver com o curso"),
    zonaTopo: { type: "slot", label: "Blocos por baixo do banner" },
    zonaConteudo: { type: "slot", label: "Blocos a seguir aos dados do curso" },
    zonaCartao: { type: "slot", label: "Blocos no cartão de inscrição" },
    mostrarBanner: simNao("Banner com imagem e título"),
    voltar: { type: "text", label: "Texto «voltar à formação» (vazio = esconder)" },
    tituloSintese: { type: "text", label: "Etiqueta da síntese" },
    mostrarDados: simNao("Duração, início, local e investimento"),
    mostrarObjetivos: simNao("Objetivos"),
    tituloObjetivos: { type: "text", label: "Título dos objetivos" },
    mostrarPrograma: simNao("Programa"),
    tituloPrograma: { type: "text", label: "Título do programa" },
    mostrarTurmas: simNao("Próximas turmas"),
    tituloTurmas: { type: "text", label: "Título das turmas" },
    mostrarCartao: simNao("Cartão de inscrição ao lado"),
    mostrarImagemCartao: simNao("Imagem no cartão"),
    textoPrepago: { type: "textarea", label: "Cartão · texto (pré-pago)" },
    textoPreinscricao: { type: "textarea", label: "Cartão · texto (pré-inscrição)" },
    textoDireto: { type: "textarea", label: "Cartão · texto (acesso direto)" },
    aparencia: campoAparencia(),
  },
  defaultProps: {
    previsualizar: "", zonaTopo: [], zonaConteudo: [], zonaCartao: [],
    mostrarBanner: true, voltar: "Voltar à formação", tituloSintese: "Síntese", mostrarDados: true,
    mostrarObjetivos: true, tituloObjetivos: "Objetivos", mostrarPrograma: true, tituloPrograma: "Programa",
    mostrarTurmas: true, tituloTurmas: "Próximas turmas", mostrarCartao: true, mostrarImagemCartao: true,
    textoPrepago: "Primeiro recolhemos os seus dados. O pagamento fica no passo seguinte.",
    textoPreinscricao: "A pré-inscrição pede os seus dados e, quando existir, a turma. O pedido fica registado e sai o email automático.",
    textoDireto: "Este curso abre no Moodle. Não há formulário de pré-inscrição.",
    aparencia: estiloVazio(),
  },
  render: ({ puck, ...p }) => <Vista {...(p as unknown as Props)} refRaiz={puck?.dragRef} editar={Boolean(puck?.isEditing)} />,
};
