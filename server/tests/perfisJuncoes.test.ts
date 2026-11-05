// Perfil personalizado: todas as rotas da equipa, com os 4 perfis e as 11 junções possíveis. Uma junção nunca chega
// a mais do que algum dos seus perfis chega, nem a menos (passar ou ser barrado pelas permissões).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancar, type Ctx } from "./helpers.js";

const PERFIS = ["secretaria", "financiada", "comercial", "contabilidade"] as const;
const JUNCOES = Array.from({ length: 15 }, (_, m) => PERFIS.filter((_, i) => (m + 1) & (1 << i))).filter(c => c.length > 1);
let ctx: Ctx;
const cookies: Record<string, string> = {};

async function sessao(nome: string, role: string, perfis: readonly string[] = []) {
  const { config } = await import("../src/config.js");
  const id = randomUUID();
  await ctx.db.query("INSERT INTO users (id, name, email, password_hash, role, active, perfis) VALUES ($1, $2, $3, 'x', $4, true, $5::text[])",
    [id, nome, `j.${id.slice(0, 8)}@exemplo.pt`, role, `{${perfis.join(",")}}`]);
  const token = randomBytes(24).toString("hex");
  await ctx.db.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
    [randomUUID(), id, createHash("sha256").update(token).digest("hex")]);
  cookies[nome] = `${config.cookieName}=${token}`;
}

beforeAll(async () => {
  ctx = await arrancar();
  for (const p of PERFIS) await sessao(p, p);
  for (const c of JUNCOES) await sessao(c.join("+"), "personalizado", c);
  await ctx.db.query(`INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, estado, regime) VALUES
    (940001, '2031-01-01 10:00', 'Junção', 'G', 'jg@exemplo.pt', '912', 'Formação de Formadores - CCP', '1º Contacto', 'gold'),
    (940002, '2031-01-01 10:00', 'Junção', 'F', 'jf@exemplo.pt', '913', 'Primeiros Socorros', '1º Contacto', 'fin') ON CONFLICT DO NOTHING`);
});

/** Endereços a experimentar: cada rota da equipa, com ids reais quando há (pré-inscrições, turmas, formandos…). */
async function enderecos(metodos: string[]) {
  const { classifyRoute } = await import("../src/routeAuth.js");
  const id = async (sql: string) => String((await ctx.db.query<{ id: unknown }>(sql)).rows[0]?.id ?? "999999");
  const ids = {
    turma: { gold: await id("SELECT id FROM turmas_gold ORDER BY id LIMIT 1"), fin: await id("SELECT id FROM turmas_fin ORDER BY id LIMIT 1") },
    formando: { gold: await id("SELECT id FROM formandos_gold ORDER BY id LIMIT 1"), fin: await id("SELECT id FROM formandos_fin ORDER BY id LIMIT 1") },
    curso: { gold: await id("SELECT id FROM cursos_gold ORDER BY id LIMIT 1"), fin: await id("SELECT id FROM cursos_fin ORDER BY id LIMIT 1") },
    lead: { gold: "940001", fin: "940002" },
  };
  const formador = await id("SELECT id FROM formadores ORDER BY id LIMIT 1");
  const out: [string, string][] = [];
  for (const linha of ctx.app.printRoutes({ commonPrefix: false }).split("\n")) {
    const m = /(\/v1\/\S+) \(([^)]+)\)/.exec(linha);
    if (!m) continue;
    for (const metodo of m[2]!.split(", ").filter(x => metodos.includes(x))) {
      const rota = m[1]!;
      if (classifyRoute(metodo, rota) !== "staff" || /\/cron\/|oauth/.test(rota)) continue;
      const temRegime = rota.includes(":regime") || /-gold|-fin|\/gold\b|\/fin\b/.test(rota);
      for (const r of (rota.includes(":regime") || !temRegime ? ["gold", "fin"] : [/-fin|\/fin\b/.test(rota) ? "fin" : "gold"]) as ("gold" | "fin")[]) {
        let u = rota.replace(":regime", r);
        if (/\/(crm\/leads|preinscricoes)\/:/.test(u)) u = u.replace(/:[a-zA-Z]+/, ids.lead[r]);
        else if (/turmas/.test(u)) u = u.replace(/:[a-zA-Z]+/, ids.turma[r]);
        else if (/formandos/.test(u)) u = u.replace(/:[a-zA-Z]+/, ids.formando[r]);
        else if (/cursos/.test(u)) u = u.replace(/:[a-zA-Z]+/, ids.curso[r]);
        else if (/formadores/.test(u)) u = u.replace(/:[a-zA-Z]+/, formador);
        u = u.replace(/:[a-zA-Z]+/g, "999999");
        out.push([metodo, temRegime ? u : `${u}?regime=${r}`]);
        if (!temRegime && r === "gold") out.push([metodo, u]);
      }
    }
  }
  return [...new Map(out.map(x => [x.join(" "), x])).values()];
}

let ip = 0;
const pedir = (quem: string, metodo: string, url: string) => ctx.app.inject({
  method: metodo as "GET", url, remoteAddress: `10.9.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
  headers: { cookie: cookies[quem]!, "x-gesforma-client": "web", ...(metodo === "GET" ? {} : { "content-type": "application/json" }) },
  ...(metodo === "GET" ? {} : { payload: "{}" }),
});

async function comparar(metodos: string[], passa: (s: number) => boolean) {
  const falhas: string[] = [];
  for (const [metodo, url] of await enderecos(metodos)) {
    const st: Record<string, number> = {};
    for (const p of PERFIS) st[p] = (await pedir(p, metodo, url)).statusCode;
    for (const c of JUNCOES) {
      const s = (await pedir(c.join("+"), metodo, url)).statusCode;
      const algum = c.some(p => passa(st[p]!));
      if (algum !== passa(s)) falhas.push(`${algum ? "MENOS" : "MAIS"} ${c.join("+")} ${metodo} ${url} -> ${s} (${c.map(p => `${p}:${st[p]}`).join(" ")})`);
    }
  }
  return falhas;
}

describe("junções de perfis: nunca mais nem menos do que a soma", () => {
  it("leituras (incluindo exportações)", async () => {
    expect(await comparar(["GET"], s => s >= 200 && s < 300)).toEqual([]);
  }, 600_000);

  it("escritas: passa ou é barrado pelas permissões", async () => {
    expect(await comparar(["POST", "PUT", "PATCH", "DELETE"], s => s !== 401 && s !== 403)).toEqual([]);
  }, 600_000);
});
