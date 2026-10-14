// API do domínio "auditoria": registo das acções (só administração).
import { api, qs, type Pagina } from "./cliente";

export type LinhaAuditoria = {
  id: number;
  quando: string;
  accao: string;
  entidade: string;
  entidade_id: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
  actor_id: string | null;
  actor_nome: string | null;
  actor_email: string | null;
};

export type FiltrosAuditoria = { entidade?: string; utilizador?: string; q?: string; de?: string; ate?: string; pagina?: number; porPagina?: number };

export const apiAuditoria = (f: FiltrosAuditoria, signal?: AbortSignal) =>
  api<Pagina<LinhaAuditoria>>(`/v1/auditoria${qs(f)}`, { signal, silencioso: true });

export const apiOpcoesAuditoria = (signal?: AbortSignal) =>
  api<{ entidades: { entidade: string; total: number }[]; utilizadores: { id: string; nome: string; email: string }[] }>(
    "/v1/auditoria/opcoes", { signal, silencioso: true },
  );
