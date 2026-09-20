// Reconstrói o código-fonte no build da Vercel.
//
// A API de upload da Vercel só aceita ficheiros pequenos, por isso os ficheiros
// grandes viajam partidos em `.deploy-parts/<caminho>.NNN` e os ficheiros
// alterados em cada ronda viajam num único blob brotli. Este script corre antes
// do build e repõe tudo nos caminhos originais.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { dirname } from "node:path";

const write = (dest, buf) => {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
};

if (existsSync(".deploy-parts/manifest.json")) {
  const manifest = JSON.parse(readFileSync(".deploy-parts/manifest.json", "utf8"));
  for (const { dest, parts } of manifest) {
    write(dest, Buffer.concat(parts.map(p => readFileSync(p))));
  }
  console.log(`assemble-parts: ${manifest.length} ficheiros reconstruídos`);
}

if (existsSync(".deploy-parts/patch.br")) {
  const patch = JSON.parse(brotliDecompressSync(readFileSync(".deploy-parts/patch.br")).toString("utf8"));
  for (const [dest, content] of Object.entries(patch)) write(dest, Buffer.from(content, "utf8"));
  console.log(`assemble-parts: ${Object.keys(patch).length} ficheiros do patch`);
}
