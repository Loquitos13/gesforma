// Campos do painel do editor visual: números sem limites (arrastar a etiqueta muda o valor),
// quatro lados, medidas com unidade, cores do tema, imagens e cursos.
import { useContext, useRef, useState, type ReactNode } from "react";
import type { CustomField, Field } from "@puckeditor/core";
import { apiImagemSite } from "../../partilhado/api/site";
import { OfertaCtx } from "../SiteLanding";
import { CORES_TEMA, FONTES, type Lados, type Medida } from "./estilos";

const caixa = "w-full min-w-0 rounded border border-[#d4d8de] bg-white px-2 py-1 text-[13px] text-[#1c2633] outline-none focus:border-[#3b6fd8]";
const rotuloCls = "mb-1 block text-[12px] font-semibold text-[#3d4a5a]";

function Rotulo({ texto, children, arrastar }: { texto: string; children: ReactNode; arrastar?: (delta: number) => void }) {
  const inicio = useRef<number | null>(null);
  return (
    <div className="mb-1">
      <span
        className={`${rotuloCls} ${arrastar ? "cursor-ew-resize select-none" : ""}`}
        title={arrastar ? "Arraste para os lados para mudar o valor" : undefined}
        onPointerDown={arrastar ? e => { inicio.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); } : undefined}
        onPointerMove={arrastar ? e => {
          if (inicio.current == null) return;
          const d = Math.round((e.clientX - inicio.current) / (e.shiftKey ? 1 : 3));
          if (d !== 0) { arrastar(d * (e.shiftKey ? 10 : 1)); inicio.current = e.clientX; }
        } : undefined}
        onPointerUp={() => { inicio.current = null; }}
      >
        {texto}
      </span>
      {children}
    </div>
  );
}

/** Número livre (aceita negativos e vazio = herdado). */
export function NumeroLivre({ valor, onChange, sufixo, placeholder, passo = 1, rotulo }: {
  valor: number | null | undefined; onChange: (v: number | null) => void; sufixo?: string; placeholder?: string; passo?: number; rotulo?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valor == null ? "" : String(valor));
  const entrada = (
    <div className="flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        step={passo}
        className={caixa}
        value={mostrado}
        placeholder={placeholder ?? "auto"}
        aria-label={rotulo}
        onChange={e => {
          setTexto(e.target.value);
          const n = e.target.value.trim() === "" ? null : Number(e.target.value);
          if (n === null || !Number.isNaN(n)) onChange(n);
        }}
        onBlur={() => setTexto(null)}
      />
      {sufixo && <span className="shrink-0 text-[11px] text-[#6b7685]">{sufixo}</span>}
    </div>
  );
  if (!rotulo) return entrada;
  return <Rotulo texto={rotulo} arrastar={d => onChange(Math.round(((valor ?? 0) + d * passo) * 100) / 100)}>{entrada}</Rotulo>;
}

export function campoNumero(label: string, sufixo = "px", passo = 1): CustomField<number | null> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => <NumeroLivre rotulo={label} valor={value} onChange={onChange} sufixo={sufixo} passo={passo} />,
  };
}

export function campoLados(label: string): CustomField<Lados> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => <CampoLados label={label} value={value} onChange={onChange} />,
  };
}

function CampoLados({ label, value, onChange }: { label: string; value: Lados | undefined; onChange: (v: Lados) => void }) {
  const v = value ?? { t: null, r: null, b: null, l: null };
  const [ligado, setLigado] = useState(false);
  const mudar = (k: keyof Lados, n: number | null) => onChange(ligado ? { t: n, r: n, b: n, l: n } : { ...v, [k]: n });
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between">
        <span className={rotuloCls}>{label}</span>
        <button type="button" onClick={() => setLigado(!ligado)} aria-pressed={ligado}
          className={`mb-1 rounded px-1.5 text-[11px] ${ligado ? "bg-[#3b6fd8] text-white" : "bg-[#eef1f5] text-[#3d4a5a]"}`}
          title="Mudar os quatro lados ao mesmo tempo">⛓ iguais</button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {([["t", "Cima"], ["r", "Dir."], ["b", "Baixo"], ["l", "Esq."]] as const).map(([k, r]) => (
          <label key={k} className="text-center text-[10px] text-[#6b7685]">
            <NumeroLivre valor={v[k]} onChange={n => mudar(k, n)} />
            {r}
          </label>
        ))}
      </div>
    </div>
  );
}

export function campoMedida(label: string): CustomField<Medida> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => {
      const v = value ?? { valor: null, unidade: "px" as const };
      return (
        <Rotulo texto={label} arrastar={d => onChange({ ...v, valor: (v.valor ?? 0) + d })}>
          <div className="flex gap-1">
            <NumeroLivre valor={v.valor} onChange={n => onChange({ ...v, valor: n })} />
            <select className={`${caixa} w-[70px] shrink-0`} value={v.unidade} onChange={e => onChange({ ...v, unidade: e.target.value as Medida["unidade"] })}>
              {["px", "%", "vw", "vh", "rem"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </Rotulo>
      );
    },
  };
}

