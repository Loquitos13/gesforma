// Desenha o JSON de uma página do editor com os mesmos componentes, sem carregar o Puck no site público.
// Os slots (listas de blocos dentro de um bloco) viram componentes, como no Puck.
import type { CSSProperties, ElementType } from "react";
import type { Config, Data } from "@puckeditor/core";

type Item = { type: string; props: Record<string, unknown> };

const ehItem = (v: unknown): v is Item =>
  Boolean(v && typeof v === "object" && typeof (v as Item).type === "string" && (v as Item).props && typeof (v as Item).props === "object");

const ehSlot = (v: unknown): v is Item[] => Array.isArray(v) && v.length > 0 && v.every(ehItem);

const PUCK = { isEditing: false, dragRef: null, metadata: {}, renderDropZone: () => null };

function Bloco({ item, config }: { item: Item; config: Config }) {
  const def = config.components[item.type];
  if (!def) return null;
  const props: Record<string, unknown> = {};
  const campos = (def.fields ?? {}) as Record<string, { type?: string }>;
  for (const [k, v] of Object.entries(item.props)) {
    if (campos[k]?.type === "slot" || ehSlot(v)) {
      const filhos = Array.isArray(v) ? v.filter(ehItem) : [];
      props[k] = ({ className, style, as }: { className?: string; style?: CSSProperties; as?: ElementType }) => {
        const Tag = as ?? "div";
        return <Tag className={className} style={style}>{filhos.map((f, i) => <Bloco key={String(f.props.id ?? i)} item={f} config={config} />)}</Tag>;
      };
    } else {
      props[k] = v;
    }
  }
  // Slots sem itens gravados continuam a ser componentes (vazios).
  for (const [k, f] of Object.entries(campos)) {
    if (f?.type === "slot" && typeof props[k] !== "function") props[k] = ({ className, style }: { className?: string; style?: CSSProperties }) => <div className={className} style={style} />;
  }
  const Componente = def.render as unknown as ElementType;
  return <Componente {...props} puck={PUCK} editMode={false} />;
}

export function DesenharPagina({ config, dados }: { config: Config; dados: Data }) {
  const conteudo = (dados.content ?? []).filter(ehItem) as Item[];
  const filhos = conteudo.map((item, i) => <Bloco key={String(item.props.id ?? i)} item={item} config={config} />);
  const Raiz = config.root?.render as unknown as ElementType | undefined;
  const raiz = (dados.root as { props?: Record<string, unknown> } | undefined)?.props ?? {};
  return Raiz ? <Raiz {...raiz} puck={PUCK} editMode={false}>{filhos}</Raiz> : <>{filhos}</>;
}
