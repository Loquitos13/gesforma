// Envia o payload de scripts/deploy-payload.mjs para o projeto gesforma.
//
//   node scripts/deploy-payload.mjs
//   VERCEL_TOKEN=... node scripts/enviar-vercel.mjs
//
// O payload é lido de DEPLOY_DIR, de .deploy-payload ou de /tmp/deploy.
//
// O token é o da conta Vercel com acesso à equipa Beringela Software.
// Não grava o token em lado nenhum.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID || "team_MUNJdpkukDLfpdBkWMeNHyZf";
const project = process.env.VERCEL_PROJECT_ID || "prj_tlMmfQdsEAWtWO7NeCamOBCfKQ5y";
if (!token) {
  console.error("Falta VERCEL_TOKEN. Gere o payload com node scripts/deploy-payload.mjs e volte a correr este script.");
  process.exit(1);
}

const deployDir = [process.env.DEPLOY_DIR, join(process.cwd(), ".deploy-payload"), "/tmp/deploy"]
  .filter(Boolean)
  .find((dir) => existsSync(join(dir, "uploads.json")));
if (!deployDir) {
  console.error("Não encontrei uploads.json. Corre primeiro: node scripts/deploy-payload.mjs");
  process.exit(1);
}

const uploads = JSON.parse(readFileSync(join(deployDir, "uploads.json"), "utf8"));
const files = JSON.parse(readFileSync(join(deployDir, "files.json"), "utf8"));

for (const item of uploads) {
  const body = Buffer.from(readFileSync(join(deployDir, `${item.sha}.b64`), "utf8"), "base64");
  const res = await fetch(`https://api.vercel.com/v2/files?teamId=${teamId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Length": String(body.length),
      "x-vercel-digest": item.sha,
    },
    body,
  });
  if (!res.ok && res.status !== 200) {
    const text = await res.text();
    throw new Error(`upload ${item.file} ${res.status} ${text}`);
  }
  console.log("ok", item.file);
}

const created = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}&forceNew=1&skipAutoDetectionConfirmation=1`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "gesforma",
    project,
    target: "production",
    files,
  }),
});
const payload = await created.json();
if (!created.ok) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}
console.log(payload.url || payload.id);
