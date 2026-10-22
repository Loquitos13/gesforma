// API do domínio "catalogos": opções para selects e filtros, e os itens de cada catálogo com o seu uso.
import { api, ApiError, enviar, qs } from "./cliente";

export type Regime = "gold" | "fin";

/** Uma opção: `valor` grava-se, `rotulo` mostra-se. */
export type Opcao = { valor: string; rotulo: string; id?: number; regime?: Regime; extra?: Record<string, unknown> };

/** Tipos servidos por `GET /v1/opcoes/:kind` (server/src/repos/catalogos.ts). */
export type KindOpcoes =
  | "cursos" | "turmas" | "formadores" | "locais" | "datas" | "horarios" | "areas" | "modulos" | "conteudos"
  | "tematicas" | "programas" | "financiadores" | "comerciais" | "campanhas" | "lista" | "modelos_conteudo";

type OptsOpcoes = { regime?: Regime; lista?: string; todos?: boolean };
type Pendente = { kind: KindOpcoes; resolver: (r: { kind: KindOpcoes; opcoes: Opcao[] }) => void; rejeitar: (e: unknown) => void };

/** Pedidos de opções feitos no mesmo instante (50 ms) juntam-se num só `GET /v1/opcoes?kinds=…`. */
const JANELA_MS = 50;
const lotes = new Map<string, { opts: OptsOpcoes; pendentes: Pendente[] }>();

function despachar(chave: string) {
  const lote = lotes.get(chave);
  lotes.delete(chave);
  if (!lote) return;
  const kinds = [...new Set(lote.pendentes.map(p => p.kind))];
  const { regime, lista, todos } = lote.opts;
  api<{ opcoes: Partial<Record<KindOpcoes, Opcao[]>> }>(`/v1/opcoes${qs({ kinds: kinds.join(","), regime, lista, todos })}`)
    .then(r => {
      for (const p of lote.pendentes) {
        const opcoes = r.opcoes[p.kind];
        if (opcoes) p.resolver({ kind: p.kind, opcoes });
        else p.rejeitar(new ApiError(403, "Sem acesso a estas opções."));
      }
    })
    .catch(e => lote.pendentes.forEach(p => p.rejeitar(e)));
}

export function apiOpcoes(kind: KindOpcoes, opts: OptsOpcoes = {}, signal?: AbortSignal) {
  const chave = `${opts.regime ?? ""}|${opts.lista ?? ""}|${opts.todos ? 1 : 0}`;
  return new Promise<{ kind: KindOpcoes; opcoes: Opcao[] }>((resolver, rejeitar) => {
    if (signal?.aborted) return rejeitar(new DOMException("Cancelado", "AbortError"));
    // Quem cancela deixa de esperar; o pedido partilhado continua para os outros.
    signal?.addEventListener("abort", () => rejeitar(new DOMException("Cancelado", "AbortError")), { once: true });
    let lote = lotes.get(chave);
    if (!lote) {
      lote = { opts, pendentes: [] };
      lotes.set(chave, lote);
      setTimeout(() => despachar(chave), JANELA_MS);
    }
    lote.pendentes.push({ kind, resolver, rejeitar });
  });
}

/** Tipos de catálogo editáveis (`catalog_items.kind`). */
export type KindCatalogo = "datas" | "locais" | "horarios" | "areas" | "modulos" | "conteudos" | "blog_tematicas" | "programas";

/** Um item do catálogo: os campos do payload, mais o uso contado no servidor (`turmas`, `cursos`, `posts`, …). */
export type ItemCatalogo = { id: number; regime: Regime; uso: Record<string, number> } & Record<string, unknown>;

export function apiCatalogo(kind: KindCatalogo, regime: Regime | undefined, signal?: AbortSignal) {
  return api<{ kind: KindCatalogo; itens: ItemCatalogo[] }>(`/v1/catalogos/${kind}${qs({ regime })}`, { signal });
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
