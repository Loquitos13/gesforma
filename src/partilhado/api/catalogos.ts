// API do domínio "catalogos": opções para selects e filtros, e os itens de cada catálogo com o seu uso.
import { api, enviar, qs } from "./cliente";

export type Regime = "gold" | "fin";

/** Uma opção: `valor` grava-se, `rotulo` mostra-se. */
export type Opcao = { valor: string; rotulo: string; id?: number; regime?: Regime; extra?: Record<string, unknown> };

/** Tipos servidos por `GET /v1/opcoes/:kind` (server/src/repos/catalogos.ts). */
export type KindOpcoes =
  | "cursos" | "turmas" | "formadores" | "locais" | "datas" | "horarios" | "areas" | "modulos" | "conteudos"
  | "tematicas" | "financiadores" | "comerciais" | "campanhas" | "lista" | "modelos_conteudo";

export function apiOpcoes(kind: KindOpcoes, opts: { regime?: Regime; lista?: string; todos?: boolean } = {}, signal?: AbortSignal) {
  return api<{ kind: KindOpcoes; opcoes: Opcao[] }>(
    `/v1/opcoes/${kind}${qs({ regime: opts.regime, lista: opts.lista, todos: opts.todos })}`,
    { silencioso: true, signal },
  );
}

/** Tipos de catálogo editáveis (`catalog_items.kind`). */
export type KindCatalogo = "datas" | "locais" | "horarios" | "areas" | "modulos" | "conteudos" | "blog_tematicas";

/** Um item do catálogo: os campos do payload, mais o uso contado no servidor (`turmas`, `cursos`, `posts`, …). */
export type ItemCatalogo = { id: number; regime: Regime; uso: Record<string, number> } & Record<string, unknown>;

export function apiCatalogo(kind: KindCatalogo, regime: Regime | undefined, signal?: AbortSignal) {
  return api<{ kind: KindCatalogo; itens: ItemCatalogo[] }>(`/v1/catalogos/${kind}${qs({ regime })}`, { signal, silencioso: true });
}

export const apiCriarItem = (kind: KindCatalogo, regime: Regime, payload: Record<string, unknown>) =>
  enviar.post<{ item: { id: number } & Record<string, unknown> }>(`/v1/catalog/${kind}`, { regime, payload });

export const apiEditarItem = (kind: KindCatalogo, id: number, payload: Record<string, unknown>) =>
  enviar.patch<{ item: { id: number } & Record<string, unknown> }>(`/v1/catalog/${kind}/${id}`, { payload });

export const apiApagarItem = (kind: KindCatalogo, id: number) => enviar.delete<{ ok: boolean }>(`/v1/catalog/${kind}/${id}`);

/** Texto curto com o uso de um item ("3 turmas, 2 datas"). */
export function textoUso(uso: Record<string, number> | undefined) {
  const nomes: Record<string, [string, string]> = {
    turmas: ["turma", "turmas"], datas: ["data", "datas"], cursos: ["curso", "cursos"], conteudos: ["conteúdo", "conteúdos"],
    posts: ["publicação", "publicações"], preinscricoes: ["pré-inscrição", "pré-inscrições"],
  };
  return Object.entries(uso ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${n === 1 ? nomes[k]?.[0] ?? k : nomes[k]?.[1] ?? k}`)
    .join(", ");
}

export function totalUso(uso: Record<string, number> | undefined) {
  return Object.values(uso ?? {}).reduce((a, b) => a + b, 0);
}
