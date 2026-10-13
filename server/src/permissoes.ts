/**
 * Matriz central de permissões das rotas do GesForma (classe "staff").
 * Aplicada no preHandler depois de `classifyRoute`. As verificações finas
 * (o formador só mexe nas suas turmas, por exemplo) continuam no handler.
 *
 * Regras por omissão, quando nenhuma linha da tabela corresponde:
 * - formador: só leitura, e nunca nas áreas de `FORMADOR_SEM_LEITURA`;
 * - restantes perfis da equipa: leitura e escrita.
 */

export type Perfil = "admin" | "secretaria" | "comercial" | "financiada" | "formador" | "formando";

const ADMIN: Perfil[] = ["admin"];
const SECRETARIA: Perfil[] = ["admin", "secretaria"];
/** Secretaria Gold e equipa pedagógica da Financiada. */
const PEDAGOGIA: Perfil[] = ["admin", "secretaria", "financiada"];
const EQUIPA: Perfil[] = ["admin", "secretaria", "financiada", "comercial"];
const COM_FORMADOR: Perfil[] = ["admin", "secretaria", "financiada", "comercial", "formador"];
const PEDAGOGIA_E_FORMADOR: Perfil[] = ["admin", "secretaria", "financiada", "formador"];
const MARKETING: Perfil[] = ["admin", "secretaria", "comercial"];

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
type Regra = [Metodo, string, Perfil[]];

/** Primeira linha que corresponde ganha. `*` no fim do padrão apanha o resto do caminho. */
export const REGRAS: Regra[] = [
  // Integrações e configuração do sistema.
  ["*", "/v1/drive/config", ADMIN],
  ["*", "/v1/drive/disconnect", ADMIN],
  ["GET", "/v1/drive/oauth/start", ADMIN],
  ["*", "/v1/crm/whatsapp/config", ADMIN],
  ["*", "/v1/crm/whatsapp/desligar", ADMIN],
  ["*", "/v1/auth/microsoft/config", ADMIN],
  ["*", "/v1/auth/microsoft/disconnect", ADMIN],
  ["*", "/v1/settings/smtp*", ADMIN],
  ["*", "/v1/users*", ADMIN],
  ["PUT", "/v1/settings/:id", SECRETARIA],
  ["GET", "/v1/settings", EQUIPA],
  ["POST", "/v1/site/hero/:slot/imagem", ADMIN],

  // Emails automáticos.
  ["GET", "/v1/email/*", SECRETARIA],
  ["*", "/v1/email/*", SECRETARIA],
  ["POST", "/v1/events", COM_FORMADOR],

  // Financeiro.
  ["*", "/v1/pagamentos*", SECRETARIA],

  // Oferta e regras de abertura de turmas.
  ["POST", "/v1/cursos-gold", MARKETING],
  ["PATCH", "/v1/cursos-gold/:id", MARKETING],
  ["DELETE", "/v1/cursos-gold/:id", SECRETARIA],
  ["*", "/v1/cursos-fin*", PEDAGOGIA],
  ["*", "/v1/turma-regras*", PEDAGOGIA],
  ["POST", "/v1/turmas/auto-regras", PEDAGOGIA],
  ["PUT", "/v1/cursos/:regime/:id/dtp-modelo", PEDAGOGIA],
  ["*", "/v1/dtp/gold/entidades*", PEDAGOGIA],

  // Marketing.
  ["*", "/v1/campanhas*", MARKETING],
  ["*", "/v1/blog*", MARKETING],

  // Formadores: criar e apagar cria/encerra contas de acesso.
  ["POST", "/v1/formadores", PEDAGOGIA],
  ["DELETE", "/v1/formadores/:id", PEDAGOGIA],
  ["PATCH", "/v1/formadores/:id", [...PEDAGOGIA_E_FORMADOR, "comercial"]],
  ["PUT", "/v1/formadores/:id/docs", PEDAGOGIA_E_FORMADOR],

  // CRM: documentos e remoção de leads.
  ["DELETE", "/v1/preinscricoes/:id", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/documentos/:docId/validar", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/documentos/:docId/recusar", PEDAGOGIA],
  ["DELETE", "/v1/crm/etiquetas/:id", SECRETARIA],
  ["DELETE", "/v1/crm/clientes/:id", SECRETARIA],
  ["DELETE", "/v1/crm/parceiros/:id", SECRETARIA],

  // Turmas: o formador só marca início/fim das suas sessões (verificado no handler).
  ["PATCH", "/v1/turmas-gold/:id", COM_FORMADOR],
  ["PATCH", "/v1/turmas-fin/:id", PEDAGOGIA_E_FORMADOR],
  ["*", "/v1/turmas-fin*", PEDAGOGIA],
  ["*", "/v1/formandos-fin*", PEDAGOGIA],

  // Pedagogia da turma.
  ["PUT", "/v1/turmas/:regime/:id/sessoes/:n", PEDAGOGIA_E_FORMADOR],
  ["PUT", "/v1/turmas/:regime/:id/avaliacao", PEDAGOGIA_E_FORMADOR],
  ["PUT", "/v1/turmas/:regime/:id/certificados/:formandoId", PEDAGOGIA],
  ["PUT", "/v1/turmas/:regime/:id/documentos", PEDAGOGIA],
  ["POST", "/v1/turmas/:regime/:id/cronograma/publicar", PEDAGOGIA],
  ["*", "/v1/turmas/:regime/:id/dtp/*", PEDAGOGIA],
  ["POST", "/v1/turmas/:regime/:id/fecho", PEDAGOGIA],
  ["POST", "/v1/turmas/:regime/:id/reabrir", ADMIN],
  ["POST", "/v1/turmas/:regime/:id/inqueritos/enviar", PEDAGOGIA],
  ["POST", "/v1/inqueritos/:id/respostas", PEDAGOGIA],

  // Leitura e escrita que o formador faz na sua área.
  ["POST", "/v1/notificacoes/lidas", COM_FORMADOR],
  ["POST", "/v1/drive/files", COM_FORMADOR],
  ["GET", "/v1/dashboard", EQUIPA],
];

/** Áreas que o formador nunca lê. */
const FORMADOR_SEM_LEITURA = [
  "/v1/crm*", "/v1/dashboard*", "/v1/settings*", "/v1/users*", "/v1/email*", "/v1/equipa*",
  "/v1/dtp*", "/v1/alertas*", "/v1/turma-regras*", "/v1/drive/status", "/v1/pagamentos*",
  "/v1/formandos/*", "/v1/inqueritos/*",
  "/v1/turmas/:regime/:id/dossie/*", "/v1/turmas/:regime/:id/relatorio-*", "/v1/turmas/:regime/:id/inqueritos/*",
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

/** Decide se um perfil da equipa pode chamar uma rota staff. */
export function podeAceder(role: string, method: string, rawPath: string): boolean {
  const path = rawPath.split("?")[0] ?? rawPath;
  const perfis = perfisDaRegra(method, path);
  if (perfis) return perfis.includes(role as Perfil);
  const leitura = method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";
  if (role === "formador") {
    return leitura && !FORMADOR_SEM_LEITURA.some(p => corresponde(path, p));
  }
  return EQUIPA.includes(role as Perfil);
}
