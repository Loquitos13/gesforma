// Descargas de ficheiros gerados pelo servidor (Excel, PDF) com a sessão do utilizador.
import { ApiError, BASE } from "./cliente";

async function obter(path: string) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", headers: { "X-Gesforma-Client": "web" } });
  if (!res.ok) {
    let msg = "Não foi possível obter o ficheiro.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* corpo sem JSON */ }
    throw new ApiError(res.status, msg);
  }
  const disp = res.headers.get("content-disposition") ?? "";
  const nome = /filename="([^"]+)"/.exec(disp)?.[1] ?? "";
  return { blob: await res.blob(), nome };
}

/** Descarrega para o computador (o nome vem do servidor; `nomeOmissao` se não vier). */
export async function descarregar(path: string, nomeOmissao: string) {
  const { blob, nome } = await obter(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome || nomeOmissao;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Abre um PDF num separador novo (se o browser bloquear, descarrega). */
export async function abrirPdf(path: string, nomeOmissao: string) {
  const { blob, nome } = await obter(path);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = nome || nomeOmissao;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
