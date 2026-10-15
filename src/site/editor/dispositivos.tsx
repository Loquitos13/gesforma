// Edição por ecrã: cada bloco guarda os valores do computador (base) e, à parte, só o que muda no
// tablet e no telemóvel. Telemóvel herda do tablet, tablet herda do computador.
// No editor, o ecrã da pré-visualização decide o que se está a editar; no site, a largura da janela.
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export type Disp = "pc" | "tab" | "tel";
type Obj = Record<string, unknown>;
export type Variantes = { base: Obj; tab?: Obj; tel?: Obj };

export const NOMES_DISP: Record<Disp, string> = { pc: "Computador", tab: "Tablet", tel: "Telemóvel" };
export const dispositivoDaLargura = (w: number): Disp => (w < 768 ? "tel" : w < 1024 ? "tab" : "pc");

const eObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clonar = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** `b` por cima de `a`, a fundo nos objectos; listas e valores simples substituem-se. */
export function fundir(a: unknown, b: unknown): unknown {
  if (!eObj(a) || !eObj(b)) return b === undefined ? clonar(a) : clonar(b);
  const out: Obj = clonar(a);
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? fundir(out[k], v) : clonar(v);
  return out;
}

/** O que `novo` tem de diferente de `herdado` (só as folhas que mudam), ou undefined se nada muda. */
export function diferenca(novo: unknown, herdado: unknown): unknown {
  if (eObj(novo) && eObj(herdado)) {
    const out: Obj = {};
    for (const k of Object.keys(novo)) {
      const d = diferenca(novo[k], herdado[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return igual(novo, herdado) ? undefined : clonar(novo);
}

/** Valores de um ecrã (com o que herda); `ate` = só o que vem de cima, sem o próprio ecrã. */
export function valoresDe(v: Variantes, d: Disp, ate = false): Obj {
  if (d === "pc") return ate ? {} : clonar(v.base);
  const tab = fundir(v.base, v.tab ?? {}) as Obj;
  if (d === "tab") return ate ? clonar(v.base) : tab;
  return ate ? tab : fundir(tab, v.tel ?? {}) as Obj;
}

// ─── Campos antigos "no telemóvel" ───────────────────────────────────────────
// Antes havia campos próprios para o telemóvel (colunasTel, margemTel, tamanhoTel…). Passam a ser
// variantes do ecrã; os campos ficam só como canalização para o CSS (preenchidos aqui).

const LADOS = ["t", "r", "b", "l"] as const;

function porCaminho(alvo: Obj, caminho: string[], valor: unknown) {
  let o = alvo;
  for (const k of caminho.slice(0, -1)) o = (o[k] = eObj(o[k]) ? o[k] : {}) as Obj;
  o[caminho[caminho.length - 1]!] = valor;
}

/** Tira os valores antigos de telemóvel/tablet (a qualquer profundidade) e põe-nos nas variantes. */
function migrarLegado(o: Obj, tab: Obj, tel: Obj, caminho: string[] = []) {
  for (const [k, val] of Object.entries(o)) if (eObj(val)) migrarLegado(val, tab, tel, [...caminho, k]);
  const sub = (k: string) => [...caminho, k];
  if ("colunas" in o) {
    if (o.colunasTab != null && o.colunasTab !== o.colunas) porCaminho(tab, sub("colunas"), o.colunasTab);
    if (o.colunasTel != null && o.colunasTel !== (o.colunasTab ?? o.colunas)) porCaminho(tel, sub("colunas"), o.colunasTel);
  }
  if ("altura" in o && o.alturaTel != null && o.alturaTel !== o.altura) porCaminho(tel, sub("altura"), o.alturaTel);
  if ("tamanho" in o && o.tamanhoTel != null && o.tamanhoTel !== o.tamanho) porCaminho(tel, sub("tamanho"), o.tamanhoTel);
  for (const [k, kt] of [["margem", "margemTel"], ["preenchimento", "preenchimentoTel"]] as const) {
    const lt = o[kt];
    if (!eObj(lt)) continue;
    for (const l of LADOS) if (lt[l] != null && lt[l] !== (eObj(o[k]) ? (o[k] as Obj)[l] : null)) porCaminho(tel, sub(k).concat(l), lt[l]);
  }
}

/** Acerta os campos de canalização para o ecrã: o CSS do telemóvel usa os valores deste ecrã. */
function acertarLegado(o: Obj, d: Disp, telOv: Obj | undefined) {
  for (const [k, val] of Object.entries(o)) if (eObj(val)) acertarLegado(val, d, eObj(telOv?.[k]) ? telOv![k] as Obj : undefined);
  if (typeof o.colunas === "number") { o.colunasTab = o.colunas; o.colunasTel = o.colunas; }
  if ("altura" in o && "alturaTel" in o) o.alturaTel = o.altura;
  if ("tamanho" in o && "tamanhoTel" in o) o.tamanhoTel = o.tamanho;
  // Margens: no telemóvel, os lados com valor próprio valem tal e qual; os herdados ficam limitados (6vw).
  for (const [k, kt] of [["margem", "margemTel"], ["preenchimento", "preenchimentoTel"]] as const) {
    if (!(k in o) || !(kt in o)) continue;
    const proprio = eObj(telOv?.[k]) ? telOv![k] as Obj : {};
    const lados = eObj(o[k]) ? o[k] as Obj : {};
    o[kt] = Object.fromEntries(LADOS.map(l => [l, d === "tel" && l in proprio ? lados[l] ?? null : null]));
  }
}

const RESERVADOS = new Set(["id", "puck", "editMode", "__disp"]);

/** Cria as variantes a partir das props de um bloco que ainda não as tem. */
export function criarVariantes(props: Obj, slots: string[]): Variantes {
  const base: Obj = {};
  for (const [k, v] of Object.entries(props)) if (!RESERVADOS.has(k) && !slots.includes(k)) base[k] = clonar(v);
  const tab: Obj = {};
  const tel: Obj = {};
  migrarLegado(base, tab, tel);
  return { base, ...(Object.keys(tab).length ? { tab } : {}), ...(Object.keys(tel).length ? { tel } : {}) };
}

/** Props a usar num ecrã: os valores desse ecrã + id, slots e o resto que não varia. */
export function efetivas(props: Obj, d: Disp, slots: string[]): Obj {
  const v = props.__disp as Variantes | undefined;
  if (!v || !eObj(v.base)) return props;
  const ef = valoresDe(v, d);
  acertarLegado(ef, d, v.tel);
  for (const k of Object.keys(props)) if (RESERVADOS.has(k) || slots.includes(k)) ef[k] = props[k];
  return ef;
}

/**
 * Props para desenhar no editor: são já os valores do ecrã em edição (o painel escreve-os aí);
 * só se acertam os campos de canalização para o CSS.
 */
export function paraDesenhoEdicao(props: Obj, d: Disp): Obj {
  const v = props.__disp as Variantes | undefined;
  const ef: Obj = { ...props };
  // Só se copiam (e acertam) os valores do bloco: `puck`, id e variantes ficam como estão (o `puck` tem ciclos).
  const valores: Obj = {};
  // Os textos editáveis na página chegam como elementos React: não são dados, ficam de fora.
  for (const [k, val] of Object.entries(ef)) if (!RESERVADOS.has(k) && eObj(val) && !("$$typeof" in val)) valores[k] = clonar(val);
  acertarLegado(valores, d, v?.tel);
  return { ...ef, ...valores };
}

/** Regista uma alteração feita no ecrã `d` (a partir das props já alteradas). */
export function registarAlteracao(v: Variantes, props: Obj, chaves: string[], d: Disp): Variantes {
  const novo = clonar(v);
  for (const k of chaves) {
    if (d === "pc") { novo.base[k] = clonar(props[k]); continue; }
    const her = valoresDe(novo, d, true)[k];
    const dif = diferenca(props[k], her);
    const alvo: Obj = { ...(novo[d] ?? {}) };
    if (dif === undefined) delete alvo[k]; else alvo[k] = dif;
    if (Object.keys(alvo).length) novo[d] = alvo; else delete novo[d];
  }
  return novo;
}

// ─── Ecrã actual ─────────────────────────────────────────────────────────────

const DispCtx = createContext<Disp | null>(null);

function larguraDe(el: Element | null) {
  const w = el?.ownerDocument?.defaultView ?? (typeof window !== "undefined" ? window : null);
  return w ? w.innerWidth : 1280;
}

/** Mede o ecrã da janela onde está (no editor, a pré-visualização) e avisa quem estiver a ouvir. */
export function MedirDispositivo({ children, aoMudar }: { children: (ref: (el: HTMLDivElement | null) => void) => ReactNode; aoMudar?: (d: Disp) => void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [d, setD] = useState<Disp>(() => dispositivoDaLargura(larguraDe(null)));
  const aviso = useRef(aoMudar);
  aviso.current = aoMudar;
  useEffect(() => {
    const janela = el?.ownerDocument?.defaultView;
    if (!janela) return;
    const medir = () => setD(dispositivoDaLargura(janela.innerWidth));
    medir();
    janela.addEventListener("resize", medir);
    return () => janela.removeEventListener("resize", medir);
  }, [el]);
  useEffect(() => { aviso.current?.(d); }, [d]);
  return <DispCtx.Provider value={d}>{children(setEl)}</DispCtx.Provider>;
}

/** Ecrã onde o bloco está a ser desenhado (fora do invólucro do tema, mede a janela). */
export function useDispositivo(): Disp {
  const ctx = useContext(DispCtx);
  const [proprio, setProprio] = useState<Disp>(() => dispositivoDaLargura(larguraDe(null)));
  useEffect(() => {
    if (ctx) return;
    const medir = () => setProprio(dispositivoDaLargura(window.innerWidth));
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ctx]);
  return ctx ?? proprio;
}

// ─── Ecrã em edição (editor) ─────────────────────────────────────────────────

let emEdicao: Disp = "pc";
const ouvintes = new Set<() => void>();
export const dispositivoEmEdicao = () => emEdicao;
export function definirDispositivoEmEdicao(d: Disp) {
  if (d === emEdicao) return;
  emEdicao = d;
  for (const f of ouvintes) f();
}
export function useDispositivoEmEdicao() {
  return useSyncExternalStore(f => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => emEdicao, () => emEdicao);
}

/** O editor avisa aqui quando a pré-visualização muda de ecrã. */
export const AvisoDispositivoCtx = createContext<((d: Disp) => void) | null>(null);

// ─── Campo "Ecrã" no topo do painel de cada bloco ────────────────────────────

/** Mostra o ecrã em edição, o que tem valor próprio neste ecrã e permite voltar a herdar. */
export function CampoDispositivo({ value, onChange, rotulos }: { value: Variantes | undefined; onChange: (v: Variantes) => void; rotulos: Record<string, string> }) {
  const d = useDispositivoEmEdicao();
  const proprios = value && d !== "pc" ? Object.keys(value[d] ?? {}) : [];
  const herdeiro = d === "tab" ? "do computador" : "do tablet (e do computador)";
  const tirar = (k?: string) => {
    if (!value || d === "pc") return;
    const resto = { ...(value[d] ?? {}) };
    if (k) delete resto[k]; else for (const x of Object.keys(resto)) delete resto[x];
    const novo: Variantes = { ...value };
    if (Object.keys(resto).length) novo[d] = resto; else delete novo[d];
    onChange(novo);
  };
  return (
    <div className="mb-1 rounded-md border border-[#c9d6f2] bg-[#f3f7fe] p-2.5 text-[12px] text-[#1c2633]">
      <p className="m-0 font-semibold">A editar: {NOMES_DISP[d]}</p>
      {d === "pc"
        ? <p className="m-0 mt-1 text-[#5b6675]">O que mudar aqui vale para todos os ecrãs, menos onde o tablet ou o telemóvel tiverem valor próprio. Mude o ecrã em cima da pré-visualização.</p>
        : <p className="m-0 mt-1 text-[#5b6675]">O que mudar aqui só vale no {NOMES_DISP[d].toLowerCase()}. O resto vem {herdeiro}.</p>}
      {proprios.length > 0 && (
        <div className="mt-2">
          <p className="m-0 font-semibold">Próprio deste ecrã:</p>
          <ul className="m-0 mt-1 list-none space-y-1 p-0">
            {proprios.map(k => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span>{rotulos[k] ?? k}</span>
                <button type="button" onClick={() => tirar(k)} className="text-[11px] text-[#3b6fd8] underline">voltar a herdar</button>
              </li>
            ))}
          </ul>
          {proprios.length > 1 && <button type="button" onClick={() => tirar()} className="mt-2 text-[11px] text-[#a60000] underline">Voltar a herdar tudo</button>}
        </div>
      )}
    </div>
  );
}

// ─── Mudar o ecrã em edição ──────────────────────────────────────────────────

type Item = { type: string; props: Obj };
type Dados = { root?: { props?: Obj }; content?: Item[]; zones?: unknown };

/** Os dados da página com as props de cada bloco nos valores do ecrã `d` (as variantes ficam iguais). */
export function paraDispositivo<D extends Dados>(dados: D, d: Disp, slotsDe: (tipo: string) => string[]): D {
  const bloco = (item: Item): Item => {
    const slots = slotsDe(item.type);
    const props: Obj = { ...item.props };
    for (const s of slots) if (Array.isArray(props[s])) props[s] = (props[s] as Item[]).map(bloco);
    const v = (props.__disp as Variantes | undefined) ?? criarVariantes(props, slots);
    return { ...item, props: efetivas({ ...props, __disp: v }, d, slots) };
  };
  const raiz = dados.root?.props ?? {};
  const vRaiz = (raiz.__disp as Variantes | undefined) ?? criarVariantes(raiz, []);
  return {
    ...dados,
    root: { ...(dados.root ?? {}), props: efetivas({ ...raiz, __disp: vRaiz }, d, []) },
    content: (dados.content ?? []).map(bloco),
  };
}

// ─── Registo das alterações (editor) ─────────────────────────────────────────

/**
 * Compara os dados novos do editor com os anteriores e regista, nas variantes de cada bloco, o que mudou
 * no ecrã em edição. Blocos novos ganham variantes; "voltar a herdar" (variantes mudadas no campo Ecrã)
 * repõe as props com os valores do ecrã. Devolve null se nada precisa de ser reescrito.
 */
export function registarNoEcra<D extends Dados>(novo: D, anterior: D | null, d: Disp, slotsDe: (tipo: string) => string[]): D | null {
  const antes = new Map<string, Obj>();
  const indexar = (itens: Item[] | undefined) => {
    for (const it of itens ?? []) {
      if (typeof it.props?.id === "string") antes.set(it.props.id, it.props);
      for (const s of slotsDe(it.type)) if (Array.isArray(it.props?.[s])) indexar(it.props[s] as Item[]);
    }
  };
  indexar(anterior?.content);
  let mudou = false;
  const tratar = (props: Obj, slots: string[], ant: Obj | undefined): Obj => {
    const v = props.__disp as Variantes | undefined;
    if (!v) { mudou = true; return { ...props, __disp: criarVariantes(props, slots) }; }
    if (!ant) return props;
    if (!igual(v, ant.__disp)) { mudou = true; return efetivas(props, d, slots); }
    const chaves = Object.keys(props).filter(k => !RESERVADOS.has(k) && !slots.includes(k) && !igual(props[k], ant[k]));
    if (!chaves.length) return props;
    mudou = true;
    return { ...props, __disp: registarAlteracao(v, props, chaves, d) };
  };
  const bloco = (it: Item): Item => {
    const slots = slotsDe(it.type);
    let props = { ...it.props };
    for (const s of slots) if (Array.isArray(props[s])) props[s] = (props[s] as Item[]).map(bloco);
    props = tratar(props, slots, typeof props.id === "string" ? antes.get(props.id) : undefined);
    return { ...it, props };
  };
  const conteudo = (novo.content ?? []).map(bloco);
  const raiz = tratar({ ...(novo.root?.props ?? {}) }, [], anterior ? (anterior.root?.props ?? {}) : undefined);
  return mudou ? { ...novo, root: { ...(novo.root ?? {}), props: raiz }, content: conteudo } : null;
}
