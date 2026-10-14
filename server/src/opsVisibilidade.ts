/** Chaves de definições que nunca saem do servidor, excepto para o administrador. */
const SEGREDO = /(webhook|token|secret|segredo|password|senha|apikey|api_key|chave)/i;

export function ehSegredo(chave: string) {
  return SEGREDO.test(chave);
}

export function settingsSemSegredos(settings: Record<string, Record<string, unknown>>) {
  return Object.fromEntries(Object.entries(settings).map(([id, values]) => [
    id,
    Object.fromEntries(Object.entries(values).filter(([k]) => !SEGREDO.test(k))),
  ]));
}