/** Cor livre ou do tema (`comTema = false` no próprio tema da página, que não se pode referir a si mesmo). */
export function campoCor(label: string, comTema = true): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => {
      const v = value ?? "";
      const hex = /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
      return (
        <Rotulo texto={label}>
          <div className="flex flex-wrap items-center gap-1">
            {comTema && CORES_TEMA.map(c => (
              <button key={c.valor} type="button" title={`${c.rotulo} (cor do tema)`} aria-label={`${c.rotulo} (cor do tema)`} onClick={() => onChange(c.valor)}
                className={`h-6 w-6 rounded-full border ${v === c.valor ? "ring-2 ring-[#3b6fd8] ring-offset-1" : "border-[#c5cbd3]"}`}
                style={{ background: c.valor.replace(")", `, ${c.amostra})`) }} />
            ))}
            <input type="color" aria-label="Escolher cor" value={hex} onChange={e => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-[#c5cbd3] bg-white p-0" />
            <input className={`${caixa} w-[84px]`} value={v} placeholder="herdada" onChange={e => onChange(e.target.value.trim())} aria-label="Código da cor" />
            {v && <button type="button" onClick={() => onChange("")} className="text-[11px] text-[#6b7685] underline">limpar</button>}
          </div>
        </Rotulo>
      );
    },
  };
}

export function campoFonte(label: string): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => (
      <Rotulo texto={label}>
        <select className={caixa} value={value ?? ""} onChange={e => onChange(e.target.value)}>
          <option value="">Herdada</option>
          <option value="tema-titulos">Fonte dos títulos (tema)</option>
          <option value="tema-texto">Fonte do texto (tema)</option>
          {Object.keys(FONTES).map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </Rotulo>
    ),
  };
}

export function campoImagem(label: string): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => <CampoImagem label={label} value={value ?? ""} onChange={onChange} />,
  };
}

function CampoImagem({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <Rotulo texto={label}>
      {value && <img src={value} alt="" className="mb-1 h-20 w-full rounded object-cover" />}
      <div className="flex gap-1">
        <button type="button" disabled={aEnviar} onClick={() => input.current?.click()}
          className="rounded bg-[#3b6fd8] px-2 py-1 text-[12px] font-semibold text-white disabled:opacity-60">{aEnviar ? "A enviar…" : "Carregar"}</button>
        <input className={caixa} value={value} placeholder="ou cole um endereço https://" onChange={e => onChange(e.target.value.trim())} />
        {value && <button type="button" onClick={() => onChange("")} className="text-[11px] text-[#6b7685] underline">tirar</button>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={async e => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setAEnviar(true);
        setErro("");
        try { onChange((await apiImagemSite(f)).url); } catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível enviar."); }
        setAEnviar(false);
      }} />
      {erro && <p className="mt-1 text-[11px] text-[#a60000]">{erro}</p>}
    </Rotulo>
  );
}

/** Nomes dos cursos por id, para os resumos das listas no painel (o editor preenche-o ao carregar a oferta). */
export const nomesCursos = new Map<string, string>();

/** Escolha de um curso da oferta publicada (o mesmo catálogo que o site mostra). */
export function campoCurso(label: string): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => <CampoCurso label={label} value={value ?? ""} onChange={onChange} />,
  };
}

function CampoCurso({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const oferta = useContext(OfertaCtx);
  const cursos = oferta?.cursos ?? [];
  for (const c of cursos) nomesCursos.set(c.id, c.title);
  return (
    <Rotulo texto={label}>
      <select className={caixa} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Escolha o curso</option>
        {cursos.map(c => <option key={c.id} value={c.id}>{c.title} · {c.funding}</option>)}
      </select>
      {value && !cursos.some(c => c.id === value) && oferta?.estado === "pronto" && (
        <p className="mt-1 text-[11px] text-[#a60000]">Este curso já não está na oferta publicada: não aparece no site.</p>
      )}
    </Rotulo>
  );
}

/** Lista de opções ligadas/desligadas (ex.: informação visível no cartão). */
export function campoMarcas<K extends string>(label: string, opcoes: readonly { valor: K; rotulo: string }[]): CustomField<K[]> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => {
      const v = new Set(value ?? []);
      return (
        <Rotulo texto={label}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {opcoes.map(o => (
              <label key={o.valor} className="flex items-center gap-1.5 text-[12px] text-[#1c2633]">
                <input type="checkbox" checked={v.has(o.valor)} onChange={e => {
                  const n = new Set(v);
                  if (e.target.checked) n.add(o.valor); else n.delete(o.valor);
                  onChange(opcoes.map(x => x.valor).filter(x => n.has(x)));
                }} />
                {o.rotulo}
              </label>
            ))}
          </div>
        </Rotulo>
      );
    },
  };
}

export const simNao = (label: string): Field => ({ type: "radio", label, options: [{ label: "Sim", value: true }, { label: "Não", value: false }] });
