// API do domínio "sistema": avisos de configuração e manutenção (só admin).
import { api, enviar } from "./cliente";

export type AvisoConfiguracao = { variavel: string; nivel: "alto" | "medio"; mensagem: string };

export function apiAvisosSistema(signal?: AbortSignal) {
  return api<{ avisos: AvisoConfiguracao[]; chavesAntigas: number }>("/v1/sistema/avisos", { silencioso: true, signal });
}

export function apiRecifrar() {
  return enviar.post<{ ok: true; total: number; ilegiveis: number; resultado: { tabela: string; coluna: string; recifrados: number; ilegiveis: number }[] }>(
    "/v1/sistema/recifrar",
  );
}
