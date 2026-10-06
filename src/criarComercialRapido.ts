import { apiCreateUser } from "./api";
import { gerarPalavraPasse } from "./passwordPolicy";

export async function criarComercialRapido(): Promise<{ id: string; name: string } | null> {
  const name = window.prompt("Nome do comercial");
  if (!name || name.trim().length < 2) return null;
  const email = window.prompt("Email do comercial");
  if (!email?.trim()) return null;
  const password = gerarPalavraPasse();
  try {
    const r = await apiCreateUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role: "comercial",
      mustChangePassword: true,
    });
    window.alert(`Comercial criado. A palavra-passe temporária é ${password}. No primeiro acesso a plataforma pede uma nova.`);
    return { id: r.user.id, name: r.user.name };
  } catch (e) {
    window.alert(e instanceof Error ? e.message : "Não foi possível criar o comercial.");
    return null;
  }
}
