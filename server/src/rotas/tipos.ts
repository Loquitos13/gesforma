import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/pool.js";

/** Regista uma entrada no `audit_log`. Ver `repos/auditoria.ts`. */
export type Auditar = (
  db: Db,
  actorId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  ip?: string,
  meta?: Record<string, unknown>,
) => Promise<void>;

/** Exige sessão; responde 401/403 e devolve false se não houver. `formando: true` deixa passar o formando. */
export type RequireAuth = (req: FastifyRequest, reply: FastifyReply, opts?: { formando?: boolean }) => boolean;

/** Dependências que cada módulo de rotas recebe. */
export type Deps = {
  db: Db;
  requireAuth: RequireAuth;
  audit: Auditar;
};

/**
 * Assinatura de um módulo de rotas por domínio (`server/src/rotas/<dominio>.ts`):
 *
 *   export async function registar(app: FastifyInstance, deps: Deps) { … }
 */
export type ModuloRotas = (app: FastifyInstance, deps: Deps) => Promise<void> | void;
