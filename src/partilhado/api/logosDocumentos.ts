// Logótipos do rodapé dos documentos da Financiada: o da DGERT (Configurações › Entidade) e o de cada programa.
import { api, BASE, enviar, enviarFicheiro } from "./cliente";

export type LogoDocumento = { nome: string; mime: string; versao: string; actualizado: string; tamanho: number };

/** Onde se lê, carrega e apaga cada logótipo, e o endereço público da imagem. */
export type DestinoLogo = { api: string; imagem: string };

export const LOGO_DGERT: DestinoLogo = { api: "/v1/configuracoes/logo-dgert", imagem: "/v1/public/logos/dgert" };
export const logoPrograma = (id: number): DestinoLogo => ({ api: `/v1/catalogos/programas/${id}/logo`, imagem: `/v1/public/logos/programa/${id}` });

export const apiLogoDocumento = (d: DestinoLogo, signal?: AbortSignal) => api<{ logo: LogoDocumento | null }>(d.api, { signal });
export const apiCarregarLogoDocumento = (d: DestinoLogo, ficheiro: File) => enviarFicheiro<{ logo: LogoDocumento }>(d.api, ficheiro);
export const apiApagarLogoDocumento = (d: DestinoLogo) => enviar.delete<{ ok: true }>(d.api);

export function urlLogoDocumento(d: DestinoLogo, versao: string) {
  const base = /^https?:\/\//i.test(BASE) ? BASE.replace(/\/$/, "") : `${window.location.origin}${BASE.replace(/\/$/, "")}`;
  return `${base}${d.imagem}?v=${encodeURIComponent(versao)}`;
}
