// Monta o payload de um deployment na Vercel sem integração git.
//
// O upload da API só aceita ficheiros pequenos, por isso os ficheiros grandes
// viajam em pedaços de 12 kB e o código-fonte vai num blob brotli. Só é
// preciso enviar o que a Vercel ainda não tem: o resto é referenciado por SHA.
import { createHash } from "node:crypto";
import { brotliCompressSync, constants } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const CHUNK = 4000;

const SKIP = new Set([
  "README.md",
  "imagens/ena-logo-nobg.png",
  "public/imagens/ena-logo-nobg.png",
  "backups/.gitkeep",
  "docker-compose.yml",
  "scripts/deploy-manifest.mjs",
  "scripts/deploy-payload.mjs",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".vercel" || entry === "data") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const installFiles = [
  ".gitignore",
  "vercel.json",
  "package.json",
  "server/package.json",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "server/tsconfig.json",
  "scripts/assemble-parts.mjs",
  "api/index.ts",
];

const patched = [
  ".env.example",
  "imagens/ena_logo.svg",
  "public/imagens/ena_logo.svg",
  "scripts/backup.sh",
  "server/.dockerignore",
  "server/Dockerfile",
  ...walk("src"),
  ...walk("server/src"),
].filter((f) => !SKIP.has(f) && !installFiles.includes(f));

const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");
const files = [];
const uploads = [];
const manifest = [];

const add = (file, buf) => {
  const sha = sha1(buf);
  files.push({ file, sha, size: buf.length });
  return sha;
};

const chunkAndUpload = (file, buf) => {
  if (buf.length <= CHUNK) {
    uploads.push({ file, sha: add(file, buf), buf });
    return;
  }
  const parts = [];
  for (let i = 0, n = 1; i < buf.length; i += CHUNK, n++) {
    const name = `.deploy-parts/${file}.${String(n).padStart(3, "0")}`;
    const slice = buf.subarray(i, i + CHUNK);
    uploads.push({ file: name, sha: add(name, slice), buf: slice });
    parts.push(name);
  }
  manifest.push({ dest: file, parts });
};

for (const file of installFiles) {
  chunkAndUpload(file, readFileSync(file));
}

const patchJson = Buffer.from(JSON.stringify(Object.fromEntries(patched.map((f) => [f, readFileSync(f, "utf8")]))));
const patchBuf = brotliCompressSync(patchJson, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: patchJson.length },
});
const patchParts = [];
for (let i = 0, n = 1; i < patchBuf.length; i += CHUNK, n++) {
  const name = `.deploy-parts/patch.br.${String(n).padStart(3, "0")}`;
  const buf = patchBuf.subarray(i, i + CHUNK);
  uploads.push({ file: name, sha: add(name, buf), buf });
  patchParts.push(name);
}
manifest.push({ dest: ".deploy-parts/patch.br", parts: patchParts });

const manifestBuf = Buffer.from(JSON.stringify(manifest));
uploads.push({ file: ".deploy-parts/manifest.json", sha: add(".deploy-parts/manifest.json", manifestBuf), buf: manifestBuf });

mkdirSync("/tmp/deploy", { recursive: true });
writeFileSync("/tmp/deploy/files.json", JSON.stringify(files));
for (const u of uploads) {
  writeFileSync(`/tmp/deploy/${u.sha}.b64`, u.buf.toString("base64"));
}
writeFileSync("/tmp/deploy/uploads.json", JSON.stringify(uploads.map((u) => ({ file: u.file, sha: u.sha, size: u.buf.length }))));
console.log(files.length, "files;", uploads.length, "uploads; patch", patchBuf.length, "b; patched", patched.length);
for (const u of uploads) console.log(`  ${u.file} ${u.buf.length}`);
