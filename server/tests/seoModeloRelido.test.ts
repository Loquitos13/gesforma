// Numa VPS o site reconstrói-se com a API a correr: o app.html novo tem de ser o que se serve (o antigo aponta para
// ficheiros que o build apagou, e a página ficava em branco).
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { definirModeloHtml, indexHtml } from "../src/seo.js";

const dir = join(process.cwd(), "dist");
const ficheiro = join(dir, "app.html");

describe("modelo HTML do site", () => {
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); definirModeloHtml(null); });

  it("relê o dist/app.html quando o site é reconstruído", async () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(ficheiro, '<div id="root"></div><script src="/assets/index-ANTIGO.js"></script>');
    definirModeloHtml(null);
    expect(await indexHtml()).toContain("index-ANTIGO.js");
    writeFileSync(ficheiro, '<div id="root"></div><script src="/assets/index-NOVO.js"></script>');
    const futuro = new Date(Date.now() + 5000);
    utimesSync(ficheiro, futuro, futuro);
    expect(await indexHtml()).toContain("index-NOVO.js");
  });
});
