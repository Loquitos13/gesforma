// Monta o payload de um deployment na Vercel sem integração git.
//
// O upload da API só aceita ficheiros pequenos, por isso os ficheiros grandes
// viajam em pedaços de 12 kB e os alterados numa ronda num blob brotli. Só é
// preciso enviar o que a Vercel ainda não tem: o resto é referenciado por SHA.
import { createHash } from "node:crypto";
import { brotliCompressSync, constants } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const CHUNK = 12000;

// Ficheiros que o deployment anterior enviou em pedaços: manter o mesmo corte
// para reaproveitar o que já está no armazenamento da Vercel.
const CHUNKED = [
  "src/ActionSurfaces.tsx",
  "src/App.tsx",
  "src/CatalogViews.tsx",
  "src/CursoFichaView.tsx",
  "src/FormKit.tsx",
  "src/TurmaExtras.tsx",
  "src/UsersView.tsx",
  "src/api.ts",
  "server/src/app.ts",
  "server/src/opsRoutes.ts",
  "server/src/pedagogiaRoutes.ts",
  "server/src/db/opsSeed.ts",
];

// Ficheiros alterados nesta ronda: vão num blob comprimido só deles.
const PATCHED = [
  "src/App.tsx",
  "src/TurmaExtras.tsx",
  "src/ActionSurfaces.tsx",
  "src/api.ts",
  "src/CatalogViews.tsx",
  "src/FormandoFicha.tsx",
  "src/ListsContext.tsx",
  "src/main.tsx",
  "server/src/pedagogiaRoutes.ts",
  "server/src/opsRoutes.ts",
  "server/src/ops.ts",
  "server/src/config.ts",
];

const SKIP = new Set([
  "README.md",
  "package-lock.json",
  "server/package-lock.json",
  "imagens/ena-logo-nobg.png",
  "public/imagens/ena-logo-nobg.png",
  "backups/.gitkeep",
  ".gitignore",
  "vercel.json",
  "scripts/deploy-manifest.mjs",
  "scripts/deploy-payload.mjs",
]);

// Já presentes no armazenamento da Vercel com o conteúdo que queremos.
const PRESET = [
  { file: ".gitignore", sha: "fe012497bcce575902f4891d43d595c351583b0c", size: 120 },
  { file: "vercel.json", sha: "567d3451868644d1e54603b9e1db788829b0d3a9", size: 542 },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".vercel" || entry === "data") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const tracked = [
  ".env.example",
  "api/index.ts",
  "docker-compose.yml",
  "imagens/ena_logo.svg",
  "public/imagens/ena_logo.svg",
  "index.html",
  "package.json",
  "scripts/backup.sh",
  "server/.dockerignore",
  "server/Dockerfile",
  "server/package.json",
  "server/tsconfig.json",
  "tsconfig.json",
  "vite.config.ts",
  ...walk("src"),
  ...walk("server/src"),
].filter(f => !SKIP.has(f));

const sha1 = buf => createHash("sha1").update(buf).digest("hex");
const files = [...PRESET];
const uploads = [];
const manifest = [];

const add = (file, buf) => {
  const sha = sha1(buf);
  files.push({ file, sha, size: buf.length });
  return sha;
};

for (const file of tracked) {
  if (PATCHED.includes(file)) continue;
  const buf = readFileSync(file);
  if (!CHUNKED.includes(file)) {
    add(file, buf);
    continue;
  }
  const parts = [];
  for (let i = 0, n = 1; i < buf.length; i += CHUNK, n++) {
    const name = `.deploy-parts/${file}.${String(n).padStart(3, "0")}`;
    add(name, buf.subarray(i, i + CHUNK));
    parts.push(name);
  }
  manifest.push({ dest: file, parts });
}

// O blob do patch também viaja partido: um upload de 20 kB não passa no
// limite de argumento da ferramenta. O assemble-parts reconstrói o manifesto
// antes de ler o patch, por isso chega registá-lo como mais um ficheiro.
const patchJson = Buffer.from(JSON.stringify(Object.fromEntries(PATCHED.map(f => [f, readFileSync(f, "utf8")]))));
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

const assembleBuf = readFileSync("scripts/assemble-parts.mjs");
uploads.push({ file: "scripts/assemble-parts.mjs", sha: add("scripts/assemble-parts.mjs", assembleBuf), buf: assembleBuf });

mkdirSync("/tmp/deploy", { recursive: true });
writeFileSync("/tmp/deploy/files.json", JSON.stringify(files));
for (const u of uploads) {
  writeFileSync(`/tmp/deploy/${u.sha}.b64`, u.buf.toString("base64"));
}
writeFileSync("/tmp/deploy/uploads.json", JSON.stringify(uploads.map(u => ({ file: u.file, sha: u.sha, size: u.buf.length }))));
console.log(files.length, "files;", uploads.length, "novos:", uploads.map(u => `${u.file} (${u.buf.length}b)`).join(", "));
