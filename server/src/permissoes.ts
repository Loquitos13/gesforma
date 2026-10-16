/**
 * Matriz central de permissões das rotas do GesForma (classe "staff").
 * Aplicada no preHandler depois de `classifyRoute`. As verificações finas
 * (o formador só mexe nas suas turmas, por exemplo) continuam no handler.
 *
 * As regras vivem por domínio em `permissoes/<dominio>.ts`; aqui só se juntam,
 * por ordem. A primeira linha que corresponde ganha.
 *
 * Regras por omissão, quando nenhuma linha corresponde:
 * - formador: só leitura, e nunca nas áreas de `FORMADOR_SEM_LEITURA`;
 * - restantes perfis da equipa: leitura e escrita.
 */
import { EQUIPA, FIN, GOLD, type Perfil, type Regra } from "./permissoes/perfis.js";
import { regras as sistema } from "./permissoes/sistema.js";
import { regras as emails } from "./permissoes/emails.js";
import { regras as pagamentos } from "./permissoes/pagamentos.js";
import { regras as cursos } from "./permissoes/cursos.js";
import { regras as campanhas } from "./permissoes/campanhas.js";
import { regras as blog } from "./permissoes/blog.js";
import { regras as formadores } from "./permissoes/formadores.js";
import { regras as crm } from "./permissoes/crm.js";
import { regras as turmas } from "./permissoes/turmas.js";
import { regras as pedagogia } from "./permissoes/pedagogia.js";
import { regras as comum } from "./permissoes/comum.js";
import { regras as painel } from "./permissoes/painel.js";
import { regras as formandos } from "./permissoes/formandos.js";
import { regras as inqueritos } from "./permissoes/inqueritos.js";
import { regras as despesas } from "./permissoes/despesas.js";
import { regras as dtp } from "./permissoes/dtp.js";
import { regras as catalogos } from "./permissoes/catalogos.js";
import { regras as listas } from "./permissoes/listas.js";
import { regras as utilizadores } from "./permissoes/utilizadores.js";
import { regras as auditoria } from "./permissoes/auditoria.js";
import { regras as site } from "./permissoes/site.js";
import { regras as configuracoes } from "./permissoes/configuracoes.js";
import { regras as assinaturas } from "./permissoes/assinaturas.js";

export type { Perfil } from "./permissoes/perfis.js";

/** Primeira linha que corresponde ganha. `*` no fim do padrão apanha o resto do caminho. */
export const REGRAS: Regra[] = [
  ...assinaturas,
  ...sistema,
  ...emails,
  ...pagamentos,
  ...cursos,
  ...campanhas,
  ...blog,
  ...formadores,
  ...crm,
  ...turmas,
  ...pedagogia,
  ...comum,
  ...painel,
  ...formandos,
  ...inqueritos,
  ...despesas,
  ...dtp,
  ...catalogos,
  ...listas,
  ...utilizadores,
  ...auditoria,
  ...site,
  ...configuracoes,
];

/** Áreas que o formador nunca lê. */
const FORMADOR_SEM_LEITURA = [
  "/v1/crm*", "/v1/dashboard*", "/v1/settings*", "/v1/users*", "/v1/email*", "/v1/equipa*",
  "/v1/dtp*", "/v1/alertas*", "/v1/turma-regras*", "/v1/drive/status", "/v1/pagamentos*",
  "/v1/formandos/*", "/v1/inqueritos/*",
  "/v1/turmas/:regime/:id/dossie/*", "/v1/turmas/:regime/:id/relatorio-*", "/v1/turmas/:regime/:id/inqueritos/*",
  "/v1/painel*", "/v1/despesas*", "/v1/auditoria*", "/v1/assinaturas*", "/v1/sistema*", "/v1/utilizadores*", "/v1/campanhas*", "/v1/formandos*",
  "/v1/catalogos*", "/v1/catalog*", "/v1/cursos*", "/v1/listas*", "/v1/site*",
];

function corresponde(path: string, padrao: string): boolean {
  const prefixo = padrao.endsWith("*");
  const pp = (prefixo ? padrao.slice(0, -1) : padrao).split("/").filter(Boolean);
  const ps = path.split("/").filter(Boolean);
  if (prefixo) {
    // "/v1/blog*" apanha "/v1/blog" e "/v1/blog/…"; "/v1/x/*" exige pelo menos um segmento.
    const exigeMais = padrao.endsWith("/*");
    if (ps.length < pp.length + (exigeMais ? 1 : 0)) return false;
  } else if (pp.length !== ps.length) {
    return false;
  }
  for (let i = 0; i < pp.length; i++) {
    const a = pp[i]!;
    const b = ps[i]!;
    if (a.startsWith(":")) continue;
    if (prefixo && i === pp.length - 1 && !padrao.endsWith("/*")) {
      if (!b.startsWith(a)) return false;
      continue;
    }
    if (a !== b) return false;
  }
  return true;
}

export function perfisDaRegra(method: string, path: string): Perfil[] | null {
  const m = method.toUpperCase();
  for (const [rm, padrao, perfis] of REGRAS) {
    if ((rm === "*" || rm === m || (rm === "GET" && m === "HEAD")) && corresponde(path, padrao)) return perfis;
  }
  return null;
}

/** Regime que o caminho indica: um segmento `gold`/`fin` ou terminado em `-gold`/`-fin` (`/v1/turmas-fin/3`). */
export function regimeDoCaminho(path: string): "gold" | "fin" | null {
  for (const s of path.split("/")) {
    if (s === "gold" || s.endsWith("-gold")) return "gold";
    if (s === "fin" || s.endsWith("-fin")) return "fin";
  }
  return null;
}

/** Decide se um perfil da equipa pode chamar uma rota staff. */
export function podeAceder(role: string, method: string, rawPath: string): boolean {
  const path = rawPath.split("?")[0] ?? rawPath;
  // Gold e Financiada nunca se misturam: quem só trabalha num regime não chega a rotas do outro.
  // O formador fica de fora desta regra: trabalha nos dois e os handlers limitam-no às suas turmas.
  const regime = regimeDoCaminho(path);
  if (regime && role !== "formador" && !(regime === "gold" ? GOLD : FIN).includes(role as Perfil)) return false;
  const perfis = perfisDaRegra(method, path);
  if (perfis) return perfis.includes(role as Perfil);
  const leitura = method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";
  if (role === "formador") {
    return leitura && !FORMADOR_SEM_LEITURA.some(p => corresponde(path, p));
  }
  return EQUIPA.includes(role as Perfil);
}
