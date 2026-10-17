// Depois do build: dist/index.html passa a dist/app.html. Sem um index.html estático, a Vercel envia também «/»
// para a função de SEO (vercel.json), que serve cada página com o seu título, descrição e dados estruturados.
import { existsSync, renameSync } from "node:fs";

if (existsSync("dist/index.html")) renameSync("dist/index.html", "dist/app.html");
