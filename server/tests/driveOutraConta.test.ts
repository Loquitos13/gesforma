import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureFolderPath, pastaExiste } from "../src/googleDrive.js";
import { esquecerPastasDrive } from "../src/repos/drive.js";
import { arrancar } from "./helpers.js";

afterEach(() => { vi.unstubAllGlobals(); });

const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

describe("Drive ligada a outra conta Google", () => {
  it("pastaExiste: não existe (404) ou no lixo → false; existe ou erro que não é «não existe» → true", async () => {
    const respostas = [
      resposta(404, { error: { message: "File not found: abc." } }),
      resposta(200, { id: "abc", trashed: true }),
      resposta(200, { id: "abc", trashed: false }),
      resposta(500, { error: { message: "Backend Error" } }),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => respostas.shift()!));
    expect(await pastaExiste("t", "abc")).toBe(false);
    expect(await pastaExiste("t", "abc")).toBe(false);
    expect(await pastaExiste("t", "abc")).toBe(true);
    expect(await pastaExiste("t", "abc")).toBe(true);
    expect(await pastaExiste("t", "")).toBe(false);
  });

  it("esquecerPastasDrive limpa as pastas guardadas (pré-inscrições, turmas, formadores)", async () => {
    const ctx = await arrancar();
    await ctx.db.query("UPDATE preinscricoes SET drive_pasta_id = 'velha', drive_pasta_parent_id = 'pai'");
    await ctx.db.query("UPDATE formadores SET drive_pasta_id = 'velha'");
    await esquecerPastasDrive(ctx.db);
    const n = async (sql: string) => Number((await ctx.db.query<{ n: number }>(sql)).rows[0]!.n);
    expect(await n("SELECT count(*)::int AS n FROM preinscricoes WHERE drive_pasta_id <> ''")).toBe(0);
    expect(await n("SELECT count(*)::int AS n FROM formadores WHERE drive_pasta_id <> ''")).toBe(0);
  });

  it("raiz fixada de outra conta (não existe na ligada): cria a raiz na conta ligada em vez de dar «File not found»", async () => {
    const ctx = await arrancar();
    const pedidos: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const metodo = (init?.method ?? "GET").toUpperCase();
      pedidos.push(`${metodo} ${url}`);
      if (url.includes("/files/velha")) return resposta(404, { error: { message: "File not found: velha." } });
      if (metodo === "POST") return resposta(200, { id: "nova-raiz" });
      return resposta(200, { files: [] });
    }));
    expect(await ensureFolderPath(ctx.db, "t", ["GesForma"], "velha")).toBe("nova-raiz");
    expect(pedidos.some(p => p.startsWith("POST") && !p.includes("velha"))).toBe(true);
  });
});
