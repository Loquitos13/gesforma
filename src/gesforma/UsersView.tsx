// Perfis de acesso do GesForma (os mesmos do servidor: server/src/repos/utilizadores.ts → PERFIS).
// O ecrã de utilizadores está em vistas/sistema/Utilizadores.tsx.
import type { StaffRole } from "../partilhado/api";

export const STAFF_ROLES: { value: StaffRole; label: string; hint: string }[] = [
  { value: "admin", label: "Administração", hint: "Gere utilizadores, integrações, configurações e tudo o resto." },
  { value: "secretaria", label: "Secretaria", hint: "Acesso geral à secretaria Gold e Financiada, pagamentos e emails." },
  { value: "comercial", label: "Comercial Gold", hint: "Pré-inscrições, campanhas e turmas Gold." },
  { value: "financiada", label: "Secretaria Financiada", hint: "Inscrições, elegibilidade, UFCD e dossiês da Financiada." },
  { value: "formador", label: "Formador", hint: "Vê as turmas em que está atribuído, o calendário, os documentos e o perfil." },
  { value: "formando", label: "Formando", hint: "Entra na área do formando, não no GesForma." },
];

export function roleLabel(role: string) {
  return STAFF_ROLES.find(r => r.value === role)?.label ?? role;
}
