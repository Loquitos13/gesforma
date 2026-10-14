// Depois de um deploy, os ficheiros da versão anterior deixam de existir: um separador que ficou aberto
// falha ao abrir um ecrã ainda não carregado. Recarrega-se a página uma vez para apanhar a versão nova.

const CHAVE = "gf-recarregou-versao";
const FALHA_DE_FICHEIRO = /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload|ChunkLoadError|Loading chunk/i;

/** Recarrega se o erro for de um ficheiro da versão anterior (no máximo uma vez por minuto). Devolve se recarregou. */
export function recarregarSeVersaoNova(erro: unknown) {
  const msg = erro instanceof Error ? erro.message : String(erro ?? "");
  if (!FALHA_DE_FICHEIRO.test(msg)) return false;
  let ultima = 0;
  try { ultima = Number(sessionStorage.getItem(CHAVE) ?? 0); } catch { /* sem armazenamento */ }
  if (Date.now() - ultima < 60_000) return false;
  try { sessionStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem armazenamento */ }
  window.location.reload();
  return true;
}
