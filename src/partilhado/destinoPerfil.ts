/** Para onde a sessão vai depois de entrar. */
export function destinoDoPerfil(role: string) {
  if (role === "formando") return "/area-formando";
  if (role === "formador") return "/gesforma/formador/turmas";
  if (role === "financiada") return "/gesforma/financiada";
  return "/gesforma/gold";
}
